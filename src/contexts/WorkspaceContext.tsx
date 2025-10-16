import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface Workspace {
  workspace_id: string;
  name: string;
  cnpj?: string;
  slug?: string;
  created_at: string;
  updated_at: string;
  connections_count: number;
}

export interface WorkspaceContextType {
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  isLoadingWorkspaces: boolean;
  setIsLoadingWorkspaces: (loading: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { userRole } = useAuth();
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // ✅ CORREÇÃO CRÍTICA: Workspace selection logic sem alternância no refresh
  useEffect(() => {
    console.log('🔍 WorkspaceContext: useEffect triggered', {
      workspacesLength: workspaces.length,
      isLoadingWorkspaces,
      hasInitialized,
      userRole,
      selectedWorkspace: selectedWorkspace?.name
    });

    // Só executar após workspaces serem carregados
    if (isLoadingWorkspaces) {
      console.log('⏳ WorkspaceContext: Aguardando carregamento de workspaces...');
      return;
    }

    // Se não há workspaces, limpar seleção e marcar como inicializado
    if (workspaces.length === 0) {
      console.log('⚠️ WorkspaceContext: Nenhum workspace disponível');
      setSelectedWorkspaceState(null);
      localStorage.removeItem('selectedWorkspace');
      setHasInitialized(true);
      return;
    }

    // Executar apenas uma vez após carregar workspaces
    if (hasInitialized) {
      console.log('✅ WorkspaceContext: Já inicializado, pulando');
      return;
    }

    // REGRA MASTER: Usuário master NÃO deve ter workspace auto-selecionado
    if (userRole === 'master') {
      console.log('🎩 WorkspaceContext: Usuário master detectado - workspace não será auto-selecionado');
      setHasInitialized(true);
      return;
    }

    console.log('✅ WorkspaceContext: Workspaces carregados:', workspaces.map(w => `${w.name} (${w.workspace_id})`));

    // PRIORIDADE 1: Restaurar do localStorage (fonte de verdade)
    const stored = localStorage.getItem('selectedWorkspace');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const matchingWorkspace = workspaces.find(w => w.workspace_id === parsed.workspace_id);
        
        if (matchingWorkspace) {
          console.log('✅ WorkspaceContext: Restaurando workspace do localStorage:', matchingWorkspace.name);
          setSelectedWorkspaceState(matchingWorkspace);
          setHasInitialized(true);
          return;
        } else {
          console.log('⚠️ WorkspaceContext: Workspace do localStorage não encontrado na lista, limpando');
          localStorage.removeItem('selectedWorkspace');
        }
      } catch (error) {
        console.error('❌ WorkspaceContext: Erro ao parsear localStorage:', error);
        localStorage.removeItem('selectedWorkspace');
      }
    }

    // PRIORIDADE 2: Se tem exatamente 1 workspace, auto-selecionar
    if (workspaces.length === 1) {
      console.log('🎯 WorkspaceContext: Auto-selecionando único workspace:', workspaces[0].name, workspaces[0].workspace_id);
      setSelectedWorkspace(workspaces[0]);
      setHasInitialized(true);
      return;
    }

    // PRIORIDADE 3: Múltiplos workspaces, aguardar seleção manual
    console.log('📋 WorkspaceContext: Usuário tem', workspaces.length, 'workspaces, aguardando seleção manual');
    setHasInitialized(true);
  }, [workspaces, isLoadingWorkspaces, hasInitialized, userRole]);

  // Reset hasInitialized quando workspaces mudam (detecta mudança no array)
  useEffect(() => {
    if (workspaces.length > 0) {
      const currentWorkspaceIds = workspaces.map(w => w.workspace_id).sort().join(',');
      const storedIds = sessionStorage.getItem('workspace_ids');
      
      if (storedIds && storedIds !== currentWorkspaceIds) {
        console.log('🔄 Workspaces mudaram, resetando inicialização');
        setHasInitialized(false);
      }
      
      sessionStorage.setItem('workspace_ids', currentWorkspaceIds);
    }
  }, [workspaces]);

  const setSelectedWorkspace = (workspace: Workspace | null) => {
    setSelectedWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    } else {
      localStorage.removeItem('selectedWorkspace');
    }
  };

  return (
    <WorkspaceContext.Provider value={{
      selectedWorkspace,
      setSelectedWorkspace,
      workspaces,
      setWorkspaces,
      isLoadingWorkspaces,
      setIsLoadingWorkspaces
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}