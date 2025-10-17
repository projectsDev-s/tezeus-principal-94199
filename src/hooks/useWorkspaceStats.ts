import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkspaceStats {
  usersCount: number;
  activeDealsCount: number;
}

export function useWorkspaceStats(workspaceId: string) {
  const [stats, setStats] = useState<WorkspaceStats>({
    usersCount: 0,
    activeDealsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);

        // Buscar número de usuários do workspace
        const { count: usersCount, error: membersError } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);

        if (membersError) throw membersError;

        // Buscar pipelines do workspace
        const { data: pipelines, error: pipelinesError } = await supabase
          .from('pipelines')
          .select('id')
          .eq('workspace_id', workspaceId);

        if (pipelinesError) throw pipelinesError;

        // Buscar número de negócios ativos
        let dealsCount = 0;
        if (pipelines && pipelines.length > 0) {
          const pipelineIds = pipelines.map(p => p.id);
          
          const { count, error: dealsError } = await supabase
            .from('pipeline_cards')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'aberto')
            .in('pipeline_id', pipelineIds);

          if (dealsError) throw dealsError;
          dealsCount = count || 0;
        }

        setStats({
          usersCount: usersCount || 0,
          activeDealsCount: dealsCount,
        });
      } catch (error) {
        console.error('Error fetching workspace stats:', error);
        setStats({
          usersCount: 0,
          activeDealsCount: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (workspaceId) {
      fetchStats();
    }
  }, [workspaceId]);

  return { stats, isLoading };
}
