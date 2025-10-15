import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TrendsChartProps {
  conversationTrends: { date: string; count: number }[];
  dealTrends: { date: string; completed: number; lost: number }[];
  isLoading?: boolean;
}

export function TrendsChart({ conversationTrends, dealTrends, isLoading = false }: TrendsChartProps) {
  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Combine conversation and deal trends by date
  const combinedData = conversationTrends.map(conv => {
    const dealData = dealTrends.find(deal => deal.date === conv.date);
    return {
      date: format(new Date(conv.date), 'dd/MM', { locale: ptBR }),
      conversas: conv.count,
      vendas: dealData?.completed || 0,
      perdidos: dealData?.lost || 0,
    };
  });

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-md">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'conversas' && 'Conversas: '}
              {entry.dataKey === 'vendas' && 'Vendas: '}
              {entry.dataKey === 'perdidos' && 'Perdidos: '}
              {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Evolução dos Atendimentos (Últimos 7 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-muted-foreground"
                fontSize={12}
              />
              <YAxis 
                className="text-muted-foreground"
                fontSize={12}
              />
              <Tooltip content={renderCustomTooltip} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Line 
                type="monotone" 
                dataKey="conversas" 
                stroke="hsl(var(--chart-1))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-1))', strokeWidth: 2 }}
                name="Conversas"
              />
              <Line 
                type="monotone" 
                dataKey="vendas" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2 }}
                name="Vendas"
              />
              <Line 
                type="monotone" 
                dataKey="perdidos" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-3))', strokeWidth: 2 }}
                name="Perdidos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}