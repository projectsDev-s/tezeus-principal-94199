import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DealsStatusChartProps {
  dealsInProgress: number;
  completedDeals: number;
  lostDeals: number;
  isLoading?: boolean;
}

export function DealsStatusChart({ dealsInProgress, completedDeals, lostDeals, isLoading = false }: DealsStatusChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = [
    {
      name: 'Em Andamento',
      value: dealsInProgress,
      color: 'hsl(var(--chart-1))'
    },
    {
      name: 'Concluídos',
      value: completedDeals,
      color: 'hsl(var(--chart-2))'
    },
    {
      name: 'Perdidos',
      value: lostDeals,
      color: 'hsl(var(--chart-3))'
    }
  ];

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-popover border border-border rounded-lg p-2 shadow-md">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{data.value} deals</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Status dos Atendimentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                className="text-muted-foreground"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                className="text-muted-foreground"
                fontSize={12}
              />
              <Tooltip content={renderCustomTooltip} />
              <Bar 
                dataKey="value" 
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}