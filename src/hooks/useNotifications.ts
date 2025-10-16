import { useState, useEffect, useMemo } from 'react';
import { useNotificationSound } from './useNotificationSound';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from './useAuth';

export interface NotificationMessage {
  id: string;
  conversationId: string;
  contactName: string;
  contactPhone: string;
  content: string;
  messageType: string;
  timestamp: Date;
  isMedia: boolean;
  notificationId: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const { playNotificationSound } = useNotificationSound();
  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();
  
  // Buscar notificações não lidas do usuário atual
  const fetchNotifications = async () => {
    if (!selectedWorkspace?.workspace_id || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          conversation_id,
          contact_id,
          title,
          content,
          message_type,
          created_at,
          contacts!inner(phone)
        `)
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('user_id', user.id)
        .eq('status', 'unread')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar notificações:', error);
        return;
      }

      const formattedNotifications: NotificationMessage[] = (data || []).map(n => ({
        id: n.id,
        notificationId: n.id,
        conversationId: n.conversation_id,
        contactName: n.title,
        contactPhone: n.contacts?.phone || '',
        content: n.content,
        messageType: n.message_type,
        timestamp: new Date(n.created_at),
        isMedia: ['image', 'video', 'audio', 'document'].includes(n.message_type)
      }));

      console.log('🔔 Notificações carregadas:', {
        total: formattedNotifications.length,
        notifications: formattedNotifications
      });

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('❌ Erro ao buscar notificações:', error);
    }
  };

  // Carregar notificações ao montar e quando workspace/user mudar
  useEffect(() => {
    fetchNotifications();
  }, [selectedWorkspace?.workspace_id, user?.id]);

  // Tocar som quando novas notificações chegam
  useEffect(() => {
    const currentCount = notifications.length;
    if (currentCount > previousUnreadCount && previousUnreadCount > 0) {
      console.log('🔔 Som de notificação:', { currentCount, previousUnreadCount });
      playNotificationSound();
    }
    setPreviousUnreadCount(currentCount);
  }, [notifications.length, previousUnreadCount, playNotificationSound]);

  // Real-time subscription para novas notificações
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id || !user?.id) return;

    const workspaceId = selectedWorkspace.workspace_id;
    const userId = user.id;
    
    console.log('🔔 Iniciando subscription de notificações para:', { workspaceId, userId });
    
    const notificationsChannel = supabase
      .channel(`user-notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('🔔 Nova notificação recebida:', payload.new);
        fetchNotifications();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('🔔 Notificação atualizada:', payload.new);
        fetchNotifications();
      })
      .subscribe();

    return () => {
      console.log('🔕 Removendo subscription de notificações');
      supabase.removeChannel(notificationsChannel);
    };
  }, [selectedWorkspace?.workspace_id, user?.id]);

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
    try {
      // Marcar todas as notificações desta conversa como lidas
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', user?.id)
        .eq('status', 'unread');

      if (error) {
        console.error('❌ Erro ao marcar notificações como lidas:', error);
        return;
      }

      console.log('✅ Notificações marcadas como lidas para conversa:', conversationId);
      await fetchNotifications();
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('workspace_id', selectedWorkspace?.workspace_id)
        .eq('user_id', user?.id)
        .eq('status', 'unread');

      if (error) {
        console.error('❌ Erro ao marcar todas como lidas:', error);
        return;
      }

      console.log('✅ Todas as notificações marcadas como lidas');
      await fetchNotifications();
    } catch (error) {
      console.error('❌ Erro ao marcar todas como lidas:', error);
    }
  };

  return {
    notifications,
    totalUnread: notifications.length,
    conversationUnreadMap: new Map(), // Mantido para compatibilidade
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp,
    markContactAsRead,
    markAllAsRead
  };
}