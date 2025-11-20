import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useEffect, useMemo, useState } from 'react';

export interface CardHistoryEvent {
  id: string;
  type:
    | 'agent_activity'
    | 'queue_transfer'
    | 'column_transfer'
    | 'pipeline_transfer'
    | 'user_assigned'
    | 'activity_lembrete'
    | 'activity_mensagem'
    | 'activity_ligacao'
    | 'activity_reuniao'
    | 'activity_agendamento'
    | 'tag';
  action: string;
  description: string;
  timestamp: string;
  user_name?: string;
  metadata?: any;
}

export const cardHistoryQueryKey = (cardId: string, contactId?: string | null) =>
  ['card-history', cardId, contactId || 'no-contact'] as const;

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
  const queryKey = useMemo(() => cardHistoryQueryKey(cardId, effectiveContactId), [cardId, effectiveContactId]);

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
              queryClient.invalidateQueries({ queryKey });
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
              queryClient.invalidateQueries({ queryKey });
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
            queryClient.invalidateQueries({ queryKey });
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
              queryClient.invalidateQueries({ queryKey });
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
          async (payload) => {
            console.log('🔄 Realtime: Tag adicionada', payload);
            const newRecord = payload.new as any;
            if (newRecord) {
              const { data: cardData } = await supabase
                .from('pipeline_cards')
                .select('pipeline_id')
                .eq('id', cardId)
                .maybeSingle();

              if (cardData) {
                const [{ data: pipelineData }, { data: tagInfo }] = await Promise.all([
                  supabase
                    .from('pipelines')
                    .select('workspace_id')
                    .eq('id', cardData.pipeline_id)
                    .maybeSingle(),
                  supabase
                    .from('tags')
                    .select('name, color')
                    .eq('id', newRecord.tag_id)
                    .maybeSingle(),
                ]);

                let createdByName: string | undefined;
                if (newRecord.created_by) {
                  const { data: createdByUser } = await supabase
                    .from('system_users')
                    .select('name')
                    .eq('id', newRecord.created_by)
                    .maybeSingle();
                  createdByName = createdByUser?.name || undefined;
                }

                if (pipelineData && tagInfo) {
                  await supabase.from('pipeline_card_history').insert({
                    card_id: cardId,
                    action: 'tag_added',
                    workspace_id: pipelineData.workspace_id,
                    metadata: {
                      tag_id: newRecord.tag_id,
                      tag_name: tagInfo.name,
                      tag_color: tagInfo.color,
                      added_at: new Date().toISOString(),
                      added_by: newRecord.created_by,
                      changed_by_name: createdByName,
                    },
                  });
                }
              }
            }

            queryClient.invalidateQueries({ queryKey });
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

                let removedByName: string | undefined;
                if (oldRecord.created_by) {
                  const { data: createdByUser } = await supabase
                    .from('system_users')
                    .select('name')
                    .eq('id', oldRecord.created_by)
                    .maybeSingle();
                  removedByName = createdByUser?.name || undefined;
                }

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
                        removed_at: new Date().toISOString(),
                        removed_by: oldRecord.created_by,
                        changed_by_name: removedByName,
                      }
                    });
                }
              }
            }
            queryClient.invalidateQueries({ queryKey });
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
  }, [cardId, effectiveContactId, queryClient, queryKey]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<CardHistoryEvent[]> => {
      if (!effectiveContactId) {
        console.log('⚠️ ContactId não disponível ainda, retornando vazio');
        return [];
      }

      const headers = getHeaders();
      const allEvents: CardHistoryEvent[] = [];
      const recordedTagAdditions = new Set<string>();

      // 1. Buscar histórico de mudanças de coluna do card
      const { data: cardHistory } = await supabase
        .from('pipeline_card_history')
        .select('*')
        .eq('card_id', cardId)
        .order('changed_at', { ascending: false });

      if (cardHistory) {
        for (const event of cardHistory) {
          const metadata = (event.metadata as any) || {};
          let description = '';
          let eventType: CardHistoryEvent['type'] = 'column_transfer';
          let eventTitle: string | undefined;

          if (event.action === 'column_changed') {
            const fromColumn = metadata.old_column_name || 'Etapa desconhecida';
            const toColumn = metadata.new_column_name || 'Etapa desconhecida';
            description = `Negócio movido: ${fromColumn} → ${toColumn}`;
            eventTitle = 'Transferência de Etapa';
          } else if (event.action === 'pipeline_changed') {
            const fromPipeline = metadata.old_pipeline_name || 'Pipeline desconhecido';
            const toPipeline = metadata.new_pipeline_name || 'Pipeline desconhecido';
            description = `Pipeline alterado: ${fromPipeline} → ${toPipeline}`;
            eventType = 'pipeline_transfer';
            eventTitle = 'Transferência de Pipeline';
          } else if (event.action === 'created') {
            description = 'Negócio criado';
            eventTitle = 'Criação do Negócio';
          } else if (event.action === 'status_changed') {
            const newStatus = metadata.new_status || 'Status desconhecido';
            description = `Status alterado para: ${newStatus}`;
            eventTitle = 'Status Atualizado';
          } else if (event.action === 'tag_removed') {
            description = `Tag "${metadata.tag_name || 'sem nome'}" foi removida do contato`;
            eventType = 'tag';
            eventTitle = 'Tag Removida';
          } else if (event.action === 'tag_added') {
            description = `Tag "${metadata.tag_name || 'sem nome'}" foi atribuída ao contato`;
            eventType = 'tag';
            eventTitle = 'Tag Atribuída';
            if (metadata.tag_id) {
              recordedTagAdditions.add(metadata.tag_id);
            }
          } else if (metadata.description) {
            description = metadata.description;
          }

          allEvents.push({
            id: event.id,
            type: eventType,
            action: event.action,
            description,
            timestamp: event.changed_at,
            user_name: metadata?.changed_by_name,
            metadata: {
              ...metadata,
              event_title: eventTitle,
            },
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

        if (assignmentHistory && assignmentHistory.length > 0) {
          const userIdsToLoad = new Set<string>();
          const queueIdsToLoad = new Set<string>();

          assignmentHistory.forEach((event) => {
            if (event.from_assigned_user_id) userIdsToLoad.add(event.from_assigned_user_id);
            if (event.to_assigned_user_id) userIdsToLoad.add(event.to_assigned_user_id);
            if (event.changed_by) userIdsToLoad.add(event.changed_by);
            if (event.from_queue_id) queueIdsToLoad.add(event.from_queue_id);
            if (event.to_queue_id) queueIdsToLoad.add(event.to_queue_id);
          });

          const usersMap = new Map<string, string>();
          if (userIdsToLoad.size > 0) {
            const { data: users } = await supabase
              .from('system_users')
              .select('id, name')
              .in('id', Array.from(userIdsToLoad));

            users?.forEach((user) => {
              usersMap.set(user.id, user.name);
            });
          }

          const queuesMap = new Map<string, string>();
          if (queueIdsToLoad.size > 0) {
            const { data: queues } = await supabase
              .from('queues')
              .select('id, name')
              .in('id', Array.from(queueIdsToLoad));

            queues?.forEach((queue) => {
              queuesMap.set(queue.id, queue.name);
            });
          }

          const formatUserName = (userId?: string | null) =>
            userId ? usersMap.get(userId) || 'Sem responsável' : 'Sem responsável';

          assignmentHistory.forEach((event) => {
            let description = '';
            let eventType: 'queue_transfer' | 'user_assigned' = 'user_assigned';
            let eventTitle = 'Conversa Atualizada';

            const fromUserName = formatUserName(event.from_assigned_user_id);
            const toUserName = formatUserName(event.to_assigned_user_id);
            const changedByName = event.changed_by ? usersMap.get(event.changed_by) : undefined;

            if (event.action === 'transfer' || (event.action === 'assign' && event.from_assigned_user_id && event.to_assigned_user_id && event.from_assigned_user_id !== event.to_assigned_user_id)) {
              description = `Conversa transferida de ${fromUserName} para ${toUserName}`;
              eventTitle = 'Conversa Transferida';
            } else if (event.action === 'assign' && event.to_assigned_user_id) {
              description = `Conversa vinculada ao responsável ${toUserName}`;
              eventTitle = 'Conversa Vinculada';
            } else if (event.action === 'assign' && !event.to_assigned_user_id && event.from_assigned_user_id) {
              description = `Conversa desvinculada do responsável ${fromUserName}`;
              eventTitle = 'Conversa Desvinculada';
            } else if (event.action === 'queue_transfer') {
              const fromQueue = event.from_queue_id ? queuesMap.get(event.from_queue_id) || 'Sem fila' : 'Sem fila';
              const toQueue = event.to_queue_id ? queuesMap.get(event.to_queue_id) || 'Sem fila' : 'Sem fila';
              description = `Conversa transferida de fila: ${fromQueue} → ${toQueue}`;
              eventType = 'queue_transfer';
              eventTitle = 'Transferência de Fila';
            } else if (!event.to_assigned_user_id && !event.from_assigned_user_id) {
              description = 'Conversa atualizada';
            }

            allEvents.push({
              id: event.id,
              type: eventType,
              action: event.action,
              description,
              timestamp: event.changed_at,
              user_name: changedByName,
              metadata: {
                event_title: eventTitle,
                from_user_name: fromUserName,
                to_user_name: toUserName,
                changed_by_name: changedByName,
                from_queue_name: eventType === 'queue_transfer' ? (event.from_queue_id ? queuesMap.get(event.from_queue_id) : undefined) : undefined,
                to_queue_name: eventType === 'queue_transfer' ? (event.to_queue_id ? queuesMap.get(event.to_queue_id) : undefined) : undefined,
              },
            });
          });
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
          tag_id,
          created_at,
          created_by,
          tags:tag_id(name, color),
          system_users:created_by(name)
        `)
        .eq('contact_id', effectiveContactId)
        .order('created_at', { ascending: false });

      if (contactTags) {
        for (const tagEvent of contactTags) {
          if (tagEvent.tag_id && recordedTagAdditions.has(tagEvent.tag_id)) {
            continue;
          }
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
              tag_id: tagEvent.tag_id,
              tag_name: tagData?.name,
              tag_color: tagData?.color,
              action: 'added',
              event_title: 'Tag Atribuída',
              changed_by_name: (tagEvent.system_users as any)?.name,
            }
          });
        }
      }

      // Buscar histórico de tags removidas através de audit/logs se existir
      // Como não temos uma tabela de audit, vamos registrar quando detectarmos remoções via realtime

      // Ordenar todos os eventos por data (mais recentes primeiro)
      allEvents.sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return a.id.localeCompare(b.id);
      });

      return allEvents;
    },
    enabled: !!cardId, // Só precisa de cardId, o contactId é resolvido internamente
    staleTime: 0, // Sempre refetch para garantir dados atualizados
    refetchOnMount: true,
  });
};
