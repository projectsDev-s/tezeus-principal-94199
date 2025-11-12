import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const publicAppUrl = Deno.env.get('PUBLIC_APP_URL');

if (!supabaseUrl || !serviceRoleKey || !publicAppUrl) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { instanceId, workspaceId } = await req.json();
    console.log(`🔧 Force reconfiguration requested - instanceId: ${instanceId}, workspaceId: ${workspaceId}`);

    const webhookUrl = `${publicAppUrl}/functions/v1/evolution-webhook-v2`;
    let query = supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        workspace_id,
        status,
        metadata,
        connection_secrets (
          token,
          evolution_url
        )
      `);

    // Se instanceId foi fornecido, buscar apenas essa instância
    if (instanceId) {
      query = query.eq('id', instanceId);
    } 
    // Se workspaceId foi fornecido, buscar todas as instâncias desse workspace
    else if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    // Filtrar apenas instâncias conectadas
    query = query.eq('status', 'connected');

    const { data: connections, error: connectionsError } = await query;

    if (connectionsError) {
      console.error('Error fetching connections:', connectionsError);
      return new Response(JSON.stringify({ error: 'Error fetching connections' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'No connected instances found',
        results: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const connection of connections) {
      console.log(`🔧 Reconfiguring webhook for instance: ${connection.instance_name}`);
      
      const secrets = Array.isArray(connection.connection_secrets) 
        ? connection.connection_secrets[0] 
        : connection.connection_secrets;
      
      if (!secrets?.token || !secrets?.evolution_url) {
        console.log(`⚠️ Skipping ${connection.instance_name} - missing credentials`);
        results.push({
          instance: connection.instance_name,
          instance_id: connection.id,
          status: 'skipped',
          reason: 'Missing credentials'
        });
        continue;
      }

      try {
        // CRITICAL: Configurar webhook com eventos corretos e base64 habilitado
        const webhookConfig = {
          url: webhookUrl,
          webhook_by_events: true,  // FORÇA eventos individuais
          webhook_base64: true,      // FORÇA base64 para mídias
          events: [
            'qrcode.updated',       // QR Code updates
            'connection.update',    // Connection status
            'messages.upsert',      // NEW/INCOMING messages
            'messages.update',      // ⚡ STATUS UPDATES (lido, entregue, etc)
            'send.message'          // Sent messages confirmation
          ]
        };

        console.log(`📤 Sending webhook config to ${secrets.evolution_url}/webhook/set/${connection.instance_name}`);
        console.log(`📋 Config:`, JSON.stringify(webhookConfig, null, 2));

        const evolutionResponse = await fetch(
          `${secrets.evolution_url}/webhook/set/${connection.instance_name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': secrets.token
            },
            body: JSON.stringify(webhookConfig)
          }
        );

        const responseText = await evolutionResponse.text();
        console.log(`📥 Evolution API response (${evolutionResponse.status}):`, responseText);

        if (evolutionResponse.ok) {
          let evolutionResult;
          try {
            evolutionResult = JSON.parse(responseText);
          } catch {
            evolutionResult = { raw: responseText };
          }

          console.log(`✅ Webhook configured for ${connection.instance_name}`);
          
          // Update metadata in database
          const updatedMetadata = {
            ...connection.metadata,
            webhook_configured: true,
            webhook_url: webhookUrl,
            webhook_configured_at: new Date().toISOString(),
            webhook_events: webhookConfig.events,
            webhook_base64_enabled: true,
            last_reconfiguration: new Date().toISOString()
          };

          await supabase
            .from('connections')
            .update({ 
              metadata: updatedMetadata,
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          results.push({
            instance: connection.instance_name,
            instance_id: connection.id,
            status: 'success',
            webhook_url: webhookUrl,
            events_configured: webhookConfig.events,
            base64_enabled: true,
            evolution_response: evolutionResult
          });
        } else {
          console.error(`❌ Failed to configure webhook for ${connection.instance_name}: ${responseText}`);
          results.push({
            instance: connection.instance_name,
            instance_id: connection.id,
            status: 'error',
            error: `Evolution API error: ${evolutionResponse.status} - ${responseText}`
          });
        }
      } catch (error) {
        console.error(`❌ Error configuring webhook for ${connection.instance_name}:`, error);
        results.push({
          instance: connection.instance_name,
          instance_id: connection.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const summary = {
      total: connections.length,
      success: results.filter(r => r.status === 'success').length,
      errors: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length
    };

    console.log('✅ Webhook reconfiguration completed:', summary);

    return new Response(JSON.stringify({
      success: summary.success > 0,
      message: `Reconfigured ${summary.success}/${summary.total} instances`,
      webhook_url: webhookUrl,
      results: results,
      summary: summary
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in force-webhook-reconfiguration:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
