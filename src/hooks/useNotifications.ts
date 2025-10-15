import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  
  // ✅ Rastrear mensagens já notificadas por message_id único
  const notifiedMessagesRef = useRef<Set<string>>(new Set());

  // ✅ REMOVIDO: Subscription duplicada - useWhatsAppConversations já faz isso

  // Calcular notificações com useMemo para otimização
  const { notifications, totalUnread } = useMemo(() => {
    const newNotifications: NotificationMessage[] = [];
    let unreadCount = 0;
    
    conversations.forEach((conv) => {
      const convUnreadCount = conv.unread_count || 0;
      
      // ✅ Contabilizar apenas mensagens não lidas NOVAS
      if (convUnreadCount > 0) {
        const lastMsg = conv.last_message?.[0];
        
        // ✅ CRÍTICO: Usar timestamp + conversa para rastreamento preciso (last_message não tem id)
        const messageKey = `${conv.id}-${lastMsg?.created_at || ''}`;
        
        // ✅ Só contabilizar se ainda não foi notificado
        if (lastMsg && !notifiedMessagesRef.current.has(messageKey)) {
          // ✅ Contar apenas 1 por mensagem, não o unread_count total
          unreadCount += 1;
          
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
          
          // Marcar como notificado
          notifiedMessagesRef.current.add(messageKey);
        }
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
    
    // ✅ Limpar histórico de notificações dessa conversa
    const keysToRemove = Array.from(notifiedMessagesRef.current)
      .filter(key => key.startsWith(conversationId));
    keysToRemove.forEach(key => notifiedMessagesRef.current.delete(key));
  };

  const markAllAsRead = async () => {
    const conversationsWithUnread = conversations.filter(conv => 
      conv.messages.some(msg => msg.sender_type === 'contact' && (!msg.read_at || msg.read_at === null))
    );
    await Promise.all(conversationsWithUnread.map(conv => markAsRead(conv.id)));
    
    // ✅ Limpar todo o histórico de notificações
    notifiedMessagesRef.current.clear();
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