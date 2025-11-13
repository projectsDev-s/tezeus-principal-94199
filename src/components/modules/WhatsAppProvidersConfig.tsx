import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useWhatsAppProviders } from '@/hooks/useWhatsAppProviders';
import { Loader2, Zap, CheckCircle2, XCircle, Trash2, Save, TestTube2, Copy, Webhook, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import type { WhatsAppProvider } from '@/types/whatsapp-provider';

interface WhatsAppProvidersConfigProps {
  workspaceId: string;
  workspaceName?: string;
}

export function WhatsAppProvidersConfig({ workspaceId, workspaceName }: WhatsAppProvidersConfigProps) {
  const {
    providers,
    isLoading,
    isTesting,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    activateProvider,
    testConnection,
  } = useWhatsAppProviders(workspaceId);

  const [activeTab, setActiveTab] = useState<'evolution' | 'zapi'>('evolution');
  
  // Evolution form state
  const [evolutionUrl, setEvolutionUrl] = useState('');
  const [evolutionToken, setEvolutionToken] = useState('');
  const [evolutionWebhook, setEvolutionWebhook] = useState('');
  const [evolutionFallback, setEvolutionFallback] = useState(false);
  const [evolutionIsActive, setEvolutionIsActive] = useState(false);

  // Z-API form state (only token, URL is fixed)
  const [zapiToken, setZapiToken] = useState('');
  const [zapiClientToken, setZapiClientToken] = useState('');
  const [zapiWebhook, setZapiWebhook] = useState('');
  const [zapiFallback, setZapiFallback] = useState(false);
  const [zapiIsActive, setZapiIsActive] = useState(false);

  // Z-API fixed URL for on-demand instance creation
  const ZAPI_BASE_URL = 'https://api.z-api.io/instances/integrator/on-demand';

  const [isSaving, setIsSaving] = useState(false);
  const [isTestingZapiToken, setIsTestingZapiToken] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, [workspaceId]);

  useEffect(() => {
    // Preencher formulários com dados existentes
    const evolutionProvider = providers.find(p => p.provider === 'evolution');
    const zapiProvider = providers.find(p => p.provider === 'zapi');

    if (evolutionProvider) {
      setEvolutionUrl(evolutionProvider.evolution_url || '');
      setEvolutionToken(evolutionProvider.evolution_token || '');
      setEvolutionWebhook(evolutionProvider.n8n_webhook_url || '');
      setEvolutionFallback(evolutionProvider.enable_fallback);
      setEvolutionIsActive(evolutionProvider.is_active);
    }

    if (zapiProvider) {
      setZapiToken(zapiProvider.zapi_token || '');
      setZapiClientToken(zapiProvider.zapi_client_token || '');
      setZapiWebhook(zapiProvider.n8n_webhook_url || '');
      setZapiFallback(zapiProvider.enable_fallback);
      setZapiIsActive(zapiProvider.is_active);
    }
  }, [providers]);

  const handleSaveEvolution = async () => {
    if (!evolutionUrl || !evolutionToken) {
      toast.error('Preencha URL e Token do Evolution');
      return;
    }

    setIsSaving(true);
    try {
      const existingProvider = providers.find(p => p.provider === 'evolution');
      
      const providerData = {
        provider: 'evolution' as const,
        evolution_url: evolutionUrl,
        evolution_token: evolutionToken,
        n8n_webhook_url: evolutionWebhook || undefined,
        enable_fallback: evolutionFallback,
        is_active: evolutionIsActive,
      };

      if (existingProvider) {
        await updateProvider(existingProvider.id, providerData);
      } else {
        await createProvider(providerData);
      }
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveZapi = async () => {
    // Validar e limpar token
    const cleanedToken = zapiToken?.trim();
    const cleanedClientToken = zapiClientToken?.trim();
    
    if (!cleanedToken || !cleanedClientToken) {
      toast.error('Preencha o Token de Integrator e o Client Token do Z-API');
      return;
    }

    if (cleanedToken.length < 20) {
      toast.error('Token do Z-API parece inválido. Tokens Z-API geralmente têm pelo menos 30 caracteres.');
      return;
    }

    console.log('💾 Salvando Z-API configuração:');
    console.log('  - Token length:', cleanedToken.length);
    console.log('  - Client Token length:', cleanedClientToken.length);
    console.log('  - Token preview:', cleanedToken.substring(0, 10) + '...' + cleanedToken.substring(cleanedToken.length - 5));
    console.log('  - URL:', ZAPI_BASE_URL);

    setIsSaving(true);
    try {
      const existingProvider = providers.find(p => p.provider === 'zapi');
      
      const providerData = {
        provider: 'zapi' as const,
        zapi_url: ZAPI_BASE_URL,
        zapi_token: cleanedToken, // Usar token limpo
        zapi_client_token: cleanedClientToken, // Adicionar client_token
        n8n_webhook_url: zapiWebhook?.trim() || undefined,
        enable_fallback: zapiFallback,
        is_active: zapiIsActive,
      };

      if (existingProvider) {
        await updateProvider(existingProvider.id, providerData);
      } else {
        await createProvider(providerData);
      }
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEvolution = async () => {
    const provider = providers.find(p => p.provider === 'evolution');
    if (!provider) {
      toast.error('Salve as configurações antes de testar');
      return;
    }
    await testConnection(provider.id);
  };

  const handleTestZapi = async () => {
    const provider = providers.find(p => p.provider === 'zapi');
    if (!provider) {
      toast.error('Salve as configurações antes de testar');
      return;
    }
    await testConnection(provider.id);
  };

  const handleTestZapiToken = async () => {
    const cleanedToken = zapiToken?.trim();
    
    if (!cleanedToken) {
      toast.error('Preencha o Token do Z-API');
      return;
    }

    if (cleanedToken.length < 20) {
      toast.error('Token parece inválido. Tokens Z-API geralmente têm pelo menos 30 caracteres.');
      return;
    }

    setIsTestingZapiToken(true);
    try {
      console.log('🧪 Testando token Z-API...');
      console.log('🔑 Token length:', cleanedToken.length);
      console.log('🔑 Token preview:', cleanedToken.substring(0, 10) + '...' + cleanedToken.substring(cleanedToken.length - 5));
      
      // Fazer uma chamada simples à API do Z-API para validar o token
      const response = await fetch(`${ZAPI_BASE_URL}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanedToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('📡 Resposta Z-API:', { status: response.status, data });

      if (response.ok) {
        toast.success('✅ Token válido! Você pode salvar as configurações.');
      } else {
        const errorMsg = data?.error || data?.message || 'Credenciais inválidas';
        toast.error(`❌ Token inválido: ${errorMsg}`);
        console.error('❌ Detalhes do erro:', data);
      }
    } catch (error) {
      console.error('❌ Erro ao testar token Z-API:', error);
      toast.error('Erro ao validar token. Verifique se o token está correto.');
    } finally {
      setIsTestingZapiToken(false);
    }
  };

  const handleDeleteEvolution = async () => {
    const provider = providers.find(p => p.provider === 'evolution');
    if (!provider) return;

    if (!confirm('Tem certeza que deseja deletar as configurações do Evolution?')) {
      return;
    }

    await deleteProvider(provider.id);
    setEvolutionUrl('');
    setEvolutionToken('');
    setEvolutionWebhook('');
    setEvolutionFallback(false);
    setEvolutionIsActive(false);
  };

  const handleDeleteZapi = async () => {
    const provider = providers.find(p => p.provider === 'zapi');
    if (!provider) return;

    if (!confirm('Tem certeza que deseja deletar as configurações do Z-API?')) {
      return;
    }

    await deleteProvider(provider.id);
    setZapiToken('');
    setZapiWebhook('');
    setZapiFallback(false);
    setZapiIsActive(false);
  };

  const evolutionProvider = providers.find(p => p.provider === 'evolution');
  const zapiProvider = providers.find(p => p.provider === 'zapi');
  const activeProvider = providers.find(p => p.is_active);

  // Webhook URLs
  const SUPABASE_PROJECT_ID = 'zldeaozqxjwvzgrblyrh';
  const zapiWebhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/zapi-webhook`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('URL copiada para a área de transferência!');
  };

  if (isLoading && providers.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'evolution' | 'zapi')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="evolution" className="flex items-center gap-2">
            Evolution API
            {evolutionProvider && (
              <Badge variant={evolutionProvider.is_active ? 'default' : 'secondary'} className="ml-2">
                {evolutionProvider.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="zapi" className="flex items-center gap-2">
            Z-API
            {zapiProvider && (
              <Badge variant={zapiProvider.is_active ? 'default' : 'secondary'} className="ml-2">
                {zapiProvider.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evolution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Evolution API
                {evolutionProvider?.is_active && <CheckCircle2 className="h-5 w-5 text-success" />}
              </CardTitle>
              <CardDescription>
                Configure as credenciais da Evolution API para este workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evolution-url">URL da Evolution API *</Label>
                <Input
                  id="evolution-url"
                  placeholder="https://api.evolution.com.br"
                  value={evolutionUrl}
                  onChange={(e) => setEvolutionUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution-token">Token da API *</Label>
                <Input
                  id="evolution-token"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={evolutionToken}
                  onChange={(e) => setEvolutionToken(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution-webhook">Webhook N8N (Opcional)</Label>
                <Input
                  id="evolution-webhook"
                  placeholder="https://n8n.example.com/webhook/..."
                  value={evolutionWebhook}
                  onChange={(e) => setEvolutionWebhook(e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Provedor Ativo</Label>
                  <p className="text-sm text-muted-foreground">
                    Usar este provedor para envios
                  </p>
                </div>
                <Switch
                  checked={evolutionIsActive}
                  onCheckedChange={setEvolutionIsActive}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar Fallback</Label>
                  <p className="text-sm text-muted-foreground">
                    Tentar Z-API se Evolution falhar
                  </p>
                </div>
                <Switch
                  checked={evolutionFallback}
                  onCheckedChange={setEvolutionFallback}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveEvolution}
                  disabled={isSaving || !evolutionUrl || !evolutionToken}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Configurações
                    </>
                  )}
                </Button>

                {evolutionProvider && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleTestEvolution}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube2 className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={handleDeleteEvolution}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zapi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Z-API
                {zapiProvider?.is_active && <CheckCircle2 className="h-5 w-5 text-success" />}
              </CardTitle>
              <CardDescription>
                Configure as credenciais da Z-API para este workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">⚠️ ATENÇÃO: Token de Integrator Necessário</AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-2">Você precisa usar o <strong>TOKEN DE INTEGRATOR</strong>, não o token de uma instância!</p>
                  <ol className="list-decimal ml-4 space-y-1 text-sm">
                    <li>Acesse o painel Z-API</li>
                    <li>Vá em <strong>Integrações</strong> → <strong>Criar Token de Integrator</strong></li>
                    <li>Copie o token gerado</li>
                    <li>Cole aqui e clique em "Testar"</li>
                  </ol>
                  <p className="text-xs mt-2 italic">URL base fixa: <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">{ZAPI_BASE_URL}</code></p>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="zapi-token" className="text-base font-semibold">
                  🔑 Bearer Token de Integrator *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="zapi-token"
                    type="password"
                    placeholder="Cole aqui o token de INTEGRATOR (não o token de instância)"
                    value={zapiToken}
                    onChange={(e) => setZapiToken(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestZapiToken}
                    disabled={isTestingZapiToken || !zapiToken}
                  >
                    {isTestingZapiToken ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>
                        <TestTube2 className="mr-2 h-4 w-4" />
                        Testar Token
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ IMPORTANTE: Teste o token antes de salvar! Se o teste falhar, o token não é válido.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zapi-client-token" className="text-base font-semibold">
                  🔐 Client Token *
                </Label>
                <Input
                  id="zapi-client-token"
                  type="password"
                  placeholder="Cole aqui o Client Token da sua conta Z-API"
                  value={zapiClientToken}
                  onChange={(e) => setZapiClientToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Token de autenticação para acessar instâncias individuais
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zapi-webhook">Webhook N8N (Opcional)</Label>
                <Input
                  id="zapi-webhook"
                  placeholder="https://n8n.example.com/webhook/..."
                  value={zapiWebhook}
                  onChange={(e) => setZapiWebhook(e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Provedor Ativo</Label>
                  <p className="text-sm text-muted-foreground">
                    Usar este provedor para envios
                  </p>
                </div>
                <Switch
                  checked={zapiIsActive}
                  onCheckedChange={setZapiIsActive}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar Fallback</Label>
                  <p className="text-sm text-muted-foreground">
                    Tentar Evolution se Z-API falhar
                  </p>
                </div>
                <Switch
                  checked={zapiFallback}
                  onCheckedChange={setZapiFallback}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveZapi}
                  disabled={isSaving || !zapiToken}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Configurações
                    </>
                  )}
                </Button>

                {zapiProvider && (
                  <Button
                    variant="destructive"
                    onClick={handleDeleteZapi}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Z-API Webhook Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Configuração do Webhook Z-API
              </CardTitle>
              <CardDescription>
                Configure este webhook no painel da Z-API para receber mensagens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>URL do Webhook</AlertTitle>
                <AlertDescription className="space-y-2">
                  <div className="flex items-center gap-2 mt-2">
                    <code className="relative rounded bg-muted px-3 py-1 font-mono text-sm flex-1 break-all">
                      {zapiWebhookUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(zapiWebhookUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-3 rounded-lg border p-4 bg-muted/50">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Como configurar no Z-API:
                </h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Acesse o painel da sua instância Z-API</li>
                  <li>Navegue até <strong>Configurações → Webhooks</strong></li>
                  <li>Cole a URL do webhook acima no campo indicado</li>
                  <li>Marque os eventos que deseja receber:
                    <ul className="ml-6 mt-1 space-y-1 list-disc list-inside">
                      <li><strong>received-message</strong> - Mensagens recebidas</li>
                      <li><strong>message-status</strong> - Status de mensagens enviadas</li>
                      <li><strong>connection-status</strong> - Status da conexão</li>
                    </ul>
                  </li>
                  <li>Salve as configurações no painel Z-API</li>
                  <li>Envie uma mensagem de teste para validar a integração</li>
                </ol>
              </div>

              <Alert variant="default">
                <Zap className="h-4 w-4" />
                <AlertTitle>Eventos suportados</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li><strong>• received-message:</strong> Mensagens de texto, imagem, vídeo, áudio e documentos</li>
                    <li><strong>• message-status:</strong> Enviado, entregue e lido</li>
                    <li><strong>• connection-status:</strong> Conectado, desconectado, conectando</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Alert variant="default">
                <Info className="h-4 w-4" />
                <AlertTitle>Importante</AlertTitle>
                <AlertDescription>
                  Certifique-se de que a instância Z-API está configurada com o mesmo <strong>instanceId</strong> cadastrado nas conexões deste workspace.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
