import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useAgentPerformanceHistory } from "@/hooks/useAgentPerformanceHistory";
import { TrendingUp, Calendar } from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function AgentPerformanceChart() {
  const { workspaces, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("all");
  const [period, setPeriod] = useState<string>("30");
  
  const { data: performanceData, isLoading: isLoadingPerformance } = useAgentPerformanceHistory(
    selectedWorkspaceId !== "all" ? selectedWorkspaceId : undefined,
    parseInt(period)
  );

  const isLoading = isLoadingWorkspaces || isLoadingPerformance;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução Temporal de Performance
          </CardTitle>
          <CardDescription>
            Histórico de métricas dos agentes ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução Temporal de Performance
            </CardTitle>
            <CardDescription>
              Histórico de métricas dos agentes ao longo do tempo
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>

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
        </div>
      </CardHeader>
      <CardContent>
        {!performanceData || performanceData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado histórico disponível para o período selecionado
          </p>
        ) : (
          <div className="space-y-8">
            {/* Gráfico de Taxa de Sucesso */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Taxa de Sucesso (%)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="successRate" 
                    stroke="hsl(var(--success))" 
                    strokeWidth={2}
                    fill="url(#successGradient)" 
                    name="Taxa de Sucesso (%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Ativações vs Desativações */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Ativações e Desativações</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="line"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="activations" 
                    stroke="hsl(var(--brand-blue))" 
                    strokeWidth={2}
                    name="Ativações"
                    dot={{ fill: 'hsl(var(--brand-blue))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="deactivations" 
                    stroke="hsl(var(--error))" 
                    strokeWidth={2}
                    name="Desativações"
                    dot={{ fill: 'hsl(var(--error))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Conversas */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Volume de Conversas</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--brand-purple))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--brand-purple))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="rect"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalConversations" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fill="url(#totalGradient)" 
                    name="Total de Conversas"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="activeConversations" 
                    stroke="hsl(var(--brand-purple))" 
                    strokeWidth={2}
                    fill="url(#activeGradient)" 
                    name="Conversas Ativas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
