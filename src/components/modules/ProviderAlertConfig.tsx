import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useProviderAlertConfig } from '@/hooks/useProviderAlertConfig';
import { useProviderAlerts } from '@/hooks/useProviderAlerts';
import { Loader2, Bell, BellOff, Mail, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProviderAlertConfigProps {
  workspaceId: string;
}

export function ProviderAlertConfig({ workspaceId }: ProviderAlertConfigProps) {
  const { configs, isLoading, upsertConfig, deleteConfig } = useProviderAlertConfig({ workspaceId });
  const { alerts } = useProviderAlerts({ workspaceId });

  const [provider, setProvider] = useState<'evolution' | 'zapi' | 'all'>('all');
  const [errorThreshold, setErrorThreshold] = useState(30);
  const [timeWindow, setTimeWindow] = useState(60);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [toastEnabled, setToastEnabled] = useState(true);
  const [emails, setEmails] = useState('');
  const [isActive, setIsActive] = useState(true);

  const handleSave = async () => {
    if (errorThreshold < 1 || errorThreshold > 100) {
      toast.error('Threshold deve estar entre 1 e 100%');
      return;
    }

    if (timeWindow < 1) {
      toast.error('Janela de tempo deve ser maior que 0');
      return;
    }

    const emailList = emails
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emailEnabled && emailList.length === 0) {
      toast.error('Adicione pelo menos um email para notificação');
      return;
    }

    await upsertConfig({
      provider,
      error_threshold_percent: errorThreshold,
      time_window_minutes: timeWindow,
      email_notifications_enabled: emailEnabled,
      toast_notifications_enabled: toastEnabled,
      notification_emails: emailList,
      is_active: isActive,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente deletar esta configuração?')) {
      await deleteConfig(id);
    }
  };

  const getProviderBadge = (provider: string) => {
    const colors = {
      evolution: 'bg-blue-500',
      zapi: 'bg-purple-500',
      all: 'bg-gray-500',
    };
    return (
      <Badge className={colors[provider as keyof typeof colors] || 'bg-gray-500'}>
        {provider === 'all' ? 'TODOS' : provider.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuração de Alertas</h2>
        <p className="text-muted-foreground">
          Configure alertas automáticos para monitorar a taxa de erro dos providers
        </p>
      </div>

      {/* Alertas Recentes */}
      {alerts.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Alertas Recentes
            </CardTitle>
            <CardDescription>Últimos alertas disparados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {getProviderBadge(alert.provider)}
                  <div>
                    <p className="font-medium">
                      Taxa de erro: {alert.error_rate}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {alert.error_count} erros de {alert.total_messages} mensagens
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(alert.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Nova Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nova Configuração
          </CardTitle>
          <CardDescription>
            Configure um novo alerta para monitorar providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="threshold">Limite de Erro (%)</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                max="100"
                value={errorThreshold}
                onChange={(e) => setErrorThreshold(parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-window">Janela de Tempo (minutos)</Label>
              <Input
                id="time-window"
                type="number"
                min="1"
                value={timeWindow}
                onChange={(e) => setTimeWindow(parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2 flex items-center justify-between">
              <Label htmlFor="is-active">Alerta Ativo</Label>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <Label htmlFor="toast-enabled">Notificações Toast</Label>
              </div>
              <Switch
                id="toast-enabled"
                checked={toastEnabled}
                onCheckedChange={setToastEnabled}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <Label htmlFor="email-enabled">Notificações por Email</Label>
                </div>
                <Switch
                  id="email-enabled"
                  checked={emailEnabled}
                  onCheckedChange={setEmailEnabled}
                />
              </div>

              {emailEnabled && (
                <div>
                  <Label htmlFor="emails">Emails (separados por vírgula)</Label>
                  <Input
                    id="emails"
                    placeholder="email1@example.com, email2@example.com"
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Os alertas serão enviados para estes emails
                  </p>
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleSave} className="w-full">
            Salvar Configuração
          </Button>
        </CardContent>
      </Card>

      {/* Configurações Existentes */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Ativas</CardTitle>
          <CardDescription>
            Gerenciar alertas configurados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhuma configuração de alerta cadastrada
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getProviderBadge(config.provider)}
                      {config.is_active ? (
                        <Bell className="h-4 w-4 text-green-500" />
                      ) : (
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm">
                      <strong>Limite:</strong> {config.error_threshold_percent}% em {config.time_window_minutes} min
                    </p>
                    <div className="flex gap-2">
                      {config.toast_notifications_enabled && (
                        <Badge variant="secondary">Toast</Badge>
                      )}
                      {config.email_notifications_enabled && (
                        <Badge variant="secondary">
                          Email ({config.notification_emails.length})
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(config.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
