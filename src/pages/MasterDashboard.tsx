import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings, Home, Users, Building2, BarChart3, Settings2, BrainCircuit, LayoutDashboard, UserCircle, ListOrdered, LogOut, ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useWorkspace, Workspace } from '@/contexts/WorkspaceContext';
import { WorkspaceCard } from '@/components/master/WorkspaceCard';
import { useAuth } from '@/hooks/useAuth';
import { DSAgenteMaster } from '@/components/modules/master/DSAgenteMaster';
import { AutomacoesFilasMaster } from '@/components/modules/master/AutomacoesFilasMaster';
import { AdministracaoUsuarios } from '@/components/modules/AdministracaoUsuarios';
import { AdministracaoConfiguracoes } from '@/components/modules/AdministracaoConfiguracoes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WorkspaceRelatorios } from '@/components/modules/WorkspaceRelatorios';
import { WorkspaceUsersModal } from '@/components/modals/WorkspaceUsersModal';
import { WorkspaceConfigModal } from '@/components/modals/WorkspaceConfigModal';
import { CreateWorkspaceModal } from '@/components/modals/CreateWorkspaceModal';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function MasterDashboard() {
  const navigate = useNavigate();
  const { workspaces, isLoading, fetchWorkspaces, deleteWorkspace, toggleWorkspaceStatus, clearCache } = useWorkspaces();
  const { setSelectedWorkspace } = useWorkspace();
  const { userRole, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState<'home' | 'users' | 'workspaces' | 'reports' | 'settings' | 'ds-agent' | 'filas' | 'usuarios' | 'configuracoes'>('workspaces');
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [selectedWorkspaceForModal, setSelectedWorkspaceForModal] = useState<Workspace | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedWorkspaceForConfig, setSelectedWorkspaceForConfig] = useState<Workspace | null>(null);
  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [toggleActiveDialogOpen, setToggleActiveDialogOpen] = useState(false);
  const [workspaceToToggle, setWorkspaceToToggle] = useState<Workspace | null>(null);
  const [toggleConfirmationText, setToggleConfirmationText] = useState('');

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

  const handleEditWorkspace = async (workspace: Workspace) => {
    // Buscar connection limit e user limit para esta workspace
    const { data: limitData } = await supabase
      .from('workspace_limits')
      .select('connection_limit, user_limit')
      .eq('workspace_id', workspace.workspace_id)
      .single();
    
    setEditingWorkspace({
      ...workspace,
      connectionLimit: limitData?.connection_limit || 1,
      userLimit: limitData?.user_limit || 5
    });
    setCreateWorkspaceModalOpen(true);
  };

  const handleDeleteWorkspace = (workspace: Workspace) => {
    setWorkspaceToDelete(workspace);
    setDeleteDialogOpen(true);
    setDeleteConfirmationText(''); // Resetar o input de confirmação
  };

  const confirmDelete = async () => {
    if (workspaceToDelete) {
      try {
        setIsRefreshing(true);
        await deleteWorkspace(workspaceToDelete.workspace_id);
        setDeleteDialogOpen(false);
        setWorkspaceToDelete(null);
        
        // Limpar cache e atualizar lista
        clearCache?.();
        await fetchWorkspaces();
      } catch (error) {
        // Error handled in hook
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const handleToggleActive = (workspace: Workspace) => {
    setWorkspaceToToggle(workspace);
    setToggleActiveDialogOpen(true);
    setToggleConfirmationText('');
  };

  const confirmToggleActive = async () => {
    if (!workspaceToToggle) return;
    
    setIsRefreshing(true);
    try {
      await toggleWorkspaceStatus(
        workspaceToToggle.workspace_id, 
        !(workspaceToToggle.is_active !== false)
      );
      setToggleActiveDialogOpen(false);
      setWorkspaceToToggle(null);
      setToggleConfirmationText('');
      
      // Refresh com delay
      setTimeout(async () => {
        clearCache?.();
        await fetchWorkspaces();
        setIsRefreshing(false);
      }, 500);
    } catch (error) {
      setIsRefreshing(false);
    }
  };

  const handleCreateModalClose = async (open: boolean) => {
    setCreateWorkspaceModalOpen(open);
    if (!open) {
      setEditingWorkspace(null);
      
      // Limpar cache e atualizar lista ao fechar modal
      setIsRefreshing(true);
      clearCache?.();
      await fetchWorkspaces();
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex fixed inset-0">
      {/* Sidebar */}
      <aside className="w-48 bg-card border-r border-border flex flex-col py-6 px-3 gap-2 shrink-0">
        <button
          onClick={() => setActivePage('workspaces')}
          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
            activePage === 'workspaces' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Building2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Empresas</span>
        </button>
        
        <button
          onClick={() => setActivePage('reports')}
          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
            activePage === 'reports' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <BarChart3 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Relatórios</span>
        </button>
        
        <button
          onClick={() => setActivePage('usuarios')}
          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
            activePage === 'usuarios' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <UserCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Usuários</span>
        </button>
        
        <button
          onClick={() => setActivePage('ds-agent')}
          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
            activePage === 'ds-agent' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <BrainCircuit className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Agente de IA</span>
        </button>
        
        <button
          onClick={() => setActivePage('filas')}
          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
            activePage === 'filas' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <ListOrdered className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Filas</span>
        </button>
        
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted mt-auto"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Sair</span>
        </button>
        
        <button
          onClick={() => setActivePage('configuracoes')}
          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
            activePage === 'configuracoes' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Settings2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Configurações</span>
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
              {activePage === 'workspaces' && (
                <Button onClick={() => setCreateWorkspaceModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Empresa
                </Button>
              )}
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
              {isLoading || isRefreshing ? (
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
                        onLogin={handleLogin}
                        onViewReports={handleViewUsers}
                        onViewWorkspace={handleViewWorkspace}
                        onViewConfig={handleViewConfig}
                        onEdit={handleEditWorkspace}
                        onDelete={handleDeleteWorkspace}
                        onToggleActive={handleToggleActive}
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
            <AdministracaoConfiguracoes />
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

      {/* Modal de Criar/Editar Empresa */}
      <CreateWorkspaceModal 
        open={createWorkspaceModalOpen} 
        onOpenChange={handleCreateModalClose}
        workspace={editingWorkspace ? {
          workspace_id: editingWorkspace.workspace_id,
          name: editingWorkspace.name,
          cnpj: editingWorkspace.cnpj,
          connectionLimit: (editingWorkspace as any).connectionLimit || 1
        } : undefined}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteConfirmationText('');
            setWorkspaceToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmar exclusão da empresa</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Tem certeza que deseja excluir a empresa <strong>"{workspaceToDelete?.name}"</strong>?
              </p>
              <p className="text-destructive font-semibold">
                Esta ação não pode ser desfeita e irá deletar permanentemente TODOS os dados relacionados: conversas, contatos, conexões, configurações, tags, etc.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirmation">
                  Para confirmar, digite <strong>"excluir empresa"</strong> no campo abaixo:
                </Label>
                <Input
                  id="delete-confirmation"
                  type="text"
                  placeholder="Digite 'excluir empresa' para confirmar"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  autoComplete="off"
                  className="border-destructive focus-visible:ring-destructive"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteConfirmationText !== 'excluir empresa'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Excluir Empresa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog de Inativar/Ativar */}
      <AlertDialog
        open={toggleActiveDialogOpen}
        onOpenChange={(open) => {
          setToggleActiveDialogOpen(open);
          if (!open) {
            setToggleConfirmationText('');
            setWorkspaceToToggle(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {workspaceToToggle?.is_active !== false ? '⚠️ Inativar Empresa' : '✅ Ativar Empresa'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Tem certeza que deseja <strong>{workspaceToToggle?.is_active !== false ? 'inativar' : 'ativar'}</strong> a empresa{' '}
                <strong>"{workspaceToToggle?.name}"</strong>?
              </p>
              {workspaceToToggle?.is_active !== false && (
                <>
                  <p className="text-orange-600 font-semibold">
                    Ao inativar a empresa:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Todos os usuários (exceto masters) serão deslogados imediatamente</li>
                    <li>Todas as instâncias WhatsApp serão desconectadas</li>
                    <li>Novos logins serão bloqueados</li>
                    <li>Os dados permanecerão intactos</li>
                    <li>Você pode reativar a empresa a qualquer momento</li>
                  </ul>
                  <div className="space-y-2">
                    <Label htmlFor="toggle-confirmation">
                      Para confirmar, digite <strong>"inativar empresa"</strong> no campo abaixo:
                    </Label>
                    <Input
                      id="toggle-confirmation"
                      type="text"
                      placeholder="Digite 'inativar empresa' para confirmar"
                      value={toggleConfirmationText}
                      onChange={(e) => setToggleConfirmationText(e.target.value)}
                      autoComplete="off"
                      className="border-orange-500 focus-visible:ring-orange-500"
                    />
                  </div>
                </>
              )}
              {workspaceToToggle?.is_active === false && (
                <p className="text-green-600 font-semibold">
                  A empresa será reativada e os usuários poderão fazer login normalmente.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleActive}
              disabled={workspaceToToggle?.is_active !== false && toggleConfirmationText !== 'inativar empresa'}
              className={
                workspaceToToggle?.is_active !== false
                  ? 'bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }
            >
              {workspaceToToggle?.is_active !== false ? 'Inativar Empresa' : 'Ativar Empresa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
