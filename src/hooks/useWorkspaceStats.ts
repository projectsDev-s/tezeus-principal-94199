import { useState, useEffect, useCallback } from 'react';
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

  const fetchStats = useCallback(async () => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Buscar número de usuários do workspace (EXCLUINDO MASTERS e membros ocultos)
      // Masters são sempre is_hidden = true
      const { count: usersCount, error: membersError } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('is_hidden', false);

      if (membersError) {
        console.error('Error counting workspace members:', membersError);
        throw membersError;
      }

      console.log('📊 useWorkspaceStats: Users count (excluding masters):', usersCount);

      // Buscar pipelines do workspace
      const { data: pipelines, error: pipelinesError } = await supabase
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspaceId);

      if (pipelinesError) {
        console.error('Error fetching pipelines:', pipelinesError);
        throw pipelinesError;
      }

      // Buscar número de negócios ativos
      let dealsCount = 0;
      if (pipelines && pipelines.length > 0) {
        const pipelineIds = pipelines.map(p => p.id);
        
        const { count, error: dealsError } = await supabase
          .from('pipeline_cards')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aberto')
          .in('pipeline_id', pipelineIds);

        if (dealsError) {
          console.error('Error counting active deals:', dealsError);
          throw dealsError;
        }
        dealsCount = count || 0;
      }

      console.log('📊 useWorkspaceStats: Active deals count:', dealsCount);

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
  }, [workspaceId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!workspaceId) return;

    console.log('🔔 useWorkspaceStats: Setting up realtime subscriptions for workspace:', workspaceId);

    const channel = supabase
      .channel(`workspace-stats-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('🔔 Workspace member change detected:', payload);
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pipeline_cards'
        },
        (payload) => {
          console.log('🔔 Pipeline card change detected:', payload);
          // Check if this card belongs to a pipeline in this workspace
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 useWorkspaceStats: Cleaning up realtime subscriptions');
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchStats]);

  return { stats, isLoading };
}
