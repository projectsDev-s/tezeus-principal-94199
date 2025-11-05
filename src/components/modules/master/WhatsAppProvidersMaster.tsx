import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { WhatsAppProvidersConfig } from '@/components/modules/WhatsAppProvidersConfig';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { Loader2, Building2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function WhatsAppProvidersMaster() {
  const { workspaces, isLoading } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

  useEffect(() => {
    // Auto-selecionar primeira workspace ativa
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      const activeWorkspace = workspaces.find(w => w.is_active !== false);
      if (activeWorkspace) {
        setSelectedWorkspaceId(activeWorkspace.workspace_id);
      }
    }
  }, [workspaces, selectedWorkspaceId]);

  const selectedWorkspace = workspaces.find(w => w.workspace_id === selectedWorkspaceId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertDescription>
          Configure os provedores WhatsApp (Evolution API e Z-API) para cada empresa do sistema.
          As configurações são específicas por empresa.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Empresa</CardTitle>
          <CardDescription>
            Escolha a empresa para configurar os provedores WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="workspace-select">Empresa</Label>
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger id="workspace-select">
                <SelectValue placeholder="Selecione uma empresa..." />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                    {workspace.name} {workspace.cnpj ? `(${workspace.cnpj})` : ''} 
                    {workspace.is_active === false && ' - INATIVA'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedWorkspace && (
        <WhatsAppProvidersConfig 
          workspaceId={selectedWorkspace.workspace_id}
          workspaceName={selectedWorkspace.name}
        />
      )}

      {!selectedWorkspace && selectedWorkspaceId && (
        <Alert>
          <AlertDescription>
            Empresa não encontrada. Selecione outra empresa.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
