import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useParams } from 'react-router-dom';
import { useCallback, useRef, useEffect } from 'react';

/**
 * Standard headers for Edge Function calls that include workspace context
 * Use this for all supabase.functions.invoke calls except list-user-workspaces
 */
export const useWorkspaceHeaders = () => {
  const { selectedWorkspace } = useWorkspace();
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId: string }>();

  const getHeaders = useCallback((overrideWorkspaceId?: string) => {
    // Ler diretamente do localStorage para garantir dados atualizados
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    console.log('🔍 [workspaceHeaders] Lendo dados do usuário:', {
      hasUserData: !!currentUserData,
      userId: currentUserData?.id,
      email: currentUserData?.email
    });
    
    if (!currentUserData?.id) {
      console.error('❌ [workspaceHeaders] Usuário não autenticado - localStorage vazio');
      throw new Error('Usuário não autenticado');
    }

    // Priorizar: override > workspaceId da URL > selectedWorkspace
    const workspaceId = overrideWorkspaceId || urlWorkspaceId || selectedWorkspace?.workspace_id;
    
    if (!workspaceId) {
      console.error('❌ [workspaceHeaders] Nenhum workspace selecionado');
      throw new Error('Nenhum workspace selecionado');
    }

    console.log('🔍 [workspaceHeaders] Headers gerados:', {
      userId: currentUserData.id,
      urlWorkspaceId,
      selectedWorkspaceId: selectedWorkspace?.workspace_id,
      overrideWorkspaceId,
      finalWorkspaceId: workspaceId
    });

    return {
      'x-system-user-id': currentUserData.id,
      'x-system-user-email': currentUserData.email || '',
      'x-workspace-id': workspaceId
    };
  }, [selectedWorkspace?.workspace_id, urlWorkspaceId]);

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
  } else {
    // Try to get from current workspace context if available
    const selectedWorkspace = localStorage.getItem('selectedWorkspace');
    if (selectedWorkspace) {
      const workspace = JSON.parse(selectedWorkspace);
      headers['x-workspace-id'] = workspace.workspace_id;
    }
  }

  return headers;
};