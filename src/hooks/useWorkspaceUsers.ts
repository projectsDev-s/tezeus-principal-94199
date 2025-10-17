import { useState, useEffect, useRef } from 'react';
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
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!workspaceId) {
      console.warn('⚠️ useWorkspaceUsers: sem workspace ID');
      setUsers([]);
      return;
    }

    // Prevenir chamadas simultâneas
    if (isFetchingRef.current) {
      console.log('⏸️ Fetch já em andamento, ignorando...');
      return;
    }

    let cancelled = false;
    isFetchingRef.current = true;

    const fetchUsers = async () => {
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

        if (cancelled) return;

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

        const filteredUsers = filterProfiles
          ? allUsers.filter(user => filterProfiles.includes(user.profile as 'user' | 'admin' | 'master'))
          : allUsers;

        console.log(`✅ ${filteredUsers.length} usuários carregados`);
        
        if (!cancelled) {
          setUsers(filteredUsers);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('❌ Erro ao carregar usuários:', error);
          setUsers([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          isFetchingRef.current = false;
        }
      }
    };

    fetchUsers();

    return () => {
      cancelled = true;
      isFetchingRef.current = false;
    };
  }, [workspaceId]); // Apenas workspaceId como dependência

  return {
    users,
    isLoading,
    loadUsers: () => {}, // Função vazia para compatibilidade
  };
}
