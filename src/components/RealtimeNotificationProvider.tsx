import { createContext, useContext, ReactNode } from 'react';
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
  // Usar o novo hook de notificações baseado na tabela dedicada
  const { notifications, totalUnread } = useNotifications();

  console.log('🔔 [RealtimeNotificationProvider] Contexto atualizado:', {
    totalUnread,
    num_notifications: notifications.length,
    timestamp: new Date().toISOString(),
    notifications: notifications.map(n => ({
      contact: n.contactName,
      content: n.content
    }))
  });

  // Forçar criação de novo objeto para garantir re-render
  const contextValue = {
    totalUnread,
    notifications: [...notifications] // Criar novo array
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
      notifications: []
    };
  }

  return context;
}
