import { Building2, Users, Settings, Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Workspace } from "@/contexts/WorkspaceContext";

interface AdminWorkspaceViewProps {
  workspace: Workspace;
  onManageConnections: () => void;
  onManageUsers: () => void;
  onManageSettings: () => void;
}

export function AdminWorkspaceView({ 
  workspace, 
  onManageConnections,
  onManageUsers,
  onManageSettings 
}: AdminWorkspaceViewProps) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">{workspace.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie sua empresa
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {workspace.connections_count || 0} conexões
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {workspace.cnpj && (
              <div>
                <span className="text-muted-foreground">CNPJ:</span>
                <p className="font-medium">{workspace.cnpj}</p>
              </div>
            )}
            {workspace.slug && (
              <div>
                <span className="text-muted-foreground">Slug:</span>
                <p className="font-medium">{workspace.slug}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Criado:</span>
              <p className="font-medium">
                {formatDistanceToNow(new Date(workspace.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Management Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Connections */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Conexões</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gerencie suas conexões WhatsApp
            </p>
            <Button 
              onClick={onManageConnections} 
              className="w-full"
              variant="outline"
            >
              Gerenciar Conexões
            </Button>
          </CardContent>
        </Card>

        {/* Users */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Usuários</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adicione e remova usuários
            </p>
            <Button 
              onClick={onManageUsers} 
              className="w-full"
              variant="outline"
            >
              Gerenciar Usuários
            </Button>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Configurações</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Configure sua workspace
            </p>
            <Button 
              onClick={onManageSettings} 
              className="w-full"
              variant="outline"
            >
              Abrir Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
