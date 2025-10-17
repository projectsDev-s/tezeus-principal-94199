import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWorkspaceHeaders } from '@/lib/workspaceHeaders';

interface WorkspaceUser {
  id: string;
  name: string;
  profile: string;
}

export function useWorkspaceUsers(workspaceId?: string, filterProfiles?: ('user' | 'admin' | 'master')[]) {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!workspaceId) {
      console.warn('⚠️ Workspace ID não fornecido');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Buscando usuários do workspace via edge function:', workspaceId);
      
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: { 
          action: 'list',
          workspaceId,
        },
        headers: getWorkspaceHeaders()
      });

      if (error) {
        console.error('❌ Erro ao buscar membros:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('❌ Resposta sem sucesso:', data);
        throw new Error(data?.error || 'Falha ao buscar membros');
      }

      const members = data.members || [];
      console.log(`📋 Encontrados ${members.length} membros do workspace`);

      const allUsers: WorkspaceUser[] = members
        .filter((member: any) => member.user)
        .map((member: any) => ({
          id: member.user.id,
          name: member.user.name,
          profile: member.user.profile
        }));

      console.log(`✅ ${allUsers.length} usuários carregados:`, allUsers.map(u => `${u.name} (${u.profile})`));

      const filteredUsers = filterProfiles
        ? allUsers.filter(user => filterProfiles.includes(user.profile as 'user' | 'admin' | 'master'))
        : allUsers;

      console.log(`🔍 Após filtro (${filterProfiles?.join(', ') || 'sem filtro'}): ${filteredUsers.length} usuários`);
      
      setUsers(filteredUsers);
    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, filterProfiles]);

  useEffect(() => {
    if (workspaceId) {
      console.log('🔄 useWorkspaceUsers: workspace mudou, carregando...', workspaceId);
      loadUsers();
    } else {
      console.warn('⚠️ useWorkspaceUsers: sem workspace ID');
      setUsers([]);
    }
  }, [workspaceId, filterProfiles]);

  return {
    users,
    isLoading,
    loadUsers,
  };
}
