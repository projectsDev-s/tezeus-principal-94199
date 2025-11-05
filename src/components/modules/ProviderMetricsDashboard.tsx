import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProviderMetrics } from '@/hooks/useProviderMetrics';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Activity, CheckCircle2, XCircle, Clock, TrendingUp, Radio } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = {
  evolution: '#3b82f6', // blue
  zapi: '#eab308', // yellow
  success: '#22c55e', // green
  error: '#ef4444', // red
};

export function ProviderMetricsDashboard() {
  const { selectedWorkspace } = useWorkspace();
  const [selectedPeriod, setSelectedPeriod] = useState('7');
  const { metrics, isLoading } = useProviderMetrics(
    selectedWorkspace?.workspace_id || '',
    parseInt(selectedPeriod)
  );

  if (!selectedWorkspace) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Selecione um workspace para visualizar as métricas
        </CardContent>
      </Card>
    );
  }

  const evolutionMetrics = metrics.find(m => m.provider === 'evolution');
  const zapiMetrics = metrics.find(m => m.provider === 'zapi');

  // Dados para gráficos comparativos
  const comparisonData = metrics.map(m => ({
    name: m.provider === 'evolution' ? 'Evolution API' : 'Z-API',
    'Taxa de Sucesso': m.successRate,
    'Mensagens': m.totalMessages,
    'Tempo Médio (ms)': m.averageResponseTime,
  }));

  const successRateData = metrics.map(m => ({
    name: m.provider === 'evolution' ? 'Evolution' : 'Z-API',
    value: m.successRate,
  }));

  const responseTimeData = metrics.map(m => ({
    name: m.provider === 'evolution' ? 'Evolution' : 'Z-API',
    'Tempo de Resposta': m.averageResponseTime,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard de Performance</h2>
          <p className="text-muted-foreground">
            Comparação de métricas entre Evolution API e Z-API
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24 horas</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Cards de Métricas Principais */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Evolution - Total de Mensagens */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Evolution - Mensagens
                </CardTitle>
                <Activity className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{evolutionMetrics?.totalMessages || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {evolutionMetrics?.successfulMessages || 0} enviadas com sucesso
                </p>
              </CardContent>
            </Card>

            {/* Evolution - Taxa de Sucesso */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Evolution - Taxa de Sucesso
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(evolutionMetrics?.successRate || 0).toFixed(1)}%
                </div>
                <Badge variant={evolutionMetrics && evolutionMetrics.successRate >= 95 ? "default" : "destructive"} className="mt-2">
                  {evolutionMetrics && evolutionMetrics.successRate >= 95 ? 'Excelente' : 'Precisa atenção'}
                </Badge>
              </CardContent>
            </Card>

            {/* Z-API - Total de Mensagens */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Z-API - Mensagens
                </CardTitle>
                <Activity className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{zapiMetrics?.totalMessages || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {zapiMetrics?.successfulMessages || 0} enviadas com sucesso
                </p>
              </CardContent>
            </Card>

            {/* Z-API - Taxa de Sucesso */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Z-API - Taxa de Sucesso
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(zapiMetrics?.successRate || 0).toFixed(1)}%
                </div>
                <Badge variant={zapiMetrics && zapiMetrics.successRate >= 95 ? "default" : "destructive"} className="mt-2">
                  {zapiMetrics && zapiMetrics.successRate >= 95 ? 'Excelente' : 'Precisa atenção'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos Detalhados */}
          <Tabs defaultValue="comparison" className="space-y-4">
            <TabsList>
              <TabsTrigger value="comparison">Comparação Geral</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="errors">Erros</TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Gráfico de Taxa de Sucesso */}
                <Card>
                  <CardHeader>
                    <CardTitle>Taxa de Sucesso Comparativa</CardTitle>
                    <CardDescription>
                      Percentual de mensagens enviadas com sucesso
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Taxa de Sucesso" fill={COLORS.success} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico de Volume de Mensagens */}
                <Card>
                  <CardHeader>
                    <CardTitle>Volume de Mensagens</CardTitle>
                    <CardDescription>
                      Total de mensagens por provedor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Mensagens" fill={COLORS.evolution} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tempo de Resposta Médio</CardTitle>
                  <CardDescription>
                    Comparação de velocidade entre provedores (em milissegundos)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={responseTimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="Tempo de Resposta" 
                        stroke={COLORS.evolution} 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      Evolution API - Erros
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total de Erros:</span>
                        <span className="font-semibold text-red-600">
                          {evolutionMetrics?.failedMessages || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Taxa de Erro:</span>
                        <span className="font-semibold">
                          {evolutionMetrics ? (100 - evolutionMetrics.successRate).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      Z-API - Erros
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total de Erros:</span>
                        <span className="font-semibold text-red-600">
                          {zapiMetrics?.failedMessages || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Taxa de Erro:</span>
                        <span className="font-semibold">
                          {zapiMetrics ? (100 - zapiMetrics.successRate).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Recomendações */}
          {!isLoading && metrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evolutionMetrics && zapiMetrics && (
                  <>
                    {evolutionMetrics.successRate > zapiMetrics.successRate + 5 ? (
                      <p className="text-sm">
                        ✅ <strong>Evolution API</strong> está apresentando melhor taxa de sucesso ({evolutionMetrics.successRate.toFixed(1)}% vs {zapiMetrics.successRate.toFixed(1)}%)
                      </p>
                    ) : zapiMetrics.successRate > evolutionMetrics.successRate + 5 ? (
                      <p className="text-sm">
                        ✅ <strong>Z-API</strong> está apresentando melhor taxa de sucesso ({zapiMetrics.successRate.toFixed(1)}% vs {evolutionMetrics.successRate.toFixed(1)}%)
                      </p>
                    ) : (
                      <p className="text-sm">
                        ℹ️ Ambos os provedores estão com performance similar
                      </p>
                    )}
                    
                    {evolutionMetrics.averageResponseTime < zapiMetrics.averageResponseTime && (
                      <p className="text-sm">
                        ⚡ <strong>Evolution API</strong> é mais rápida ({evolutionMetrics.averageResponseTime.toFixed(0)}ms vs {zapiMetrics.averageResponseTime.toFixed(0)}ms)
                      </p>
                    )}
                    
                    {zapiMetrics.averageResponseTime < evolutionMetrics.averageResponseTime && (
                      <p className="text-sm">
                        ⚡ <strong>Z-API</strong> é mais rápida ({zapiMetrics.averageResponseTime.toFixed(0)}ms vs {evolutionMetrics.averageResponseTime.toFixed(0)}ms)
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
