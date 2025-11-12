import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import { QueueUser } from "@/hooks/useQueueUsers";

interface QueueUsersListProps {
  users: QueueUser[];
  loading?: boolean;
  onRemoveUser: (userId: string) => void;
}

export function QueueUsersList({ users, loading, onRemoveUser }: QueueUsersListProps) {
  // Mostrar skeleton durante carregamento
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center space-x-3 p-3 rounded-lg border bg-card"
          >
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">Nenhum usuário adicionado</p>
        <p className="text-sm">Clique em "Adicionar usuário à fila" para começar</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((queueUser) => {
        const user = queueUser.system_users;
        if (!user) return null;

        return (
          <div
            key={queueUser.id}
            className="flex items-center space-x-3 p-3 rounded-lg border bg-card"
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>

            <Badge variant={user.profile === 'admin' ? 'default' : 'secondary'}>
              {user.profile === 'admin' ? 'Admin' : 'User'}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveUser(user.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
