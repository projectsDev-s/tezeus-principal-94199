import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ColorPickerModal } from "./ColorPickerModal";
import { IconSelector } from "@/components/ui/icon-selector";
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { ColumnAutomationsTab } from "./ColumnAutomationsTab";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Users, User, Trash2 } from "lucide-react";
import { DeletarColunaModal } from "./DeletarColunaModal";
import { useAuth } from "@/hooks/useAuth";

interface EditarColunaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string | null;
  columnName: string;
  columnColor: string;
  columnIcon?: string;
  onUpdate: () => void;
}

export function EditarColunaModal({
  open,
  onOpenChange,
  columnId,
  columnName,
  columnColor,
  columnIcon = 'Circle',
  onUpdate,
}: EditarColunaModalProps) {
  const [name, setName] = useState(columnName);
  const [color, setColor] = useState(columnColor);
  const [icon, setIcon] = useState(columnIcon);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [viewAllDealsUsers, setViewAllDealsUsers] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  const { selectedWorkspace } = useWorkspace();
  const { members } = useWorkspaceMembers(selectedWorkspace?.workspace_id);
  const { user } = useAuth();

  useEffect(() => {
    if (open && columnId) {
      setName(columnName);
      setColor(columnColor);
      setIcon(columnIcon || 'Circle');
      setActiveTab('settings');
      loadPermissions();
    }
  }, [open, columnName, columnColor, columnIcon, columnId]);

  const loadPermissions = async () => {
    if (!columnId) return;
    
    try {
      const { data, error } = await supabase
        .from('pipeline_columns')
        .select('permissions, view_all_deals_permissions')
        .eq('id', columnId)
        .single();

      if (error) throw error;
      
      const permissions = data?.permissions;
      const viewAllPermissions = data?.view_all_deals_permissions;
      
      setSelectedUsers(Array.isArray(permissions) ? permissions.filter((p): p is string => typeof p === 'string') : []);
      setViewAllDealsUsers(Array.isArray(viewAllPermissions) ? viewAllPermissions.filter((p): p is string => typeof p === 'string') : []);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    setShowColorPicker(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da coluna não pode estar vazio",
        variant: "destructive",
      });
      return;
    }

    if (!columnId) return;

    try {
      setIsLoading(true);
      const headers = getHeaders();

      const { error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers,
        body: {
          name: name.trim(),
          color,
          icon,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Coluna atualizada com sucesso",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar coluna:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar coluna",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!columnId) return;

    try {
      const headers = getHeaders();
      const { error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers,
        body: {
          permissions: selectedUsers,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Permissões atualizadas com sucesso",
      });
      onUpdate();
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar permissões",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!columnId) return;

    try {
      const headers = getHeaders();
      const { error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'DELETE',
        headers,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Coluna excluída com sucesso",
      });

      onUpdate();
      onOpenChange(false);
      setIsDeleteModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir coluna:', error);
      
      if (error.message?.includes('existing cards')) {
        toast({
          title: "Erro ao excluir coluna",
          description: "Não é possível excluir uma coluna que contém negócios. Mova os negócios para outra coluna primeiro.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao excluir coluna",
          description: "Erro ao excluir coluna",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpdateViewAllDealsPermissions = async () => {
    if (!columnId) return;

    try {
      const headers = getHeaders();
      const { error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers,
        body: {
          view_all_deals_permissions: viewAllDealsUsers,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Permissões de visualização atualizadas com sucesso",
      });
      onUpdate();
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar permissões de visualização",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Coluna</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">Configurações</TabsTrigger>
              <TabsTrigger value="permissions">Permissões</TabsTrigger>
              <TabsTrigger value="automations">Automações</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="column-name">Nome da Coluna</Label>
                <Input
                  id="column-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite o nome da coluna"
                />
              </div>

              <div className="space-y-2">
                <Label>Ícone</Label>
                <IconSelector 
                  selectedIcon={icon}
                  onIconSelect={setIcon}
                />
                <p className="text-xs text-muted-foreground">
                  O ícone será exibido no timeline do pipeline
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded border cursor-pointer"
                    style={{ backgroundColor: color }}
                    onClick={() => setShowColorPicker(true)}
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>

              <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
                <div className="flex gap-2 sm:mr-auto">
                  <Button 
                    variant="destructive" 
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Coluna
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-6 py-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Usuários que podem ver a coluna</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {selectedUsers.length === 0 
                      ? 'Todos os usuários podem ver esta coluna' 
                      : `${selectedUsers.length} usuário${selectedUsers.length > 1 ? 's' : ''} selecionado${selectedUsers.length > 1 ? 's' : ''}`
                    }
                  </p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                    {members?.filter(member => !member.is_hidden).map(member => (
                      <div key={member.id} className="flex items-center space-x-3">
                        <Checkbox 
                          id={`user-${member.id}`}
                          checked={selectedUsers.includes(member.user_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUsers([...selectedUsers, member.user_id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== member.user_id));
                            }
                          }}
                        />
                        <div className="flex items-center space-x-2 flex-1">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <label 
                            htmlFor={`user-${member.id}`} 
                            className="text-sm font-medium cursor-pointer"
                          >
                            {member.user?.name}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full mt-3" 
                    onClick={handleUpdatePermissions}
                  >
                    Salvar Permissões de Visualização
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Usuários que podem ver todos os negócios</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Usuários selecionados verão todos os negócios desta coluna independente do responsável
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {viewAllDealsUsers.length} usuário{viewAllDealsUsers.length !== 1 ? 's' : ''} selecionado{viewAllDealsUsers.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                    {members?.filter(member => !member.is_hidden).map(member => (
                      <div key={member.id} className="flex items-center space-x-3">
                        <Checkbox 
                          id={`view-all-${member.id}`}
                          checked={viewAllDealsUsers.includes(member.user_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setViewAllDealsUsers([...viewAllDealsUsers, member.user_id]);
                            } else {
                              setViewAllDealsUsers(viewAllDealsUsers.filter(id => id !== member.user_id));
                            }
                          }}
                        />
                        <div className="flex items-center space-x-2 flex-1">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <label 
                            htmlFor={`view-all-${member.id}`} 
                            className="text-sm font-medium cursor-pointer"
                          >
                            {member.user?.name}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full mt-3" 
                    onClick={handleUpdateViewAllDealsPermissions}
                  >
                    Salvar Permissões de Todos os Negócios
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="automations" className="py-4">
              {columnId ? (
                <ColumnAutomationsTab 
                  columnId={columnId} 
                  onAutomationChange={onUpdate}
                  isActive={activeTab === 'automations'}
                  isModalOpen={open}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Selecione uma coluna para gerenciar automações
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ColorPickerModal
        open={showColorPicker}
        onOpenChange={setShowColorPicker}
        onColorSelect={handleColorSelect}
      />

      <DeletarColunaModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        columnName={name}
      />
    </>
  );
}
