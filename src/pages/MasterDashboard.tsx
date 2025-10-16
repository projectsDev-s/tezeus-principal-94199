import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings, Home, Users, Building2, BarChart3, Settings2, BrainCircuit, LayoutDashboard, UserCircle, ListOrdered, LogOut, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useWorkspace, Workspace } from '@/contexts/WorkspaceContext';
import { WorkspaceCard } from '@/components/master/WorkspaceCard';
import { useAuth } from '@/hooks/useAuth';
import { DSAgenteMaster } from '@/components/modules/master/DSAgenteMaster';
import { AutomacoesFilasMaster } from '@/components/modules/master/AutomacoesFilasMaster';
import { AdministracaoUsuarios } from '@/components/modules/AdministracaoUsuarios';
import { AdministracaoConfiguracoes } from '@/components/modules/AdministracaoConfiguracoes';
import { WebhooksEvolutionConfigMaster } from '@/components/modules/master/WebhooksEvolutionConfigMaster';
import { EvolutionApiConfigMaster } from '@/components/modules/master/EvolutionApiConfigMaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceRelatorios } from '@/components/modules/WorkspaceRelatorios';
import { WorkspaceUsersModal } from '@/components/modals/WorkspaceUsersModal';
import { WorkspaceConfigModal } from '@/components/modals/WorkspaceConfigModal';

export default function MasterDashboard() {
  const navigate = useNavigate();
  const { workspaces, isLoading } = useWorkspaces();
  const { setSelectedWorkspace } = useWorkspace();
  const { userRole, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState<'home' | 'users' | 'workspaces' | 'reports' | 'settings' | 'ds-agent' | 'filas' | 'usuarios' | 'configuracoes'>('workspaces');
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [selectedWorkspaceForModal, setSelectedWorkspaceForModal] = useState<Workspace | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedWorkspaceForConfig, setSelectedWorkspaceForConfig] = useState<Workspace | null>(null);

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
    navigate(`/workspace/${workspace.workspace_id}/dashboard`);
  };

  const handleViewUsers = (workspace: Workspace) => {
    setSelectedWorkspaceForModal(workspace);
    setUsersModalOpen(true);
  };

  const handleViewWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    navigate(`/workspace/${workspace.workspace_id}/dashboard`);
  };

  const handleViewConfig = (workspace: Workspace) => {
    setSelectedWorkspaceForConfig(workspace);
    setConfigModalOpen(true);
  };

  const handleNavigateToAdminPage = (page: 'ds-agent' | 'filas' | 'usuarios' | 'configuracoes') => {
    setActivePage(page);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex fixed inset-0">
      {/* Sidebar */}
      <aside className="w-16 bg-card border-r border-border flex flex-col items-center py-6 gap-4 shrink-0">
        <button
          onClick={() => setActivePage('workspaces')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'workspaces' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Empresas"
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
          onClick={() => setActivePage('usuarios')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'usuarios' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Usuários"
        >
          <UserCircle className="h-5 w-5" />
        </button>
        
        <button
          onClick={() => setActivePage('ds-agent')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'ds-agent' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="DS Agent"
        >
          <BrainCircuit className="h-5 w-5" />
        </button>
        
        <button
          onClick={() => setActivePage('filas')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'filas' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Filas"
        >
          <ListOrdered className="h-5 w-5" />
        </button>
        
        <button
          onClick={handleLogout}
          className="p-3 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted mt-auto"
          title="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
        
        <button
          onClick={() => setActivePage('configuracoes')}
          className={`p-3 rounded-lg transition-colors ${
            activePage === 'configuracoes' 
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
                {activePage === 'workspaces' && 'Workspaces do Usuário Master'}
                {activePage === 'ds-agent' && 'DS Agent - Configuração Master'}
                {activePage === 'filas' && 'Filas - Configuração Master'}
                {activePage === 'usuarios' && 'Usuários - Gestão Master'}
                {activePage === 'configuracoes' && 'Configurações - Master'}
                {activePage === 'reports' && 'Relatórios'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {activePage === 'workspaces' && 'Gerencie todas as empresas do sistema'}
                {activePage === 'ds-agent' && 'Configure agentes inteligentes de forma global'}
                {activePage === 'filas' && 'Gerencie filas de atendimento do sistema'}
                {activePage === 'usuarios' && 'Administre todos os usuários do sistema'}
                {activePage === 'configuracoes' && 'Configurações globais do sistema'}
                {activePage === 'reports' && 'Visualize métricas e estatísticas de todas as empresas'}
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
              
              {/* Menu de busca está sempre visível */}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-auto">
          {activePage === 'workspaces' ? (
            <>
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
                        onViewReports={handleViewUsers}
                        onViewWorkspace={handleViewWorkspace}
                        onViewConfig={handleViewConfig}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : activePage === 'ds-agent' ? (
            <DSAgenteMaster />
          ) : activePage === 'filas' ? (
            <AutomacoesFilasMaster />
          ) : activePage === 'usuarios' ? (
            <AdministracaoUsuarios />
          ) : activePage === 'reports' ? (
            <WorkspaceRelatorios />
          ) : activePage === 'configuracoes' ? (
            <div className="space-y-6">
              <Tabs defaultValue="personalizacao">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
                  <TabsTrigger value="webhooks">Webhooks Evolution</TabsTrigger>
                  <TabsTrigger value="evolution-api">Evolution API</TabsTrigger>
                </TabsList>
                <TabsContent value="personalizacao">
                  <AdministracaoConfiguracoes />
                </TabsContent>
                <TabsContent value="webhooks">
                  <WebhooksEvolutionConfigMaster />
                </TabsContent>
                <TabsContent value="evolution-api">
                  <EvolutionApiConfigMaster />
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </main>

        {/* Footer */}
        <footer className="bg-card border-t border-border px-6 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tezeus CRM – Usuário Master</span>
            <span>Versão 1.0.0</span>
          </div>
        </footer>
      </div>

      {/* Modal de Usuários */}
      {selectedWorkspaceForModal && (
        <WorkspaceUsersModal
          open={usersModalOpen}
          onOpenChange={setUsersModalOpen}
          workspaceId={selectedWorkspaceForModal.workspace_id}
          workspaceName={selectedWorkspaceForModal.name}
        />
      )}

      {/* Modal de Configurações */}
      {selectedWorkspaceForConfig && (
        <WorkspaceConfigModal
          open={configModalOpen}
          onOpenChange={setConfigModalOpen}
          workspaceId={selectedWorkspaceForConfig.workspace_id}
          workspaceName={selectedWorkspaceForConfig.name}
        />
      )}
    </div>
  );
}
