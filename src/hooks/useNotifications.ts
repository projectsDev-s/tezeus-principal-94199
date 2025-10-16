import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from './useAuth';
import { useNotificationSound } from './useNotificationSound';

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
  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { playNotificationSound } = useNotificationSound();

  // Buscar notificações
  const fetchNotifications = async () => {
    if (!selectedWorkspace?.workspace_id || !user?.id) {
      console.log('⚠️ [useNotifications] Workspace ou user não disponível');
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

      if (error) throw error;

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

      console.log('✅ [useNotifications] Notificações carregadas:', formattedNotifications.length);
      setNotifications(formattedNotifications);
    } catch (err) {
      console.error('❌ [useNotifications] Erro ao buscar notificações:', err);
    }
  };

  // Carregar notificações iniciais
  useEffect(() => {
    fetchNotifications();
  }, [selectedWorkspace?.workspace_id, user?.id]);

  // Real-time subscription
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id || !user?.id) {
      console.log('⚠️ [useNotifications] Não criando subscription - dados faltando');
      return;
    }

    const workspaceId = selectedWorkspace.workspace_id;
    const userId = user.id;
    
    console.log('🔔 [useNotifications] Criando subscription de notificações:', {
      workspaceId,
      userId
    });
    
    const channel = supabase
      .channel(`notifications-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload: any) => {
          // Filtrar apenas notificações do usuário atual
          if (payload.new.user_id === userId) {
            console.log('🔔🔔🔔 [useNotifications] NOVA NOTIFICAÇÃO!', payload.new);
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
          // Filtrar apenas notificações do usuário atual
          if (payload.new.user_id === userId || payload.old?.user_id === userId) {
            console.log('🔔 [useNotifications] Notificação atualizada');
            fetchNotifications();
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 [useNotifications] Status da subscription:', status);
      });

    return () => {
      console.log('🔕 [useNotifications] Removendo subscription');
      supabase.removeChannel(channel);
    };
  }, [selectedWorkspace?.workspace_id, user?.id]);

  // Marcar conversa como lida
  const markContactAsRead = async (conversationId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('conversation_id', conversationId)
        .eq('status', 'unread');

      if (error) throw error;
      
      console.log('✅ [useNotifications] Notificações marcadas como lidas:', conversationId);
      await fetchNotifications();
    } catch (err) {
      console.error('❌ [useNotifications] Erro ao marcar como lida:', err);
    }
  };

  // Marcar todas como lidas
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

      if (error) throw error;

      console.log('✅ [useNotifications] Todas as notificações marcadas como lidas');
      await fetchNotifications();
    } catch (err) {
      console.error('❌ [useNotifications] Erro ao marcar todas como lidas:', err);
    }
  };

  // Utilitários
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

  return {
    notifications,
    totalUnread: notifications.length,
    markContactAsRead,
    markAllAsRead,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp
  };
}
