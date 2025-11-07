import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, MessageCircle, Clock, Activity } from "lucide-react";
import { useAgentStats } from "@/hooks/useAgentStats";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AgentStatsCard() {
  const { stats, isLoading } = useAgentStats();

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Estatísticas de Agentes
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

  if (stats.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Estatísticas de Agentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum agente foi utilizado ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Estatísticas de Agentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stats.map((agent) => (
            <div
              key={agent.agentId}
              className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-semibold text-foreground">{agent.agentName}</h4>
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
      </CardContent>
    </Card>
  );
}
