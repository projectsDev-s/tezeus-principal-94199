import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConfigureWebhookResult {
  success: boolean;
  message: string;
  webhookUrl?: string;
  results?: any[];
}

export function useZapiWebhooks() {
  const [isConfiguring, setIsConfiguring] = useState(false);

  const configureWebhooks = async (
    connectionId: string,
    instanceName?: string
  ): Promise<ConfigureWebhookResult> => {
    setIsConfiguring(true);
    try {
      const { data, error } = await supabase.functions.invoke('configure-zapi-webhook', {
        body: {
          connectionId,
          instanceName,
          webhookType: 'all'
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Webhooks Z-API configurados com sucesso!');
      } else {
        toast.error(data.message || 'Erro ao configurar webhooks');
      }

      return data;
    } catch (error: any) {
      console.error('Erro ao configurar webhooks Z-API:', error);
      toast.error(error.message || 'Erro ao configurar webhooks Z-API');
      return {
        success: false,
        message: error.message || 'Erro desconhecido'
      };
    } finally {
      setIsConfiguring(false);
    }
  };

  return {
    configureWebhooks,
    isConfiguring
  };
}
