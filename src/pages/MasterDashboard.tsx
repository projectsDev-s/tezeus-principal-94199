import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings, Home, Users, Building2, BarChart3, Settings2, BrainCircuit, LayoutDashboard, UserCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useWorkspace, Workspace } from '@/contexts/WorkspaceContext';
import { WorkspaceCard } from '@/components/master/WorkspaceCard';
import { useAuth } from '@/hooks/useAuth';

export default function MasterDashboard() {
  const navigate = useNavigate();
  const { workspaces, isLoading } = useWorkspaces();
  const { setSelectedWorkspace } = useWorkspace();
  const { userRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState<'home' | 'users' | 'workspaces' | 'reports' | 'settings'>('workspaces');

  // Verificar se o usuário é realmente master
  if (userRole !== 'master') {
    navigate('/dashboard');
    return null;
  }

  // Filtrar workspaces com base na busca
  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) return workspaces;
    
    const query = searchQuery.toLowerCase();
    return workspaces.filter(w => 
      w.name.toLowerCase().includes(query) ||
      w.cnpj?.toLowerCase().includes(query)
    );
  }, [workspaces, searchQuery]);

  const handleLogin = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    navigate('/dashboard');
  };

  const handleViewReports = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    navigate('/workspace-relatorios');
  };

  const handleViewWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    navigate('/dashboard');
  };

  const handleNavigateToAdminModule = (module: string) => {
    // Se não tiver workspace selecionado, selecionar o primeiro
    if (!filteredWorkspaces || filteredWorkspaces.length === 0) return;
    
    const workspace = filteredWorkspaces[0];
    setSelectedWorkspace(workspace);
    localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    navigate(`/${module}`);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-16 bg-card border-r border-border flex flex-col items-center py-6 gap-6">
        <button
          onClick={() => setActivePage('home')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'home' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Home"
        >
          <Home className="h-5 w-5" />
        </button>
        <button
          onClick={() => setActivePage('users')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'users' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Usuários"
        >
          <Users className="h-5 w-5" />
        </button>
        <button
          onClick={() => setActivePage('workspaces')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'workspaces' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Workspaces"
        >
          <Building2 className="h-5 w-5" />
        </button>
        <button
          onClick={() => setActivePage('reports')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'reports' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Relatórios"
        >
          <BarChart3 className="h-5 w-5" />
        </button>
        <button
          onClick={() => setActivePage('settings')}
          className={`p-3 rounded-lg transition-colors mt-auto ${
            activePage === 'settings' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Configurações"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Workspaces do Usuário Master
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie todas as empresas do sistema
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar empresa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              
              {/* Dropdown Menu de Administração */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" title="Menu de Administração">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-background z-50">
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                    Administração
                  </div>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => handleNavigateToAdminModule('automacoes-agente')}>
                    <BrainCircuit className="w-4 h-4 mr-2" />
                    DS Agente
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => handleNavigateToAdminModule('automacoes-filas')}>
                    <Users className="w-4 h-4 mr-2" />
                    Filas
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => handleNavigateToAdminModule('administracao-usuarios')}>
                    <UserCircle className="w-4 h-4 mr-2" />
                    Usuários
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => handleNavigateToAdminModule('administracao-dashboard')}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => handleNavigateToAdminModule('administracao-configuracoes')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchQuery ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery 
                  ? 'Tente ajustar sua busca ou limpar o filtro.'
                  : 'Comece criando uma nova empresa no sistema.'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Exibindo {filteredWorkspaces.length} de {workspaces.length} empresas
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredWorkspaces.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.workspace_id}
                    workspace={workspace}
                    usersCount={0}
                    conversationsCount={0}
                    onLogin={handleLogin}
                    onViewReports={handleViewReports}
                    onViewWorkspace={handleViewWorkspace}
                  />
                ))}
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-card border-t border-border px-6 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tezeus CRM – Usuário Master</span>
            <span>Versão 1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
