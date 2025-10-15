import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Cell, PieChart, Pie, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ConversionChartProps {
  completedDeals: number;
  lostDeals: number;
  conversionRate: number;
  isLoading?: boolean;
}

export function ConversionChart({ completedDeals, lostDeals, conversionRate, isLoading = false }: ConversionChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-8 w-20" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <Skeleton className="w-full h-full rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = [
    {
      name: 'Vendas Concluídas',
      value: completedDeals,
      color: 'hsl(var(--chart-1))'
    },
    {
      name: 'Clientes Perdidos',
      value: lostDeals,
      color: 'hsl(var(--chart-2))'
    }
  ];

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))'];

  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-popover border border-border rounded-lg p-2 shadow-md">
          <p className="text-sm font-medium">{data.name}</p>
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
          Taxa de Conversão
        </CardTitle>
        <div className="text-2xl font-bold text-foreground">
          {conversionRate.toFixed(1)}%
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={renderCustomTooltip} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}