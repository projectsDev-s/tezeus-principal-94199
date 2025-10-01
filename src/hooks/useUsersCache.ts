import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  profile: string;
}

// Cache global para usuários
let globalUsersCache: User[] = [];
let isFetching = false;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milliseconds

// Listeners para notificar componentes quando o cache é atualizado
const cacheListeners: ((users: User[]) => void)[] = [];

const notifyListeners = (users: User[]) => {
  cacheListeners.forEach(listener => listener(users));
};

const addCacheListener = (listener: (users: User[]) => void) => {
  cacheListeners.push(listener);
  return () => {
    const index = cacheListeners.indexOf(listener);
    if (index > -1) {
      cacheListeners.splice(index, 1);
    }
  };
};

const fetchUsersFromDB = async (workspaceId?: string): Promise<User[]> => {
  // Se já está buscando, retornar cache atual
  if (isFetching) {
    return globalUsersCache;
  }

  // Se cache é recente e workspace é o mesmo, usar cache
  const now = Date.now();
  if (globalUsersCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION && !workspaceId) {
    return globalUsersCache;
  }

  isFetching = true;
  try {
    console.log('🔄 Buscando usuários do banco...', workspaceId ? `workspace: ${workspaceId}` : 'todos');
    
    // Se workspace_id foi fornecido, filtrar por membros do workspace
    if (workspaceId) {
      console.log('📋 Buscando membros do workspace:', workspaceId);
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId);

      if (membersError) {
        console.error('❌ Erro ao buscar membros do workspace:', membersError);
        throw membersError;
      }

      const memberIds = members?.map(m => m.user_id) || [];
      console.log(`📋 IDs de membros encontrados: ${memberIds.length}`, memberIds);
      
      if (memberIds.length === 0) {
        console.warn('⚠️ Nenhum membro encontrado no workspace');
        return [];
      }

      // Buscar usuários que são membros do workspace
      const { data, error } = await supabase
        .from('system_users')
        .select('id, name, profile')
        .eq('status', 'active')
        .neq('profile', 'master')
        .in('id', memberIds)
        .order('name')
        .limit(100);
      
      if (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        throw error;
      }

      const users = data?.map(user => ({ 
        id: user.id, 
        name: user.name, 
        profile: user.profile 
      })) || [];
      
      console.log(`✅ Usuários do workspace carregados: ${users.length}`, users.map(u => `${u.name} (${u.profile})`));
      return users;
    }

    // Busca global (sem filtro de workspace)
    const { data, error } = await supabase
      .from('system_users')
      .select('id, name, profile')
      .eq('status', 'active')
      .neq('profile', 'master')
      .order('name')
      .limit(100);
    
    if (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      throw error;
    }

    const users = data?.map(user => ({ id: user.id, name: user.name, profile: user.profile })) || [];
    
    // Só atualizar cache global se não for filtro por workspace
    if (!workspaceId) {
      globalUsersCache = users;
      cacheTimestamp = now;
    }
    
    console.log(`✅ Usuários carregados: ${users.length} usuários`);
    
    // Notificar todos os listeners apenas se for cache global
    if (!workspaceId) {
      notifyListeners(users);
    }
    
    return users;
  } catch (error) {
    console.error('❌ Erro crítico ao buscar usuários:', error);
    // Retornar cache antigo se houver erro
    return globalUsersCache;
  } finally {
    isFetching = false;
  }
};

export const useUsersCache = (workspaceId?: string, filterProfiles?: ('user' | 'admin' | 'master')[]) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Se workspace_id mudou, recarregar
    if (workspaceId) {
      loadUsers();
    } else if (globalUsersCache.length > 0) {
      setUsers(globalUsersCache);
    }
  }, [workspaceId]);

  useEffect(() => {
    // Adicionar listener para updates do cache global apenas se não tiver workspace específico
    if (!workspaceId) {
      const removeListener = addCacheListener((updatedUsers) => {
        setUsers(updatedUsers);
      });
      return removeListener;
    }
  }, [workspaceId]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await fetchUsersFromDB(workspaceId);
      setUsers(fetchedUsers);
      return { data: fetchedUsers };
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      return { error: 'Erro ao carregar usuários' };
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUsers = async () => {
    // Força atualização ignorando cache
    if (!workspaceId) {
      cacheTimestamp = 0;
      globalUsersCache = [];
    }
    return loadUsers();
  };

  // Filtrar usuários por perfil se especificado
  const filteredUsers = filterProfiles 
    ? users.filter(user => {
        const matchesFilter = filterProfiles.includes(user.profile as 'user' | 'admin' | 'master');
        return matchesFilter;
      })
    : users;

  console.log(`📊 Workspace: ${workspaceId || 'global'}, Total: ${users.length}, Filtrados: ${filteredUsers.length}, Filtros: ${filterProfiles?.join(', ') || 'nenhum'}`);

  return {
    users: filteredUsers,
    isLoading,
    loadUsers,
    refreshUsers
  };
};