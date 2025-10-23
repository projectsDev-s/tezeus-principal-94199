import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export const useWorkspaceAgent = () => {
  const { selectedWorkspace } = useWorkspace();
  
  const { data: agent, isLoading } = useQuery({
    queryKey: ['workspace-agent', selectedWorkspace?.workspace_id],
    queryFn: async () => {
      if (!selectedWorkspace?.workspace_id) return null;
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, is_active, agent_type')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWorkspace?.workspace_id,
  });
  
  return { 
    agent, 
    hasAgent: !!agent, 
    isLoading 
  };
};
