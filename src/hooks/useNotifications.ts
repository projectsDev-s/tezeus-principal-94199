import { useState, useEffect, useMemo } from 'react';
import { useWhatsAppConversations } from './useWhatsAppConversations';
import { useNotificationSound } from './useNotificationSound';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface NotificationMessage {
  id: string;
  conversationId: string;
  contactName: string;
  contactPhone: string;
  content: string;
  messageType: string;
  timestamp: Date;
  isMedia: boolean;
}

export function useNotifications() {
  const { conversations, markAsRead, fetchConversations } = useWhatsAppConversations();
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const { playNotificationSound } = useNotificationSound();
  const { selectedWorkspace } = useWorkspace();

  // ✅ Criar hash para forçar recálculo quando unread_count mudar
  const conversationsHash = useMemo(() => {
    return conversations.map(c => `${c.id}:${c.unread_count}`).join('|');
  }, [conversations]);

  // ✅ Calcular notificações com dependência no hash
  const { notifications, totalUnread, conversationUnreadMap } = useMemo(() => {
    console.log('🔔 Recalculando notificações...', { 
      conversationsCount: conversations.length,
      hash: conversationsHash
    });
    
    const newNotifications: NotificationMessage[] = [];
    let unreadCount = 0;
    const unreadMap = new Map<string, number>();
    
    conversations.forEach((conv) => {
      const actualUnreadCount = conv.unread_count || 0;
      
      console.log(`📊 [${conv.contact.name}] unread_count:`, actualUnreadCount);
      
      if (actualUnreadCount > 0) {
        unreadMap.set(conv.id, actualUnreadCount);
        unreadCount += actualUnreadCount;
        
        const lastMsg = conv.last_message?.[0];
        newNotifications.push({
          id: conv.id,
          conversationId: conv.id,
          contactName: conv.contact.name,
          contactPhone: conv.contact.phone,
          content: lastMsg?.content || 'Nova mensagem',
          messageType: lastMsg?.message_type || 'text',
          timestamp: new Date(conv.last_activity_at || new Date()),
          isMedia: ['image', 'video', 'audio', 'document'].includes(lastMsg?.message_type || '')
        });
      }
    });
    
    newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    console.log('✅ Total calculado:', { 
      totalUnread: unreadCount,
      notificationsCount: newNotifications.length,
      conversationsWithUnread: unreadMap.size,
      details: Array.from(unreadMap.entries())
    });
    
    return { 
      notifications: newNotifications, 
      totalUnread: unreadCount,
      conversationUnreadMap: unreadMap
    };
  }, [conversations, conversationsHash]);

  // ✅ Tocar som quando totalUnread aumenta
  useEffect(() => {
    if (totalUnread > previousUnreadCount && previousUnreadCount > 0) {
      console.log('🔔 Som de notificação:', { totalUnread, previousUnreadCount });
      playNotificationSound();
    }
    setPreviousUnreadCount(totalUnread);
  }, [totalUnread, previousUnreadCount, playNotificationSound]);

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
    await markAsRead(conversationId);
  };

  const markAllAsRead = async () => {
    const conversationsWithUnread = conversations.filter(conv => conv.unread_count > 0);
    await Promise.all(conversationsWithUnread.map(conv => markAsRead(conv.id)));
  };


  return {
    notifications,
    totalUnread,
    conversationUnreadMap, // ✅ Novo: mapa de unread por conversa
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp,
    markContactAsRead,
    markAllAsRead
  };
}