import React, { useState, useEffect, useRef } from "react";
import { User, Eye, EyeOff, Plus, X, Camera } from "lucide-react";
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profile: 'user',
    senha: '',
    default_channel: '',
    phone: '',
    avatar: ''
  });

  const { toast } = useToast();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { connections, isLoading: connectionsLoading } = useWorkspaceConnections(selectedWorkspaceId);
  const { createUser, updateUser } = useSystemUsers();
  
  const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return null;
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O tamanho máximo é 5MB"
        });
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setFormData(prev => ({ ...prev, avatar: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
          phone: '', // Phone not available in SystemUser type
          avatar: editingUser.avatar || ''
        });
        setAvatarPreview(editingUser.avatar || '');
        
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
          phone: '',
          avatar: ''
        });
        setSelectedWorkspaceId('');
        setAvatarFile(null);
        setAvatarPreview('');
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
          default_channel: formData.default_channel || null
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
        phone: '',
        avatar: ''
      });
      setSelectedWorkspaceId('');
      setAvatarFile(null);
      setAvatarPreview('');
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
      phone: '',
      avatar: ''
    });
    setSelectedWorkspaceId('');
    setAvatarFile(null);
    setAvatarPreview('');
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
          {/* Avatar Upload */}
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              {avatarPreview && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                {avatarPreview ? 'Alterar Foto' : 'Adicionar Foto'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG ou GIF (máx. 5MB)
              </p>
            </div>
          </div>

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
                    <SelectItem value="master">Usuário Tezeus</SelectItem>
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

            </div>
          </div>

          
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name || !formData.email || !formData.profile || (!isEditing && !formData.senha)}
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