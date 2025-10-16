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
  
  // ✅ CRÍTICO: Forçar recalculo quando mensagens mudam
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // ✅ Detectar mudanças nas mensagens das conversas
  useEffect(() => {
    setUpdateTrigger(prev => prev + 1);
  }, [conversations]);

  // ✅ Calcular notificações e unread total em tempo real
  const { notifications, totalUnread, conversationUnreadMap } = useMemo(() => {
    console.log('🔔 Recalculando notificações...', { 
      conversationsCount: conversations.length,
      trigger: updateTrigger 
    });
    
    const newNotifications: NotificationMessage[] = [];
    let unreadCount = 0;
    const unreadMap = new Map<string, number>();
    
    conversations.forEach((conv) => {
      // ✅ USAR o unread_count que vem do BACKEND (já está correto!)
      const actualUnreadCount = conv.unread_count || 0;
      
      console.log(`📊 Conversa ${conv.contact.name}:`, { 
        actualUnreadCount,
        source: 'backend_unread_count'
      });
      
      // ✅ Armazenar no mapa para uso nos badges
      if (actualUnreadCount > 0) {
        unreadMap.set(conv.id, actualUnreadCount);
      }
      
      // ✅ Contabilizar apenas mensagens não lidas NOVAS para o sino
      if (actualUnreadCount > 0) {
        const lastMsg = conv.last_message?.[0];
        
        // ✅ CRÍTICO: Usar timestamp + conversa para rastreamento preciso
        const messageKey = `${conv.id}-${lastMsg?.created_at || ''}`;
        
        // ✅ Só contabilizar se ainda não foi notificado
        if (lastMsg && !notifiedMessagesRef.current.has(messageKey)) {
          console.log('🆕 Nova notificação detectada:', { 
            contact: conv.contact.name, 
            messageKey,
            unreadCount: actualUnreadCount
          });
          
          // ✅ Somar TODOS os não lidos para o sino
          unreadCount += actualUnreadCount;
          
          newNotifications.push({
            id: `${conv.id}-${actualUnreadCount}`,
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
    
    console.log('✅ Resultado do cálculo:', { 
      totalUnread: unreadCount, 
      notificationsCount: newNotifications.length,
      unreadMapSize: unreadMap.size,
      unreadDetails: Array.from(unreadMap.entries())
    });
    
    return { 
      notifications: newNotifications, 
      totalUnread: unreadCount,
      conversationUnreadMap: unreadMap
    };
  }, [conversations, updateTrigger]);

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
    conversationUnreadMap, // ✅ Novo: mapa de unread por conversa
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp,
    markContactAsRead,
    markAllAsRead
  };
}