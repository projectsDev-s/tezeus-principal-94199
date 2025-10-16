import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface RealtimeNotificationContextType {
  totalUnread: number;
  notifications: any[];
  conversationUnreadMap: Map<string, number>; // ✅ Novo: mapa de unread por conversa
}

const RealtimeNotificationContext = createContext<RealtimeNotificationContextType | undefined>(undefined);

interface RealtimeNotificationProviderProps {
  children: ReactNode;
}

export function RealtimeNotificationProvider({ children }: RealtimeNotificationProviderProps) {
  const { notifications, totalUnread, conversationUnreadMap } = useNotifications();

  // Atualizar título da página com notificações
  useEffect(() => {
    const originalTitle = document.title;
    
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ${originalTitle.replace(/^\(\d+\) /, '')}`;
    } else {
      document.title = originalTitle.replace(/^\(\d+\) /, '');
    }

    return () => {
      document.title = originalTitle.replace(/^\(\d+\) /, '');
    };
  }, [totalUnread]);

  const contextValue = {
    totalUnread,
    notifications,
    conversationUnreadMap // ✅ Novo: passar mapa para contexto
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
    throw new Error('useRealtimeNotifications must be used within a RealtimeNotificationProvider');
  }
  return context;
}