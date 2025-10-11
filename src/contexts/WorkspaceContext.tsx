import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Unified workspace selection logic
  useEffect(() => {
    // Só executar após workspaces serem carregados
    if (workspaces.length === 0 || isLoadingWorkspaces) {
      console.log('⏳ Aguardando carregamento de workspaces...');
      return;
    }

    // Marcar como inicializado
    if (!hasInitialized) {
      console.log('✅ Workspaces carregados:', workspaces.map(w => w.name));
      setHasInitialized(true);
    }

    // Se já tem workspace selecionado, validar se ainda é válido
    if (selectedWorkspace) {
      const isStillValid = workspaces.some(w => w.workspace_id === selectedWorkspace.workspace_id);
      if (isStillValid) {
        console.log('✅ Workspace atual ainda é válido:', selectedWorkspace.name);
        return; // Workspace atual é válido, manter
      } else {
        console.log('⚠️ Workspace atual inválido, limpando:', selectedWorkspace.name);
        setSelectedWorkspaceState(null);
        localStorage.removeItem('selectedWorkspace');
      }
    }

    // Tentar restaurar do localStorage
    const stored = localStorage.getItem('selectedWorkspace');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const isValid = workspaces.some(w => w.workspace_id === parsed.workspace_id);
        
        if (isValid) {
          console.log('✅ Restaurando workspace do localStorage:', parsed.name);
          setSelectedWorkspaceState(parsed);
          return;
        } else {
          console.log('⚠️ Workspace do localStorage inválido:', parsed.name);
          localStorage.removeItem('selectedWorkspace');
        }
      } catch (error) {
        console.error('❌ Erro ao parsear localStorage:', error);
        localStorage.removeItem('selectedWorkspace');
      }
    }

    // Se chegou aqui e usuário tem exatamente 1 workspace, auto-selecionar
    if (workspaces.length === 1) {
      console.log('🎯 Auto-selecionando único workspace:', workspaces[0].name);
      setSelectedWorkspace(workspaces[0]);
    } else {
      console.log('📋 Usuário tem', workspaces.length, 'workspaces, aguardando seleção manual');
    }
  }, [workspaces, isLoadingWorkspaces, selectedWorkspace, hasInitialized]);

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