import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace, type Workspace } from '@/contexts/WorkspaceContext';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const { setWorkspaces: setContextWorkspaces, setIsLoadingWorkspaces } = useWorkspace();

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setContextWorkspaces([]);
      setIsLoadingWorkspaces(false);
      return;
    }

    setIsLoading(true);
    setIsLoadingWorkspaces(true);
    try {
      // Always use the Edge function to bypass RLS issues
      // Fetching workspaces via Edge function
      
      const { data, error } = await supabase.functions.invoke('list-user-workspaces', {
        headers: {
          'x-system-user-id': user.id,
          'x-system-user-email': user.email || ''
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      // Transform the data to match expected format
      const workspaceData = data?.workspaces?.map((w: any) => ({
        workspace_id: w.workspace_id || w.id,
        name: w.name,
        slug: w.slug,
        cnpj: w.cnpj,
        created_at: w.created_at,
        updated_at: w.updated_at,
        connections_count: w.connections_count || 0
      })) || [];

      // Workspaces fetched
      setWorkspaces(workspaceData);
      setContextWorkspaces(workspaceData);

      // Fallback: buscar connections_count diretamente se não veio da Edge function
      if (workspaceData.some((w: any) => !w.connections_count && w.connections_count !== 0)) {
        // Fetching connections count as fallback
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
          // Fallback connections count failed
          // Não mostrar erro para fallback, apenas usar os workspaces sem connection count
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      // Só mostrar erro se realmente falhou em buscar workspaces
      if (!workspaces.length) {
        toast({
          title: "Erro",
          description: "Falha ao carregar empresas",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
      setIsLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user, userRole]);

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
    deleteWorkspace
  };
}