import { useState, useEffect } from 'react';
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

  const fetchLimits = async () => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // Get workspace limits - use maybeSingle to avoid 406 errors
      const { data: limitsData, error: limitsError } = await supabase
        .from('workspace_limits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (limitsError && limitsError.code !== 'PGRST116') { // Not found error
        throw limitsError;
      }

      // Get current connection count
      const { count: connectionCount, error: countError } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      if (countError) {
        throw countError;
      }

      const currentLimit = limitsData?.connection_limit || 1;
      const currentUsage = connectionCount || 0;

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
  };

  useEffect(() => {
    fetchLimits();
  }, [workspaceId]);

  return {
    limits,
    usage,
    isLoading,
    refreshLimits: fetchLimits
  };
}