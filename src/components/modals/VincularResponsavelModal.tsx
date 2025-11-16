import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2 } from "lucide-react";
import { useConversationAssign } from "@/hooks/useConversationAssign";

interface VincularResponsavelModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  conversationId?: string;
  contactId?: string;
  currentResponsibleId?: string;
  onSuccess?: () => void;
  onResponsibleUpdated?: () => void;
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
  contactId,
  currentResponsibleId,
  onSuccess,
  onResponsibleUpdated
}: VincularResponsavelModalProps) {
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();
  const { assignConversation } = useConversationAssign();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<WorkspaceUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentResponsibleId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Atualizar selectedUserId quando o modal abre ou currentResponsibleId muda
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(currentResponsibleId || null);
    }
  }, [isOpen, currentResponsibleId]);

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
      console.log('🔍 Buscando usuários para workspace:', selectedWorkspace.workspace_id);
      
      // Usar a edge function que já funciona no sistema
      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: { action: 'list', userData: {} }
      });

      console.log('📊 Resposta da edge function:', data);
      
      if (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        throw error;
      }

      if (!data?.success || !data?.data) {
        console.warn('⚠️ Resposta inválida da edge function');
        setUsers([]);
        setFilteredUsers([]);
        return;
      }

      // Filtrar usuários que pertencem ao workspace atual (excluindo masters)
      const workspaceUsers = data.data
        .filter((user: any) => {
          const belongsToWorkspace = user.workspaces?.some(
            (ws: any) => ws.id === selectedWorkspace.workspace_id
          );
          const isNotMaster = user.profile !== 'master';
          console.log(`User ${user.name} belongs to workspace:`, belongsToWorkspace, 'isNotMaster:', isNotMaster);
          return belongsToWorkspace && isNotMaster;
        })
        .map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email || ''
        }));

      console.log('🎯 Usuários filtrados para o workspace:', workspaceUsers);

      setUsers(workspaceUsers);
      setFilteredUsers(workspaceUsers);
    } catch (error) {
      console.error('❌ Erro geral ao carregar usuários:', error);
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
      console.log('🔄 Vinculando responsável:', {
        cardId,
        conversationId,
        contactId,
        selectedUserId,
        currentResponsibleId
      });

      // Buscar conversa do contato se não tiver conversationId mas tiver contactId
      let targetConversationId = conversationId;
      
      if (!targetConversationId && contactId) {
        console.log('🔍 Buscando conversa para o contato:', contactId);
        const { data: conversations, error: searchError } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contactId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1);

        if (searchError) {
          console.error('⚠️ Erro ao buscar conversa:', searchError);
        } else if (conversations && conversations.length > 0) {
          targetConversationId = conversations[0].id;
          console.log('✅ Conversa encontrada:', targetConversationId);
        } else {
          console.log('⚠️ Nenhuma conversa aberta encontrada para o contato');
        }
      }

      // ✅ Atualizar PRIMEIRO o card diretamente
      console.log('📝 Atualizando card com responsible_user_id:', selectedUserId);
      const { error: cardUpdateError } = await supabase
        .from('pipeline_cards')
        .update({ 
          responsible_user_id: selectedUserId,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId);

      if (cardUpdateError) {
        console.error('❌ Erro ao atualizar card:', cardUpdateError);
        throw cardUpdateError;
      }
      console.log('✅ Card atualizado com sucesso');

      // ✅ Se tiver conversa, atualizar também
      if (targetConversationId) {
        console.log('🔄 Atualizando conversa também:', targetConversationId);
        const result = await assignConversation(targetConversationId, selectedUserId);
        
        if (!result.success) {
          console.error('⚠️ Erro ao atribuir conversa (mas card foi atualizado):', result.error);
          // Não falhar aqui - card já foi atualizado com sucesso
        } else {
          console.log('✅ Conversa atribuída:', result.action);
        }
      } else {
        console.log('ℹ️ Sem conversa para atualizar');
      }

      toast({
        title: "Sucesso",
        description: "Responsável vinculado com sucesso"
      });

      onSuccess?.();
      onResponsibleUpdated?.();
      onClose();
    } catch (error) {
      console.error('❌ Erro geral ao vincular responsável:', error);
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
    setIsDropdownOpen(false);
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
          <div className="relative">
            <Input
              placeholder="Buscar usuário"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
              className="border-warning focus:border-warning focus:ring-warning cursor-pointer"
              readOnly={!isDropdownOpen}
            />

            {isDropdownOpen && (
              <>
                {/* Overlay para fechar o dropdown ao clicar fora */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setSearchTerm("");
                  }}
                />
                
                {/* Dropdown lista de usuários */}
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-warning/50 rounded-lg shadow-lg z-20 max-h-[300px] overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      <p className="font-medium">Nenhum usuário encontrado</p>
                      {users.length === 0 && (
                        <p className="text-xs mt-1">Não há usuários cadastrados neste workspace</p>
                      )}
                    </div>
                  ) : (
                    <div className="py-1">
                      {filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setSearchTerm(user.name);
                            setIsDropdownOpen(false);
                          }}
                          className={`px-3 py-2 cursor-pointer transition-colors ${
                            selectedUserId === user.id
                              ? 'bg-warning/20 text-warning font-medium border-l-2 border-warning'
                              : 'hover:bg-accent'
                          }`}
                        >
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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
