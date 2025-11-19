import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceUsers } from "@/hooks/useWorkspaceUsers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2 } from "lucide-react";

interface AdicionarUsuarioFilaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddUsers: (userIds: string[]) => Promise<void>;
  excludeUserIds?: string[];
  workspaceId?: string;
}

export function AdicionarUsuarioFilaModal({
  open,
  onOpenChange,
  onAddUsers,
  excludeUserIds = [],
  workspaceId,
}: AdicionarUsuarioFilaModalProps) {
  const { selectedWorkspace } = useWorkspace();
  
  // Estabilizar a referência do array de filtros para evitar loops infinitos
  const filterProfiles = useMemo<('user' | 'admin' | 'master')[]>(() => ['admin', 'user'], []);
  const effectiveWorkspaceId = workspaceId || selectedWorkspace?.workspace_id;
  const { users, isLoading } = useWorkspaceUsers(effectiveWorkspaceId, filterProfiles);
  
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  // Filtrar usuários que já estão na fila
  const availableUsers = users.filter(user => !excludeUserIds.includes(user.id));

  useEffect(() => {
    if (!open) {
      setSelectedUserIds([]);
    }
  }, [open]);

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddUsers = async () => {
    if (selectedUserIds.length === 0) return;

    setAdding(true);
    try {
      await onAddUsers(selectedUserIds);
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar usuários à fila</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Todos os usuários já estão adicionados à fila
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                {selectedUserIds.length} usuário(s) selecionado(s)
              </div>

              <div className="space-y-2">
                {availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => handleToggleUser(user.id)}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={() => handleToggleUser(user.id)}
                    />
                    
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback>
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="font-medium">{user.name}</div>
                    </div>

                    <Badge variant={user.profile === 'admin' ? 'default' : 'secondary'}>
                      {user.profile === 'admin' ? 'Admin' : 'User'}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddUsers}
              disabled={selectedUserIds.length === 0 || adding}
            >
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                `Adicionar ${selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
