import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bot, TrendingUp, Clock, Target, CheckCircle2, XCircle } from "lucide-react";
import { useAgentStats } from "@/hooks/useAgentStats";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useState } from "react";

export function AgentPerformanceComparison() {
  const { workspaces, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("all");
  
  const { stats, isLoading: isLoadingStats } = useAgentStats(
    selectedWorkspaceId !== "all" ? selectedWorkspaceId : undefined
  );

  const isLoading = isLoadingWorkspaces || isLoadingStats;

  // Calcular métricas de performance
  const performanceMetrics = useMemo(() => {
    if (!stats || stats.length === 0) return [];

    return stats.map(agent => {
      // Taxa de sucesso: ativações vs desativações (quanto maior, melhor)
      const successRate = agent.activationCount > 0 
        ? ((agent.activationCount - agent.deactivationCount) / agent.activationCount) * 100 
        : 0;

      // Eficiência: conversas por ativação (quanto maior, melhor)
      const efficiency = agent.activationCount > 0 
        ? agent.totalConversations / agent.activationCount 
        : 0;

      // Score geral (0-100)
      const performanceScore = Math.min(100, (
        (successRate * 0.4) + 
        (Math.min(efficiency * 20, 40)) + 
        (agent.activeConversations > 0 ? 20 : 0)
      ));

      return {
        ...agent,
        successRate: Math.max(0, Math.min(100, successRate)),
        efficiency: efficiency,
        performanceScore: performanceScore,
        isActive: agent.activeConversations > 0,
      };
    }).sort((a, b) => b.performanceScore - a.performanceScore);
  }, [stats]);

  const getPerformanceBadge = (score: number) => {
    if (score >= 80) return { label: "Excelente", variant: "default" as const, color: "hsl(var(--success))" };
    if (score >= 60) return { label: "Bom", variant: "secondary" as const, color: "hsl(var(--brand-blue))" };
    if (score >= 40) return { label: "Regular", variant: "outline" as const, color: "hsl(var(--warning))" };
    return { label: "Baixo", variant: "destructive" as const, color: "hsl(var(--error))" };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Comparação de Performance de Agentes
          </CardTitle>
          <CardDescription>
            Análise comparativa de eficiência e taxa de sucesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Comparação de Performance de Agentes
            </CardTitle>
            <CardDescription>
              Análise comparativa de eficiência e taxa de sucesso
            </CardDescription>
          </div>
          
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
        {performanceMetrics.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado de performance disponível
          </p>
        ) : (
          <div className="space-y-4">
            {performanceMetrics.map((agent, index) => {
              const badge = getPerformanceBadge(agent.performanceScore);
              
              return (
                <div
                  key={agent.agentId}
                  className="p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{agent.agentName}</h4>
                          {index === 0 && (
                            <Badge variant="default" className="text-xs">
                              🏆 Melhor Performance
                            </Badge>
                          )}
                          {agent.isActive && (
                            <Badge variant="outline" className="text-xs border-success text-success">
                              Em uso
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Score de Performance: {agent.performanceScore.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    
                    <Badge 
                      variant={badge.variant}
                      style={{ 
                        backgroundColor: badge.variant === "outline" ? "transparent" : badge.color,
                        borderColor: badge.color,
                        color: badge.variant === "outline" ? badge.color : "hsl(var(--primary-foreground))"
                      }}
                    >
                      {badge.label}
                    </Badge>
                  </div>

                  {/* Performance Bar */}
                  <div className="mb-4">
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${agent.performanceScore}%`,
                          backgroundColor: badge.color
                        }}
                      />
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Target className="h-3 w-3" />
                        <span className="text-xs">Taxa de Sucesso</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold text-foreground">
                          {agent.successRate.toFixed(0)}%
                        </span>
                        {agent.successRate >= 70 ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-error" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-xs">Eficiência</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">
                        {agent.efficiency.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        conversas/ativação
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">Tempo Médio Ativo</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">
                        {agent.averageActiveDuration > 0
                          ? `${agent.averageActiveDuration}min`
                          : "N/A"}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Bot className="h-3 w-3" />
                        <span className="text-xs">Total Conversas</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">
                        {agent.totalConversations}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {agent.activeConversations} ativas
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
