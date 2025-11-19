import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ActiveUser {
  id: string;
  name: string;
  avatar?: string;
  dealCount: number;
  dealIds: string[];
}

export function usePipelineActiveUsers(pipelineId?: string, workspaceId?: string) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const fetchActiveUsers = useCallback(async () => {
    if (!pipelineId || !workspaceId) {
      setActiveUsers([]);
      return;
    }
    
    console.log('🔍 Buscando usuários ativos para pipeline:', pipelineId);
    setIsLoading(true);
    
    try {
      // Buscar membros do workspace via Edge Function
      const { data: membersResponse, error: membersError } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'list',
          workspaceId
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': workspaceId
        }
      });

      if (membersError) {
        console.error('Error fetching workspace members:', membersError);
        return;
      }

      if (!membersResponse?.success) {
        console.error('Failed to fetch workspace members:', membersResponse);
        return;
      }

      const members = membersResponse.members || [];
      const allUsers = members
        .filter((member: any) => member.user)
        .map((member: any) => member.user);
      
      console.log(`👥 Encontrados ${allUsers.length} usuários do workspace`);

      const currentUser = allUsers.find((u: any) => u.email === user?.email);

      if (!currentUser) {
        console.error('Current user not found');
        return;
      }

      // ✅ Buscar todos os cards do pipeline (RLS já gerencia permissões)
      const { data: cards, error: cardsError } = await supabase
        .from('pipeline_cards')
        .select(`
          id,
          title,
          responsible_user_id,
          conversation_id,
          conversations(
            id,
            status,
            assigned_user_id
          )
        `)
        .eq('pipeline_id', pipelineId);

      if (cardsError) {
        console.error('Error fetching cards:', cardsError);
        return;
      }

      console.log('📊 Cards encontrados:', cards?.length);

      // Coletar IDs de usuários responsáveis
      const userIds = new Set<string>();
      
      cards?.forEach((card: any) => {
        // Adicionar responsible_user_id se existir
        if (card.responsible_user_id) {
          userIds.add(card.responsible_user_id);
        }
        // Adicionar assigned_user_id da conversa se existir
        if (card.conversations?.assigned_user_id) {
          userIds.add(card.conversations.assigned_user_id);
        }
      });

      console.log('👥 IDs de usuários únicos:', Array.from(userIds));

      if (userIds.size === 0) {
        console.log('ℹ️ Nenhum usuário ativo encontrado');
        setActiveUsers([]);
        return;
      }

      // Filtrar usuários pelos IDs necessários
      const users = allUsers.filter((user: any) => userIds.has(user.id));
      console.log('✅ Usuários filtrados:', users.map((u: any) => u.name));

      // Agrupar por usuário (contar quantos cards cada um tem)
      const userMap = new Map<string, ActiveUser>();
      
      cards?.forEach((card: any) => {
        // Priorizar responsible_user_id sobre assigned_user_id
        const userId = card.responsible_user_id || card.conversations?.assigned_user_id;
        
        if (userId) {
          const user = users?.find(u => u.id === userId);
          if (user) {
            if (userMap.has(userId)) {
              const existingUser = userMap.get(userId)!;
              existingUser.dealCount += 1;
              existingUser.dealIds.push(card.id);
            } else {
              userMap.set(userId, {
                id: userId,
                name: user.name,
                avatar: user.avatar,
                dealCount: 1,
                dealIds: [card.id]
              });
            }
          }
        }
      });

      const activeUsersList = Array.from(userMap.values());
      console.log('🎯 Usuários ativos finais:', activeUsersList.map(u => `${u.name} (${u.dealCount})`));
      
      setActiveUsers(activeUsersList);
    } catch (error) {
      console.error('Error fetching active users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pipelineId, workspaceId, user?.email]);

  useEffect(() => {
    fetchActiveUsers();
  }, [fetchActiveUsers]);

  // Função para forçar atualização manual
  const refreshActiveUsers = useCallback(() => {
    console.log('🔄 Forçando refresh de usuários ativos...');
    fetchActiveUsers();
  }, [fetchActiveUsers]);

  return { activeUsers, isLoading, refreshActiveUsers };
}