import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    console.log('🔍 Diagnosing webhook configuration for workspace:', workspaceId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get Evolution config
    const { data: evolutionConfig, error: evolutionError } = await supabase
      .from('evolution_instance_tokens')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .single();

    if (evolutionError || !evolutionConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Evolution API não configurada para este workspace',
        details: evolutionError
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all connections for this workspace
    const { data: connections, error: connectionsError } = await supabase
      .from('connections')
      .select('id, instance_name, status')
      .eq('workspace_id', workspaceId);

    const results = [];

    // Check webhook config for each connection
    for (const connection of connections || []) {
      try {
        console.log(`📡 Checking webhook for instance: ${connection.instance_name}`);
        
        const webhookCheckResponse = await fetch(
          `${evolutionConfig.evolution_url}/webhook/find/${connection.instance_name}`,
          {
            headers: {
              'apikey': evolutionConfig.token
            }
          }
        );

        const webhookConfig = webhookCheckResponse.ok 
          ? await webhookCheckResponse.json()
          : null;

        results.push({
          instance_name: connection.instance_name,
          instance_id: connection.id,
          status: connection.status,
          webhook_configured: !!webhookConfig,
          webhook_details: webhookConfig,
          webhook_check_status: webhookCheckResponse.status
        });

      } catch (error) {
        console.error(`❌ Error checking webhook for ${connection.instance_name}:`, error);
        results.push({
          instance_name: connection.instance_name,
          instance_id: connection.id,
          status: connection.status,
          webhook_configured: false,
          error: error.message
        });
      }
    }

    // Get webhook settings from database
    const { data: webhookSettings } = await supabase
      .from('workspace_webhook_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    // Get recent webhook logs
    const { data: recentLogs } = await supabase
      .from('webhook_logs')
      .select('event_type, status, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10);

    return new Response(JSON.stringify({
      success: true,
      workspace_id: workspaceId,
      evolution_config: {
        url: evolutionConfig.evolution_url,
        configured: true
      },
      webhook_settings: webhookSettings,
      connections_checked: results.length,
      connections: results,
      recent_webhook_logs: recentLogs,
      expected_webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook-v2`,
      recommendations: generateRecommendations(results, webhookSettings)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in diagnose-webhook-config:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateRecommendations(connections: any[], webhookSettings: any) {
  const recommendations = [];

  const missingWebhooks = connections.filter(c => !c.webhook_configured);
  if (missingWebhooks.length > 0) {
    recommendations.push({
      type: 'warning',
      message: `${missingWebhooks.length} conexão(ões) sem webhook configurado`,
      instances: missingWebhooks.map(c => c.instance_name)
    });
  }

  if (!webhookSettings) {
    recommendations.push({
      type: 'warning',
      message: 'Webhook N8N não configurado no banco de dados'
    });
  }

  const wrongUrls = connections.filter(c => 
    c.webhook_details && 
    !c.webhook_details.url?.includes('evolution-webhook-v2')
  );
  
  if (wrongUrls.length > 0) {
    recommendations.push({
      type: 'error',
      message: 'Algumas instâncias estão usando URL de webhook antiga',
      instances: wrongUrls.map(c => c.instance_name)
    });
  }

  const missingEvents = connections.filter(c => 
    c.webhook_details && 
    (!c.webhook_details.events?.includes('MESSAGES_UPSERT') ||
     !c.webhook_details.events?.includes('MESSAGES_UPDATE'))
  );

  if (missingEvents.length > 0) {
    recommendations.push({
      type: 'error',
      message: 'Algumas instâncias não têm eventos MESSAGES_UPSERT/UPDATE habilitados',
      instances: missingEvents.map(c => c.instance_name)
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'Todas as configurações parecem corretas'
    });
  }

  return recommendations;
}
