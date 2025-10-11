import React, { useState, useEffect } from "react";
import { User, Eye, EyeOff, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceConnections } from "@/hooks/useWorkspaceConnections";
import { useSystemUsers, type SystemUser } from "@/hooks/useSystemUsers";
import { useCargos } from "@/hooks/useCargos";

interface AdicionarEditarUsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser?: SystemUser | null;
  onSuccess?: () => void;
}

export function AdicionarEditarUsuarioModal({ 
  open, 
  onOpenChange, 
  editingUser, 
  onSuccess 
}: AdicionarEditarUsuarioModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedCargos, setSelectedCargos] = useState<string[]>([]);
  const [showCargoDropdown, setShowCargoDropdown] = useState(false);
  const [cargos, setCargos] = useState<any[]>([]);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profile: 'user',
    senha: '',
    default_channel: '',
    phone: ''
  });

  const { toast } = useToast();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { connections, isLoading: connectionsLoading } = useWorkspaceConnections(selectedWorkspaceId);
  const { createUser, updateUser } = useSystemUsers();
  const { listCargos, loading: cargosLoading } = useCargos();

  // Load cargos when modal opens
  useEffect(() => {
    if (open) {
      loadCargos();
    }
  }, [open]);

  const loadCargos = async () => {
    const result = await listCargos();
    if (result.data) {
      setCargos(result.data);
    }
  };

  // Reset form when modal opens/closes or editing user changes
  useEffect(() => {
    if (open) {
      if (editingUser) {
        // Editing mode - populate form with existing data
        setFormData({
          name: editingUser.name || '',
          email: editingUser.email || '',
          profile: editingUser.profile || 'user',
          senha: '', // Never populate password for security
          default_channel: editingUser.default_channel || '',
          phone: '' // Phone not available in SystemUser type
        });
        
        // Populate selected cargos
        setSelectedCargos(editingUser.cargo_ids || []);
        
        // Get workspace from user's workspaces (first one if multiple)
        if (editingUser.workspaces && editingUser.workspaces.length > 0) {
          setSelectedWorkspaceId(editingUser.workspaces[0].id);
        }
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          email: '',
          profile: 'user',
          senha: '',
          default_channel: '',
          phone: ''
        });
        setSelectedWorkspaceId('');
        setSelectedCargos([]);
      }
    }
  }, [open, editingUser]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.profile) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (!editingUser && !formData.senha) {
      toast({
        title: "Erro",
        description: "Senha é obrigatória para novos usuários",
        variant: "destructive"
      });
      return;
    }

    if (!selectedWorkspaceId) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        // Update existing user
        const updateData = {
          id: editingUser.id,
          name: formData.name,
          email: formData.email,
          profile: formData.profile,
          status: editingUser.status,
          phone: formData.phone,
          default_channel: formData.default_channel || null,
          // Only include password if it was changed
          ...(formData.senha && { senha: formData.senha })
        };

        const result = await updateUser(updateData);
        
        if (result.error) {
          throw new Error(result.error);
        }

        toast({
          title: "Sucesso",
          description: "Usuário atualizado com sucesso"
        });
      } else {
        // Create new user
        const userData = {
          name: formData.name,
          email: formData.email,
          profile: formData.profile,
          senha: formData.senha,
          phone: formData.phone,
          default_channel: formData.default_channel || null,
          cargo_ids: selectedCargos
        };

        const result = await createUser(userData);
        
        if (result.error) {
          throw new Error(result.error);
        }

        toast({
          title: "Sucesso",
          description: "Usuário criado com sucesso"
        });
      }

      // Reset form and close modal
      setFormData({
        name: '',
        email: '',
        profile: 'user',
        senha: '',
        default_channel: '',
        phone: ''
      });
      setSelectedWorkspaceId('');
      onOpenChange(false);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar usuário",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      email: '',
      profile: 'user',
      senha: '',
      default_channel: '',
      phone: ''
    });
    setSelectedWorkspaceId('');
    setSelectedCargos([]);
    onOpenChange(false);
  };

  const isEditing = !!editingUser;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {isEditing ? 'Editar Usuário' : 'Adicionar Usuário'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifique os dados do usuário e selecione a empresa.' : 'Preencha os dados do novo usuário e selecione a empresa.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dados Básicos */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Dados Básicos</h3>
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
                <Label htmlFor="profile">Perfil *</Label>
                <Select value={formData.profile} onValueChange={(value) => setFormData(prev => ({ ...prev, profile: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="senha">
                  {isEditing ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}
                </Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    placeholder={isEditing ? "Digite nova senha (opcional)" : "Digite a senha"}
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

              {/* Cargos */}
              <div className="space-y-2 relative col-span-2">
                <Label htmlFor="cargos">Cargos</Label>
                <div className="min-h-12 border border-input rounded-md p-2 flex flex-wrap items-center gap-2 bg-background">
                  <button 
                    type="button"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground border border-dashed border-border rounded-md hover:bg-muted"
                    onClick={() => setShowCargoDropdown(!showCargoDropdown)}
                  >
                    <Plus className="h-3 w-3" />
                    <span>Adicionar</span>
                  </button>
                  {selectedCargos.map(cargoId => {
                    const cargo = cargos.find(c => c.id === cargoId);
                    return cargo ? (
                      <div key={cargoId} className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        <span>{cargo.nome}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCargos(prev => prev.filter(id => id !== cargoId))}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
                
                {/* Dropdown de cargos */}
                {showCargoDropdown && cargos.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                    {cargos
                      .filter(cargo => !selectedCargos.includes(cargo.id))
                      .map((cargo) => (
                        <button
                          key={cargo.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-b-0"
                          onClick={() => {
                            setSelectedCargos(prev => [...prev, cargo.id]);
                            setShowCargoDropdown(false);
                          }}
                        >
                          {cargo.nome}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seleção de Empresa */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Empresa</h3>
            <div className="space-y-2">
              <Label htmlFor="workspace">Empresa *</Label>
              <Select 
                value={selectedWorkspaceId} 
                onValueChange={setSelectedWorkspaceId}
                disabled={workspacesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={workspacesLoading ? "Carregando empresas..." : "Selecione uma empresa"} />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background border border-border">
                  {workspaces.length === 0 ? (
                    <SelectItem value="no-workspaces" disabled>
                      Nenhuma empresa disponível
                    </SelectItem>
                  ) : (
                    workspaces.map((workspace) => (
                      <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                        {workspace.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Canal Padrão */}
          {selectedWorkspaceId && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Configurações</h3>
              <div className="space-y-2">
                <Label htmlFor="default_channel">Canal Padrão</Label>
                <Select 
                  value={formData.default_channel} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, default_channel: value }))}
                  disabled={connectionsLoading}
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
          )}
          
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name || !formData.email || !formData.profile || (!isEditing && !formData.senha) || !selectedWorkspaceId}
            >
              {isSubmitting ? (isEditing ? "Salvando..." : "Criando...") : (isEditing ? "Salvar Alterações" : "Criar Usuário")}
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
      </DialogContent>
    </Dialog>
  );
}