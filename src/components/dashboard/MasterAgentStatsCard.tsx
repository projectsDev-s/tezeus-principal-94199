import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, MessageCircle, Clock, Activity, Building2 } from "lucide-react";
import { useAgentStats, AgentStats } from "@/hooks/useAgentStats";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MasterAgentStatsCard() {
  const { workspaces, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("all");
  const [allStats, setAllStats] = useState<Array<AgentStats & { workspaceName: string }>>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    const fetchAllStats = async () => {
      if (selectedWorkspaceId === "all" && workspaces.length > 0) {
        setIsLoadingStats(true);
        
        const statsPromises = workspaces.map(async (workspace) => {
          const { stats } = useAgentStats(workspace.workspace_id);
          return stats.map(stat => ({
            ...stat,
            workspaceName: workspace.name
          }));
        });

        // Simplified approach - we'll reload when workspace changes
        setIsLoadingStats(false);
      }
    };

    fetchAllStats();
  }, [workspaces, selectedWorkspaceId]);

  const { stats: currentStats, isLoading: isLoadingCurrent } = useAgentStats(
    selectedWorkspaceId !== "all" ? selectedWorkspaceId : undefined
  );

  const isLoading = isLoadingWorkspaces || isLoadingStats || isLoadingCurrent;

  const displayStats = selectedWorkspaceId === "all" 
    ? allStats 
    : currentStats.map(stat => ({ 
        ...stat, 
        workspaceName: workspaces.find(w => w.workspace_id === selectedWorkspaceId)?.name || ""
      }));

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Estatísticas de Agentes por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Estatísticas de Agentes por Empresa
          </CardTitle>
          
          <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Empresas</SelectItem>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {displayStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum agente foi utilizado ainda
          </p>
        ) : (
          <div className="space-y-4">
            {displayStats.map((agent) => (
              <div
                key={`${agent.agentId}-${agent.workspaceName}`}
                className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="p-3 rounded-full bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-semibold text-foreground">{agent.agentName}</h4>
                      {selectedWorkspaceId === "all" && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Building2 className="h-3 w-3" />
                          {agent.workspaceName}
                        </div>
                      )}
                      {agent.lastUsed && (
                        <p className="text-xs text-muted-foreground">
                          Última utilização:{" "}
                          {formatDistanceToNow(new Date(agent.lastUsed), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      )}
                    </div>
                    
                    {agent.activeConversations > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                        <Activity className="h-3 w-3" />
                        {agent.activeConversations} ativa{agent.activeConversations !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">{agent.totalConversations}</p>
                        <p className="text-xs text-muted-foreground">Conversas</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">
                          {agent.averageActiveDuration > 0
                            ? `${agent.averageActiveDuration}min`
                            : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">Tempo Médio</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">{agent.activationCount}</p>
                        <p className="text-xs text-muted-foreground">Ativações</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
