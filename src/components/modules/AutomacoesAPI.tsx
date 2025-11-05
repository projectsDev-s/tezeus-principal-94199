import { WebhookConfigFix } from '@/components/webhook/WebhookConfigFix';
import { InstanceSyncPanel } from '@/components/sync/InstanceSyncPanel';
import { WebhookDiagnostics } from '@/components/diagnostics/WebhookDiagnostics';
import { WhatsAppProvidersConfig } from '@/components/modules/WhatsAppProvidersConfig';
import { ProviderLogsViewer } from '@/components/modules/ProviderLogsViewer';
import { ProviderAlertConfig } from '@/components/modules/ProviderAlertConfig';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AutomacoesAPI() {
  const { selectedWorkspace } = useWorkspace();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Automações - API</h1>
        <p className="text-muted-foreground mb-6">Configurações de API, webhooks e sincronização</p>
      </div>
      
      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="providers">Provedores WhatsApp</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
          <TabsTrigger value="logs">Logs de Envios</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6">
          {selectedWorkspace && (
            <WhatsAppProvidersConfig 
              workspaceId={selectedWorkspace.workspace_id} 
              workspaceName={selectedWorkspace.name}
            />
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <WebhookDiagnostics />
          <WebhookConfigFix />
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <InstanceSyncPanel />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          {selectedWorkspace && (
            <ProviderLogsViewer workspaceId={selectedWorkspace.workspace_id} />
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          {selectedWorkspace && (
            <ProviderAlertConfig workspaceId={selectedWorkspace.workspace_id} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}