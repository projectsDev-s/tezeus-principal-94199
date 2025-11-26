import React, { useState, useEffect } from "react";
import { User, UserPlus, Edit, Trash, Eye, EyeOff, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceMembers, WorkspaceMember } from "@/hooks/useWorkspaceMembers";
import { useWorkspaceConnections } from "@/hooks/useWorkspaceConnections";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCargos } from "@/hooks/useCargos";
import { AdicionarEditarUsuarioModal } from "./AdicionarEditarUsuarioModal";
import { DeletarUsuarioModal } from "./DeletarUsuarioModal";
import { useSystemUsers } from "@/hooks/useSystemUsers";

interface WorkspaceUsersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

const roleLabels = {
  user: 'Usuário',
  admin: 'Administrador',
  master: 'Master'
};

const roleVariants = {
  user: 'secondary' as const,
  admin: 'default' as const,
  master: 'destructive' as const
};

export function WorkspaceUsersModal({ open, onOpenChange, workspaceId, workspaceName }: WorkspaceUsersModalProps) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin' | 'master'>('user');
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [defaultInstance, setDefaultInstance] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; memberId: string } | null>(null);
  
  // Form data for new user
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    senha: '',
    default_channel: '',
    phone: ''
  });

  const { members, isLoading, createUserAndAddToWorkspace, updateMember, removeMember } = useWorkspaceMembers(workspaceId);
  const { connections, isLoading: connectionsLoading } = useWorkspaceConnections(workspaceId);
  const { toast } = useToast();
  const { deleteUser } = useSystemUsers();

  // Fetch default instance when showing add user form
  useEffect(() => {
    if (showAddUser && workspaceId && !defaultInstance) {
      const fetchDefaultInstance = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-default-instance', {
            body: { workspaceId }
          });
          
          if (!error && data?.defaultInstance) {
            setDefaultInstance(data.defaultInstance);
            // Pre-fill the select if default instance exists and is in connections list
            if (connections.some(conn => conn.id === data.defaultInstance)) {
              setFormData(prev => ({ ...prev, default_channel: data.defaultInstance }));
            }
          }
        } catch (error) {
          console.error('Error fetching default instance:', error);
        }
      };
      
      fetchDefaultInstance();
    }
  }, [showAddUser, workspaceId, connections, defaultInstance]);

  // Update form when connections load and default instance is available
  useEffect(() => {
    if (defaultInstance && connections.length > 0 && !formData.default_channel) {
      const defaultConnection = connections.find(conn => conn.id === defaultInstance);
      if (defaultConnection) {
        setFormData(prev => ({ ...prev, default_channel: defaultInstance }));
      }
    }
  }, [defaultInstance, connections, formData.default_channel]);

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.senha) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Set default_channel if not selected
    let finalFormData = { ...formData, profile: selectedRole };
    if (!finalFormData.default_channel) {
      // Try to use default instance
      if (defaultInstance && connections.some(conn => conn.id === defaultInstance)) {
        finalFormData.default_channel = defaultInstance;
      } else {
        // Fallback to first connected connection, then first available
        const connectedConnection = connections.find(conn => conn.status === 'connected');
        const fallbackConnection = connectedConnection || connections[0];
        
        if (fallbackConnection) {
          finalFormData.default_channel = fallbackConnection.id;
        }
      }
    }
    
    setIsSubmitting(true);
    try {
      await createUserAndAddToWorkspace(finalFormData, selectedRole);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        senha: '',
        default_channel: '',
        phone: ''
      });
      setSelectedRole('user');
      setShowAddUser(false);
      setDefaultInstance(null);
      
      toast({
        title: "Sucesso",
        description: "Usuário criado e adicionado ao workspace com sucesso"
      });
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      email: '',
      senha: '',
      default_channel: '',
      phone: ''
    });
    setSelectedRole('user');
    setShowAddUser(false);
    setDefaultInstance(null);
  };

  const handleUpdateRole = async (memberId: string, newRole: 'user' | 'admin' | 'master') => {
    try {
      await updateMember(memberId, { role: newRole });
      setEditingMember(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    setUserToDelete({
      id: member.user_id,
      name: member.user?.name || 'N/A',
      memberId: member.id
    });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      await deleteUser(userToDelete.id);
      await removeMember(userToDelete.memberId);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso"
      });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleEditUser = (member: WorkspaceMember) => {
    if (member.user) {
      setUserToEdit({
        id: member.user_id,
        name: member.user.name,
        email: member.user.email,
        profile: member.user.profile,
        phone: member.user.phone || '',
        default_channel: (member.user as any).default_channel || '',
        cargo_ids: (member.user as any).cargo_ids || []
      });
      setIsEditModalOpen(true);
    }
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setUserToEdit(null);
    // Refresh members list
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Usuários do Workspace: {workspaceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add User Section */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Membros ({members.length})</h3>
            <Button
              onClick={() => setShowAddUser(!showAddUser)}
              className="gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Adicionar Usuário
            </Button>
          </div>

          {showAddUser && (
            <div className="border rounded-lg p-6 space-y-6">
              <h4 className="font-medium text-lg">Criar Novo Usuário</h4>
              
              {/* Dados Básicos */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-muted-foreground">Dados Básicos</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      placeholder="Nome completo"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha *</Label>
                    <div className="relative">
                      <Input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite a senha"
                        value={formData.senha}
                        onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="default_channel">Canal Padrão</Label>
                    <Select 
                      value={formData.default_channel} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, default_channel: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={connectionsLoading ? "Carregando..." : "Selecione uma conexão (opcional)"} />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border border-border">
                        {connections.length === 0 ? (
                          <SelectItem value="no-connections" disabled>
                            Nenhuma conexão disponível
                          </SelectItem>
                        ) : (
                          connections.map((connection) => (
                            <SelectItem key={connection.id} value={connection.id}>
                              {connection.instance_name} {connection.phone_number ? `— ${connection.phone_number}` : ''} 
                              {connection.status === 'connected' && ' ✓'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Função no Workspace */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-muted-foreground">Função no Workspace</h5>
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select value={selectedRole} onValueChange={(value: 'user' | 'admin' | 'master') => setSelectedRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreateUser}
                  disabled={isSubmitting || !formData.name || !formData.email || !formData.senha}
                >
                  {isSubmitting ? "Criando..." : "Criar Usuário"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Members Table */}
          <div className="border rounded-lg">
            <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Adicionado em</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum membro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  members
                    .filter(member => member.user?.profile !== 'master')
                    .map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.user?.name || 'N/A'}
                      </TableCell>
                      
                      <TableCell className="text-muted-foreground">
                        {member.user?.email || 'N/A'}
                      </TableCell>
                      
                      <TableCell>
                        <span className="capitalize">{member.user?.profile || 'N/A'}</span>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.user?.cargo_names && member.user.cargo_names.length > 0 ? (
                            member.user.cargo_names.map((cargoName, index) => (
                              <Badge 
                                key={index} 
                                variant="outline"
                                className="text-xs"
                              >
                                {cargoName}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge 
                          variant={member.user?.status === 'active' ? 'secondary' : 'outline'} 
                          className={member.user?.status === 'active' 
                            ? "bg-brand-yellow text-black hover:bg-brand-yellow-hover rounded-full px-3 py-1" 
                            : "border-destructive text-destructive rounded-full px-3 py-1"
                          }
                        >
                          {member.user?.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(member.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditUser(member)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveMember(member)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>

      {/* Modal de Editar Usuário */}
      <AdicionarEditarUsuarioModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        editingUser={userToEdit}
        onSuccess={handleEditSuccess}
      />

      {/* Modal de Deletar Usuário */}
      <DeletarUsuarioModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        userName={userToDelete?.name || ''}
      />
    </Dialog>
  );
}