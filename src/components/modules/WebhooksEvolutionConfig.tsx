import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useWorkspaceWebhooks } from "@/hooks/useWorkspaceWebhooks";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { WebhookLog } from "@/types/webhook";
import { 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Send, 
  Download, 
  Settings, 
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function WebhooksEvolutionConfig() {
  const { selectedWorkspace } = useWorkspace();
  const workspaceId = selectedWorkspace?.workspace_id;
  
  // WebhooksEvolutionConfig initialized
  
  const {
    webhookConfig,
    instances,
    logs,
    isLoading,
    isTestingWebhook,
    saveWebhookConfig,
    rotateWebhookSecret,
    applyToAllInstances,
    testWebhook,
    fetchWebhookLogs,
    getAppliedCount,
    getFilteredInstances,
    refreshConfig
  } = useWorkspaceWebhooks(workspaceId);

  const [webhookUrl, setWebhookUrl] = useState(webhookConfig?.webhook_url || "");
  const [showSecret, setShowSecret] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyApplied, setShowOnlyApplied] = useState(false);
  const [filters, setFilters] = useState({
    eventType: "",
    status: "",
    dateFrom: "",
    dateTo: ""
  });

  // Sync webhookUrl with config when it loads
  useEffect(() => {
    console.log('🔧 WebhookConfig effect - webhookConfig:', webhookConfig);
    // WebhookConfig effect triggered
    console.log('🔧 WebhookConfig effect - isLoading:', isLoading);
    
    if (webhookConfig?.webhook_url) {
      console.log('🔧 Setting webhookUrl to:', webhookConfig.webhook_url);
      setWebhookUrl(webhookConfig.webhook_url);
    } else {
      console.log('🔧 No webhook_url found in config, clearing field');
      setWebhookUrl('');
    }
  }, [webhookConfig, workspaceId, isLoading]);

  const handleSaveConfig = async () => {
    if (!webhookUrl.trim()) return;
    
    const secret = webhookConfig?.webhook_secret || generateRandomSecret();
    await saveWebhookConfig(webhookUrl, secret);
  };

  const handleRotateSecret = async () => {
    const success = await rotateWebhookSecret();
    if (success && webhookConfig?.webhook_url) {
      setWebhookUrl(webhookConfig.webhook_url);
    }
  };

  const handleApplyToAll = async () => {
    await applyToAllInstances();
  };

  // Check if current URL is a test URL
  const isTestUrl = webhookUrl.includes('/test/');
  const getProductionUrl = (url: string) => url.replace('/test/', '/webhook/');

  const handleConvertToProduction = () => {
    if (isTestUrl) {
      const productionUrl = getProductionUrl(webhookUrl);
      setWebhookUrl(productionUrl);
    }
  };

  const handleTestWebhook = async () => {
    await testWebhook();
  };

  const generateRandomSecret = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500 text-white">Conectado</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Desconectado</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Conectando</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getLogStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!workspaceId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Por favor, selecione uma empresa para configurar webhooks</p>
        </div>
      </div>
    );
  }

  if (isLoading && !webhookConfig) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando configurações de webhook...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Webhooks Evolution</h1>
        <p className="text-muted-foreground">Configure webhooks centralizados para todas as instâncias do workspace</p>
        <p className="text-xs text-muted-foreground mt-1">
          Workspace: {selectedWorkspace?.name} | ID: {workspaceId}
        </p>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="instances" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Instâncias
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Configuração do Webhook */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Padrão do Workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                {webhookConfig?.webhook_url && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Valor em uso:</strong> {webhookConfig.webhook_url}
                  </p>
                )}
                <div className="space-y-2">
                  <Input
                    id="webhook-url"
                    placeholder="https://seu-servidor.com/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  
                  {isTestUrl && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-medium text-yellow-800 text-sm">URL de Teste Detectada</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            Esta é uma URL de teste do N8N que só funciona durante execução manual. 
                            Para funcionar em produção com o workflow ativo, use a URL de produção.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={handleConvertToProduction}
                              className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                            >
                              Converter para Produção
                            </Button>
                          </div>
                          <p className="text-xs text-yellow-600 mt-2">
                            <strong>URL de produção será:</strong> {getProductionUrl(webhookUrl)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Webhook Secret</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook-secret"
                    type={showSecret ? "text" : "password"}
                    value={webhookConfig?.webhook_secret || ""}
                    readOnly
                    placeholder="Secret será gerado automaticamente"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRotateSecret}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Rotacionar
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={handleSaveConfig}
                  disabled={isLoading || !webhookUrl.trim()}
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Padrão
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={refreshConfig}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Sincronizar do Banco
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleApplyToAll}
                  disabled={isLoading || !webhookConfig}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Aplicar a Todas as Instâncias
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook || !webhookConfig?.webhook_url}
                >
                  {isTestingWebhook ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Testar Entrega
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instâncias do Workspace */}
        <TabsContent value="instances" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Instâncias do Workspace</span>
                <Badge variant="outline">
                  Aplicadas: {getAppliedCount()} de {instances.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-applied"
                  checked={showOnlyApplied}
                  onCheckedChange={setShowOnlyApplied}
                />
                <Label htmlFor="show-applied">
                  Mostrar apenas instâncias com configuração aplicada
                </Label>
              </div>
              
              {instances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma instância encontrada
                </div>
              ) : getFilteredInstances(showOnlyApplied).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma instância com configuração aplicada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instância</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Usa Padrão</TableHead>
                      <TableHead>Webhook</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredInstances(showOnlyApplied).map((instance) => (
                      <TableRow key={instance.id}>
                        <TableCell className="font-medium">
                          {instance.instance_name}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(instance.status)}
                        </TableCell>
                        <TableCell>
                          {instance.use_workspace_default ? (
                            <Badge variant="default" className="bg-green-500 text-white">Sim</Badge>
                          ) : (
                            <Badge variant="outline">Personalizado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {instance.use_workspace_default 
                            ? webhookConfig?.webhook_url || "Não configurado"
                            : "Configuração personalizada"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs de Webhook */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Logs de Webhook</span>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log encontrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{log.event_type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getLogStatusIcon(log.status)}
                            <span className="capitalize">{log.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Payload
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para visualizar payload do log */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payload do Webhook</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Evento:</Label>
                  <p className="font-medium">{selectedLog.event_type}</p>
                </div>
                <div>
                  <Label>Status:</Label>
                  <div className="flex items-center gap-2">
                    {getLogStatusIcon(selectedLog.status)}
                    <span className="capitalize">{selectedLog.status}</span>
                  </div>
                </div>
                <div>
                  <Label>Data/Hora:</Label>
                  <p className="font-medium">
                    {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                {selectedLog.response_status && (
                  <div>
                    <Label>Status HTTP:</Label>
                    <p className="font-medium">{selectedLog.response_status}</p>
                  </div>
                )}
              </div>
              <Separator />
              <div>
                <Label>Payload JSON:</Label>
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto mt-2">
                  {JSON.stringify(selectedLog.payload_json, null, 2)}
                </pre>
              </div>
              {selectedLog.response_body && (
                <div>
                  <Label>Resposta:</Label>
                  <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto mt-2">
                    {selectedLog.response_body}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}