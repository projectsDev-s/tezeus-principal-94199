import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface RealtimeNotificationContextType {
  totalUnread: number;
  notifications: any[];
}

const RealtimeNotificationContext = createContext<RealtimeNotificationContextType | undefined>(undefined);

interface RealtimeNotificationProviderProps {
  children: ReactNode;
}

export function RealtimeNotificationProvider({ children }: RealtimeNotificationProviderProps) {
  console.log('🔔🔔🔔 [RealtimeNotificationProvider] Componente MONTADO');
  
  const { notifications, totalUnread } = useNotifications();
  
  console.log('🔔🔔🔔 [RealtimeNotificationProvider] Hook retornou:', {
    notifications: notifications.length,
    totalUnread
  });

  useEffect(() => {
    console.log('🔔🔔🔔 [RealtimeNotificationProvider] Notificações MUDARAM:', {
      totalUnread,
      num_notifications: notifications.length,
      timestamp: new Date().toISOString(),
      notifications: notifications.map(n => ({
        contact: n.contactName,
        content: n.content
      }))
    });
  }, [notifications, totalUnread]);

  const contextValue = useMemo(() => ({
    totalUnread,
    notifications
  }), [totalUnread, notifications]);

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
      notifications: []
    };
  }

  return context;
}
