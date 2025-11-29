import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings, Home, Users, Building2, BarChart3, Settings2, BrainCircuit, LayoutDashboard, UserCircle, ListOrdered, LogOut, ArrowLeft, Edit, Trash2, Activity, Bell, AlertTriangle, Plus, Eye, EyeOff, MoreVertical } from 'lucide-react';
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
import { WhatsAppProvidersMaster } from '@/components/modules/master/WhatsAppProvidersMaster';
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
import { WorkspaceUsersModal } from '@/components/modals/WorkspaceUsersModal';
import { WorkspaceConfigModal } from '@/components/modals/WorkspaceConfigModal';
import { CreateWorkspaceModal } from '@/components/modals/CreateWorkspaceModal';
import { supabase } from '@/integrations/supabase/client';
import { RelatoriosAvancados } from '@/components/relatorios-avancados/RelatoriosAvancados';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MasterDashboard() {
  const navigate = useNavigate();
  const { workspaces, isLoading, fetchWorkspaces, deleteWorkspace, toggleWorkspaceStatus, clearCache } = useWorkspaces();
  const { setSelectedWorkspace } = useWorkspace();
  const { userRole, logout } = useAuth();
  
  // Debug workspaces
  console.log('🔍 [MasterDashboard] workspaces data:', {
    count: workspaces.length,
    workspaces: workspaces,
    isLoading,
    firstWorkspace: workspaces[0]
  });
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
          <span className="text-sm font-medium">Agentes de IA</span>
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
        {/* Excel-style Toolbar - apenas na aba Empresas */}
        {activePage === 'workspaces' && (
          <div className="bg-[#f3f3f3] border-b border-[#d4d4d4] px-3 py-1.5 shrink-0">
            <div className="flex w-full items-center gap-2">
              {/* Nova Empresa Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCreateWorkspaceModalOpen(true)}
                className="h-7 w-7 rounded-none hover:bg-gray-200 text-gray-700 border border-transparent hover:border-gray-300"
                title="Nova Empresa"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>

              <div className="h-4 w-px bg-gray-300 mx-1" />

              {/* Search Input */}
              <div className="relative flex-1 min-w-[150px] max-w-xs">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar empresas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 h-7 text-xs bg-white border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="flex-1" />

              {/* Title */}
              <span className="text-xs font-semibold text-gray-700">
                Workspaces do Master
              </span>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className={`flex-1 ${activePage === 'reports' ? 'overflow-hidden flex flex-col' : activePage === 'workspaces' ? 'overflow-hidden flex flex-col bg-white' : 'p-6 overflow-auto'}`}>
          {activePage === 'workspaces' ? (
            <div className="h-full flex flex-col">
              {/* Excel-style Table */}
              <div className="flex-1 overflow-auto p-4">
                {isLoading || isRefreshing ? (
                  <div className="bg-white border border-[#d4d4d4] shadow-sm">
                    <div className="grid grid-cols-7 bg-[#f3f3f3] border-b border-[#d4d4d4]">
                      {['Nome', 'Status', 'Conexões', 'Usuários', 'Negócios', 'Criado em', 'Ações'].map((header) => (
                        <div key={header} className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] last:border-r-0">
                          {header}
                        </div>
                      ))}
                    </div>
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="grid grid-cols-7 border-b border-[#d4d4d4] animate-pulse">
                        {[...Array(7)].map((_, j) => (
                          <div key={j} className="px-3 py-2.5 border-r border-[#d4d4d4] last:border-r-0">
                            <div className="h-4 bg-gray-200 rounded" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : filteredWorkspaces.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 bg-white border-2 border-dashed border-[#d4d4d4]">
                    <Building2 className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma empresa encontrada</h3>
                    <p className="text-gray-500 mb-4">
                      {searchQuery ? "Tente uma busca diferente" : "Comece criando uma nova empresa"}
                    </p>
                    {!searchQuery && (
                      <Button 
                        onClick={() => setCreateWorkspaceModalOpen(true)}
                        className="h-7 px-3 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Nova Empresa
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-[#d4d4d4] shadow-sm">
                    {/* Table Header */}
                    <div className="grid grid-cols-7 bg-[#f3f3f3] border-b border-[#d4d4d4] sticky top-0 z-10">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4]">
                        Nome
                      </div>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4]">
                        Status
                      </div>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4]">
                        Conexões
                      </div>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4]">
                        Usuários
                      </div>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4]">
                        Negócios
                      </div>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4]">
                        Criado em
                      </div>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-700">
                        Ações
                      </div>
                    </div>

                    {/* Table Body */}
                    {filteredWorkspaces.map((workspace) => (
                      <div
                        key={workspace.workspace_id}
                        className="grid grid-cols-7 border-b border-[#d4d4d4] hover:bg-gray-50 transition-colors"
                      >
                        {/* Nome */}
                        <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-gray-500" />
                          <span className="font-medium">{workspace.name}</span>
                        </div>

                        {/* Status */}
                        <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center">
                          <Badge 
                            variant={workspace.is_active ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0 h-5"
                          >
                            {workspace.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>

                        {/* Conexões */}
                        <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4]">
                          {workspace.connections_count || 0}
                        </div>

                        {/* Usuários */}
                        <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4]">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewUsers(workspace)}
                            className="h-5 px-2 text-[10px] hover:bg-gray-200"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                        </div>

                        {/* Negócios */}
                        <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4]">
                          -
                        </div>

                        {/* Criado em */}
                        <div className="px-3 py-2.5 text-xs text-gray-500 border-r border-[#d4d4d4]">
                          {formatDistanceToNow(new Date(workspace.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </div>

                        {/* Ações */}
                        <div className="px-3 py-2.5 text-xs flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLogin(workspace)}
                            className="h-6 px-2 text-[10px] hover:bg-gray-200"
                            title="Entrar na empresa"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewConfig(workspace)}
                            className="h-6 px-2 text-[10px] hover:bg-gray-200"
                            title="Configurações"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-gray-200"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditWorkspace(workspace)}>
                                <Edit className="mr-2 h-3.5 w-3.5" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(workspace)}>
                                {workspace.is_active ? (
                                  <>
                                    <EyeOff className="mr-2 h-3.5 w-3.5" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <Eye className="mr-2 h-3.5 w-3.5" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteWorkspace(workspace)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activePage === 'reports' ? (
            <RelatoriosAvancados workspaces={workspaces} />
          ) : activePage === 'ds-agent' ? (
            <DSAgenteMaster />
          ) : activePage === 'filas' ? (
            <AutomacoesFilasMaster />
          ) : activePage === 'usuarios' ? (
            <AdministracaoUsuarios />
          )  : activePage === 'configuracoes' ? (
            <AdministracaoConfiguracoes />
          ) : null}
        </main>

        {/* Footer */}
        <footer className="bg-card border-t border-border px-6 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tezeus CRM – Usuário Interno</span>
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
