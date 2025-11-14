import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

// Helper function to forward message to N8N
async function forwardToN8N(
  webhookUrl: string,
  webhookSecret: string | null,
  payload: any,
  requestId: string
) {
  if (!webhookUrl) {
    console.log(`⚠️ [${requestId}] No N8N webhook URL configured, skipping forward`);
    return;
  }

  console.log(`🚀 [${requestId}] Forwarding to N8N: ${webhookUrl}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (webhookSecret) {
    headers['Authorization'] = `Bearer ${webhookSecret}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    console.log(`✅ [${requestId}] N8N webhook called successfully, status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      console.error(`❌ [${requestId}] N8N webhook error response:`, errorText);
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
  }
}

serve(async (req) => {
  const requestId = `zapi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🔥 [${requestId}] Z-API WEBHOOK - BUILD 2025-11-14`);
  console.log(`🔥 [${requestId}] Method:`, req.method);
  console.log(`🔥 [${requestId}] URL:`, req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const webhookData = await req.json();
    console.log("📦 Z-API Webhook Data:", JSON.stringify(webhookData, null, 2));

    // Identificar tipo de evento Z-API
    const eventType = webhookData.event || webhookData.type;
    const instanceName = webhookData.instanceName || webhookData.instance;

    console.log(`📍 Event Type: ${eventType}, Instance: ${instanceName}`);

    if (!instanceName) {
      console.error("❌ No instance name provided");
      return new Response(
        JSON.stringify({ success: false, error: "Instance name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão pelo instance_name com provider
    const { data: connection, error: connError } = await supabase
      .from("connections")
      .select(`
        *,
        provider:whatsapp_providers!connections_provider_id_fkey(
          id,
          n8n_webhook_url
        )
      `)
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (connError || !connection) {
      console.error(`❌ [${requestId}] Connection not found:`, connError);
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${requestId}] Connection found: ${connection.id}`);

    // Buscar webhook secret
    let webhookSecret: string | null = null;
    if (connection.provider?.n8n_webhook_url) {
      const { data: webhookSecretData } = await supabase
        .from('workspace_webhook_secrets')
        .select('webhook_secret')
        .eq('workspace_id', connection.workspace_id)
        .maybeSingle();
      
      webhookSecret = webhookSecretData?.webhook_secret || null;
      console.log(`🔐 [${requestId}] Webhook secret ${webhookSecret ? 'found' : 'not found'}`);
    }

    // Processar evento de conexão
    if (eventType === "qrcode.updated" || webhookData.qrcode) {
      console.log("📱 Processing QR Code update");
      
      const qrCode = webhookData.qrcode?.qrcode || webhookData.qrcode;
      
      await supabase
        .from("connections")
        .update({
          status: "qr",
          qr_code: qrCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      console.log("✅ QR Code updated");
      
      return new Response(
        JSON.stringify({ success: true, message: "QR code updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Evento de conexão estabelecida
    if (eventType === "connection.update" || eventType === "connected") {
      console.log("🔗 Processing connection update");

      const phoneNumber = webhookData.phone || webhookData.instance?.phone;
      
      await supabase
        .from("connections")
        .update({
          status: "connected",
          phone_number: phoneNumber || connection.phone_number,
          qr_code: null,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      console.log("✅ Connection status updated to connected");
      
      return new Response(
        JSON.stringify({ success: true, message: "Connection established" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Evento de desconexão
    if (eventType === "disconnected" || webhookData.status === "DISCONNECTED") {
      console.log("❌ Processing disconnection");

      await supabase
        .from("connections")
        .update({
          status: "disconnected",
          qr_code: null,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      console.log("✅ Connection status updated to disconnected");
      
      return new Response(
        JSON.stringify({ success: true, message: "Connection disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processar mensagem recebida
    if (eventType === "message" || webhookData.data?.message) {
      console.log("💬 Processing received message");

      const messageData = webhookData.data?.message || webhookData.message;
      const remoteJid = messageData.key?.remoteJid || messageData.from;
      const messageKey = messageData.key?.id || messageData.messageId;

      if (!remoteJid) {
        console.error("❌ No remoteJid found");
        return new Response(
          JSON.stringify({ success: false, error: "Invalid message format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extrair número de telefone limpo
      const phoneNumber = remoteJid.replace(/[^0-9]/g, "");
      
      console.log(`📞 Processing message from: ${phoneNumber}`);

      // Buscar ou criar contato
      let { data: contact } = await supabase
        .from("contacts")
        .select("*")
        .eq("workspace_id", connection.workspace_id)
        .eq("phone", phoneNumber)
        .maybeSingle();

      if (!contact) {
        console.log("👤 Creating new contact");
        
        const contactName = messageData.pushName || phoneNumber;
        
        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            workspace_id: connection.workspace_id,
            phone: phoneNumber,
            name: contactName,
          })
          .select()
          .single();

        if (contactError) {
          console.error("❌ Error creating contact:", contactError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to create contact" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        contact = newContact;
        console.log(`✅ Contact created: ${contact.id}`);
      }

      // Buscar ou criar conversa
      let { data: conversation } = await supabase
        .from("conversations")
        .select("*")
        .eq("workspace_id", connection.workspace_id)
        .eq("contact_id", contact.id)
        .eq("connection_id", connection.id)
        .maybeSingle();

      if (!conversation) {
        console.log("💬 Creating new conversation");
        
        const { data: newConversation, error: convError } = await supabase
          .from("conversations")
          .insert({
            workspace_id: connection.workspace_id,
            contact_id: contact.id,
            connection_id: connection.id,
            status: "open",
            canal: "whatsapp",
          })
          .select()
          .single();

        if (convError) {
          console.error("❌ Error creating conversation:", convError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to create conversation" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        conversation = newConversation;
        console.log(`✅ Conversation created: ${conversation.id}`);
      } else if (conversation.status === "closed") {
        // Reabrir conversa se estava fechada
        await supabase
          .from("conversations")
          .update({ status: "open" })
          .eq("id", conversation.id);
        
        console.log("✅ Conversation reopened");
      }

      // Extrair conteúdo da mensagem
      let content = "";
      let messageType = "text";
      let fileUrl = null;
      let fileName = null;
      let mimeType = null;

      if (messageData.message?.conversation) {
        content = messageData.message.conversation;
      } else if (messageData.text) {
        content = messageData.text;
      } else if (messageData.message?.imageMessage) {
        messageType = "image";
        content = messageData.message.imageMessage.caption || "📷 Imagem";
        fileUrl = messageData.message.imageMessage.url;
        mimeType = messageData.message.imageMessage.mimetype;
      } else if (messageData.message?.videoMessage) {
        messageType = "video";
        content = messageData.message.videoMessage.caption || "🎥 Vídeo";
        fileUrl = messageData.message.videoMessage.url;
        mimeType = messageData.message.videoMessage.mimetype;
      } else if (messageData.message?.audioMessage) {
        messageType = "audio";
        content = "🎵 Áudio";
        fileUrl = messageData.message.audioMessage.url;
        mimeType = messageData.message.audioMessage.mimetype;
      } else if (messageData.message?.documentMessage) {
        messageType = "document";
        content = "📄 Documento";
        fileUrl = messageData.message.documentMessage.url;
        fileName = messageData.message.documentMessage.fileName;
        mimeType = messageData.message.documentMessage.mimetype;
      } else {
        content = JSON.stringify(messageData);
      }

      // Verificar se mensagem já existe
      const { data: existingMessage } = await supabase
        .from("messages")
        .select("id")
        .eq("external_id", messageKey)
        .maybeSingle();

      if (existingMessage) {
        console.log("⚠️ Message already exists, skipping");
        return new Response(
          JSON.stringify({ success: true, message: "Message already processed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Criar mensagem
      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          workspace_id: connection.workspace_id,
          conversation_id: conversation.id,
          external_id: messageKey,
          content: content,
          message_type: messageType,
          sender_type: "contact",
          status: "received",
          file_url: fileUrl,
          file_name: fileName,
          mime_type: mimeType,
          metadata: messageData,
        });

      if (messageError) {
        console.error("❌ Error creating message:", messageError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create message" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`✅ [${requestId}] Message created successfully`);

      // 🚀 Disparar webhook para N8N
      if (connection.provider?.n8n_webhook_url) {
        console.log(`🎯 [${requestId}] Forwarding message to N8N`);
        
        const n8nPayload = {
          event_type: 'MESSAGE_RECEIVED',
          provider: 'zapi',
          instance_name: instanceName,
          workspace_id: connection.workspace_id,
          connection_id: connection.id,
          processed_locally: true,
          processed_data: {
            contact: {
              id: contact.id,
              name: contact.name,
              phone: phoneNumber
            },
            conversation: {
              id: conversation.id,
              status: conversation.status
            },
            message: {
              content: content,
              message_type: messageType,
              sender_type: 'contact',
              file_url: fileUrl,
              file_name: fileName,
              mime_type: mimeType,
              timestamp: new Date().toISOString()
            }
          },
          original_event: webhookData
        };

        await forwardToN8N(
          connection.provider.n8n_webhook_url,
          webhookSecret,
          n8nPayload,
          requestId
        );
      } else {
        console.log(`⚠️ [${requestId}] No N8N webhook configured, message not forwarded`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Message processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processar status de mensagem enviada
    if (eventType === "message.status" || webhookData.status) {
      console.log("📬 Processing message status update");

      const messageKey = webhookData.messageId || webhookData.key?.id;
      const status = webhookData.status?.toLowerCase();

      if (!messageKey) {
        console.error("❌ No message key found");
        return new Response(
          JSON.stringify({ success: false, error: "Message key is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData: any = {};
      
      if (status === "sent" || status === "delivered") {
        updateData.status = "delivered";
        updateData.delivered_at = new Date().toISOString();
      } else if (status === "read") {
        updateData.status = "read";
        updateData.read_at = new Date().toISOString();
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from("messages")
          .update(updateData)
          .eq("external_id", messageKey);

        console.log(`✅ Message status updated to: ${status}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Status updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("⚠️ Unknown event type, logging only");
    
    return new Response(
      JSON.stringify({ success: true, message: "Event logged" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error processing Z-API webhook:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
