import { createContext, useContext, useEffect, ReactNode, useState, useMemo, useRef } from 'react';
import { useWhatsAppConversations } from '@/hooks/useWhatsAppConversations';
import { useNotificationSound } from '@/hooks/useNotificationSound';

interface RealtimeNotificationContextType {
  totalUnread: number;
  notifications: any[];
  conversations: any[];
}

const RealtimeNotificationContext = createContext<RealtimeNotificationContextType | undefined>(undefined);

interface RealtimeNotificationProviderProps {
  children: ReactNode;
}

export function RealtimeNotificationProvider({ children }: RealtimeNotificationProviderProps) {
  // ✅ ÚNICA INSTÂNCIA de useWhatsAppConversations
  const { conversations } = useWhatsAppConversations();
  const { playNotificationSound } = useNotificationSound();
  
  // Rastrear unread_count anterior de cada conversa
  const previousUnreadMapRef = useRef<Map<string, number>>(new Map());

  // Calcular notificações com useMemo para evitar recalcular desnecessariamente
  const notificationData = useMemo(() => {
    const newNotifications: any[] = [];
    let totalUnread = 0;

    conversations.forEach((conv) => {
      const actualUnreadCount = conv.unread_count || 0;

      if (actualUnreadCount > 0) {
        totalUnread += actualUnreadCount;

        const lastMsg = conv.last_message?.[0];
        newNotifications.push({
          id: conv.id,
          conversationId: conv.id,
          contactName: conv.contact?.name || conv.contact?.phone || 'Desconhecido',
          contactPhone: conv.contact?.phone || '',
          content: lastMsg?.content || 'Nova mensagem',
          messageType: lastMsg?.message_type || 'text',
          timestamp: new Date(conv.last_activity_at || new Date()),
          isMedia: ['image', 'video', 'audio', 'document'].includes(lastMsg?.message_type || '')
        });
      }
    });

    newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      notifications: newNotifications,
      totalUnread
    };
  }, [conversations]);

  // Detectar mudanças REAIS no unread_count e tocar som apenas uma vez
  useEffect(() => {
    const currentUnreadMap = new Map<string, number>();
    let hasRealChange = false;

    // Construir mapa atual de unread_count
    conversations.forEach((conv) => {
      const currentCount = conv.unread_count || 0;
      currentUnreadMap.set(conv.id, currentCount);

      // Verificar se houve incremento real comparado ao anterior
      const previousCount = previousUnreadMapRef.current.get(conv.id) || 0;
      if (currentCount > previousCount) {
        hasRealChange = true;
        console.log('🔔 [RealtimeNotificationProvider] Mudança detectada:', {
          conversation_id: conv.id,
          contact: conv.contact?.name,
          previous: previousCount,
          current: currentCount
        });
      }
    });

    // Tocar som apenas se houve mudança real
    if (hasRealChange && previousUnreadMapRef.current.size > 0) {
      console.log('🔊 Tocando som de notificação!');
      playNotificationSound();
    }

    // Atualizar referência com os valores atuais
    previousUnreadMapRef.current = currentUnreadMap;
  }, [conversations, playNotificationSound]);

  // Atualizar título da página com notificações
  useEffect(() => {
    const originalTitle = document.title;

    if (notificationData.totalUnread > 0) {
      document.title = `(${notificationData.totalUnread}) ${originalTitle.replace(/^\(\d+\) /, '')}`;
    } else {
      document.title = originalTitle.replace(/^\(\d+\) /, '');
    }

    return () => {
      document.title = originalTitle.replace(/^\(\d+\) /, '');
    };
  }, [notificationData.totalUnread]);

  const contextValue = {
    totalUnread: notificationData.totalUnread,
    notifications: notificationData.notifications,
    conversations
  };

  console.log('🔔 [RealtimeNotificationProvider] Contexto atualizado:', {
    totalUnread: contextValue.totalUnread,
    num_notifications: contextValue.notifications.length,
    num_conversations: contextValue.conversations.length
  });

  return (
    <RealtimeNotificationContext.Provider value={contextValue}>
      {children}
    </RealtimeNotificationContext.Provider>
  );
}

export function useRealtimeNotifications() {
  const context = useContext(RealtimeNotificationContext);

  if (context === undefined) {
    return {
      totalUnread: 0,
      notifications: [],
      conversations: []
    };
  }

  return context;
}