import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBodyCache: any = null;
  let receivedMessageId: string | undefined;

  try {
    try {
      requestBodyCache = await req.json();
    } catch (_) {
      requestBodyCache = {};
    }

    const { 
      messageId, 
      phoneNumber, 
      content, 
      messageType = 'text', 
      fileUrl, 
      fileName, 
      mimeType: mimeTypeFromBody, 
      evolutionInstance: evolutionInstanceFromBody,
      conversationId,
      workspaceId,
      external_id 
    } = requestBodyCache;
    
    receivedMessageId = messageId;
    console.log(`📨 [${messageId}] N8N Send Message - Dados recebidos:`, { 
      messageId, 
      phoneNumber: phoneNumber?.substring(0, 8) + '***', 
      content: content?.substring(0, 50), 
      messageType, 
      hasFile: !!fileUrl 
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

    // Buscar dados da mensagem para ter contexto completo (incluindo sender_id)
    let conversationIdResolved: string | null = conversationId || null;
    let contactName: string | null = null;
    let contactEmail: string | null = null;
    let contactPhone: string | null = phoneNumber || null;
    let evolutionInstance: string | null = evolutionInstanceFromBody || null;
    let senderId: string | null = null;

    if (messageId) {
      const { data: msgRow, error: msgErr } = await supabase
        .from('messages')
        .select('conversation_id, sender_id')
        .eq('id', messageId)
        .maybeSingle();

      if (msgRow) {
        senderId = msgRow.sender_id;
        conversationIdResolved = msgRow.conversation_id;
      }
    }

    // Buscar informações do contato e conversação se necessário
    if (conversationIdResolved && !contactPhone) {
      console.log(`🔍 [${messageId}] Buscando informações de conversa: ${conversationIdResolved}`);
      
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select(`
          id,
          workspace_id,
          contact:contacts(phone, name, email),
          connection:connections(instance_name)
        `)
        .eq('id', conversationIdResolved)
        .single();

      if (convData) {
        contactPhone = convData.contact?.phone;
        contactName = convData.contact?.name;
        contactEmail = convData.contact?.email;
        evolutionInstance = convData.connection?.instance_name;
        finalWorkspaceId = convData.workspace_id;
      }
    }

    if (!contactPhone) {
      if (!phoneNumber) {
        console.error(`❌ [${messageId}] senderId is empty, message might fail instance resolution`);
      }
      contactPhone = phoneNumber;
    }

    if (!evolutionInstance) {
      console.error(`❌ [${messageId}] evolutionInstance is empty, message might fail`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not resolve evolutionInstance',
        message: messageId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const finalEvolutionInstance = evolutionInstance;

    // Buscar configurações da instância Evolution
    const { data: instanceConfig, error: instanceErr } = await supabase
      .from('evolution_instance_tokens')
      .select('*')
      .eq('instance_name', finalEvolutionInstance)
      .maybeSingle();

    if (!instanceConfig) {
      console.error(`❌ [${messageId}] Instância não encontrada:`, finalEvolutionInstance);
      return new Response(JSON.stringify({
        success: false,
        error: `Instância não encontrada: ${finalEvolutionInstance}`,
        message: messageId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MELHORADO: Verificar se workspace tem webhook N8N configurado antes de tentar
    if (!finalWorkspaceId) {
      console.error(`❌ [${messageId}] Could not resolve workspace_id`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not resolve workspace_id',
        message: messageId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${finalWorkspaceId}`;
    
    const { data: webhookData, error: webhookError } = await supabase
      .from('workspace_webhook_secrets')
      .select('webhook_url')
      .eq('workspace_id', finalWorkspaceId)
      .eq('secret_name', workspaceWebhookSecretName)
      .maybeSingle();

    let workspaceWebhookUrl: string | null = null;
    
    if (!webhookError && webhookData?.webhook_url) {
      workspaceWebhookUrl = webhookData.webhook_url;
      console.log(`📤 [${messageId}] Found workspace webhook for N8N`);
    } else {
      console.log(`⚠️ [${messageId}] No workspace webhook configured - N8N unavailable`);
      return new Response(JSON.stringify({
        success: false,
        error: 'N8N webhook not configured for workspace',
        message: messageId
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preparar payload para N8N baseado no tipo de mensagem
    let evolutionMessage: any = {};
    let evolutionMessageType = 'conversation';

    if (messageType === 'text' || !fileUrl) {
      evolutionMessage = {
        conversation: content ?? ''
      };
      evolutionMessageType = 'conversation';
    } else if (messageType === 'image') {
      evolutionMessageType = 'imageMessage';
      evolutionMessage = {
        imageMessage: {
          url: fileUrl,
          caption: content || '',
          fileName: fileName || 'image.jpg'
        }
      };
    } else if (messageType === 'video') {
      evolutionMessageType = 'videoMessage';
      evolutionMessage = {
        videoMessage: {
          url: fileUrl,
          caption: content || '',
          fileName: fileName || 'video.mp4'
        }
      };
    } else if (messageType === 'audio') {
      evolutionMessageType = 'audioMessage';
      evolutionMessage = {
        audioMessage: {
          url: fileUrl,
          fileName: fileName || 'audio.ogg'
        }
      };
    } else if (messageType === 'document' || messageType === 'file') {
      evolutionMessageType = 'documentMessage';
      evolutionMessage = {
        documentMessage: {
          url: fileUrl,
          caption: content || '',
          fileName: fileName || 'document'
        }
      };
    } else {
      evolutionMessage = { conversation: content ?? '' };
      evolutionMessageType = 'conversation';
    }

    const n8nPayload = {
      event: 'send.message',
      instance: finalEvolutionInstance,
      external_id: external_id || messageId, // Usar external_id se fornecido, senão messageId
      data: {
        key: {
          remoteJid: `${contactPhone}@s.whatsapp.net`,
          fromMe: true,
          id: external_id || messageId // Usar external_id como ID também
        },
        message: evolutionMessage,
        messageType: evolutionMessageType,
        messageTimestamp: Date.now()
      },
      destination: workspaceWebhookUrl,
      date_time: new Date().toISOString(),
      sender: contactPhone,
      server_url: instanceConfig.evolution_url,
      apikey: instanceConfig.token
    };

    console.log(`📡 [${messageId}] Enviando para N8N workspace webhook`);

    // Chamar N8N com timeout e detecção de falhas melhorada
    const n8nResponse = await fetch(workspaceWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(n8nPayload),
      signal: AbortSignal.timeout(15000) // 15 segundos timeout
    });

    const responseText = await n8nResponse.text();
    
    // Verificação melhorada de sucesso do N8N
    if (!n8nResponse.ok) {
      console.error(`❌ [${messageId}] N8N webhook failed (${n8nResponse.status}):`, responseText);
      return new Response(JSON.stringify({
        success: false,
        error: `N8N webhook failed with status ${n8nResponse.status}`,
        details: responseText,
        message: messageId
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se a resposta contém erro mesmo com status 200
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      if (responseData.error || responseData.success === false) {
        console.error(`❌ [${messageId}] N8N returned error in response:`, responseData);
        return new Response(JSON.stringify({
          success: false,
          error: 'N8N processing failed',
          details: responseData,
          message: messageId
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (parseError) {
      // Se não conseguir fazer parse, assumir que é texto simples e sucesso
      responseData = { response: responseText };
    }

    console.log(`✅ [${messageId}] N8N webhook executado com sucesso`);

    // 🔄 UPDATE external_id with Evolution API message ID if available
    if (responseData?.key?.id && messageId) {
      const evolutionMessageId = responseData.key.id;
      console.log(`🔄 [${messageId}] Updating external_id to Evolution message ID: ${evolutionMessageId}`);
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ external_id: evolutionMessageId })
        .eq('id', messageId);
      
      if (updateError) {
        console.error(`❌ [${messageId}] Failed to update external_id:`, updateError);
      } else {
        console.log(`✅ [${messageId}] external_id updated successfully to ${evolutionMessageId}`);
      }
    } else {
      console.log(`⚠️ [${messageId}] No Evolution message ID in response to update external_id`);
    }

    return new Response(JSON.stringify({
      success: true,
      method: 'n8n',
      message: messageId,
      response: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ [${receivedMessageId}] Erro no N8N Send Message:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message,
      message: receivedMessageId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});