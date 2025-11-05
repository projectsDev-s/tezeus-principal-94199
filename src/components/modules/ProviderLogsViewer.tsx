import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useProviderLogs } from '@/hooks/useProviderLogs';
import { Loader2, Filter, Trash2, Eye, Download, RefreshCw, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ProviderLogsViewerProps {
  workspaceId: string;
}

export function ProviderLogsViewer({ workspaceId }: ProviderLogsViewerProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [provider, setProvider] = useState<'evolution' | 'zapi' | 'all'>('all');
  const [result, setResult] = useState<'success' | 'error' | 'all'>('all');
  const [action, setAction] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { logs, isLoading, totalCount, metrics, fetchLogs, clearLogs } = useProviderLogs({
    workspaceId,
    startDate,
    endDate,
    provider,
    result,
    action
  });

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setProvider('all');
    setResult('all');
    setAction('');
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('Nenhum log para exportar');
      return;
    }

    const headers = ['Data/Hora', 'Provider', 'Ação', 'Resultado', 'Detalhes'];
    const rows = logs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
      log.provider.toUpperCase(),
      log.action,
      log.result,
      JSON.stringify(log.payload)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `provider-logs-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    link.click();

    toast.success('Logs exportados com sucesso');
  };

  const getResultBadge = (result: string) => {
    if (result === 'success') {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Sucesso
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Erro
      </Badge>
    );
  };

  const getProviderBadge = (provider: string) => {
    const colors = {
      evolution: 'bg-blue-500',
      zapi: 'bg-purple-500'
    };
    return (
      <Badge className={colors[provider as keyof typeof colors] || 'bg-gray-500'}>
        {provider.toUpperCase()}
      </Badge>
    );
  };

  const providerDistributionData = [
    { name: 'Evolution', value: metrics.evolutionCount, color: 'hsl(var(--chart-1))' },
    { name: 'Z-API', value: metrics.zapiCount, color: 'hsl(var(--chart-2))' }
  ].filter(item => item.value > 0);

  const providerComparisonData = [
    {
      name: 'Evolution',
      sucesso: metrics.evolutionCount > 0 ? metrics.evolutionSuccessRate : 0,
      erro: metrics.evolutionCount > 0 ? (100 - metrics.evolutionSuccessRate) : 0,
    },
    {
      name: 'Z-API',
      sucesso: metrics.zapiCount > 0 ? metrics.zapiSuccessRate : 0,
      erro: metrics.zapiCount > 0 ? (100 - metrics.zapiSuccessRate) : 0,
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Logs de Envios WhatsApp</h2>
        <p className="text-muted-foreground">
          Histórico completo de envios e tentativas via provedores
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Envios</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              Últimos 100 registros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {logs.filter(log => log.result === 'success').length} sucessos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Erro</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.errorRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {logs.filter(log => log.result === 'error').length} erros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Provider Principal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.evolutionCount >= metrics.zapiCount ? 'Evolution' : 'Z-API'}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.max(metrics.evolutionCount, metrics.zapiCount)} envios
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {logs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Provider</CardTitle>
              <CardDescription>
                Proporção de envios por provedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={providerDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {providerDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comparação de Performance</CardTitle>
              <CardDescription>
                Taxa de sucesso por provider
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={providerComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sucesso" fill="hsl(var(--chart-1))" name="Sucesso %" />
                  <Bar dataKey="erro" fill="hsl(var(--chart-2))" name="Erro %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Filtre os logs por data, provider, status e ação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="evolution">Evolution</SelectItem>
                  <SelectItem value="zapi">Z-API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="result">Resultado</Label>
              <Select value={result} onValueChange={(v) => setResult(v as any)}>
                <SelectTrigger id="result">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Buscar por Ação</Label>
            <Input
              id="action"
              placeholder="Digite para buscar..."
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleClearFilters}>
              Limpar Filtros
            </Button>
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExportCSV} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="destructive" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Todos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
        <CardHeader>
          <CardTitle>
            Registros ({totalCount} {totalCount === 1 ? 'log' : 'logs'})
          </CardTitle>
          <CardDescription>
            Últimos 100 registros ordenados por data (mais recentes primeiro)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhum log encontrado com os filtros aplicados
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getProviderBadge(log.provider)}</TableCell>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell>{getResultBadge(log.result)}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Detalhes do Log</DialogTitle>
                              <DialogDescription>
                                {format(new Date(log.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", { locale: ptBR })}
                              </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="h-[400px] w-full">
                              <div className="space-y-4">
                                <div>
                                  <Label>Provider</Label>
                                  <div className="mt-1">{getProviderBadge(log.provider)}</div>
                                </div>
                                <div>
                                  <Label>Ação</Label>
                                  <p className="mt-1 font-mono text-sm">{log.action}</p>
                                </div>
                                <div>
                                  <Label>Resultado</Label>
                                  <div className="mt-1">{getResultBadge(log.result)}</div>
                                </div>
                                <div>
                                  <Label>Payload Completo</Label>
                                  <pre className="mt-1 p-4 bg-muted rounded-lg overflow-auto text-xs">
                                    {JSON.stringify(log.payload, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
