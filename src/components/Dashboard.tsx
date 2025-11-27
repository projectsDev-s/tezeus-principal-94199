import { useWorkspaceAnalytics } from "@/hooks/useWorkspaceAnalytics";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceStatusCheck } from "@/hooks/useWorkspaceStatusCheck";
import { MessageCircle, Users, TrendingUp, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

// Inline KPICard component
function AnalyticsKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading
}: any) {
  if (isLoading) return <Skeleton className="h-32" />;
  return <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>;
}
export function Dashboard({
  isDarkMode
}: {
  isDarkMode?: boolean;
}) {
  const {
    analytics,
    isLoading
  } = useWorkspaceAnalytics();
  const {
    selectedWorkspace,
    isLoadingWorkspaces
  } = useWorkspace();
  const {
    userRole
  } = useAuth();

  // Monitorar status do workspace
  useWorkspaceStatusCheck();
  const isMasterRole = userRole === 'master';

  // Loading state
  if (isLoadingWorkspaces || !selectedWorkspace || isLoading) {
    return <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({
          length: 4
        }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-80" />
      </div>;
  }

  // Data for Charts
  const pieData = [{
    name: 'Em Andamento',
    value: analytics.dealsInProgress
  }, {
    name: 'Ganhos',
    value: analytics.completedDeals
  }, {
    name: 'Perdidos',
    value: analytics.lostDeals
  }].filter(d => d.value > 0);
  const COLORS = ['#3B82F6', '#10B981', '#EF4444']; // Blue, Green, Red

  return <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          Relatório de Atividades
        </h1>
        
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnalyticsKPICard title="Conversas Ativas" value={analytics.activeConversations} subtitle={`${analytics.totalConversations} conversas no total`} icon={MessageCircle} isLoading={isLoading} />
        
        <AnalyticsKPICard title="Atendimentos em Andamento" value={analytics.dealsInProgress} subtitle="Negócios em pipeline" icon={Users} isLoading={isLoading} />
        
        <AnalyticsKPICard title="Vendas Concluídas" value={analytics.completedDeals} subtitle="Deals fechados" icon={TrendingUp} isLoading={isLoading} />
        
        <AnalyticsKPICard title="Taxa de Conversão" value={`${analytics.conversionRate.toFixed(1)}%`} subtitle="Vendas vs. Total de closes" icon={Target} isLoading={isLoading} />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Deals Status Chart (Pie) */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Negócios</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {pieData.length > 0 ? <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
             </ResponsiveContainer> : <div className="h-full flex items-center justify-center text-muted-foreground">
                    Sem dados para exibir
                </div>}
          </CardContent>
        </Card>

        {/* Trends Chart (Line) */}
        <Card>
            <CardHeader>
                <CardTitle>Tendência de Conversas (7 dias)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
                {analytics.conversationTrends.length > 0 ? <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analytics.conversationTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit'
              })} />
                            <YAxis />
                            <Tooltip labelFormatter={val => new Date(val).toLocaleDateString('pt-BR')} />
                            <Legend />
                            <Line type="monotone" dataKey="count" name="Conversas" stroke="#8884d8" strokeWidth={2} activeDot={{
                r: 8
              }} />
                        </LineChart>
                    </ResponsiveContainer> : <div className="h-full flex items-center justify-center text-muted-foreground">
                        Sem dados para exibir
                    </div>}
            </CardContent>
        </Card>
      </div>
    </div>;
}