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
  
  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['workspace-agent', selectedWorkspace?.workspace_id],
    queryFn: async () => {
      if (!selectedWorkspace?.workspace_id) {
        console.log('❌ Workspace ID não disponível');
        return null;
      }
      
      console.log('🔍 Buscando agente para workspace:', selectedWorkspace.workspace_id);
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, is_active, agent_type')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .maybeSingle();
      
      console.log('📊 Resultado da busca:', { data, error });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWorkspace?.workspace_id,
  });
  
  console.log('✅ Hook result:', { 
    hasAgent: !!agent, 
    isLoading,
    agent: agent?.name 
  });
  
  return { 
    agent, 
    hasAgent: !!agent, 
    isLoading 
  };
};
