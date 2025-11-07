import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export const useWorkspaceAgent = () => {
  const { selectedWorkspace } = useWorkspace();
  
  console.log('🤖 useWorkspaceAgent - selectedWorkspace:', {
    workspace_id: selectedWorkspace?.workspace_id,
    name: selectedWorkspace?.name,
    enabled: !!selectedWorkspace?.workspace_id
  });
  
  const { data: agents, isLoading, error } = useQuery({
    queryKey: ['workspace-agents', selectedWorkspace?.workspace_id],
    queryFn: async () => {
      if (!selectedWorkspace?.workspace_id) {
        console.log('❌ Workspace ID não disponível');
        return [];
      }
      
      console.log('🔍 Buscando agentes para workspace:', selectedWorkspace.workspace_id);
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, is_active, agent_type')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      console.log('📊 Resultado da busca:', { data, error, count: data?.length });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedWorkspace?.workspace_id,
  });
  
  const hasAgent = agents && agents.length > 0;
  const defaultAgent = agents?.[0] || null;
  
  console.log('✅ Hook result:', { 
    hasAgent, 
    isLoading,
    agentsCount: agents?.length,
    defaultAgent: defaultAgent?.name 
  });
  
  return { 
    agent: defaultAgent,
    agents: agents || [],
    hasAgent, 
    isLoading 
  };
};
