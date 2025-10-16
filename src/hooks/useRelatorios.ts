import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";

interface WorkspaceStats {
  workspace_id: string;
  workspace_name: string;
  connections_count: number;
  conversations_count: number;
  messages_count: number;
  active_conversations: number;
}

async function fetchRelatorios(
  userId: string | undefined, 
  userEmail: string | undefined,
  isMaster: boolean, 
  selectedWorkspaceId?: string
) {
  if (!userId || !userEmail) {
    throw new Error("Usuário não autenticado");
  }

  console.log('📊 Relatórios: Iniciando fetch', { userId, userEmail, isMaster, selectedWorkspaceId });

  // Buscar stats usando a edge function que usa service role
  const { data: response, error } = await supabase.functions.invoke('get-workspace-stats', {
    headers: {
      'x-system-user-id': userId,
      'x-system-user-email': userEmail,
    }
  });

  if (error) {
    console.error('❌ Relatórios: Erro ao buscar stats', error);
    throw error;
  }

  const stats = response?.stats || [];
  
  if (stats.length === 0) {
    console.log('⚠️ Relatórios: Nenhum workspace encontrado');
    return [];
  }

  console.log('✅ Relatórios: Stats carregados com sucesso', { count: stats.length });

  // Filtrar workspace se não for master e tiver um selecionado
  if (!isMaster && selectedWorkspaceId) {
    return stats.filter((stat: any) => stat.workspace_id === selectedWorkspaceId);
  }
  
  return stats;
}

export function useRelatorios() {
  const { user, userRole } = useAuth();
  const { selectedWorkspace } = useWorkspace();

  return useQuery<WorkspaceStats[], Error>({
    queryKey: ['relatorios', user?.id, userRole, selectedWorkspace?.workspace_id],
    queryFn: () => fetchRelatorios(
      user?.id, 
      user?.email,
      userRole === 'master', 
      selectedWorkspace?.workspace_id
    ),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 1000 * 60, // 1 minuto
    refetchOnWindowFocus: false,
    enabled: !!user?.id && !!user?.email, // Só executa se tiver usuário e email
  });
}
