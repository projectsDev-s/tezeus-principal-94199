import { useWorkspaceAnalytics } from "@/hooks/useWorkspaceAnalytics";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceStatusCheck } from "@/hooks/useWorkspaceStatusCheck";
import { AnalyticsKPICard } from "./dashboard/AnalyticsKPICard";
import { ConversionChart } from "./dashboard/ConversionChart";
import { TrendsChart } from "./dashboard/TrendsChart";
import { DealsStatusChart } from "./dashboard/DealsStatusChart";

import { MessageCircle, Users, TrendingUp, DollarSign, Clock, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function Dashboard({ isDarkMode }: { isDarkMode?: boolean }) {
  const { analytics, isLoading } = useWorkspaceAnalytics();
  const { selectedWorkspace, isLoadingWorkspaces } = useWorkspace();
  const { userRole } = useAuth();

  // Monitorar status do workspace
  useWorkspaceStatusCheck();

  const isUserRole = userRole === 'user';
  const isMasterRole = userRole === 'master';

  // Loading state - mostrar skeleton enquanto carrega workspace ou analytics
  if (isLoadingWorkspaces || !selectedWorkspace || isLoading) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          Relatório de Atividades
        </h1>
        <p className="text-sm text-muted-foreground">
          {isMasterRole
            ? "Visualização global de todas as empresas"
            : `Indicadores consolidados de ${selectedWorkspace.name}`}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnalyticsKPICard
          title="Conversas Ativas"
          value={analytics.activeConversations}
          subtitle={`${analytics.totalConversations} conversas no total`}
          icon={MessageCircle}
          isLoading={isLoading}
        />
        
        <AnalyticsKPICard
          title="Atendimentos em Andamento"
          value={analytics.dealsInProgress}
          subtitle="Negócios em pipeline"
          icon={Users}
          isLoading={isLoading}
        />
        
        <AnalyticsKPICard
          title="Vendas Concluídas"
          value={analytics.completedDeals}
          subtitle="Deals fechados"
          icon={TrendingUp}
          isLoading={isLoading}
        />
        
        <AnalyticsKPICard
          title="Taxa de Conversão"
          value={`${analytics.conversionRate.toFixed(1)}%`}
          subtitle="Vendas vs. Total de closes"
          icon={Target}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <DealsStatusChart
          dealsInProgress={analytics.dealsInProgress}
          completedDeals={analytics.completedDeals}
          lostDeals={analytics.lostDeals}
          isLoading={isLoading}
        />
        
        <ConversionChart
          completedDeals={analytics.completedDeals}
          lostDeals={analytics.lostDeals}
          conversionRate={analytics.conversionRate}
          isLoading={isLoading}
        />
      </div>

      {/* Trends Chart */}
      <TrendsChart
        conversationTrends={analytics.conversationTrends}
        dealTrends={analytics.dealTrends}
        isLoading={isLoading}
      />

      {/* Agent Statistics */}
      
    </div>
  );
}