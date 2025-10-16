import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
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
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  
  const [notificationData, setNotificationData] = useState<{
    notifications: any[];
    totalUnread: number;
  }>({
    notifications: [],
    totalUnread: 0
  });

  useEffect(() => {
    const newNotifications: any[] = [];
    let unreadCount = 0;

    conversations.forEach((conv) => {
      const actualUnreadCount = conv.unread_count || 0;

      if (actualUnreadCount > 0) {
        unreadCount += actualUnreadCount;

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

    setNotificationData({
      notifications: newNotifications,
      totalUnread: unreadCount
    });
  }, [conversations]);

  useEffect(() => {
    if (notificationData.totalUnread > previousUnreadCount && previousUnreadCount > 0) {
      playNotificationSound();
    }
    setPreviousUnreadCount(notificationData.totalUnread);
  }, [notificationData.totalUnread, previousUnreadCount, playNotificationSound]);

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