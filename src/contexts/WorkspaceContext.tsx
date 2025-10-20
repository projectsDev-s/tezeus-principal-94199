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
  is_active?: boolean;
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

  // ✅ CORREÇÃO CRÍTICA: Workspace selection logic com verificação antecipada de localStorage
  useEffect(() => {
    console.log('🔍 WorkspaceContext: useEffect triggered', {
      workspacesLength: workspaces.length,
      isLoadingWorkspaces,
      userRole,
      selectedWorkspace: selectedWorkspace?.name || 'null',
      hasLocalStorage: localStorage.getItem('selectedWorkspace') ? 'exists' : 'missing'
    });

    // REGRA MASTER: Usuário master NÃO deve ter workspace auto-selecionado do localStorage
    if (userRole === 'master') {
      console.log('🎩 Usuário master detectado - workspace não será auto-selecionado do localStorage');
      return;
    }

    // ✅ PRIORIDADE 0: Verificar localStorage SEMPRE PRIMEIRO (antes de aguardar workspaces)
    const stored = localStorage.getItem('selectedWorkspace');
    if (stored && !selectedWorkspace) {
      try {
        const parsed = JSON.parse(stored);
        console.log('💾 Restaurando workspace do localStorage:', parsed.name);
        
        // Se workspaces já carregou, confirmar se workspace ainda é válido
        if (workspaces.length > 0) {
          const matchingWorkspace = workspaces.find(w => w.workspace_id === parsed.workspace_id);
          if (matchingWorkspace) {
            console.log('✅ Workspace confirmado na lista:', matchingWorkspace.name);
            setSelectedWorkspaceState(matchingWorkspace);
            return;
          } else {
            console.log('⚠️ Workspace do localStorage não encontrado na lista, limpando');
            localStorage.removeItem('selectedWorkspace');
            setSelectedWorkspaceState(null);
          }
        } else {
          // Workspaces ainda não carregou, setar temporariamente
          console.log('⚡ Usando workspace do localStorage temporariamente (workspaces ainda carregando)');
          setSelectedWorkspaceState(parsed);
          return;
        }
      } catch (error) {
        console.error('❌ Erro ao parsear localStorage:', error);
        localStorage.removeItem('selectedWorkspace');
      }
    }

    // Se já tem workspace selecionado E workspaces carregou, validar
    if (selectedWorkspace && workspaces.length > 0) {
      const exists = workspaces.find(w => w.workspace_id === selectedWorkspace.workspace_id);
      if (exists) {
        console.log('✅ Workspace já selecionado e confirmado:', selectedWorkspace.name);
        return;
      } else {
        console.log('⚠️ Workspace selecionado não está na lista, resetando');
        setSelectedWorkspaceState(null);
        localStorage.removeItem('selectedWorkspace');
      }
    }

    // Aguardar workspaces carregar
    if (workspaces.length === 0 || isLoadingWorkspaces) {
      console.log('⏳ Aguardando carregamento de workspaces...');
      return;
    }

    console.log('✅ Workspaces carregados:', workspaces.map(w => w.name));

    // PRIORIDADE 1: Se tem exatamente 1 workspace, auto-selecionar
    if (workspaces.length === 1) {
      console.log('🎯 Auto-selecionando único workspace:', workspaces[0].name);
      setSelectedWorkspace(workspaces[0]);
      return;
    }

    // PRIORIDADE 2: Múltiplos workspaces, aguardar seleção manual
    console.log('📋 Usuário tem', workspaces.length, 'workspaces, aguardando seleção manual');
  }, [workspaces, isLoadingWorkspaces, userRole, selectedWorkspace]);

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