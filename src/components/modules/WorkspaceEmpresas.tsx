import { useState } from "react";
import { Plus, Building2, Users, Settings, Calendar, MapPin, MoreVertical, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useAuth } from "@/hooks/useAuth";
import { CreateWorkspaceModal } from "@/components/modals/CreateWorkspaceModal";
import { WorkspaceConfigModal } from "@/components/modals/WorkspaceConfigModal";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface WorkspaceEmpresasProps {
  onNavigateToUsers?: (workspaceId: string) => void;
  onNavigateToConfig?: (workspaceId: string) => void;
}

export function WorkspaceEmpresas({ onNavigateToUsers, onNavigateToConfig }: WorkspaceEmpresasProps) {
  const { workspaces, isLoading, deleteWorkspace, fetchWorkspaces } = useWorkspaces();
  const { isMaster, isAdmin } = useWorkspaceRole();
  const { userRole } = useAuth(); // Adicionar userRole como fallback
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<any>(null);

  const handleUsersClick = (workspace: { workspace_id: string; name: string }) => {
    navigate(`/workspace-empresas/${workspace.workspace_id}/usuarios`);
  };

  const handleConfigClick = (workspace: { workspace_id: string; name: string }) => {
    setSelectedWorkspace({ id: workspace.workspace_id, name: workspace.name });
    setShowConfigModal(true);
  };

  const handleEditClick = async (workspace: any) => {
    // Fetch the connection limit for this workspace
    const { data: limitData } = await supabase
      .from('workspace_limits')
      .select('connection_limit')
      .eq('workspace_id', workspace.workspace_id)
      .single();
    
    setEditingWorkspace({
      workspace_id: workspace.workspace_id,
      name: workspace.name,
      cnpj: workspace.cnpj,
      connectionLimit: limitData?.connection_limit || 1
    });
    setShowCreateModal(true);
  };

  const handleDeleteClick = (workspace: any) => {
    setWorkspaceToDelete(workspace);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (workspaceToDelete) {
      try {
        await deleteWorkspace(workspaceToDelete.workspace_id);
        setDeleteDialogOpen(false);
        setWorkspaceToDelete(null);
        // Refresh workspaces list after deletion
        fetchWorkspaces();
      } catch (error) {
        // Error handled in hook
      }
    }
  };

  const handleCreateModalClose = (open: boolean) => {
    setShowCreateModal(open);
    if (!open) {
      setEditingWorkspace(null);
      // Refresh workspaces list after modal closes
      fetchWorkspaces();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Empresas</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="w-full h-6 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="w-3/4 h-4 bg-muted rounded" />
                  <div className="w-1/2 h-4 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-muted-foreground">
            Gerencie suas empresas e workspaces
          </p>
        </div>
        {(isMaster || userRole === 'master') && (
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Empresa
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((workspace) => (
          <Card key={workspace.workspace_id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg line-clamp-1">{workspace.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    conexões: {workspace.connections_count || 0}
                  </Badge>
                  {(isMaster || userRole === 'master') && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(isMaster || userRole === 'master') && (
                        <>
                          <DropdownMenuItem onClick={() => handleEditClick(workspace)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(workspace)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                {workspace.cnpj && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>CNPJ: {workspace.cnpj}</span>
                  </div>
                )}
                {workspace.slug && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">Slug: {workspace.slug}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Criado {formatDistanceToNow(new Date(workspace.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>
              </div>

              {(isMaster || isAdmin(workspace.workspace_id!) || userRole === 'master' || userRole === 'admin') && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleUsersClick(workspace)}
                  >
                    <Users className="w-4 h-4" />
                    Usuários
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleConfigClick(workspace)}
                  >
                    <Settings className="w-4 h-4" />
                    Config
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {workspaces.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma empresa encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {(isMaster || userRole === 'master') ? "Crie sua primeira empresa para começar" : "Nenhuma empresa atribuída"}
          </p>
          {(isMaster || userRole === 'master') && (
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Primeira Empresa
            </Button>
          )}
        </div>
      )}

      <CreateWorkspaceModal 
        open={showCreateModal} 
        onOpenChange={handleCreateModalClose}
        workspace={editingWorkspace}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              ⚠️ Tem certeza que deseja excluir a empresa "{workspaceToDelete?.name}"?<br/>
              Esta ação não pode ser desfeita e irá deletar permanentemente TODOS os dados relacionados: conversas, contatos, conexões, configurações, tags, etc.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedWorkspace && (
        <WorkspaceConfigModal
          open={showConfigModal}
          onOpenChange={setShowConfigModal}
          workspaceId={selectedWorkspace.id}
          workspaceName={selectedWorkspace.name}
        />
      )}
    </div>
  );
}