import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace, type Workspace } from '@/contexts/WorkspaceContext';
import { useCache } from './useCache';
import { useRetry } from './useRetry';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { setWorkspaces: setContextWorkspaces, setIsLoadingWorkspaces } = useWorkspace();
  const { getCache, setCache, isExpired, clearCache } = useCache<Workspace[]>(5); // 5 min cache
  const { retry } = useRetry();
  const hasFetched = useRef(false);

  const fetchWorkspaces = async () => {
    if (!user) {
      console.log('⚠️ useWorkspaces: No user, skipping fetch');
      setWorkspaces([]);
      setContextWorkspaces([]);
      setIsLoadingWorkspaces(false);
      return;
    }

    // Check cache first
    const cached = getCache();
    if (cached && !isExpired() && cached.length > 0) {
      console.log('✅ useWorkspaces: Using cached workspaces:', cached.length);
      setWorkspaces(cached);
      setContextWorkspaces(cached);
      setIsLoadingWorkspaces(false);
      return;
    }

    console.log('🔄 useWorkspaces: Fetching workspaces for user:', user.email);
    setIsLoading(true);
    setIsLoadingWorkspaces(true);
    try {
      console.log('📡 useWorkspaces: Calling list-user-workspaces...');
      const data = await retry(async () => {
        const { data, error } = await supabase.functions.invoke('list-user-workspaces', {
          headers: {
            'x-system-user-id': user.id,
            'x-system-user-email': user.email || ''
          }
        });
        if (error) {
          console.error('❌ useWorkspaces: Error from edge function:', error);
          throw error;
        }
        return data;
      });

      if (!data?.workspaces) {
        console.error('❌ useWorkspaces: No workspaces data received');
        throw new Error('No workspaces data received');
      }

      console.log('📦 useWorkspaces: Received workspaces:', data.workspaces);

      // Transform the data to match expected format with fallback
      const workspaceData = data?.workspaces?.map((w: any) => {
        const workspace = {
          workspace_id: w.workspace_id || w.id,
          name: w.name,
          slug: w.slug,
          cnpj: w.cnpj,
          created_at: w.created_at,
          updated_at: w.updated_at,
          connections_count: w.connections_count || 0
        };
        console.log('✅ useWorkspaces: Transformed workspace:', workspace.name, workspace.workspace_id);
        return workspace;
      }) || [];

      console.log('✅ useWorkspaces: Final workspaces:', workspaceData);
      
      // Workspaces fetched
      setWorkspaces(workspaceData);
      setContextWorkspaces(workspaceData);
      setCache(workspaceData);

      // Fallback: buscar connections_count diretamente se não veio da Edge function
      if (workspaceData.some((w: any) => !w.connections_count && w.connections_count !== 0)) {
        console.log('🔄 useWorkspaces: Fetching connections count as fallback...');
        try {
          const { data: connectionsData } = await supabase
            .from('connections')
            .select('workspace_id')
            .in('workspace_id', workspaceData.map((w: any) => w.workspace_id));
          
          const connectionCounts = connectionsData?.reduce((acc: any, conn: any) => {
            acc[conn.workspace_id] = (acc[conn.workspace_id] || 0) + 1;
            return acc;
          }, {}) || {};

          const updatedWorkspaces = workspaceData.map((w: any) => ({
            ...w,
            connections_count: connectionCounts[w.workspace_id] || 0
          }));
          
          setWorkspaces(updatedWorkspaces);
          setContextWorkspaces(updatedWorkspaces);
        } catch (fallbackError) {
          console.error('⚠️ useWorkspaces: Fallback connections count failed');
        }
      }
    } catch (error) {
      console.error('❌ useWorkspaces: Error fetching workspaces:', error);
      
      // Use expired cache if available
      const cached = getCache();
      if (cached) {
        console.log('⚠️ useWorkspaces: Using expired cache due to error');
        setWorkspaces(cached);
        setContextWorkspaces(cached);
      } else if (!workspaces.length) {
        toast({
          title: "Erro",
          description: "Falha ao carregar empresas",
          variant: "destructive"
        });
        setWorkspaces([]);
        setContextWorkspaces([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    if (user) {
      hasFetched.current = true;
      fetchWorkspaces();
    }
  }, [user]);

  // Limpar cache apenas quando necessário (não por mudança de selectedWorkspace)
  const clearWorkspacesCache = () => {
    console.log('🗑️ useWorkspaces: Clearing cache manually');
    clearCache();
  };

  const createWorkspace = async (name: string, cnpj?: string, connectionLimit?: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'create', name, cnpj, connectionLimit },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        // Handle specific error types
        if (error.message?.includes('401') || error.message?.includes('authenticated')) {
          toast({
            title: "Erro de Autenticação",
            description: "Sua sessão expirou. Faça login novamente.",
            variant: "destructive"
          });
        } else if (error.message?.includes('403') || error.message?.includes('master')) {
          toast({
            title: "Acesso Negado",
            description: "Somente usuários master podem criar empresas.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro",
            description: "Falha ao criar empresa",
            variant: "destructive"
          });
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso"
      });

      fetchWorkspaces(); // Refresh list
      return data;
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      
      // If error wasn't handled above, show generic message
      if (!error.message?.includes('401') && !error.message?.includes('403')) {
        toast({
          title: "Erro",
          description: "Falha ao criar empresa",
          variant: "destructive"
        });
      }
      throw error;
    }
  };

  const updateWorkspace = async (workspaceId: string, updates: { name?: string; cnpj?: string; connectionLimit?: number }) => {
    try {
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'update', workspaceId, ...updates },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso"
      });

      fetchWorkspaces(); // Refresh list
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar empresa",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'delete', workspaceId },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa removida com sucesso"
      });

      fetchWorkspaces(); // Refresh list
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover empresa",
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    workspaces,
    isLoading,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    clearWorkspacesCache
  };
}