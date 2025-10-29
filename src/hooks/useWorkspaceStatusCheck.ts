import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function useWorkspaceStatusCheck() {
  const { userRole, logout } = useAuth();
  const { selectedWorkspace } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    // Masters não precisam dessa verificação
    if (userRole === 'master' || !selectedWorkspace) return;

    const checkWorkspaceStatus = async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('is_active')
        .eq('id', selectedWorkspace.workspace_id)
        .single();

      if (!error && data && (data as any).is_active === false) {
        // Workspace inativo - forçar logout
        toast.error('Sua empresa foi inativada. Entre em contato com o administrador.');
        await logout();
        navigate('/login');
      }
    };

    // Verificar imediatamente
    checkWorkspaceStatus();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkWorkspaceStatus, 30000);

    return () => clearInterval(interval);
  }, [selectedWorkspace, userRole, logout, navigate]);
}
