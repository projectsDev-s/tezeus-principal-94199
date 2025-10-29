// Evolution Webhook V2 - Enhanced logging and diagnostics
// Force redeploy: 2025-10-15 - Added comprehensive logging for debugging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret',
};

// ✅ DEDUP LOCAL - Prevenir processamento duplicado de eventos
const recentEvents = new Set<string>();

function checkDedup(key: string): boolean {
  if (recentEvents.has(key)) return true;
  recentEvents.add(key);
  setTimeout(() => recentEvents.delete(key), 10000); // TTL de 10s
  return false;
}

function generateRequestId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  // Remove todos os caracteres não-numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove sufixos comuns do Evolution API (62, 63, etc)
  // Esses são adicionados incorretamente pelo WhatsApp em alguns casos
  if (cleaned.length > 13 && cleaned.endsWith('62')) {
    const original = cleaned;
    cleaned = cleaned.slice(0, -2);
    console.log(`⚠️ [SANITIZE] Truncated phone number: "${phone}" -> original_digits="${original}" (${original.length} chars) -> final="${cleaned}" (${cleaned.length} chars)`);
  }
  
  return cleaned;
}

function extractPhoneFromRemoteJid(remoteJid: string): string {
  // Handle different WhatsApp remoteJid formats:
  // @s.whatsapp.net (normal WhatsApp contacts)
  // @lid (LinkedIn imported contacts or other sources)
  // @g.us (group chats)
  // @broadcast (broadcast lists)
  console.log(`📱 Extracting phone from remoteJid: ${remoteJid}`);
  
  // Remove any WhatsApp suffix using regex
  const phoneNumber = remoteJid.replace(/@(s\.whatsapp\.net|lid|g\.us|broadcast|c\.us)$/, '');
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  console.log(`📱 Extracted phone: ${phoneNumber} -> sanitized: ${sanitized}`);
  return sanitized;
}

// Helper function to get or create conversation
async function getOrCreateConversation(
  supabase: any,
  phoneNumber: string,
  contactId: string,
  connectionId: string,
  workspaceId: string,
  instanceName: string
) {
  // ✅ Buscar conversa ativa existente por contact_id + connection_id
  // Isso garante que ao mudar connection_id, a conversa seja vinculada corretamente
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, contact_id, assigned_user_id, connection_id')
    .eq('contact_id', contactId)
    .eq('connection_id', connectionId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (existing) {
    console.log(`✅ [ROUTING] Found conversation ${existing.id} for contact ${contactId} on connection ${connectionId}`);
    
    // 🤖 Verificar e ativar agente IA se necessário
    const { data: existingWithQueue } = await supabase
      .from('conversations')
      .select('id, queue_id, agente_ativo')
      .eq('id', existing.id)
      .single();
    
    if (existingWithQueue?.queue_id) {
      const { data: queue } = await supabase
        .from('queues')
        .select('ai_agent_id')
        .eq('id', existingWithQueue.queue_id)
        .single();
      
      if (queue?.ai_agent_id && !existingWithQueue.agente_ativo) {
        console.log(`🤖 [${instanceName}] Ativando agente IA para conversa ${existing.id}`);
        
        await supabase
          .from('conversations')
          .update({ agente_ativo: true })
          .eq('id', existing.id);
        
        existing.agente_ativo = true;
        console.log(`✅ [${instanceName}] Agente IA ativado automaticamente`);
      }
    }
    
    return existing;
  }
  
  // Criar nova conversa se não existir
  console.log(`🆕 [ROUTING] Creating new conversation for contact ${contactId} on connection ${connectionId}`);
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      contact_phone: phoneNumber,
      contact_id: contactId,
      connection_id: connectionId,
      workspace_id: workspaceId,
      instance_name: instanceName,
      status: 'active',
      last_message_at: new Date().toISOString()
    })
    .select('id, contact_id, assigned_user_id, connection_id')
    .single();
  
  if (error) {
    console.error('❌ Erro ao criar conversa:', error);
    return null;
  }
  
  console.log(`✅ New conversation created: ${newConv.id}`);
  
  // 🎯 DISTRIBUIÇÃO AUTOMÁTICA: Se é uma conversa NOVA, distribuir para fila
  if (newConv && connectionId) {
    console.log(`🎯 Nova conversa criada - iniciando distribuição automática`);
    
    try {
      const { data: distResult, error: distError } = await supabase.functions.invoke(
        'assign-conversation-to-queue',
        {
          body: {
            conversation_id: newConv.id,
            queue_id: null  // Auto-detectar da conexão
          }
        }
      );
      
      if (distError) {
        console.error(`❌ Erro ao distribuir automaticamente:`, distError);
      } else {
        console.log(`✅ Distribuição automática concluída:`, distResult);
      }
    } catch (distException) {
      console.error(`❌ Exceção ao distribuir:`, distException);
    }
  }
  
  return newConv;
}

