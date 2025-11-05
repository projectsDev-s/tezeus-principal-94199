import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Centralizador inteligente de envio com fallback automático
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // ETAPA 1: Verificar se webhook N8N está configurado
    const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${finalWorkspaceId}`;
    
    const { data: webhookData, error: webhookError } = await supabase
      .from('workspace_webhook_secrets')
      .select('webhook_url')
      .eq('workspace_id', finalWorkspaceId)
      .eq('secret_name', workspaceWebhookSecretName)
      .maybeSingle();

    const hasWebhookConfigured = !webhookError && webhookData?.webhook_url;
    
    console.log(`🔍 [${requestId}] Webhook check:`, {
      configured: hasWebhookConfigured,
      webhookUrl: hasWebhookConfigured ? webhookData.webhook_url.substring(0, 50) + '...' : 'none'
    });

    // ETAPA 2: Enviar via WhatsApp Provider Genérico (Evolution ou Z-API)
    if (!hasWebhookConfigured) {
      console.log(`📱 [${requestId}] No N8N webhook, using WhatsApp provider directly...`);
      
      try {
        const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            messageId,
            phoneNumber,
            content,
            messageType,
            fileUrl,
            fileName,
            evolutionInstance,
            workspaceId: finalWorkspaceId,
            external_id: requestBody.external_id
          }
        });

        if (!whatsappError && whatsappResult?.success) {
          console.log(`✅ [${requestId}] WhatsApp provider send successful via ${whatsappResult.provider}`);
          return new Response(JSON.stringify({
            success: true,
            method: 'whatsapp_provider',
            provider: whatsappResult.provider,
            result: whatsappResult,
            requestId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          console.error(`❌ [${requestId}] WhatsApp provider send failed:`, { error: whatsappError, result: whatsappResult });
          return new Response(JSON.stringify({
            success: false,
            error: 'WhatsApp provider sending failed',
            details: { error: whatsappError, result: whatsappResult },
            requestId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (whatsappException) {
        console.error(`❌ [${requestId}] WhatsApp provider send exception:`, whatsappException);
        return new Response(JSON.stringify({
          success: false,
          error: 'WhatsApp provider sending exception',
          details: { exception: whatsappException.message },
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ETAPA 3: Envio via N8N (se configurado)
    console.log(`🚀 [${requestId}] Sending via N8N...`);
    
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
        console.error(`❌ [${requestId}] N8N send failed, trying WhatsApp provider fallback...`);
        
        // FALLBACK: Tentar enviar via WhatsApp provider
        try {
          const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-message', {
            body: {
              messageId,
              phoneNumber,
              content,
              messageType,
              fileUrl,
              fileName,
              evolutionInstance,
              workspaceId: finalWorkspaceId,
              external_id: requestBody.external_id
            }
          });

          if (!whatsappError && whatsappResult?.success) {
            console.log(`✅ [${requestId}] WhatsApp provider fallback successful via ${whatsappResult.provider}`);
            return new Response(JSON.stringify({
              success: true,
              method: 'whatsapp_provider_fallback',
              provider: whatsappResult.provider,
              result: whatsappResult,
              n8n_error: n8nError || n8nResult,
              requestId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (fallbackException) {
          console.error(`❌ [${requestId}] WhatsApp provider fallback also failed:`, fallbackException);
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: 'N8N and WhatsApp provider sending failed',
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
      console.error(`❌ [${requestId}] N8N send exception, trying WhatsApp provider fallback:`, n8nException);
      
      // FALLBACK: Tentar enviar via WhatsApp provider
      try {
        const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            messageId,
            phoneNumber,
            content,
            messageType,
            fileUrl,
            fileName,
            evolutionInstance,
            workspaceId: finalWorkspaceId,
            external_id: requestBody.external_id
          }
        });

        if (!whatsappError && whatsappResult?.success) {
          console.log(`✅ [${requestId}] WhatsApp provider fallback successful via ${whatsappResult.provider}`);
          return new Response(JSON.stringify({
            success: true,
            method: 'whatsapp_provider_fallback',
            provider: whatsappResult.provider,
            result: whatsappResult,
            n8n_exception: n8nException.message,
            requestId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (fallbackException) {
        console.error(`❌ [${requestId}] WhatsApp provider fallback also failed:`, fallbackException);
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'N8N exception and WhatsApp provider fallback failed',
        details: {
          exception: n8nException.message
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
      details: error.message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});