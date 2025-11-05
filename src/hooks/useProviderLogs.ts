import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProviderLog {
  id: string;
  workspace_id: string;
  provider: 'evolution' | 'zapi';
  action: string;
  result: 'success' | 'error';
  payload: any;
  created_at: string;
}

interface UseProviderLogsParams {
  workspaceId: string;
  startDate?: Date;
  endDate?: Date;
  provider?: 'evolution' | 'zapi' | 'all';
  result?: 'success' | 'error' | 'all';
  action?: string;
}

export function useProviderLogs({
  workspaceId,
  startDate,
  endDate,
  provider,
  result,
  action
}: UseProviderLogsParams) {
  const [logs, setLogs] = useState<ProviderLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('whatsapp_provider_logs')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply filters
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      if (provider && provider !== 'all') {
        query = query.eq('provider', provider);
      }

      if (result && result !== 'all') {
        query = query.eq('result', result);
      }

      if (action) {
        query = query.ilike('action', `%${action}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching provider logs:', error);
        toast.error('Erro ao buscar logs');
        return;
      }

      setLogs((data as ProviderLog[]) || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Exception fetching logs:', error);
      toast.error('Erro ao buscar logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [workspaceId, startDate, endDate, provider, result, action]);

  const clearLogs = async () => {
    if (!workspaceId) return;

    try {
      const { error } = await supabase
        .from('whatsapp_provider_logs')
        .delete()
        .eq('workspace_id', workspaceId);

      if (error) {
        toast.error('Erro ao limpar logs');
        return;
      }

      toast.success('Logs limpos com sucesso');
      fetchLogs();
    } catch (error) {
      toast.error('Erro ao limpar logs');
    }
  };

  return {
    logs,
    isLoading,
    totalCount,
    fetchLogs,
    clearLogs
  };
}