serve(async (req) => {
  const requestId = generateRequestId();
  const receivedAt = new Date().toISOString();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST method is allowed',
      requestId
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 🔐 SECURITY: Log incoming requests for debugging
  const secretHeader = req.headers.get('X-Secret');
  const userAgent = req.headers.get('User-Agent');
  const authorization = req.headers.get('Authorization');
  
  console.log(`🔍 [${requestId}] Headers received:`, {
    'X-Secret': secretHeader,
    'User-Agent': userAgent,
    'Authorization': authorization ? '[REDACTED]' : null,
    'Content-Type': req.headers.get('Content-Type')
  });

  try {
    const payload = await req.json();
    
    // ✅ LOGGING COMPLETO - Capturar TODOS os eventos que chegam
    console.log(`📨 [WEBHOOK RECEIVED] ${receivedAt}`);
    console.log(`📨 Event Type: ${payload.event}`);
    console.log(`📨 Instance: ${payload.instance}`);
    console.log(`📨 Full Body:`, JSON.stringify(payload, null, 2));

    // Extract instance name from payload
    const instanceName = payload.instance || payload.instanceName;
    const eventType = payload.event;
    
    // ✅ FASE 1.2: Buscar dados da conexão e workspace
    let connectionData = null;
    let workspaceId = null;
    let webhookUrl = null;
    let webhookSecret = null;
    
    if (instanceName) {
      console.log(`🔍 [${requestId}] Fetching connection data for instance: ${instanceName}`);
      const { data: conn } = await supabase
        .from('connections')
        .select(`
          id,
          workspace_id,
          history_days,
          history_recovery,
          history_sync_status,
          history_sync_started_at,
          auto_create_crm_card,
          default_pipeline_id,
          created_at
        `)
        .eq('instance_name', instanceName)
        .single();
      
      if (conn) {
        connectionData = conn;
        workspaceId = conn.workspace_id;
        
        // Get webhook settings for this workspace
        const { data: webhookSettings } = await supabase
          .from('workspace_webhook_settings')
          .select('webhook_url, webhook_secret')
          .eq('workspace_id', workspaceId)
          .single();

        if (webhookSettings) {
          webhookUrl = webhookSettings.webhook_url;
          webhookSecret = webhookSettings.webhook_secret;
        }
        
        console.log(`🔧 [${requestId}] Connection data loaded:`, {
          workspace_id: workspaceId,
          webhook_url: webhookUrl ? webhookUrl.substring(0, 50) + '...' : 'NOT FOUND',
          has_secret: !!webhookSecret
        });
      } else {
        console.warn(`⚠️ [${requestId}] Connection not found for instance: ${instanceName}`);
      }
    }

    // ✅ LOG TODOS EVENTOS NO BANCO - ANTES de qualquer processamento
    try {
      await supabase.from('webhook_logs').insert({
        workspace_id: workspaceId,
        event_type: eventType,
        status: 'received',
        payload_json: payload,
        created_at: receivedAt
      });
      console.log(`✅ Event logged to webhook_logs: ${eventType}`);
    } catch (logError) {
      console.error(`❌ Failed to log webhook event:`, logError);
    }

    // ✅ FASE 1.1: Normalizar evento para processamento consistente
    const EVENT = String(payload.event || '').toUpperCase().replace(/\./g, '_');
    console.log(`📊 [${requestId}] Instance: ${instanceName}, Event: "${payload.event}" → normalized: "${EVENT}"`);
    
    // ✅ DEDUP: Verificar se já processamos esse evento recentemente
    const dedupKey = `${EVENT}:${payload.data?.keyId || payload.data?.messageId || payload.data?.key?.id || Date.now()}`;
    if (checkDedup(dedupKey)) {
      console.log(`⏭️ [${requestId}] Event duplicado ignorado: ${dedupKey}`);
      return new Response(JSON.stringify({
        code: 'DUPLICATE_EVENT',
        message: 'Event already processed recently',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if we should process this event
    const shouldProcess = [
      'messages.upsert',
      'MESSAGES_UPSERT', 
      'messages.update',
      'MESSAGES_UPDATE'
    ].includes(eventType);

    if (!shouldProcess) {
      console.log(`⏭️ Skipping event (not a message event): ${eventType}`);
      
      await supabase.from('webhook_logs').insert({
        workspace_id: workspaceId,
        event_type: eventType,
        status: 'skipped_not_message',
        payload_json: payload,
        response_body: 'Event logged but not processed - not a message event',
        created_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Event logged but not processed - not a message event',
        event_type: eventType
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Processing message event: ${eventType}`);

    // Check if N8N webhook is configured
    console.log(`🔍 Looking for N8N webhook for workspace: ${workspaceId}`);

    if (!webhookUrl) {
      console.log(`⚠️ No N8N webhook configured for workspace: ${workspaceId}`);
      
      await supabase.from('webhook_logs').insert({
        workspace_id: workspaceId,
        event_type: eventType,
        status: 'skipped_no_webhook',
        payload_json: payload,
        response_body: 'No N8N webhook configured',
        created_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No N8N webhook configured - event received but not forwarded' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Forward to N8N
    console.log(`📤 Forwarding to N8N: ${webhookUrl}`);
    const forwardedAt = new Date().toISOString();
    
    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const responseText = await n8nResponse.text();
    console.log(`✅ N8N Response: ${n8nResponse.status} ${responseText}`);

    // Log the forwarding result
    await supabase.from('webhook_logs').insert({
      workspace_id: workspaceId,
      event_type: eventType,
      status: n8nResponse.ok ? 'forwarded' : 'forward_failed',
      payload_json: payload,
      response_status: n8nResponse.status,
      response_body: responseText,
      created_at: forwardedAt
    });

    console.log(`📊 Webhook flow complete:`, {
      received_at: receivedAt,
      forwarded_at: forwardedAt,
      n8n_status: n8nResponse.status
    });

    return new Response(JSON.stringify({
      success: true,
      forwarded: true,
      n8n_status: n8nResponse.status,
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error in webhook:`, error);
    
    // Log error
    try {
      await supabase.from('webhook_logs').insert({
        workspace_id: null,
        event_type: 'ERROR',
        status: 'error',
        payload_json: { error: error.message, stack: error.stack },
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.error(`❌ Failed to log error:`, logErr);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
