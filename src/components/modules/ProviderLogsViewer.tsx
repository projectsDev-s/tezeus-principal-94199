import { useProviderAlerts } from '@/hooks/useProviderAlerts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProviderLogsViewerProps {
  workspaceId: string;
}

export function ProviderLogsViewer({ workspaceId }: ProviderLogsViewerProps) {
  const { alerts, isLoading } = useProviderAlerts({ workspaceId });

  if (isLoading) {
    return <div className="text-center p-8">Carregando alertas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <h2 className="text-2xl font-bold">Histórico de Alertas</h2>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <Card key={alert.id} className="p-4 border-l-4 border-l-destructive">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">{alert.provider.toUpperCase()}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(alert.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm">
                    <strong className="text-destructive">
                      Taxa de Erro: {Number(alert.error_rate).toFixed(1)}%
                    </strong>
                    <span className="text-muted-foreground">
                      {' '}
                      (limite configurado: {alert.threshold_percent}%)
                    </span>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {alert.error_count} de {alert.total_messages} mensagens falharam
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Período: {format(new Date(alert.time_window_start), 'HH:mm')} -{' '}
                    {format(new Date(alert.time_window_end), 'HH:mm')}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Notificado via: {alert.notified_via.join(', ') || 'Nenhum'}
              </div>
            </div>
          </Card>
        ))}

        {alerts.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            Nenhum alerta disparado recentemente. 🎉
          </Card>
        )}
      </div>
    </div>
  );
}
