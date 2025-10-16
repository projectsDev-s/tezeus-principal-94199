import { createContext, useContext, ReactNode } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface RealtimeNotificationContextType {
  totalUnread: number;
  notifications: any[];
  markContactAsRead: (conversationId: string) => Promise<void>;
}

const RealtimeNotificationContext = createContext<RealtimeNotificationContextType | undefined>(undefined);

interface RealtimeNotificationProviderProps {
  children: ReactNode;
}

export function RealtimeNotificationProvider({ children }: RealtimeNotificationProviderProps) {
  // Usar o novo hook de notificações baseado na tabela dedicada
  const { notifications, totalUnread, markContactAsRead } = useNotifications();

  console.log('🔔 [RealtimeNotificationProvider] Contexto atualizado:', {
    totalUnread,
    num_notifications: notifications.length,
    notifications: notifications.map(n => ({
      contact: n.contactName,
      content: n.content
    }))
  });

  const contextValue = {
    totalUnread,
    notifications,
    markContactAsRead
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
      markContactAsRead: async () => {}
    };
  }

  return context;
}
