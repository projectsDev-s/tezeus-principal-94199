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

  // Persist selected workspace in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('selectedWorkspace');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Restoring workspace from localStorage
        setSelectedWorkspaceState(parsed);
      } catch (error) {
        console.error('Error parsing stored workspace:', error);
        localStorage.removeItem('selectedWorkspace');
      }
    }
  }, []);

  // Auto-select first workspace when workspaces load and none is selected
  useEffect(() => {
    if (!selectedWorkspace && workspaces.length > 0 && !isLoadingWorkspaces) {
      // Auto-selecting first available workspace
      setSelectedWorkspace(workspaces[0]);
    }
  }, [selectedWorkspace, workspaces, isLoadingWorkspaces]);

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