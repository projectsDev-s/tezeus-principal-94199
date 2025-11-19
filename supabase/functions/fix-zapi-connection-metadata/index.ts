import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 [Fix Z-API Connection] Starting...');

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { connectionId, zapiInstanceId, zapiToken } = await req.json();

    if (!connectionId) {
      throw new Error('connectionId é obrigatório');
    }

    console.log('📍 Connection ID:', connectionId);

    // 1. Buscar a conexão e seu provider
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        workspace_id,
        provider_id,
        metadata,
        provider:whatsapp_providers!connections_provider_id_fkey(
          id,
          provider,
          zapi_url,
          zapi_token,
          zapi_client_token
        )
      `)
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      console.error('❌ Erro ao buscar conexão:', connError);
      throw new Error('Conexão não encontrada');
    }

    // 2. Validar se é Z-API
    const provider = Array.isArray(connection.provider) ? connection.provider[0] : connection.provider;
    
    if (!provider || provider.provider !== 'zapi') {
      throw new Error('Esta conexão não usa Z-API como provedor');
    }

    console.log('✅ Provider Z-API encontrado:', provider.id);

    // 3. Preparar metadados corretos
    const currentMetadata = connection.metadata || {};
    
    // Se zapiInstanceId ou zapiToken foram fornecidos, usar eles
    // Caso contrário, usar os valores do provider
    const instanceId = zapiInstanceId || connection.instance_name;
    const instanceToken = zapiToken || provider.zapi_token;
    const clientToken = provider.zapi_client_token;

    if (!instanceToken || !clientToken) {
      throw new Error('Token Z-API não encontrado no provider');
    }

    // 4. Atualizar metadados da conexão
    const updatedMetadata = {
      ...currentMetadata,
      zapiInstanceId: instanceId,
      zapiToken: instanceToken,
      clientToken: clientToken,
      zapiUrl: provider.zapi_url || 'https://api.z-api.io',
      provider: 'zapi',
      fixedAt: new Date().toISOString()
    };

    console.log('🔄 Atualizando metadados da conexão...');

    const { error: updateError } = await supabase
      .from('connections')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('❌ Erro ao atualizar metadados:', updateError);
      throw updateError;
    }

    console.log('✅ Metadados atualizados com sucesso');

    // 5. Configurar webhooks automaticamente
    console.log('🔗 Configurando webhooks Z-API...');

    const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook`;
    
    const webhookEndpoints: Record<string, string> = {
      'status': 'update-webhook-status',
      'received': 'update-webhook-received', 
      'delivery': 'update-webhook-delivery',
      'disconnected': 'update-webhook-disconnected',
      'connected': 'update-webhook-connected',
      'chatPresence': 'update-webhook-chat-presence'
    };

    const webhookResults: any[] = [];

    for (const [type, endpoint] of Object.entries(webhookEndpoints)) {
      try {
        const zapiEndpoint = `${provider.zapi_url}/${instanceId}/${endpoint}`;
        
        console.log(`📡 Configurando webhook ${type}: ${zapiEndpoint}`);

        const response = await fetch(zapiEndpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'client-token': clientToken,
            'instance-token': instanceToken
          },
          body: JSON.stringify({
            value: webhookUrl
          })
        });

        const result = await response.json();
        
        webhookResults.push({
          type,
          endpoint: zapiEndpoint,
          success: response.ok,
          status: response.status,
          result
        });

        if (response.ok) {
          console.log(`✅ Webhook ${type} configurado`);
        } else {
          console.error(`❌ Erro ao configurar webhook ${type}:`, result);
        }
      } catch (error) {
        console.error(`❌ Erro ao configurar webhook ${type}:`, error);
        webhookResults.push({
          type,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 6. Atualizar metadados da conexão com status da configuração de webhooks
    await supabase
      .from('connections')
      .update({
        metadata: {
          ...updatedMetadata,
          webhookConfigured: true,
          webhookConfiguredAt: new Date().toISOString(),
          webhookResults
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    const successCount = webhookResults.filter(r => r.success).length;
    const totalCount = webhookResults.length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Metadados atualizados e ${successCount}/${totalCount} webhooks configurados`,
        connection: {
          id: connection.id,
          instance_name: connection.instance_name,
          metadata: updatedMetadata
        },
        webhooks: {
          configured: successCount,
          total: totalCount,
          results: webhookResults
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ [Fix Z-API Connection] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
