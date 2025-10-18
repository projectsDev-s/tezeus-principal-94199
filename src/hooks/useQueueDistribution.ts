import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useQueueDistribution = () => {
  const [isDistributing, setIsDistributing] = useState<string | null>(null);

  const distributeConversation = async (conversationId: string, queueId?: string) => {
    try {
      setIsDistributing(conversationId);
      
      const { data, error } = await supabase.functions.invoke('assign-conversation-to-queue', {
        body: { 
          conversation_id: conversationId,
          queue_id: queueId || null
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao distribuir conversa');
      }

      if (data.action === 'no_queue' || data.action === 'no_distribution') {
        toast({
          title: "Sem fila configurada",
          description: data.message,
          variant: "default",
        });
        return { success: true, action: data.action, message: data.message };
      }

      toast({
        title: "Conversa distribuída",
        description: `Atribuída para usuário via fila ${data.queue_name} (${data.distribution_type})`,
      });

      return { 
        success: true, 
        action: data.action,
        assigned_user_id: data.assigned_user_id,
        queue_name: data.queue_name,
        distribution_type: data.distribution_type
      };

    } catch (error) {
      console.error('❌ Error distributing conversation:', error);
      
      toast({
        title: "Erro ao distribuir conversa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      
      return { success: false, error: error.message };
    } finally {
      setIsDistributing(null);
    }
  };

  return {
    distributeConversation,
    isDistributing
  };
};
