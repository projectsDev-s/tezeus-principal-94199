import { useEffect, useRef } from 'react';
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
  onConversationUpdate?: (conversationId: string, updates: any) => void;
}

export function usePipelineRealtime({
  pipelineId,
  onCardInsert,
  onCardUpdate,
  onCardDelete,
  onColumnInsert,
  onColumnUpdate,
  onColumnDelete,
  onConversationUpdate,
}: UsePipelineRealtimeProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!pipelineId) {
      console.log('⏭️ [Realtime] Pipeline ID não fornecido, pulando conexão');
      return;
    }

    console.log('🔌 [Realtime] Conectando ao pipeline:', pipelineId);

    // Limpar conexão anterior se existir
    if (channelRef.current) {
      console.log('🧹 [Realtime] Removendo canal anterior...');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Limpar timeout de reconexão se existir
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Canal único e estável para este pipeline
    const channelName = `pipeline-${pipelineId}`;
    
    console.log('📡 [Realtime] Criando canal:', channelName);
    console.log('🔐 [Realtime] Verificando autenticação...');
    
    // Verificar se há sessão ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 [Realtime] Sessão:', session ? 'Ativa' : 'Inativa');
      if (session) {
        console.log('🔐 [Realtime] User ID:', session.user?.id);
        console.log('🔐 [Realtime] JWT metadata:', session.user?.user_metadata);
      }
    });

    // Criar canal com configurações otimizadas
    const channel: RealtimeChannel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false }, // Não receber próprios eventos
          presence: { key: '' },
        },
      })
      // Broadcasts personalizados para contornar casos onde eventos do DB não chegam por RLS
      .on('broadcast', { event: 'pipeline-card-moved' }, (payload: any) => {
        try {
          const { cardId, newColumnId } = payload?.payload || {};
          console.log('📡 [Realtime][Broadcast] pipeline-card-moved:', { cardId, newColumnId });
          if (!cardId || !newColumnId) return;

          if (onCardUpdate) {
            // Enviar um objeto mínimo; o handler no contexto mescla com dados existentes
            const minimalUpdate: any = { id: cardId, column_id: newColumnId };
            onCardUpdate(minimalUpdate as PipelineCard);
          }
        } catch (err) {
          console.error('❌ [Realtime][Broadcast] Erro ao processar pipeline-card-moved:', err);
        }
      })
      .on('broadcast', { event: 'conversation-agent-updated' }, (payload: any) => {
        try {
          const { conversationId, agente_ativo, agent_active_id } = payload?.payload || {};
          console.log('📡 [Realtime][Broadcast] conversation-agent-updated:', { 
            conversationId, 
            agente_ativo, 
            agent_active_id 
          });
          
          if (!conversationId) return;

          if (onConversationUpdate) {
            onConversationUpdate(conversationId, {
              agente_ativo,
              agent_active_id,
            });
          }
        } catch (err) {
          console.error('❌ [Realtime][Broadcast] Erro ao processar conversation-agent-updated:', err);
        }
      })
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
            hasOldData: !!oldCard,
            payloadKeys: Object.keys(payload)
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
            try {
              onCardUpdate(cardUpdate);
              console.log('✅ [Realtime] onCardUpdate executado com sucesso');
            } catch (error) {
              console.error('❌ [Realtime] Erro ao executar onCardUpdate:', error);
            }
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const updated = payload.new as any;
          console.log('🤖 [Realtime] Conversation atualizada:', {
            id: updated.id,
            agente_ativo: updated.agente_ativo,
            agent_active_id: updated.agent_active_id
          });
          
          if (onConversationUpdate) {
            onConversationUpdate(updated.id, {
              agente_ativo: updated.agente_ativo,
              agent_active_id: updated.agent_active_id,
            });
          }
        }
      )
      // Escutar mudanças em tags de contato
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'contact_tags',
        },
        async (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          console.log('🏷️ [Realtime] Contact tag mudou:', {
            event: payload.eventType,
            contact_id: newData?.contact_id || oldData?.contact_id,
            tag_id: newData?.tag_id || oldData?.tag_id
          });
          
          // Força refresh dos cards para atualizar tags
          // Precisamos encontrar cards relacionados a este contato
          const contactId = newData?.contact_id || oldData?.contact_id;
          if (contactId && onCardUpdate) {
            console.log('🔄 [Realtime] Forçando refresh de cards para contato:', contactId);
            // Enviar um sinal de "refresh" para o card
            // O card irá buscar as tags atualizadas
            onCardUpdate({ id: `refresh-contact-${contactId}`, _refresh: true } as any);
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`📡 [Realtime] Status do canal ${channelName}:`, status);
        console.log(`📡 [Realtime] Erro (se houver):`, err);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Canal subscrito com sucesso:', channelName);
          console.log('✅ [Realtime] PRONTO PARA RECEBER EVENTOS!');
          reconnectAttemptsRef.current = 0; // Reset contador de tentativas
          channelRef.current = channel;
          
          // Teste: Verificar se podemos ver eventos
          console.log('🔍 [Realtime] Testando conexão...');
          setTimeout(() => {
            console.log('🔍 [Realtime] Conexão ativa há 5 segundos. Se não vir eventos, verifique:');
            console.log('   1. Se a migração foi aplicada (20250115000000_fix_pipeline_realtime_rls.sql)');
            console.log('   2. Se as tabelas estão na publicação realtime');
            console.log('   3. Se o usuário tem permissão SELECT nas linhas');
          }, 5000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] Erro no canal:', err);
          console.error('❌ [Realtime] Detalhes do erro:', JSON.stringify(err, null, 2));
          
          // Tentar reconectar após 3 segundos
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000); // Max 30s
          
          console.log(`🔄 [Realtime] Tentando reconectar em ${delay}ms (tentativa ${reconnectAttemptsRef.current})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 [Realtime] Reconectando...');
            // Forçar recriação do efeito removendo o canal
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            // O useEffect será executado novamente
          }, delay);
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ [Realtime] Timeout no canal:', channelName);
          
          // Tentar reconectar
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
          }, delay);
        } else if (status === 'CLOSED') {
          console.warn('🔌 [Realtime] Canal fechado:', channelName);
        } else {
          console.log(`ℹ️ [Realtime] Status desconhecido: ${status}`);
        }
      });

    // Armazenar referência do canal
    channelRef.current = channel;

    // Cleanup: desconectar ao desmontar
    return () => {
      console.log('🧹 [Realtime] Limpando conexão do pipeline:', pipelineId);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (channelRef.current) {
        console.log('🔌 [Realtime] Removendo canal...');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    pipelineId,
    onCardInsert,
    onCardUpdate,
    onCardDelete,
    onColumnInsert,
    onColumnUpdate,
    onColumnDelete,
    onConversationUpdate
  ]);
}
