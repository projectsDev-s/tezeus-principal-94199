import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProviderAlertConfig {
  id: string;
  workspace_id: string;
  provider: 'evolution' | 'zapi' | 'all';
  error_threshold_percent: number;
  time_window_minutes: number;
  email_notifications_enabled: boolean;
  toast_notifications_enabled: boolean;
  notification_emails: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UseProviderAlertConfigParams {
  workspaceId: string;
}

export function useProviderAlertConfig({ workspaceId }: UseProviderAlertConfigParams) {
  const [configs, setConfigs] = useState<ProviderAlertConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfigs = async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_provider_alert_config')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('provider', { ascending: true });

      if (error) {
        console.error('Error fetching alert configs:', error);
        toast.error('Erro ao buscar configurações de alerta');
        return;
      }

      setConfigs((data as ProviderAlertConfig[]) || []);
    } catch (error) {
      console.error('Exception fetching configs:', error);
      toast.error('Erro ao buscar configurações de alerta');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [workspaceId]);

  const upsertConfig = async (configData: Partial<ProviderAlertConfig> & { provider: 'evolution' | 'zapi' | 'all' }) => {
    try {
      const dataToUpsert: any = {
        provider: configData.provider,
        error_threshold_percent: configData.error_threshold_percent,
        time_window_minutes: configData.time_window_minutes,
        email_notifications_enabled: configData.email_notifications_enabled,
        toast_notifications_enabled: configData.toast_notifications_enabled,
        notification_emails: configData.notification_emails,
        is_active: configData.is_active,
        workspace_id: workspaceId,
      };

      const { error } = await supabase
        .from('whatsapp_provider_alert_config')
        .upsert([dataToUpsert], {
          onConflict: 'workspace_id,provider'
        });

      if (error) {
        toast.error('Erro ao salvar configuração');
        return false;
      }

      toast.success('Configuração salva com sucesso');
      fetchConfigs();
      return true;
    } catch (error) {
      console.error('Error upserting config:', error);
      toast.error('Erro ao salvar configuração');
      return false;
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_provider_alert_config')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Erro ao deletar configuração');
        return false;
      }

      toast.success('Configuração deletada com sucesso');
      fetchConfigs();
      return true;
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Erro ao deletar configuração');
      return false;
    }
  };

  return {
    configs,
    isLoading,
    fetchConfigs,
    upsertConfig,
    deleteConfig,
  };
}
