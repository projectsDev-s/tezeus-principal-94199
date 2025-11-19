import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWorkspaceHeaders } from '@/lib/workspaceHeaders';

interface WorkspaceUser {
  id: string;
  name: string;
  profile: string;
  avatar?: string;
}

export function useWorkspaceUsers(workspaceId?: string, filterProfiles?: ('user' | 'admin' | 'master')[]) {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 500; // ms

  // Usar comparação profunda para filterProfiles
  const filterProfilesKey = JSON.stringify(filterProfiles);

  useEffect(() => {
    // Determinar o workspace efetivo: prop > localStorage
    let effectiveWorkspaceId = workspaceId;

    if (!effectiveWorkspaceId) {
      const storedWorkspace = localStorage.getItem('selectedWorkspace');
      if (storedWorkspace) {
        try {
          const parsed = JSON.parse(storedWorkspace);
          effectiveWorkspaceId = parsed?.workspace_id;
        } catch (e) {
          console.error('❌ [useWorkspaceUsers] Erro ao ler selectedWorkspace do localStorage:', e);
        }
      }
    }

    console.log('🔍 [useWorkspaceUsers] useEffect triggered:', { 
      workspaceIdProp: workspaceId, 
      effectiveWorkspaceId,
      filterProfiles,
      hasWorkspaceId: !!effectiveWorkspaceId
    });
    
    if (!effectiveWorkspaceId) {
      console.warn('⚠️ useWorkspaceUsers: sem workspace ID efetivo');
      setUsers([]);
      return;
    }

    // Prevenir chamadas simultâneas
    if (isFetchingRef.current) {
      console.log('⏸️ Fetch já em andamento, ignorando...');
      return;
    }

    // Proteção anti-loop: evitar requisições muito rápidas
    const now = Date.now();
    if (now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      console.log('⏸️ Requisição muito rápida, aguardando...');
      return;
    }
    lastFetchTime.current = now;

    let cancelled = false;
    isFetchingRef.current = true;

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        console.log('🔄 Buscando usuários do workspace via edge function:', effectiveWorkspaceId);
        
        const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
          body: { 
            action: 'list',
            workspaceId: effectiveWorkspaceId,
          },
          headers: getWorkspaceHeaders(effectiveWorkspaceId)
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
            profile: member.user.profile,
            avatar: member.user.avatar
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
  }, [workspaceId, filterProfilesKey]); // Usar string serializada para comparação profunda

  return {
    users,
    isLoading,
  };
}
