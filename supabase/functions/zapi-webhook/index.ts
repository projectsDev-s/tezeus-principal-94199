// Z-API Webhook Receiver - Handles incoming webhooks from Z-API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Deduplication cache
const recentEvents = new Set<string>();

function checkDedup(key: string): boolean {
  if (recentEvents.has(key)) return true;
  recentEvents.add(key);
  setTimeout(() => recentEvents.delete(key), 10000);
  return false;
}

function generateRequestId(): string {
  return `zapi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

function extractPhoneFromZapi(phone: string): string {
  // Z-API typically sends phone numbers with country code
  // Remove any non-numeric characters
  const sanitized = sanitizePhoneNumber(phone);
  console.log(`📱 Z-API phone: ${phone} -> sanitized: ${sanitized}`);
  return sanitized;
}

async function getOrCreateConversation(
  supabase: any,
  phoneNumber: string,
  contactId: string,
  connectionId: string,
  workspaceId: string,
  instanceName: string
) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, contact_id, assigned_user_id, connection_id, queue_id, agente_ativo')
    .eq('contact_id', contactId)
    .eq('connection_id', connectionId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (existing) {
    console.log(`✅ Found conversation ${existing.id} for contact ${contactId}`);
    
    // Check and activate AI agent if needed
    if (existing.queue_id) {
      const { data: queue } = await supabase
        .from('queues')
        .select('agent_id')
        .eq('id', existing.queue_id)
        .single();
      
      if (queue?.agent_id && !existing.agente_ativo) {
        await supabase
          .from('conversations')
          .update({ agente_ativo: true })
          .eq('id', existing.id);
        
        console.log(`🤖 AI agent activated for conversation ${existing.id}`);
      }
    }
    
    return existing.id;
  }
  
  console.log(`🆕 Creating new conversation for contact ${contactId}`);
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      contact_id: contactId,
      connection_id: connectionId,
      workspace_id: workspaceId,
      status: 'active',
      instance_name: instanceName
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return newConv.id;
}

async function getOrCreateContact(
  supabase: any,
  phoneNumber: string,
  name: string | null,
  workspaceId: string
) {
  const { data: existing } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('phone', phoneNumber)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  
  if (existing) {
    // Update name if provided and different
    if (name && name !== existing.name) {
      await supabase
        .from('contacts')
        .update({ name })
        .eq('id', existing.id);
      console.log(`📝 Updated contact ${existing.id} name to: ${name}`);
    }
    return existing.id;
  }
  
  console.log(`🆕 Creating new contact: ${phoneNumber}`);
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      phone: phoneNumber,
      name: name || phoneNumber,
      workspace_id: workspaceId
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return newContact.id;
}

serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`🌐 [${requestId}] Z-API Webhook received`);

  try {
    const payload = await req.json();
    console.log(`📨 [${requestId}] Z-API webhook payload:`, JSON.stringify(payload, null, 2));

    // Extract instance identifier - Z-API uses "instanceId" or similar
    const instanceId = payload.instanceId || payload.instance || payload.phone;
    
    if (!instanceId) {
      console.error(`❌ [${requestId}] No instance identifier in payload`);
      return new Response(JSON.stringify({
        code: 'MISSING_INSTANCE',
        message: 'Instance identifier not found',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get connection data for this Z-API instance
    const { data: connection } = await supabase
      .from('connections')
      .select(`
        id,
        workspace_id,
        instance_name,
        auto_create_crm_card,
        default_pipeline_id,
        default_column_id,
        queue_id
      `)
      .eq('instance_name', instanceId)
      .single();
    
    if (!connection) {
      console.error(`❌ [${requestId}] Connection not found for instance: ${instanceId}`);
      return new Response(JSON.stringify({
        code: 'CONNECTION_NOT_FOUND',
        message: `Connection not found for instance: ${instanceId}`,
        requestId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Connection found: ${connection.id} for workspace: ${connection.workspace_id}`);

    // Process different Z-API event types
    const eventType = payload.event || payload.type || 'unknown';
    console.log(`📊 [${requestId}] Event type: ${eventType}`);

    // Deduplication
    const messageId = payload.messageId || payload.data?.messageId || payload.id;
    const dedupKey = `${eventType}:${messageId || Date.now()}`;
    
    if (checkDedup(dedupKey)) {
      console.log(`⏭️ [${requestId}] Duplicate event ignored: ${dedupKey}`);
      return new Response(JSON.stringify({
        code: 'DUPLICATE_EVENT',
        message: 'Event already processed',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle message received events
    if (eventType === 'received-message' || eventType === 'message-received') {
      console.log(`📬 [${requestId}] Processing received message from Z-API`);
      
      const messageData = payload.data || payload;
      const senderPhone = extractPhoneFromZapi(messageData.phone || messageData.from);
      const senderName = messageData.senderName || messageData.pushName || senderPhone;
      const messageText = messageData.text?.message || messageData.message || '';
      const messageType = messageData.messageType || messageData.type || 'text';
      const externalId = messageData.messageId || messageData.id;
      
      console.log(`📱 [${requestId}] Message from: ${senderPhone} (${senderName})`);

      // Get or create contact
      const contactId = await getOrCreateContact(
        supabase,
        senderPhone,
        senderName,
        connection.workspace_id
      );

      // Get or create conversation
      const conversationId = await getOrCreateConversation(
        supabase,
        senderPhone,
        contactId,
        connection.id,
        connection.workspace_id,
        connection.instance_name
      );

      // Process message content based on type
      let messageContent = messageText;
      let mediaUrl = null;
      let fileName = null;
      let mimeType = null;

      if (messageType === 'image' && messageData.image) {
        mediaUrl = messageData.image.imageUrl || messageData.image.url;
        fileName = messageData.image.filename || 'image.jpg';
        mimeType = messageData.image.mimetype || 'image/jpeg';
        messageContent = messageData.image.caption || '';
      } else if (messageType === 'video' && messageData.video) {
        mediaUrl = messageData.video.videoUrl || messageData.video.url;
        fileName = messageData.video.filename || 'video.mp4';
        mimeType = messageData.video.mimetype || 'video/mp4';
        messageContent = messageData.video.caption || '';
      } else if (messageType === 'audio' && messageData.audio) {
        mediaUrl = messageData.audio.audioUrl || messageData.audio.url;
        fileName = messageData.audio.filename || 'audio.ogg';
        mimeType = messageData.audio.mimetype || 'audio/ogg';
      } else if (messageType === 'document' && messageData.document) {
        mediaUrl = messageData.document.documentUrl || messageData.document.url;
        fileName = messageData.document.filename || 'document';
        mimeType = messageData.document.mimetype || 'application/octet-stream';
        messageContent = messageData.document.caption || '';
      }

      // Insert message into database
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: messageContent,
          sender_type: 'contact',
          sender_id: contactId,
          message_type: messageType === 'text' ? 'text' : messageType,
          status: 'received',
          external_id: externalId,
          file_url: mediaUrl,
          file_name: fileName,
          mime_type: mimeType,
          workspace_id: connection.workspace_id,
          origem_resposta: 'webhook_zapi'
        })
        .select()
        .single();

      if (insertError) {
        console.error(`❌ [${requestId}] Error inserting message:`, insertError);
        throw insertError;
      }

      console.log(`✅ [${requestId}] Message saved: ${newMessage.id}`);

      // Trigger AI agent if active
      const { data: conversation } = await supabase
        .from('conversations')
        .select('agente_ativo, queue_id')
        .eq('id', conversationId)
        .single();

      if (conversation?.agente_ativo && conversation.queue_id) {
        console.log(`🤖 [${requestId}] Triggering AI agent for conversation ${conversationId}`);
        
        const { data: queue } = await supabase
          .from('queues')
          .select('agent_id')
          .eq('id', conversation.queue_id)
          .single();

        if (queue?.agent_id) {
          try {
            await supabase.functions.invoke('ai-chat-response', {
              body: {
                conversationId,
                contactId,
                workspaceId: connection.workspace_id,
                agentId: queue.agent_id,
                phoneNumber: senderPhone,
                instanceName: connection.instance_name
              }
            });
            console.log(`✅ [${requestId}] AI agent triggered`);
          } catch (aiError) {
            console.error(`❌ [${requestId}] Error triggering AI:`, aiError);
          }
        }
      }

      return new Response(JSON.stringify({
        code: 'MESSAGE_PROCESSED',
        message: 'Message received and processed',
        requestId,
        messageId: newMessage.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle message status updates (sent, delivered, read)
    if (eventType === 'message-status' || eventType === 'status-update') {
      console.log(`📬 [${requestId}] Processing message status update from Z-API`);
      
      const statusData = payload.data || payload;
      const messageId = statusData.messageId || statusData.id;
      const status = statusData.status;
      
      console.log(`🔄 [${requestId}] Status update for message ${messageId}: ${status}`);

      // Map Z-API status to our status
      const mappedStatus = status === 'READ' ? 'read' :
                          status === 'DELIVERED' ? 'delivered' :
                          status === 'SENT' ? 'sent' : null;

      if (mappedStatus && messageId) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ status: mappedStatus })
          .eq('external_id', messageId);

        if (updateError) {
          console.error(`❌ [${requestId}] Error updating message status:`, updateError);
        } else {
          console.log(`✅ [${requestId}] Message status updated to: ${mappedStatus}`);
        }
      }

      return new Response(JSON.stringify({
        code: 'STATUS_UPDATED',
        message: 'Status update processed',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle connection status updates
    if (eventType === 'connection' || eventType === 'connection-status') {
      console.log(`🔌 [${requestId}] Connection status update from Z-API`);
      
      const statusData = payload.data || payload;
      const connectionStatus = statusData.status || statusData.state;
      
      // Map Z-API connection status to our status
      const mappedStatus = connectionStatus === 'CONNECTED' || connectionStatus === 'open' ? 'connected' :
                          connectionStatus === 'DISCONNECTED' || connectionStatus === 'close' ? 'disconnected' :
                          connectionStatus === 'CONNECTING' ? 'qrcode' : null;

      if (mappedStatus) {
        await supabase
          .from('connections')
          .update({ 
            status: mappedStatus,
            last_activity_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        console.log(`✅ [${requestId}] Connection status updated to: ${mappedStatus}`);
      }

      return new Response(JSON.stringify({
        code: 'CONNECTION_STATUS_UPDATED',
        message: 'Connection status updated',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Unknown event type
    console.log(`⚠️ [${requestId}] Unknown Z-API event type: ${eventType}`);
    
    return new Response(JSON.stringify({
      code: 'UNKNOWN_EVENT',
      message: `Unknown event type: ${eventType}`,
      requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error processing Z-API webhook:`, error);
    
    return new Response(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Error processing webhook',
      error: error.message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
