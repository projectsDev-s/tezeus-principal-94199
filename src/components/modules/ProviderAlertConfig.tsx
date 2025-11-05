import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProviderAlertConfig } from '@/hooks/useProviderAlertConfig';
import { Bell, Trash2, Plus } from 'lucide-react';

interface ProviderAlertConfigProps {
  workspaceId: string;
}

export function ProviderAlertConfig({ workspaceId }: ProviderAlertConfigProps) {
  const { configs, isLoading, saveConfig, deleteConfig } = useProviderAlertConfig(workspaceId);
  const [editingConfig, setEditingConfig] = useState<any>(null);

  const handleSave = async () => {
    if (!editingConfig) return;
    await saveConfig(editingConfig);
    setEditingConfig(null);
  };

  const handleNew = () => {
    setEditingConfig({
      provider: 'all',
      error_threshold_percent: 10,
      time_window_minutes: 60,
      email_notifications_enabled: false,
      toast_notifications_enabled: true,
      notification_emails: [],
      is_active: true,
    });
  };

  if (isLoading) {
    return <div className="text-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Configuração de Alertas</h2>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Alerta
        </Button>
      </div>

      {editingConfig && (
        <Card className="p-6 border-2 border-primary">
          <h3 className="font-semibold mb-4">
            {editingConfig.id ? 'Editar Configuração' : 'Nova Configuração'}
          </h3>
          <div className="space-y-4">
            <div>
              <Label>Provedor</Label>
              <Select
                value={editingConfig.provider}
                onValueChange={(value) =>
                  setEditingConfig({ ...editingConfig, provider: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="evolution">Evolution</SelectItem>
                  <SelectItem value="zapi">Z-API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Taxa de Erro Limite (%)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={editingConfig.error_threshold_percent}
                onChange={(e) =>
                  setEditingConfig({
                    ...editingConfig,
                    error_threshold_percent: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <Label>Janela de Tempo (minutos)</Label>
              <Input
                type="number"
                min="1"
                value={editingConfig.time_window_minutes}
                onChange={(e) =>
                  setEditingConfig({
                    ...editingConfig,
                    time_window_minutes: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Notificações Toast</Label>
              <Switch
                checked={editingConfig.toast_notifications_enabled}
                onCheckedChange={(checked) =>
                  setEditingConfig({
                    ...editingConfig,
                    toast_notifications_enabled: checked,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Notificações por Email</Label>
              <Switch
                checked={editingConfig.email_notifications_enabled}
                onCheckedChange={(checked) =>
                  setEditingConfig({
                    ...editingConfig,
                    email_notifications_enabled: checked,
                  })
                }
              />
            </div>

            {editingConfig.email_notifications_enabled && (
              <div>
                <Label>Emails (separados por vírgula)</Label>
                <Input
                  value={editingConfig.notification_emails?.join(', ') || ''}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      notification_emails: e.target.value
                        .split(',')
                        .map((email) => email.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={editingConfig.is_active}
                onCheckedChange={(checked) =>
                  setEditingConfig({ ...editingConfig, is_active: checked })
                }
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingConfig(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {configs.map((config) => (
          <Card key={config.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">
                    {config.provider === 'all'
                      ? 'Todos os Provedores'
                      : config.provider.toUpperCase()}
                  </span>
                  {!config.is_active && (
                    <span className="text-xs bg-muted px-2 py-1 rounded">Inativo</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>
                    Limite: <strong>{config.error_threshold_percent}%</strong> em{' '}
                    <strong>{config.time_window_minutes} minutos</strong>
                  </div>
                  <div>
                    Notificações:{' '}
                    {[
                      config.toast_notifications_enabled && 'Toast',
                      config.email_notifications_enabled && 'Email',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Nenhuma'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingConfig(config)}
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteConfig(config.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {configs.length === 0 && !editingConfig && (
          <Card className="p-8 text-center text-muted-foreground">
            Nenhuma configuração de alerta criada.
            <br />
            Clique em "Novo Alerta" para começar.
          </Card>
        )}
      </div>
    </div>
  );
}
