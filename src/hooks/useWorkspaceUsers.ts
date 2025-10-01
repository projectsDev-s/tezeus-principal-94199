import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkspaceUser {
  id: string;
  name: string;
  profile: string;
}

export function useWorkspaceUsers(workspaceId?: string, filterProfiles?: ('user' | 'admin' | 'master')[]) {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      loadUsers();
    }
  }, [workspaceId]);

  const loadUsers = async () => {
    if (!workspaceId) {
      console.warn('⚠️ Workspace ID não fornecido');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Buscando usuários do workspace:', workspaceId);
      
      // Buscar membros do workspace
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', workspaceId);

      if (membersError) {
        console.error('❌ Erro ao buscar membros:', membersError);
        throw membersError;
      }

      if (!members || members.length === 0) {
        console.warn('⚠️ Nenhum membro encontrado no workspace');
        setUsers([]);
        return;
      }

      const memberIds = members.map(m => m.user_id);
      console.log(`📋 Encontrados ${memberIds.length} membros`);

      // Buscar dados dos usuários
      const { data: usersData, error: usersError } = await supabase
        .from('system_users')
        .select('id, name, profile')
        .in('id', memberIds)
        .eq('status', 'active');

      if (usersError) {
        console.error('❌ Erro ao buscar usuários:', usersError);
        throw usersError;
      }

      const allUsers = usersData || [];
      console.log(`✅ ${allUsers.length} usuários carregados:`, allUsers.map(u => `${u.name} (${u.profile})`));

      // Filtrar por perfil se especificado
      const filteredUsers = filterProfiles
        ? allUsers.filter(user => filterProfiles.includes(user.profile as 'user' | 'admin' | 'master'))
        : allUsers;

      console.log(`🔍 Após filtro (${filterProfiles?.join(', ')}): ${filteredUsers.length} usuários`);
      
      setUsers(filteredUsers);
    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    users,
    isLoading,
    loadUsers,
  };
}
