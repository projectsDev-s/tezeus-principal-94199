import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useEffect } from 'react';

export interface CardHistoryEvent {
  id: string;
  type: 'agent_activity' | 'queue_transfer' | 'column_transfer' | 'user_assigned' | 'activity' | 'tag' | 'message';
  action: string;
  description: string;
  timestamp: string;
  user_name?: string;
  metadata?: any;
}

export const useCardHistory = (cardId: string, contactId: string) => {
  const { getHeaders } = useWorkspaceHeaders();
  const queryClient = useQueryClient();

  // Adicionar realtime listener para atualizar automaticamente
  useEffect(() => {
    if (!cardId || !contactId) return;

    console.log('🔌 Configurando realtime para histórico do card:', cardId);

    // Primeiro buscar as conversas do contato para filtrar os eventos
    const setupRealtimeWithFilters = async () => {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId);

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
            event: '*',
            schema: 'public',
            table: 'contact_tags',
            filter: `contact_id=eq.${contactId}`
          },
          (payload) => {
            console.log('🔄 Realtime: contact_tags changed', payload);
            queryClient.invalidateQueries({ queryKey: ['card-history', cardId, contactId] });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          (payload) => {
            console.log('🔄 Realtime: messages changed', payload);
            const record = payload.new as any;
            if (conversationIds.includes(record?.conversation_id)) {
              console.log('✅ Nova mensagem, invalidando cache');
              queryClient.invalidateQueries({ queryKey: ['card-history', cardId, contactId] });
            }
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
  }, [cardId, contactId, queryClient]);

  return useQuery({
    queryKey: ['card-history', cardId, contactId],
    queryFn: async (): Promise<CardHistoryEvent[]> => {
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
          }

          allEvents.push({
            id: event.id,
            type: 'column_transfer',
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
        .eq('contact_id', contactId);

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
              description = 'Conversa transferida de fila';
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
          responsible_id,
          system_users:responsible_id(name)
        `)
        .eq('pipeline_card_id', cardId)
        .order('created_at', { ascending: false });

      if (activities) {
        for (const activity of activities) {
          const description = `Atividade "${activity.subject}" ${activity.is_completed ? 'foi concluída' : 'foi criada'}`;
          
          allEvents.push({
            id: activity.id,
            type: 'activity' as any,
            action: activity.is_completed ? 'completed' : 'created',
            description,
            timestamp: activity.created_at,
            user_name: (activity.system_users as any)?.name,
            metadata: {
              activity_type: activity.type,
              scheduled_for: activity.scheduled_for,
              subject: activity.subject
            }
          });
        }
      }

      // 4. Buscar tags adicionadas ao contato
      const { data: contactTags } = await supabase
        .from('contact_tags')
        .select(`
          id,
          created_at,
          created_by,
          tags:tag_id(name, color),
          system_users:created_by(name)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (contactTags) {
        for (const tagEvent of contactTags) {
          const tagData = tagEvent.tags as any;
          const description = `Tag "${tagData?.name}" foi adicionada ao contato`;
          
          allEvents.push({
            id: tagEvent.id,
            type: 'tag' as any,
            action: 'tag_added',
            description,
            timestamp: tagEvent.created_at,
            user_name: (tagEvent.system_users as any)?.name,
            metadata: {
              tag_name: tagData?.name,
              tag_color: tagData?.color
            }
          });
        }
      }

      // 5. Buscar mensagens importantes (apenas do contato, para não ficar muito grande)
      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        
        const { data: messages } = await supabase
          .from('messages')
          .select('id, content, created_at, sender_type, message_type')
          .in('conversation_id', conversationIds)
          .eq('sender_type', 'contact')
          .order('created_at', { ascending: false })
          .limit(50); // Limitar para não trazer muitas mensagens

        if (messages) {
          for (const message of messages) {
            let description = '';
            if (message.message_type === 'text') {
              const preview = message.content.length > 50 
                ? message.content.substring(0, 50) + '...' 
                : message.content;
              description = `Mensagem do contato: "${preview}"`;
            } else {
              description = `Contato enviou ${message.message_type}`;
            }
            
            allEvents.push({
              id: message.id,
              type: 'message' as any,
              action: 'message_received',
              description,
              timestamp: message.created_at,
              metadata: {
                message_type: message.message_type
              }
            });
          }
        }
      }

      // Ordenar todos os eventos por data (mais recentes primeiro)
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return allEvents;
    },
    enabled: !!cardId && !!contactId,
  });
};
