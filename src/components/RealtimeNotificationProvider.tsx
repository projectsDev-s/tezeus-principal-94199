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
  const { notifications, totalUnread } = useNotifications();

  return (
    <RealtimeNotificationContext.Provider value={{ totalUnread, notifications }}>
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
