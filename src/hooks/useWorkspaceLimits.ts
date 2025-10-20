import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface WorkspaceLimit {
  id: string;
  workspace_id: string;
  connection_limit: number;
  created_at: string;
  updated_at: string;
}

interface ConnectionUsage {
  current: number;
  limit: number;
  canCreateMore: boolean;
}

export function useWorkspaceLimits(workspaceId: string) {
  const [limits, setLimits] = useState<WorkspaceLimit | null>(null);
  const [usage, setUsage] = useState<ConnectionUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchLimits = useCallback(async () => {
    if (!workspaceId) {
      console.log('🔴 useWorkspaceLimits: workspaceId is null/undefined');
      setIsLoading(false);
      return;
    }
    
    console.log('🔵 useWorkspaceLimits: Fetching limits for workspace:', workspaceId);
    setIsLoading(true);
    try {
      // Get workspace limits - use maybeSingle to avoid 406 errors
      const { data: limitsData, error: limitsError } = await supabase
        .from('workspace_limits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      console.log('📊 useWorkspaceLimits: Limits data from DB:', limitsData);

      if (limitsError && limitsError.code !== 'PGRST116') { // Not found error
        console.error('❌ useWorkspaceLimits: Error fetching limits:', limitsError);
        throw limitsError;
      }

      // Get current connection count
      const { count: connectionCount, error: countError } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      console.log('📊 useWorkspaceLimits: Connections count:', connectionCount);

      if (countError) {
        console.error('❌ useWorkspaceLimits: Error counting connections:', countError);
        throw countError;
      }

      const currentLimit = limitsData?.connection_limit || 1;
      const currentUsage = connectionCount || 0;

      console.log('✅ useWorkspaceLimits: Final values - current:', currentUsage, 'limit:', currentLimit, 'canCreateMore:', currentUsage < currentLimit);

      setLimits(limitsData);
      setUsage({
        current: currentUsage,
        limit: currentLimit,
        canCreateMore: currentUsage < currentLimit
      });

    } catch (error) {
      console.error('Error fetching workspace limits:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar limites do workspace",
        variant: "destructive"
      });
      // Keep previous usage if any to prevent UI flashing
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  // Subscribe to realtime changes on connections table
  useEffect(() => {
    if (!workspaceId) return;

    console.log('🔔 useWorkspaceLimits: Setting up realtime subscription for workspace:', workspaceId);

    const channel = supabase
      .channel(`workspace-connections-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('🔔 Connection change detected:', payload);
          // Refresh limits whenever a connection is added, updated, or deleted
          fetchLimits();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_limits',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('🔔 Workspace limit change detected:', payload);
          // Refresh when the limit itself changes
          fetchLimits();
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 useWorkspaceLimits: Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchLimits]);

  return {
    limits,
    usage,
    isLoading,
    refreshLimits: fetchLimits
  };
}