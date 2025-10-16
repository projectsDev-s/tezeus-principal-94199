import { Building2, Users, MessageSquare, LogIn, BarChart3, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Workspace } from '@/contexts/WorkspaceContext';

interface WorkspaceCardProps {
  workspace: Workspace;
  usersCount?: number;
  conversationsCount?: number;
  onLogin: (workspace: Workspace) => void;
  onViewReports: (workspace: Workspace) => void;
  onViewWorkspace: (workspace: Workspace) => void;
}

export function WorkspaceCard({
  workspace,
  usersCount = 0,
  conversationsCount = 0,
  onLogin,
  onViewReports,
  onViewWorkspace
}: WorkspaceCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{workspace.name}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {workspace.connections_count || 0} conexões
          </Badge>
        </div>
        {workspace.cnpj && (
          <CardDescription className="text-xs">
            CNPJ: {workspace.cnpj}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{usersCount} usuários</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>{conversationsCount} conversas ativas</span>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={() => onLogin(workspace)}
          className="w-full"
          size="sm"
        >
          <LogIn className="h-4 w-4 mr-2" />
          Entrar
        </Button>
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button
            onClick={() => onViewReports(workspace)}
            variant="outline"
            size="sm"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Relatórios
          </Button>
          <Button
            onClick={() => onViewWorkspace(workspace)}
            variant="outline"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-1" />
            Visualizar
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
