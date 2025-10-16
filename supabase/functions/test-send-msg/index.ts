import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

function generateRequestId(): string {
  return `send_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`🚀 [${requestId}] SEND MESSAGE FUNCTION - ROTA EXCLUSIVA VIA N8N`);
  console.log(`📋 [${requestId}] Mensagens serão enviadas APENAS via N8N (Evolution será chamado pelo N8N)`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Wrong method: ${req.method}`);
    return new Response(JSON.stringify({
      error: 'Only POST method is allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    console.log(`📨 [${requestId}] Received body:`, JSON.stringify(body, null, 2));
    
    const { conversation_id, content, message_type = 'text', sender_id, sender_type, file_url, file_name, clientMessageId } = body;

    // Para mensagens de mídia, ignorar placeholders como [IMAGE], [VIDEO], etc
    const isMediaMessage = message_type && message_type !== 'text';
    const isPlaceholder = content && /^\[.*\]$/.test(content); // Detecta [IMAGE], [VIDEO], [DOCUMENT]
    const effectiveContent = (isMediaMessage && isPlaceholder) ? '' : (content || '');

    // Validação de file_url para mensagens de mídia
    if (isMediaMessage && !file_url) {
      console.log(`❌ [${requestId}] Media message missing file_url`);
      return new Response(JSON.stringify({
        error: 'file_url is required for media messages'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!conversation_id || (!effectiveContent && !isMediaMessage)) {
      console.log(`❌ [${requestId}] Missing required fields - conversation_id: ${!!conversation_id}, content: ${!!content}, message_type: ${message_type}`);
      return new Response(JSON.stringify({
        error: isMediaMessage 
          ? 'Missing required field: conversation_id' 
          : 'Missing required fields: conversation_id, content'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      console.log(`❌ [${requestId}] Missing env vars`);
      return new Response(JSON.stringify({
        error: 'Missing environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    console.log(`✅ [${requestId}] Supabase client created`);

    // Fetch conversation details with connection info
    console.log(`🔍 [${requestId}] Fetching conversation: ${conversation_id}`);
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('workspace_id, connection_id, contact_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.log(`❌ [${requestId}] Conversation error:`, convError);
      return new Response(JSON.stringify({
        error: 'Conversation not found',
        details: convError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If conversation doesn't have connection_id, try to find default connection for workspace
    let actualConnectionId = conversation.connection_id;
    if (!actualConnectionId) {
      console.log(`⚠️ [${requestId}] Conversation has no connection_id, finding default for workspace`);
      const { data: defaultConnection } = await supabase
        .from('connections')
        .select('id')
        .eq('workspace_id', conversation.workspace_id)
        .eq('status', 'connected')
        .limit(1)
        .single();
      
      if (defaultConnection) {
        actualConnectionId = defaultConnection.id;
        console.log(`✅ [${requestId}] Using default connection: ${actualConnectionId}`);
        
        // Update the conversation to include the connection_id
        await supabase
          .from('conversations')
          .update({ connection_id: actualConnectionId })
          .eq('id', conversation_id);
          
        console.log(`✅ [${requestId}] Updated conversation with connection_id`);
      }
    }

    if (convError || !conversation) {
      console.log(`❌ [${requestId}] Conversation error:`, convError);
      return new Response(JSON.stringify({
        error: 'Conversation not found',
        details: convError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Conversation found:`, conversation);

    // Fetch contact details
    console.log(`🔍 [${requestId}] Fetching contact: ${conversation.contact_id}`);
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('phone')
      .eq('id', conversation.contact_id)
      .single();

    if (contactError || !contact) {
      console.log(`❌ [${requestId}] Contact error:`, contactError);
      return new Response(JSON.stringify({
        error: 'Contact not found',
        details: contactError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Contact found: ${contact.phone}`);

    // Fetch connection details to get instance_name
    let instance_name = null;
    
    if (actualConnectionId) {
      console.log(`🔍 [${requestId}] Fetching connection: ${actualConnectionId}`);
      const { data: connection, error: connectionError } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', actualConnectionId)
        .single();

      if (connectionError || !connection) {
        console.log(`❌ [${requestId}] Connection error:`, connectionError);
        return new Response(JSON.stringify({
          error: 'Connection not found',
          details: connectionError?.message
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      instance_name = connection.instance_name;
      console.log(`✅ [${requestId}] Connection found: ${instance_name}`);
    } else {
      console.log(`⚠️ [${requestId}] No connection available for this conversation`);
    }

    // Get N8N webhook URL from workspace configuration
    // Try workspace_webhook_settings first (new table)
    console.log(`🔍 [${requestId}] Looking for webhook URL in workspace_webhook_settings`);
    
    const { data: webhookSettings, error: settingsError } = await supabase
      .from('workspace_webhook_settings')
      .select('webhook_url')
      .eq('workspace_id', conversation.workspace_id)
      .maybeSingle();

    let n8nWebhookUrl = null;

    if (!settingsError && webhookSettings?.webhook_url) {
      n8nWebhookUrl = webhookSettings.webhook_url;
      console.log(`✅ [${requestId}] Found webhook in settings table: ${n8nWebhookUrl.substring(0, 50)}...`);
    } else {
      // Fallback to workspace_webhook_secrets (old table)
      console.log(`🔄 [${requestId}] Webhook not found in settings, trying secrets table (fallback)`);
      
      const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${conversation.workspace_id}`;
      
      const { data: webhookData, error: webhookError } = await supabase
        .from('workspace_webhook_secrets')
        .select('webhook_url')
        .eq('workspace_id', conversation.workspace_id)
        .eq('secret_name', workspaceWebhookSecretName)
        .maybeSingle();

      if (!webhookError && webhookData?.webhook_url) {
        n8nWebhookUrl = webhookData.webhook_url;
        console.log(`✅ [${requestId}] Found webhook in secrets table (fallback): ${n8nWebhookUrl.substring(0, 50)}...`);
      }
    }

    if (!n8nWebhookUrl) {
      console.error(`❌ [${requestId}] N8N webhook not configured for workspace ${conversation.workspace_id} in either table`);
      return new Response(JSON.stringify({
        error: 'N8N webhook not configured for this workspace'
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar credenciais da Evolution API do _master_config (URL + API Key Global)
    console.log(`🔍 [${requestId}] Fetching Evolution credentials from _master_config`);
    const { data: masterConfig, error: configError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('workspace_id', conversation.workspace_id)
      .eq('instance_name', '_master_config')
      .maybeSingle();

    if (configError || !masterConfig) {
      console.error(`❌ [${requestId}] Master config not found:`, configError);
      return new Response(JSON.stringify({
        error: 'Evolution API not configured for this workspace',
        details: configError?.message
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const evolutionUrl = masterConfig.evolution_url;
    const evolutionApiKey = masterConfig.token;
    console.log(`✅ [${requestId}] Evolution config found: ${evolutionUrl}`);


    // ✅ ETAPA 2: VERIFICAR DUPLICAÇÃO POR clientMessageId
    if (clientMessageId) {
      console.log(`🔍 [${requestId}] ETAPA 2 - Verificando duplicação:`, {
        request_id: requestId,
        session_id: conversation.workspace_id,
        chat_id: conversation_id,
        client_message_id: clientMessageId,
        source: 'frontend',
        attempt: 1
      });
      
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .eq('external_id', clientMessageId)
        .maybeSingle();
      
      if (existing) {
        console.log(`✅ [${requestId}] ETAPA 2 - Duplicação detectada (DEDUPLICADO):`, {
          request_id: requestId,
          client_message_id: clientMessageId,
          existing_message_id: existing.id,
          action: 'skipped_insertion'
        });
        
        return new Response(JSON.stringify({
          success: true,
          message_id: existing.id,
          status: 'duplicate',
          message: 'Message already sent (deduplicated by clientMessageId)'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`✅ [${requestId}] ETAPA 2 - Nenhuma duplicação encontrada, prosseguindo`);
    }
    
    // Generate external_id for tracking (usar clientMessageId se fornecido)
    const external_id = clientMessageId || crypto.randomUUID();
    
    // CRÍTICO: Salvar a mensagem ANTES de chamar Evolution para evitar race condition
    console.log(`💾 [${requestId}] Saving message to database BEFORE calling Evolution`);
    
    try {
      const messageData = {
        id: external_id,
        conversation_id: conversation_id,
        workspace_id: conversation.workspace_id,
        content: effectiveContent || '',
        message_type: message_type,
        sender_type: sender_type || 'agent',
        sender_id: sender_id,
        file_url: file_url || null,
        file_name: file_name || null,
        status: 'sending',
        origem_resposta: 'manual',
        external_id: external_id, // ✅ Salvar clientMessageId como external_id
        metadata: {
          source: 'test-send-msg-pre-save',
          request_id: requestId,
          step: 'before_evolution',
          client_message_id: clientMessageId
        }
      };

      console.log(`📋 [${requestId}] ETAPA 2 - PRÉ-SALVAMENTO:`, {
        request_id: requestId,
        session_id: conversation.workspace_id,
        chat_id: conversation_id,
        message_id: external_id,
        client_message_id: clientMessageId,
        source: 'frontend',
        attempt: 1
      });

      const { data: savedMessage, error: saveError } = await supabase
        .from('messages')
        .insert(messageData)
        .select('id')
        .single();

      if (saveError) {
        console.error(`❌ [${requestId}] Failed to save message before N8N:`, saveError);
        return new Response(JSON.stringify({
          error: 'Failed to save message',
          details: saveError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ [${requestId}] ETAPA 2 - PÓS-SALVAMENTO:`, {
        request_id: requestId,
        database_id: savedMessage.id,
        external_id: external_id,
        client_message_id: clientMessageId
      });
      
      // ✅ Armazenar o ID real para retornar depois
      const messageCreatedAt = savedMessage.id;
    } catch (preSaveError) {
      console.error(`❌ [${requestId}] Pre-save error:`, preSaveError);
      return new Response(JSON.stringify({
        error: 'Failed to save message before N8N',
        details: preSaveError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // ============================================================
    // ENVIAR MENSAGEM DIRETAMENTE PARA EVOLUTION API
    // ============================================================
    console.log(`📤 [${requestId}] Sending message directly to Evolution API`);
    
    console.log(`📤 [${requestId}] Enviando mensagem EXCLUSIVAMENTE via N8N`);

    // ✅ CHAMAR APENAS O N8N - Evolution será chamado pelo N8N
    try {
      const n8nPayload = {
        direction: 'outbound',
        external_id: external_id,
        phone_number: contact.phone,
        message_type: message_type,
        content: effectiveContent,
        file_url: file_url || null,
        file_name: file_name || null,
        mime_type: body.mime_type || null,
        workspace_id: conversation.workspace_id,
        connection_id: conversation.connection_id,
        conversation_id: conversation_id,
        contact_name: contact.name,
        instance_name: connection.instance_name,
        evolution_url: evolutionUrl,
        evolution_api_key: evolutionApiKey,
        request_id: requestId
      };

      console.log(`🌐 [${requestId}] Calling N8N webhook:`, n8nWebhookUrl.substring(0, 50) + '...');
      console.log(`📦 [${requestId}] N8N payload:`, JSON.stringify(n8nPayload, null, 2));

      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(n8nPayload),
        signal: AbortSignal.timeout(30000) // 30s timeout
      });

      if (!n8nResponse.ok) {
        const n8nError = await n8nResponse.text();
        console.error(`❌ [${requestId}] N8N webhook error (${n8nResponse.status}):`, n8nError);
        
        // Atualizar mensagem como failed
        await supabase
          .from('messages')
          .update({ 
            status: 'failed',
            metadata: {
              client_msg_id: clientMessageId,
              request_id: requestId,
              error: `N8N webhook failed: ${n8nResponse.status}`,
              error_details: n8nError,
              step: 'n8n_webhook_failed'
            }
          })
          .eq('external_id', external_id);

        return new Response(JSON.stringify({
          error: 'N8N webhook failed',
          status: n8nResponse.status,
          details: n8nError
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const n8nData = await n8nResponse.json();
      console.log(`✅ [${requestId}] N8N webhook success:`, n8nData);

      // N8N deve retornar os evolution IDs após processar
      if (n8nData.success && (n8nData.evolution_key_id || n8nData.key?.id)) {
        console.log(`💾 [${requestId}] Salvando Evolution IDs retornados pelo N8N`);
        
        const updateFields: any = {
          status: 'sent',
          metadata: {
            source: 'n8n-processed',
            request_id: requestId,
            step: 'n8n_success',
            client_msg_id: clientMessageId,
            n8n_response: n8nData
          }
        };
        
        // Aceitar evolution_key_id de múltiplos formatos possíveis
        const evolutionKeyId = n8nData.evolution_key_id || n8nData.key?.id || n8nData.keyId;
        if (evolutionKeyId) {
          updateFields.evolution_key_id = evolutionKeyId;
        }
        
        if (n8nData.evolution_short_key_id) {
          updateFields.evolution_short_key_id = n8nData.evolution_short_key_id;
        }
        
        const { error: updateError } = await supabase
          .from('messages')
          .update(updateFields)
          .eq('external_id', external_id);

        if (updateError) {
          console.error(`⚠️ [${requestId}] Failed to save evolution IDs from N8N:`, updateError);
        } else {
          console.log(`✅ [${requestId}] Evolution IDs saved successfully from N8N response!`);
        }
      } else {
        // Mesmo sem evolution IDs, marcar como sent se N8N retornou sucesso
        console.log(`⚠️ [${requestId}] N8N retornou sucesso mas sem evolution IDs, marcando como sent`);
        
        await supabase
          .from('messages')
          .update({ 
            status: 'sent',
            metadata: {
              source: 'n8n-processed',
              request_id: requestId,
              step: 'n8n_success_no_ids',
              client_msg_id: clientMessageId,
              n8n_response: n8nData
            }
          })
          .eq('external_id', external_id);
      
      console.log(`🎉 [${requestId}] SUCCESS - Mensagem enviada via N8N`);

      // ✅ Retornar o ID real da mensagem salva
      return new Response(JSON.stringify({
        success: true,
        message: {
          id: external_id,
          external_id: external_id,
          evolution_key_id: n8nData.evolution_key_id || n8nData.key?.id || null,
          created_at: new Date().toISOString(),
          status: 'sent'
        },
        conversation_id: conversation_id,
        phone_number: contact.phone
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (n8nError) {
      console.error(`❌ [${requestId}] N8N webhook call failed:`, n8nError);
      
      // Atualizar mensagem como failed
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          metadata: {
            client_msg_id: clientMessageId,
            request_id: requestId,
            error: n8nError.message,
            step: 'n8n_webhook_exception'
          }
        })
        .eq('external_id', external_id);

      return new Response(JSON.stringify({
        error: 'Failed to send message via N8N',
        details: n8nError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error(`💥 [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});