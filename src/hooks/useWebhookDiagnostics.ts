import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useWebhookDiagnostics = () => {
  const [isReconfiguring, setIsReconfiguring] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const reconfigureWebhooks = async (instanceId?: string, workspaceId?: string) => {
    setIsReconfiguring(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('force-webhook-reconfiguration', {
        body: { instanceId, workspaceId }
      });

      if (error) {
        console.error('Erro ao reconfigurar webhooks:', error);
        toast.error('Erro ao reconfigurar webhooks');
        return null;
      }

      const result = data as {
        success: boolean;
        message: string;
        summary: {
          total: number;
          success: number;
          errors: number;
          skipped: number;
        };
        results: Array<{
          instance: string;
          status: string;
          error?: string;
        }>;
      };
      
      if (result.success) {
        toast.success(result.message || `✅ ${result.summary.success}/${result.summary.total} instâncias reconfiguradas`);
        
        if (result.summary.errors > 0) {
          toast.warning(`⚠️ ${result.summary.errors} instâncias falharam na reconfiguração`);
        }
      } else {
        toast.error('Falha ao reconfigurar webhooks');
      }

      return result;
    } catch (error) {
      console.error('Erro ao reconfigurar webhooks:', error);
      toast.error('Erro interno ao reconfigurar webhooks');
      return null;
    } finally {
      setIsReconfiguring(false);
    }
  };

  const testWebhookFlow = async (conversationId: string) => {
    setIsTesting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook-status-flow', {
        body: { conversationId }
      });

      if (error) {
        console.error('Erro ao testar fluxo de webhooks:', error);
        toast.error('Erro ao executar teste de webhooks');
        return null;
      }

      const result = data as {
        test_successful: boolean;
        message_sent: boolean;
        status_updates_received: number;
        recommendations: string[];
      };

      // Mostrar diagnóstico
      if (result.status_updates_received === 0) {
        toast.error('❌ Nenhum webhook de status recebido', {
          description: 'Reconfigurar webhooks pode resolver o problema'
        });
      } else if (result.status_updates_received === 1) {
        toast.warning('⚠️ Apenas 1 webhook recebido', {
          description: 'Esperado: send.message + messages.update'
        });
      } else {
        toast.success(`✅ ${result.status_updates_received} webhooks recebidos`, {
          description: 'Sistema funcionando corretamente'
        });
      }

      return result;
    } catch (error) {
      console.error('Erro ao testar webhooks:', error);
      toast.error('Erro interno ao testar webhooks');
      return null;
    } finally {
      setIsTesting(false);
    }
  };

  return {
    isReconfiguring,
    isTesting,
    reconfigureWebhooks,
    testWebhookFlow
  };
};
