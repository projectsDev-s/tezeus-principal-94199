import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { useWhatsAppConversations } from '@/hooks/useWhatsAppConversations';
import { useNotificationSound } from '@/hooks/useNotificationSound';

interface RealtimeNotificationContextType {
  totalUnread: number;
  notifications: any[];
  conversationUnreadMap: Map<string, number>;
  conversations: any[]; // ✅ Expor conversations para compartilhar
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
  
  // ✅ NOVO: useState ao invés de useMemo para forçar recriação do Map
  const [notificationData, setNotificationData] = useState<{
    notifications: any[];
    totalUnread: number;
    conversationUnreadMap: Map<string, number>;
  }>({
    notifications: [],
    totalUnread: 0,
    conversationUnreadMap: new Map()
  });

  // ✅ CRÍTICO: useEffect recalcula sempre que conversations mudar
  useEffect(() => {
    console.log('🔔 [Provider] Recalculando notificações via useEffect...', {
      conversationsCount: conversations.length,
      conversationsData: conversations.map(c => ({ id: c.id, name: c.contact?.name, unread: c.unread_count }))
    });

    const newNotifications: any[] = [];
    let unreadCount = 0;
    const unreadMap = new Map<string, number>();

    conversations.forEach((conv) => {
      const actualUnreadCount = conv.unread_count || 0;

      console.log(`📊 [Provider] [${conv.contact?.name}] unread_count:`, actualUnreadCount);

      if (actualUnreadCount > 0) {
        unreadMap.set(conv.id, actualUnreadCount);
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

    console.log('✅ [Provider] Total calculado via useEffect:', {
      totalUnread: unreadCount,
      notificationsCount: newNotifications.length,
      conversationsWithUnread: unreadMap.size,
      mapEntries: Array.from(unreadMap.entries())
    });

    // ✅ CRÍTICO: Sempre cria um novo objeto e Map, forçando re-render
    setNotificationData({
      notifications: newNotifications,
      totalUnread: unreadCount,
      conversationUnreadMap: unreadMap
    });
  }, [conversations]); // Dependência direta em conversations

  // ✅ Tocar som quando totalUnread aumenta
  useEffect(() => {
    if (notificationData.totalUnread > previousUnreadCount && previousUnreadCount > 0) {
      console.log('🔔 Som de notificação:', { totalUnread: notificationData.totalUnread, previousUnreadCount });
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
    conversationUnreadMap: notificationData.conversationUnreadMap,
    conversations // ✅ Expor conversations
  };

  return (
    <RealtimeNotificationContext.Provider value={contextValue}>
      {children}
    </RealtimeNotificationContext.Provider>
  );
}

export function useRealtimeNotifications() {
  const context = useContext(RealtimeNotificationContext);

  // ✅ Retornar valores padrão se não estiver dentro do Provider
  if (context === undefined) {
    return {
      totalUnread: 0,
      notifications: [],
      conversationUnreadMap: new Map<string, number>(),
      conversations: []
    };
  }

  return context;
}