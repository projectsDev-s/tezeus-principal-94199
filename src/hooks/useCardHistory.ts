import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useEffect, useState } from 'react';

export interface CardHistoryEvent {
  id: string;
  type: 'agent_activity' | 'queue_transfer' | 'column_transfer' | 'user_assigned' | 'activity_lembrete' | 'activity_mensagem' | 'activity_ligacao' | 'activity_reuniao' | 'activity_agendamento' | 'tag';
  action: string;
  description: string;
  timestamp: string;
  user_name?: string;
  metadata?: any;
}

export const useCardHistory = (cardId: string, contactId?: string) => {
  const { getHeaders } = useWorkspaceHeaders();
  const queryClient = useQueryClient();
  const [resolvedContactId, setResolvedContactId] = useState<string | null>(contactId || null);

  // Buscar contactId se não for fornecido
  useEffect(() => {
    if (cardId && !contactId && !resolvedContactId) {
      const fetchContactId = async () => {
        const { data: card } = await supabase
          .from('pipeline_cards')
          .select('contact_id')
          .eq('id', cardId)
          .maybeSingle();
        
        if (card?.contact_id) {
          console.log('✅ ContactId resolvido internamente no hook:', card.contact_id);
          setResolvedContactId(card.contact_id);
        }
      };
      
      fetchContactId();
    } else if (contactId) {
      setResolvedContactId(contactId);
    }
  }, [cardId, contactId, resolvedContactId]);

  const effectiveContactId = contactId || resolvedContactId;

  // Adicionar realtime listener para atualizar automaticamente
  useEffect(() => {
    if (!cardId || !effectiveContactId) return;

    console.log('🔌 Configurando realtime para histórico do card:', cardId);

    // Primeiro buscar as conversas do contato para filtrar os eventos
    const setupRealtimeWithFilters = async () => {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', effectiveContactId);

      const conversationIds = conversations?.map(c => c.id) || [];
      console.log('📋 Conversas encontradas para realtime:', conversationIds);

      const channel = supabase
        .channel(`card-history-${cardId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_agent_history'
          },
          (payload) => {
            console.log('🔄 Realtime: conversation_agent_history changed', payload);
            // Verificar se o evento pertence a uma das conversas do contato
            const record = payload.new as any;
            if (conversationIds.includes(record?.conversation_id)) {
              console.log('✅ Evento válido, invalidando cache');
              queryClient.invalidateQueries({ queryKey: ['card-history', cardId, contactId] });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_assignments'
          },
          (payload) => {
            console.log('🔄 Realtime: conversation_assignments changed', payload);
            const record = payload.new as any;
            if (conversationIds.includes(record?.conversation_id)) {
              console.log('✅ Evento válido, invalidando cache');
              queryClient.invalidateQueries({ queryKey: ['card-history', cardId, contactId] });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pipeline_card_history',
            filter: `card_id=eq.${cardId}`
          },
          (payload) => {
            console.log('🔄 Realtime: pipeline_card_history changed', payload);
            queryClient.invalidateQueries({ queryKey: ['card-history', cardId, contactId] });
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'activities'
          },
          (payload) => {
            console.log('🔄 Realtime: activities changed', payload);
            const record = payload.new as any;
            if (record?.contact_id === contactId || record?.pipeline_card_id === cardId) {
              console.log('✅ Evento válido, invalidando cache');
              queryClient.invalidateQueries({ queryKey: ['card-history', cardId, contactId] });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'contact_tags',
            filter: `contact_id=eq.${effectiveContactId}`
          },
          (payload) => {
            console.log('🔄 Realtime: Tag adicionada', payload);
            queryClient.invalidateQueries({ queryKey: ['card-history', cardId, contactId] });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'contact_tags',
            filter: `contact_id=eq.${effectiveContactId}`
          },
          async (payload) => {
            console.log('🔄 Realtime: Tag removida', payload);
            // Registrar remoção de tag no histórico
            const oldRecord = payload.old as any;
            if (oldRecord) {
              // Buscar workspace_id do card
              const { data: cardData } = await supabase
                .from('pipeline_cards')
                .select('pipeline_id')
                .eq('id', cardId)
                .maybeSingle();

              if (cardData) {
                const { data: pipelineData } = await supabase
                  .from('pipelines')
                  .select('workspace_id')
                  .eq('id', cardData.pipeline_id)
                  .maybeSingle();

                // Buscar informações da tag removida
                const { data: tagInfo } = await supabase
                  .from('tags')
                  .select('name, color')
                  .eq('id', oldRecord.tag_id)
                  .maybeSingle();

                if (tagInfo && pipelineData) {
                  // Salvar evento de remoção no pipeline_card_history
                  await supabase
                    .from('pipeline_card_history')
                    .insert({
                      card_id: cardId,
                      action: 'tag_removed',
                      workspace_id: pipelineData.workspace_id,
                      metadata: {
                        tag_id: oldRecord.tag_id,
                        tag_name: tagInfo.name,
                        tag_color: tagInfo.color,
                        removed_at: new Date().toISOString()
                      }
                    });
                }
              }
            }
            queryClient.invalidateQueries({ queryKey: ['card-history', cardId, effectiveContactId] });
          }
        )
        .subscribe((status) => {
          console.log('🔌 Realtime connection status:', status);
        });

      return channel;
    };

    const channelPromise = setupRealtimeWithFilters();

    return () => {
      console.log('🔌 Desconectando realtime do histórico');
      channelPromise.then(channel => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, [cardId, effectiveContactId, queryClient]);

  return useQuery({
    queryKey: ['card-history', cardId, effectiveContactId],
    queryFn: async (): Promise<CardHistoryEvent[]> => {
      if (!effectiveContactId) {
        console.log('⚠️ ContactId não disponível ainda, retornando vazio');
        return [];
      }

      const headers = getHeaders();
      const allEvents: CardHistoryEvent[] = [];

      // 1. Buscar histórico de mudanças de coluna do card
      const { data: cardHistory } = await supabase
        .from('pipeline_card_history')
        .select('*')
        .eq('card_id', cardId)
        .order('changed_at', { ascending: false });

      if (cardHistory) {
        for (const event of cardHistory) {
          let description = '';
          const metadata = event.metadata as any;
          
          if (event.action === 'column_changed' && metadata) {
            const fromColumn = metadata.old_column_name || 'Desconhecida';
            const toColumn = metadata.new_column_name || 'Desconhecida';
            description = `Negócio movido: ${fromColumn} → ${toColumn}`;
          } else if (event.action === 'created') {
            description = 'Negócio iniciado por mensagem';
          } else if (event.action === 'status_changed' && metadata) {
            description = `Status alterado para: ${metadata.new_status}`;
          } else if (event.action === 'tag_removed' && metadata) {
            description = `Tag "${metadata.tag_name}" foi removida do contato`;
          }

          // Determinar o tipo de evento correto
          let eventType: CardHistoryEvent['type'] = 'column_transfer';
          if (event.action === 'tag_removed') {
            eventType = 'tag';
          }

          allEvents.push({
            id: event.id,
            type: eventType,
            action: event.action,
            description,
            timestamp: event.changed_at,
            user_name: metadata?.changed_by_name,
            metadata: event.metadata
          });
        }
      }

      // 2. Buscar conversas do contato para pegar histórico de agente e filas
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', effectiveContactId);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);

        // 2a. Histórico de ativação/desativação de agente IA
        const { data: agentHistory } = await supabase
          .from('conversation_agent_history')
          .select(`
            id,
            action,
            agent_name,
            created_at,
            metadata,
            changed_by,
            system_users:changed_by(name)
          `)
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false });

        if (agentHistory) {
          for (const event of agentHistory) {
            let description = '';
            
            if (event.action === 'activated') {
              description = `Agente **${event.agent_name}** foi ativado para esse Negócio`;
            } else if (event.action === 'deactivated') {
              description = `Agente **${event.agent_name}** foi desativado para esse Negócio`;
            } else if (event.action === 'changed') {
              description = `Agente **${event.agent_name}** foi ativado para esse Negócio`;
            }

            allEvents.push({
              id: event.id,
              type: 'agent_activity',
              action: event.action,
              description,
              timestamp: event.created_at,
              user_name: (event.system_users as any)?.name,
              metadata: event.metadata
            });
          }
        }

        // 2b. Histórico de transferências de fila e atribuições de usuário
        const { data: assignmentHistory } = await supabase
          .from('conversation_assignments')
          .select(`
            id,
            action,
            changed_at,
            from_assigned_user_id,
            to_assigned_user_id,
            from_queue_id,
            to_queue_id,
            changed_by
          `)
          .in('conversation_id', conversationIds)
          .order('changed_at', { ascending: false });

        if (assignmentHistory) {
          for (const event of assignmentHistory) {
            let description = '';
            let eventType: 'queue_transfer' | 'user_assigned' = 'user_assigned';
            let changedByName: string | undefined;

            // Buscar nome do usuário que fez a mudança
            if (event.changed_by) {
              const { data: changedByUser } = await supabase
                .from('system_users')
                .select('name')
                .eq('id', event.changed_by)
                .maybeSingle();
              changedByName = changedByUser?.name;
            }

            if (event.action === 'transfer') {
              // Buscar nomes dos usuários
              const userIds = [event.from_assigned_user_id, event.to_assigned_user_id].filter(Boolean);
              if (userIds.length > 0) {
                const { data: users } = await supabase
                  .from('system_users')
                  .select('id, name')
                  .in('id', userIds);

                const fromUser = users?.find(u => u.id === event.from_assigned_user_id);
                const toUser = users?.find(u => u.id === event.to_assigned_user_id);
                
                description = `Conversa transferida de ${fromUser?.name || 'Ninguém'} para ${toUser?.name || 'Ninguém'}`;
              }
              eventType = 'user_assigned';
            } else if (event.action === 'assign' && event.to_assigned_user_id) {
              // Buscar nome do usuário atribuído
              const { data: toUser } = await supabase
                .from('system_users')
                .select('name')
                .eq('id', event.to_assigned_user_id)
                .maybeSingle();

              description = `Conversa vinculada ao responsável: ${toUser?.name || 'Desconhecido'}`;
              eventType = 'user_assigned';
            } else if (event.action === 'queue_transfer') {
              // Buscar nomes das filas
              const queueIds = [event.from_queue_id, event.to_queue_id].filter(Boolean) as string[];
              if (queueIds.length > 0) {
                const { data: queues } = await supabase
                  .from('queues')
                  .select('id, name')
                  .in('id', queueIds);

                const fromQueue = queues?.find(q => q.id === event.from_queue_id);
                const toQueue = queues?.find(q => q.id === event.to_queue_id);
                
                description = `Conversa transferida de fila: ${fromQueue?.name || 'Nenhuma'} → ${toQueue?.name || 'Nenhuma'}`;
              } else {
                description = 'Conversa transferida de fila';
              }
              eventType = 'queue_transfer';
            }

            allEvents.push({
              id: event.id,
              type: eventType,
              action: event.action,
              description,
              timestamp: event.changed_at,
              user_name: changedByName,
            });
          }
        }
      }

      // 3. Buscar atividades do card
      const { data: activities } = await supabase
        .from('activities')
        .select(`
          id,
          type,
          subject,
          scheduled_for,
          is_completed,
          created_at,
          completed_at,
          responsible_id
        `)
        .eq('pipeline_card_id', cardId)
        .order('created_at', { ascending: false });

      if (activities) {
        // Buscar nomes dos usuários responsáveis
        const responsibleIds = activities
          .map(a => a.responsible_id)
          .filter(Boolean) as string[];
        
        const usersMap = new Map<string, string>();
        if (responsibleIds.length > 0) {
          const { data: users } = await supabase
            .from('system_users')
            .select('id, name')
            .in('id', [...new Set(responsibleIds)]);
          
          users?.forEach(user => {
            usersMap.set(user.id, user.name);
          });
        }

        for (const activity of activities) {
          // Criar evento para criação da atividade
          const activityTypeMap: Record<string, CardHistoryEvent['type']> = {
            'Lembrete': 'activity_lembrete',
            'Mensagem': 'activity_mensagem',
            'Ligação': 'activity_ligacao',
            'Reunião': 'activity_reuniao',
            'Agendamento': 'activity_agendamento'
          };

          const eventType = activityTypeMap[activity.type] || 'activity_lembrete';
          const activityTypeName = activity.type || 'Atividade';

          // Evento de criação
          allEvents.push({
            id: `${activity.id}_created`,
            type: eventType,
            action: 'created',
            description: `${activityTypeName} "${activity.subject}" foi criada`,
            timestamp: activity.created_at,
            user_name: activity.responsible_id ? usersMap.get(activity.responsible_id) : undefined,
            metadata: {
              activity_type: activity.type,
              scheduled_for: activity.scheduled_for,
              subject: activity.subject,
              status: 'created'
            }
          });

          // Evento de conclusão (se foi concluída)
          if (activity.is_completed && activity.completed_at) {
            allEvents.push({
              id: `${activity.id}_completed`,
              type: eventType,
              action: 'completed',
              description: `${activityTypeName} "${activity.subject}" foi concluída`,
              timestamp: activity.completed_at,
              user_name: activity.responsible_id ? usersMap.get(activity.responsible_id) : undefined,
              metadata: {
                activity_type: activity.type,
                scheduled_for: activity.scheduled_for,
                subject: activity.subject,
                status: 'completed'
              }
            });
          }
        }
      }

      // 4. Buscar tags adicionadas E removidas do contato
      // Primeiro buscar tags atuais (adicionadas)
      const { data: contactTags } = await supabase
        .from('contact_tags')
        .select(`
          id,
          created_at,
          created_by,
          tags:tag_id(name, color),
          system_users:created_by(name)
        `)
        .eq('contact_id', effectiveContactId)
        .order('created_at', { ascending: false });

      if (contactTags) {
        for (const tagEvent of contactTags) {
          const tagData = tagEvent.tags as any;
          const description = `Tag "${tagData?.name}" foi atribuída ao contato`;
          
          allEvents.push({
            id: tagEvent.id,
            type: 'tag' as any,
            action: 'tag_added',
            description,
            timestamp: tagEvent.created_at,
            user_name: (tagEvent.system_users as any)?.name,
            metadata: {
              tag_name: tagData?.name,
              tag_color: tagData?.color,
              action: 'added'
            }
          });
        }
      }

      // Buscar histórico de tags removidas através de audit/logs se existir
      // Como não temos uma tabela de audit, vamos registrar quando detectarmos remoções via realtime

      // Ordenar todos os eventos por data (mais recentes primeiro)
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return allEvents;
    },
    enabled: !!cardId, // Só precisa de cardId, o contactId é resolvido internamente
    staleTime: 0, // Sempre refetch para garantir dados atualizados
    refetchOnMount: true,
  });
};
