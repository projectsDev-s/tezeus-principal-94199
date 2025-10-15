import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  CheckSquare, 
  Users, 
  DollarSign,
  ArrowRight,
  Plus
} from "lucide-react";
import { DashboardStats } from "@/hooks/useDashboardStats";

interface DashboardOperationsCardsProps {
  stats: DashboardStats;
  isLoading: boolean;
  onNavigate: (path: string) => void;
}

export function DashboardOperationsCards({ stats, isLoading, onNavigate }: DashboardOperationsCardsProps) {
  const operationCards = [
    {
      title: "Pipeline de Negócios",
      value: stats.activePipelineDeals,
      subtitle: "negócios em andamento",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-success",
      bgColor: "bg-success/10",
      action: () => onNavigate("/crm-negocios"),
      actionLabel: "Ver Pipeline"
    },
    {
      title: "Tarefas Pendentes", 
      value: stats.pendingTasks,
      subtitle: "tarefas abertas",
      icon: <CheckSquare className="w-5 h-5" />,
      color: "text-warning",
      bgColor: "bg-warning/10",
      action: () => onNavigate("/recursos-tarefas"),
      actionLabel: "Gerenciar"
    },
    {
      title: "Contatos Ativos",
      value: stats.totalConversations,
      subtitle: "interações registradas",
      icon: <Users className="w-5 h-5" />,
      color: "text-primary",
      bgColor: "bg-primary/10",
      action: () => onNavigate("/crm-contatos"),
      actionLabel: "Ver Contatos"
    },
    {
      title: "Receita do Dia",
      value: `R$ ${stats.todayRevenue.toLocaleString()}`,
      subtitle: "vendas realizadas",
      icon: <DollarSign className="w-5 h-5" />,
      color: "text-accent",
      bgColor: "bg-accent/10",
      action: () => onNavigate("/dashboard"),
      actionLabel: "Detalhes"
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Operações</h2>
        <Button variant="outline" size="sm" className="text-xs">
          <Plus className="w-3 h-3 mr-1" />
          Criar Tarefa
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {operationCards.map((card, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span>{card.title}</span>
                <div className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center ${card.color}`}>
                  {card.icon}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </div>
                <p className="text-sm text-muted-foreground">{card.subtitle}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={card.action}
                >
                  {card.actionLabel}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}