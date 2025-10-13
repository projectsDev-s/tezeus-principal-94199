import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWhatsAppConversations } from './useWhatsAppConversations';
import { useNotificationSound } from './useNotificationSound';
import { toast } from '@/hooks/use-toast';

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
  const { conversations, markAsRead } = useWhatsAppConversations();
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const { playNotificationSound } = useNotificationSound();
  const [lastToastTime, setLastToastTime] = useState(0);

  // Calcular notificações com useMemo para otimização
  const { notifications, totalUnread } = useMemo(() => {
    const newNotifications: NotificationMessage[] = [];
    let unreadCount = 0;
    
    conversations.forEach((conv) => {
      const convUnreadCount = conv.unread_count || 0;
      unreadCount += convUnreadCount;
      
      if (convUnreadCount > 0) {
        const lastMsg = conv.last_message?.[0];
        
        newNotifications.push({
          id: `${conv.id}-${convUnreadCount}`,
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
    
    return { notifications: newNotifications, totalUnread: unreadCount };
  }, [conversations]);

  // Tocar som quando totalUnread aumenta
  useEffect(() => {
    if (totalUnread > previousUnreadCount && previousUnreadCount > 0) {
      playNotificationSound();
    }
    setPreviousUnreadCount(totalUnread);
  }, [totalUnread, previousUnreadCount, playNotificationSound]);

  // Toast para novas mensagens
  useEffect(() => {
    conversations.forEach((conv) => {
      if (conv.unread_count > 0 && conv.last_message?.[0]) {
        const lastMsg = conv.last_message[0];
        const now = Date.now();
        
        if (now - lastToastTime > 1000 && lastMsg.sender_type === 'contact') {
          const isMedia = ['image', 'video', 'audio', 'document'].includes(lastMsg.message_type || '');
          
          toast({
            title: `Nova mensagem de ${conv.contact.name}`,
            description: isMedia ? '📎 Mídia' : (lastMsg.content?.substring(0, 50) || '') + '...',
            duration: 4000,
          });
          setLastToastTime(now);
        }
      }
    });
  }, [conversations, lastToastTime]);

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
    const conversationsWithUnread = conversations.filter(conv => 
      conv.messages.some(msg => msg.sender_type === 'contact' && (!msg.read_at || msg.read_at === null))
    );
    await Promise.all(conversationsWithUnread.map(conv => markAsRead(conv.id)));
  };


  return {
    notifications,
    totalUnread,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp,
    markContactAsRead,
    markAllAsRead
  };
}