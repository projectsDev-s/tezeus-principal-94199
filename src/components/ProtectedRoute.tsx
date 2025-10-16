import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, userRole } = useAuth();
  const { selectedWorkspace } = useWorkspace();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se for master sem workspace selecionado e não está na dashboard master, redirecionar
  if (
    userRole === 'master' && 
    !selectedWorkspace && 
    location.pathname !== '/master-dashboard'
  ) {
    return <Navigate to="/master-dashboard" replace />;
  }

  return <>{children}</>;
};