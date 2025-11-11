import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Envio EXCLUSIVO via N8N - sem fallback
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;
  const requestId = `msgSender_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    requestBody = await req.json();
    const { 
      messageId, 
      phoneNumber, 
      content, 
      messageType = 'text', 
      fileUrl, 
      fileName, 
      evolutionInstance,
      conversationId,
      workspaceId 
    } = requestBody;

    console.log(`📤 [${requestId}] Message sender started:`, { 
      messageId, 
      phoneNumber, 
      messageType, 
      evolutionInstance,
      conversationId,
      workspaceId
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error(`❌ [${requestId}] Missing SUPABASE_URL or SERVICE_ROLE_KEY`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing Supabase service credentials',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolver workspace se não fornecido
    let finalWorkspaceId = workspaceId;
    if (!finalWorkspaceId && conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('workspace_id')
        .eq('id', conversationId)
        .single();
      
      finalWorkspaceId = conversation?.workspace_id;
    }

    if (!finalWorkspaceId) {
      console.error(`❌ [${requestId}] Could not resolve workspace_id`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not resolve workspace_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // VERIFICAR SE WEBHOOK N8N ESTÁ CONFIGURADO (OBRIGATÓRIO)
    const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${finalWorkspaceId}`;
    let workspaceWebhookUrl: string | null = null;
    let webhookSource: 'settings' | 'secrets' | null = null;

    const { data: webhookSettings, error: settingsError } = await supabase
      .from('workspace_webhook_settings')
      .select('webhook_url, updated_at, webhook_secret')
      .eq('workspace_id', finalWorkspaceId)
      .maybeSingle();

    if (!settingsError && webhookSettings?.webhook_url) {
      workspaceWebhookUrl = webhookSettings.webhook_url;
      webhookSource = 'settings';
      console.log(`🔍 [${requestId}] Webhook encontrado em workspace_webhook_settings: ${workspaceWebhookUrl.substring(0, 50)}...`, {
        updated_at: webhookSettings?.updated_at
      });
    } else {
      const { data: webhookData, error: webhookError } = await supabase
        .from('workspace_webhook_secrets')
        .select('webhook_url, updated_at')
        .eq('workspace_id', finalWorkspaceId)
        .eq('secret_name', workspaceWebhookSecretName)
        .maybeSingle();

      if (!webhookError && webhookData?.webhook_url) {
        workspaceWebhookUrl = webhookData.webhook_url;
        webhookSource = 'secrets';
        console.log(`🔍 [${requestId}] Webhook encontrado em workspace_webhook_secrets (fallback): ${workspaceWebhookUrl.substring(0, 50)}...`, {
          updated_at: webhookData?.updated_at
        });
      }
    }

    console.log(`🔍 [${requestId}] Webhook check:`, {
      configured: !!workspaceWebhookUrl,
      webhookUrl: workspaceWebhookUrl ? workspaceWebhookUrl.substring(0, 50) + '...' : 'none',
      source: webhookSource
    });

    if (!workspaceWebhookUrl) {
      console.error(`❌ [${requestId}] N8N webhook not configured for workspace ${finalWorkspaceId}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'N8N webhook not configured',
        details: 'Configure N8N webhook first to send messages',
        requestId
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ENVIO VIA N8N (ÚNICO MÉTODO PERMITIDO)
    console.log(`🚀 [${requestId}] Sending via N8N (required)...`);
    
    try {
      const { data: n8nResult, error: n8nError } = await supabase.functions.invoke('n8n-send-message', {
        body: {
          messageId,
          phoneNumber,
          content,
          messageType,
          fileUrl,
          fileName,
          evolutionInstance,
          conversationId,
          workspaceId: finalWorkspaceId,
          external_id: requestBody.external_id
        }
      });

      console.log(`🔍 [${requestId}] N8N response:`, { 
        hasError: !!n8nError, 
        error: n8nError,
        resultSuccess: n8nResult?.success,
        result: n8nResult 
      });

      if (!n8nError && n8nResult?.success !== false) {
        console.log(`✅ [${requestId}] N8N send successful`);
        return new Response(JSON.stringify({
          success: true,
          method: 'n8n',
          result: n8nResult,
          requestId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        console.error(`❌ [${requestId}] N8N send failed:`, { error: n8nError, result: n8nResult });
        return new Response(JSON.stringify({
          success: false,
          error: 'N8N sending failed',
          details: {
            n8n_error: n8nError,
            n8n_result: n8nResult
          },
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (n8nException) {
      console.error(`❌ [${requestId}] N8N send exception:`, n8nException);
      return new Response(JSON.stringify({
        success: false,
        error: 'N8N exception',
        details: {
          exception: n8nException instanceof Error ? n8nException.message : String(n8nException)
        },
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error(`💥 [${requestId}] Message sender error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
