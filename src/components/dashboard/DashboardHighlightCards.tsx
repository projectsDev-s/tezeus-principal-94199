import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Wifi, AlertTriangle, Users } from "lucide-react";
import { DashboardStats } from "@/hooks/useDashboardStats";
import { WorkspaceConnection } from "@/hooks/useWorkspaceConnections";

interface DashboardHighlightCardsProps {
  stats: DashboardStats;
  connections: WorkspaceConnection[];
  isLoading: boolean;
}

export function DashboardHighlightCards({ stats, connections, isLoading }: DashboardHighlightCardsProps) {
  const connectedInstances = connections.filter(c => c.status === 'connected').length;
  const hasConnectionIssues = connections.some(c => c.status === 'disconnected' || c.status === 'error');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12 mb-2" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* WhatsApp Status Card */}
      <Card className="border-l-4 border-l-success">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            Status WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">{connectedInstances}</span>
              <Badge variant={hasConnectionIssues ? "destructive" : "secondary"} className="text-xs">
                {hasConnectionIssues ? "Atenção" : "Conectado"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {connectedInstances} de {connections.length} instâncias ativas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Conversations Card */}
      <Card className="border-l-4 border-l-warning">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Conversas Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">{stats.activeConversations}</span>
              <Badge variant="outline" className="text-xs">
                Aguardando
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {stats.todayMessages} mensagens hoje
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Alerts Card */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alertas do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">{hasConnectionIssues ? 1 : 0}</span>
              <Badge variant={hasConnectionIssues ? "destructive" : "secondary"} className="text-xs">
                {hasConnectionIssues ? "Urgente" : "Normal"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {hasConnectionIssues ? "Instância desconectada" : "Tudo funcionando"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}