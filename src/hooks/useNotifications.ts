import { useState, useEffect } from 'react';
import { useNotificationSound } from './useNotificationSound';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from './useAuth';

export interface NotificationMessage {
  id: string;
  conversationId: string;
  contactId: string;
  contactName: string;
  content: string;
  messageType: string;
  timestamp: Date;
  isMedia: boolean;
  status: 'unread' | 'read';
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const { playNotificationSound } = useNotificationSound();
  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();

  // Buscar notificações do usuário atual
  const fetchNotifications = async () => {
    if (!selectedWorkspace?.workspace_id || !user?.id) {
      console.log('⚠️ Workspace ou user não disponível');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('user_id', user.id)
        .eq('status', 'unread')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar notificações:', error);
        return;
      }

      const formattedNotifications: NotificationMessage[] = (data || []).map(notif => ({
        id: notif.id,
        conversationId: notif.conversation_id,
        contactId: notif.contact_id,
        contactName: notif.title,
        content: notif.content,
        messageType: notif.message_type,
        timestamp: new Date(notif.created_at),
        isMedia: ['image', 'video', 'audio', 'document'].includes(notif.message_type),
        status: notif.status as 'unread' | 'read'
      }));

      console.log('✅ Notificações carregadas:', {
        total: formattedNotifications.length,
        notifications: formattedNotifications
      });

      setNotifications(formattedNotifications);
    } catch (err) {
      console.error('❌ Erro ao processar notificações:', err);
    }
  };

  // Carregar notificações iniciais
  useEffect(() => {
    fetchNotifications();
  }, [selectedWorkspace?.workspace_id, user?.id]);

  // Tocar som quando quantidade de notificações aumenta
  useEffect(() => {
    const totalUnread = notifications.length;
    if (totalUnread > previousUnreadCount && previousUnreadCount > 0) {
      console.log('🔔 Som de notificação:', { totalUnread, previousUnreadCount });
      playNotificationSound();
    }
    setPreviousUnreadCount(totalUnread);
  }, [notifications.length, previousUnreadCount, playNotificationSound]);

  // Real-time subscriptions para notificações
  useEffect(() => {
    console.log('🔔🔔🔔 [useNotifications] Verificando condições para subscription:', {
      hasWorkspace: !!selectedWorkspace?.workspace_id,
      hasUser: !!user?.id,
      workspaceId: selectedWorkspace?.workspace_id,
      userId: user?.id
    });

    if (!selectedWorkspace?.workspace_id || !user?.id) {
      console.log('⚠️ [useNotifications] Workspace ou user não disponível, subscription não será criada');
      return;
    }

    const userId = user.id;
    const workspaceId = selectedWorkspace.workspace_id;
    
    console.log('🔔🔔🔔 [useNotifications] CRIANDO SUBSCRIPTION DE NOTIFICAÇÕES:', {
      userId,
      workspaceId,
      channelName: `notifications-realtime-${workspaceId}-${userId}`
    });
    
    // Subscription para novas notificações e atualizações
    const notificationsChannel = supabase
      .channel(`notifications-realtime-${workspaceId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload: any) => {
          // Filtrar user_id no cliente
          if (payload.new.user_id === userId) {
            console.log('🔔🔔🔔 [Realtime] NOVA NOTIFICAÇÃO RECEBIDA!', {
              notification: payload.new,
              timestamp: new Date().toISOString()
            });
            playNotificationSound();
            fetchNotifications();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload: any) => {
          // Filtrar user_id no cliente
          if (payload.new.user_id === userId) {
            console.log('🔔 [Realtime] Notificação ATUALIZADA:', {
              old: payload.old,
              new: payload.new,
              timestamp: new Date().toISOString()
            });
            fetchNotifications();
          }
        }
      )
      .subscribe((status, err) => {
        console.log('🔔🔔🔔 [Realtime Notifications] STATUS MUDOU:', {
          status,
          error: err,
          timestamp: new Date().toISOString()
        });
        
        if (err) {
          console.error('🔔❌ [Realtime Notifications] ERRO NA SUBSCRIPTION:', err);
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('🔔✅✅✅ [Realtime Notifications] SUBSCRIPTION ATIVA E FUNCIONANDO!', {
            channel: `notifications-realtime-${workspaceId}-${userId}`,
            filters: {
              workspace_id: workspaceId,
              user_id: userId
            }
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('🔔❌ [Realtime Notifications] ERRO NO CANAL - RECONECTANDO...');
        } else if (status === 'CLOSED') {
          console.error('🔔❌ [Realtime Notifications] CANAL FECHADO');
        } else if (status === 'TIMED_OUT') {
          console.error('🔔❌ [Realtime Notifications] TIMEOUT NA CONEXÃO');
        }
      });

    return () => {
      console.log('🔕 [useNotifications] Removendo subscription de notificações');
      supabase.removeChannel(notificationsChannel);
    };
  }, [selectedWorkspace?.workspace_id, user?.id, playNotificationSound, fetchNotifications]);

  const getAvatarInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const markContactAsRead = async (conversationId: string) => {
    if (!user?.id) {
      console.log('⚠️ [markContactAsRead] User não disponível');
      return;
    }

    console.log('🔔 [markContactAsRead] Iniciando marcação para conversa:', conversationId, 'user:', user.id);

    try {
      // Marcar todas as notificações dessa conversa como lidas
      const { data, error } = await supabase
        .from('notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('conversation_id', conversationId)
        .eq('status', 'unread')
        .select();

      if (error) {
        console.error('❌ [markContactAsRead] Erro ao marcar notificação como lida:', error);
        return;
      }

      console.log('✅ [markContactAsRead] Notificações marcadas como lidas:', {
        conversationId,
        count: data?.length || 0,
        notifications: data
      });
      
      // Forçar recarregamento imediato das notificações
      await fetchNotifications();
    } catch (err) {
      console.error('❌ [markContactAsRead] Erro ao processar marcação de lida:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id || !selectedWorkspace?.workspace_id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('status', 'unread');

      if (error) {
        console.error('❌ Erro ao marcar todas como lidas:', error);
        return;
      }

      console.log('✅ Todas as notificações marcadas como lidas');
      fetchNotifications();
    } catch (err) {
      console.error('❌ Erro ao processar marcação de todas como lidas:', err);
    }
  };

  return {
    notifications,
    totalUnread: notifications.length,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp,
    markContactAsRead,
    markAllAsRead
  };
}
