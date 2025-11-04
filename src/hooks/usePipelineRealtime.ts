import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PipelineCard, PipelineColumn } from '@/contexts/PipelinesContext';

interface UsePipelineRealtimeProps {
  pipelineId: string | null;
  onCardInsert?: (card: PipelineCard) => void;
  onCardUpdate?: (card: PipelineCard) => void;
  onCardDelete?: (cardId: string) => void;
  onColumnInsert?: (column: PipelineColumn) => void;
  onColumnUpdate?: (column: PipelineColumn) => void;
  onColumnDelete?: (columnId: string) => void;
}

export function usePipelineRealtime({
  pipelineId,
  onCardInsert,
  onCardUpdate,
  onCardDelete,
  onColumnInsert,
  onColumnUpdate,
  onColumnDelete,
}: UsePipelineRealtimeProps) {
  useEffect(() => {
    if (!pipelineId) return;

    console.log('🔌 [Realtime] Conectando ao pipeline:', pipelineId);

    // Canal único e estável para este pipeline
    const channelName = `pipeline-${pipelineId}`;

    // Canal único para este pipeline
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pipeline_cards',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          console.log('🆕 [Realtime] Card inserido:', payload.new);
          onCardInsert?.(payload.new as PipelineCard);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pipeline_cards',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          const cardUpdate = payload.new as PipelineCard;
          const oldCard = payload.old as Partial<PipelineCard> | null;
          
          // Detectar mudança de coluna especificamente (payload.old pode não estar sempre disponível)
          const columnChanged = oldCard?.column_id && oldCard.column_id !== cardUpdate.column_id;
          
          console.log('🔄 [Realtime] Card atualizado (RAW):', {
            cardId: cardUpdate.id,
            cardTitle: cardUpdate.title,
            columnChanged,
            oldColumnId: oldCard?.column_id || 'N/A',
            newColumnId: cardUpdate.column_id,
            hasOldData: !!oldCard
          });
          
          if (columnChanged) {
            console.log('🎯 [Realtime] ⚠️ MUDANÇA DE COLUNA DETECTADA NO EVENTO:', {
              cardId: cardUpdate.id,
              cardTitle: cardUpdate.title,
              from: oldCard.column_id,
              to: cardUpdate.column_id,
              timestamp: new Date().toISOString()
            });
          }
          
          if (onCardUpdate) {
            console.log('🔄 [Realtime] Chamando onCardUpdate...');
            onCardUpdate(cardUpdate);
            console.log('✅ [Realtime] onCardUpdate executado');
          } else {
            console.warn('⚠️ [Realtime] onCardUpdate é undefined!');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'pipeline_cards',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          console.log('🗑️ [Realtime] Card deletado:', payload.old.id);
          onCardDelete?.(payload.old.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pipeline_columns',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          console.log('🆕 [Realtime] Coluna inserida:', payload.new);
          onColumnInsert?.(payload.new as PipelineColumn);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pipeline_columns',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          console.log('🔄 [Realtime] Coluna atualizada:', payload.new);
          onColumnUpdate?.(payload.new as PipelineColumn);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'pipeline_columns',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          console.log('🗑️ [Realtime] Coluna deletada:', payload.old.id);
          onColumnDelete?.(payload.old.id);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Canal subscrito:', channelName);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ [Realtime] Status: ${status} - Canal: ${channelName}`);
        }
      });

    // Cleanup: desconectar ao desmontar
    return () => {
      console.log('🔌 [Realtime] Desconectando do pipeline:', pipelineId);
      supabase.removeChannel(channel);
    };
  }, [
    pipelineId,
    onCardInsert,
    onCardUpdate,
    onCardDelete,
    onColumnInsert,
    onColumnUpdate,
    onColumnDelete
  ]);
}
