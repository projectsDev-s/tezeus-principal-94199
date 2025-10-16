import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface WorkspaceStats {
  workspace_id: string;
  workspace_name: string;
  connections_count: number;
  conversations_count: number;
  messages_count: number;
  active_conversations: number;
}

async function fetchRelatorios(userId: string | undefined, isMaster: boolean, selectedWorkspaceId?: string) {
  if (!userId) {
    throw new Error("Usuário não autenticado");
  }

  console.log('📊 Relatórios: Iniciando fetch', { userId, isMaster, selectedWorkspaceId });

  // 1. Buscar workspaces
  let workspacesQuery = supabase.from('workspaces').select('id, name');
  
  if (!isMaster && selectedWorkspaceId) {
    workspacesQuery = workspacesQuery.eq('id', selectedWorkspaceId);
  }

  const { data: workspacesData, error: workspacesError } = await workspacesQuery;

  if (workspacesError) {
    console.error('❌ Relatórios: Erro ao buscar workspaces', workspacesError);
    throw workspacesError;
  }

  if (!workspacesData || workspacesData.length === 0) {
    console.log('⚠️ Relatórios: Nenhum workspace encontrado');
    return [];
  }

  console.log('✅ Relatórios: Workspaces encontrados', { count: workspacesData.length });

  // 2. Buscar stats de cada workspace em paralelo
  const statsPromises = workspacesData.map(async (workspace) => {
    const [
      { count: connectionsCount },
      { count: conversationsCount },
      { count: messagesCount },
      { count: activeConversations }
    ] = await Promise.all([
      supabase.from('connections').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
      supabase.from('conversations').select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .gte('last_activity_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    ]);

    return {
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      connections_count: connectionsCount || 0,
      conversations_count: conversationsCount || 0,
      messages_count: messagesCount || 0,
      active_conversations: activeConversations || 0,
    };
  });

  const stats = await Promise.all(statsPromises);
  console.log('✅ Relatórios: Stats carregados com sucesso', { count: stats.length });
  
  return stats;
}

export function useRelatorios() {
  const { user, userRole } = useAuth();
  const { selectedWorkspace } = useWorkspace();

  return useQuery<WorkspaceStats[], Error>({
    queryKey: ['relatorios', user?.id, userRole, selectedWorkspace?.workspace_id],
    queryFn: () => fetchRelatorios(user?.id, userRole === 'master', selectedWorkspace?.workspace_id),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 1000 * 60, // 1 minuto
    refetchOnWindowFocus: false,
    enabled: !!user?.id, // Só executa se tiver usuário
  });
}
