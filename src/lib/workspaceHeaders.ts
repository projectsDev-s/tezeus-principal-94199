import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useParams } from 'react-router-dom';

/**
 * Standard headers for Edge Function calls that include workspace context
 * Use this for all supabase.functions.invoke calls except list-user-workspaces
 */
export const useWorkspaceHeaders = () => {
  const { selectedWorkspace } = useWorkspace();
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId: string }>();

  const getHeaders = () => {
    // Get current user from localStorage (custom auth system)
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    if (!currentUserData?.id) {
      throw new Error('Usuário não autenticado');
    }

    // Priorizar workspaceId da URL (para Masters navegando entre workspaces)
    const workspaceId = urlWorkspaceId || selectedWorkspace?.workspace_id;
    
    if (!workspaceId) {
      throw new Error('Nenhum workspace selecionado');
    }

    console.log('🔍 [workspaceHeaders] Headers gerados:', {
      userId: currentUserData.id,
      urlWorkspaceId,
      selectedWorkspaceId: selectedWorkspace?.workspace_id,
      finalWorkspaceId: workspaceId
    });

    return {
      'x-system-user-id': currentUserData.id,
      'x-system-user-email': currentUserData.email || '',
      'x-workspace-id': workspaceId
    };
  };

  return { getHeaders };
};

/**
 * Utility function to get headers without React hook (for use in utility functions)
 */
export const getWorkspaceHeaders = (workspaceId?: string) => {
  // Get current user from localStorage (custom auth system)
  const userData = localStorage.getItem('currentUser');
  const currentUserData = userData ? JSON.parse(userData) : null;
  
  if (!currentUserData?.id) {
    throw new Error('Usuário não autenticado');
  }

  const headers: Record<string, string> = {
    'x-system-user-id': currentUserData.id,
    'x-system-user-email': currentUserData.email || ''
  };

  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }

  return headers;
};