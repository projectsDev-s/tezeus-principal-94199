import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';

export function usePipelineCardAutoCreation() {
  const [isCreating, setIsCreating] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  const checkAndCreateCard = useCallback(async (
    conversationId: string,
    contactId: string,
    workspaceId: string,
    pipelineId?: string
  ) => {
    try {
      setIsCreating(true);

      // Usar a Edge Function inteligente que gerencia unicidade
      const { data, error } = await supabase.functions.invoke('smart-pipeline-card-manager', {
        body: {
          contactId,
          conversationId,
          workspaceId,
          pipelineId
        }
      });

      if (error) {
        console.error('Erro na Edge Function:', error);
        
        // Se for erro de conflito (card aberto já existe), NÃO mostrar toast
        // A notificação já foi tratada no data.error
        if (data?.error === 'duplicate_open_card') {
          console.log('⚠️ Card duplicado detectado, mas isso é esperado');
          return null;
        }
        
        return null;
      }

      // Verificar se retornou erro de card duplicado no data
      if (data?.error === 'duplicate_open_card') {
        console.log('⚠️ Negócio aberto já existe para este contato');
        // NÃO mostrar toast aqui, deixar silencioso
        return null;
      }

      // Mostrar toast apenas se foi criado um novo card
      if (data?.action === 'created') {
        console.log('✅ Card criado:', data.card);
        toast({
          title: 'CRM atualizado',
          description: 'Novo negócio criado automaticamente',
        });
      } else if (data?.action === 'updated') {
        console.log('✅ Card atualizado:', data.card);
        // Não mostrar toast para atualizações silenciosas
      }

      return data?.card || null;

    } catch (error) {
      console.error('Erro ao gerenciar card:', error);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [toast]);

  return {
    checkAndCreateCard,
    isCreating
  };
}