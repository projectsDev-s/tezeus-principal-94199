import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2 } from "lucide-react";

interface VincularResponsavelModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  conversationId?: string;
  currentResponsibleId?: string;
  onSuccess?: () => void;
}

interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
}

export function VincularResponsavelModal({
  isOpen,
  onClose,
  cardId,
  conversationId,
  currentResponsibleId,
  onSuccess
}: VincularResponsavelModalProps) {
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<WorkspaceUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentResponsibleId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && selectedWorkspace) {
      loadWorkspaceUsers();
    }
  }, [isOpen, selectedWorkspace]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  const loadWorkspaceUsers = async () => {
    if (!selectedWorkspace) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          system_users!inner(id, name, email)
        `)
        .eq('workspace_id', selectedWorkspace.workspace_id);

      if (error) throw error;

      const workspaceUsers = data?.map(member => ({
        id: member.system_users.id,
        name: member.system_users.name,
        email: member.system_users.email
      })) || [];

      setUsers(workspaceUsers);
      setFilteredUsers(workspaceUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários do workspace",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedUserId) {
      toast({
        title: "Atenção",
        description: "Selecione um responsável",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Atualizar o card do pipeline
      const { error: cardError } = await supabase
        .from('pipeline_cards')
        .update({ responsible_user_id: selectedUserId })
        .eq('id', cardId);

      if (cardError) throw cardError;

      // Atualizar a conversa se houver conversation_id
      if (conversationId) {
        const { error: convError } = await supabase
          .from('conversations')
          .update({ 
            assigned_user_id: selectedUserId,
            assigned_at: new Date().toISOString()
          })
          .eq('id', conversationId);

        if (convError) throw convError;
      }

      toast({
        title: "Sucesso",
        description: "Responsável vinculado com sucesso"
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao vincular responsável:', error);
      toast({
        title: "Erro",
        description: "Erro ao vincular responsável",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    setSelectedUserId(currentResponsibleId || null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-warning">
            Selecione o responsável
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-warning focus:border-warning focus:ring-warning"
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum usuário encontrado
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUserId === user.id
                        ? 'bg-warning/10 border-2 border-warning'
                        : 'hover:bg-accent border-2 border-transparent'
                    }`}
                  >
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isSaving}
            className="text-destructive hover:text-destructive"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving || !selectedUserId}
            className="bg-warning hover:bg-warning/90 text-black"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirmando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
