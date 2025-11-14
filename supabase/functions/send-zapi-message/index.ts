import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  console.log("🔥 SEND Z-API MESSAGE - BUILD 2025-11-05");
  console.log("🔥 Method:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      connectionId,
      conversationId,
      phoneNumber,
      message,
      messageType = "text",
      fileUrl,
      fileName,
      mimeType,
      caption,
      senderId,
    } = await req.json();

    console.log("📋 Request params:", {
      connectionId,
      conversationId,
      phoneNumber,
      messageType,
      hasFileUrl: !!fileUrl,
    });

    if (!connectionId || !phoneNumber || !message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "connectionId, phoneNumber e message são obrigatórios",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão
    const { data: connection, error: connError } = await supabase
      .from("connections")
      .select("*, provider:whatsapp_providers(*)")
      .eq("id", connectionId)
      .maybeSingle();

    if (connError || !connection) {
      console.error("❌ Connection not found:", connError);
      return new Response(
        JSON.stringify({ success: false, error: "Conexão não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (connection.status !== "connected") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Conexão não está ativa. Status: ${connection.status}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se provider é Z-API
    if (!connection.provider || connection.provider.provider !== "zapi") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Esta conexão não está configurada para usar Z-API",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiUrl = connection.provider.zapi_url;
    const zapiClientToken = connection.provider.zapi_client_token;

    if (!zapiUrl || !zapiToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuração Z-API incompleta (URL ou token ausente)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter ID e token da instância do metadata da conexão
    const zapiInstanceId = 
      connection.metadata?.id || 
      connection.metadata?.instanceId || 
      connection.metadata?.instance_id;
    
    const zapiInstanceToken =
      connection.metadata?.token ||
      connection.metadata?.instanceToken ||
      connection.metadata?.instance_token;

    if (!zapiInstanceId || !zapiInstanceToken) {
      console.error("❌ Missing Z-API instance credentials in metadata");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Credenciais da instância Z-API não encontradas no metadata",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Z-API provider and instance validated");

    // Formatar número de telefone para Z-API
    const formattedPhone = phoneNumber.replace(/[^0-9]/g, "");
    
    // Preparar payload baseado no tipo de mensagem
    let zapiPayload: any = {
      phone: formattedPhone,
    };

    let endpoint = "/send-text";

    switch (messageType) {
      case "text":
        zapiPayload.message = message;
        endpoint = "/send-text";
        break;

      case "image":
        if (!fileUrl) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "fileUrl é obrigatório para envio de imagens",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        zapiPayload.image = fileUrl;
        zapiPayload.caption = caption || message || "";
        endpoint = "/send-image";
        break;

      case "video":
        if (!fileUrl) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "fileUrl é obrigatório para envio de vídeos",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        zapiPayload.video = fileUrl;
        zapiPayload.caption = caption || message || "";
        endpoint = "/send-video";
        break;

      case "audio":
      case "ptt":
        if (!fileUrl) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "fileUrl é obrigatório para envio de áudio",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        zapiPayload.audio = fileUrl;
        endpoint = messageType === "ptt" ? "/send-ptt" : "/send-audio";
        break;

      case "document":
        if (!fileUrl) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "fileUrl é obrigatório para envio de documentos",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        zapiPayload.document = fileUrl;
        zapiPayload.fileName = fileName || "documento.pdf";
        zapiPayload.caption = caption || message || "";
        endpoint = "/send-document";
        break;

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Tipo de mensagem não suportado: ${messageType}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`📤 Sending ${messageType} via Z-API to ${formattedPhone}`);
    console.log("📦 Z-API Payload:", JSON.stringify(zapiPayload, null, 2));

    // Enviar mensagem via Z-API usando formato correto com token na URL
    // Formato: https://api.z-api.io/instances/{id}/token/{token}/send-text
    let baseUrl = zapiUrl;
    if (zapiUrl.includes('/instances/integrator')) {
      baseUrl = zapiUrl.split('/instances/integrator')[0];
    }
    baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    
    const fullUrl = `${baseUrl}/instances/${zapiInstanceId}/token/${zapiInstanceToken}${endpoint}`;

    console.log("🔗 Z-API URL:", fullUrl);

    const zapiResponse = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapiClientToken, // ✅ Token de CLIENTE para operar instância
      },
      body: JSON.stringify(zapiPayload),
    });

    if (!zapiResponse.ok) {
      let errorData;
      try {
        errorData = await zapiResponse.json();
      } catch {
        errorData = { message: await zapiResponse.text() };
      }

      console.error("❌ Z-API error:", {
        status: zapiResponse.status,
        error: errorData,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro Z-API (${zapiResponse.status}): ${errorData?.message || "Erro desconhecido"}`,
          details: errorData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiResult = await zapiResponse.json();
    console.log("✅ Z-API response:", zapiResult);

    // Extrair messageId da resposta Z-API
    const messageId = zapiResult.messageId || zapiResult.key?.id || zapiResult.id;

    // Salvar mensagem no banco se conversationId foi fornecido
    let savedMessage = null;
    if (conversationId) {
      console.log("💾 Saving message to database");

      const { data: conversation } = await supabase
        .from("conversations")
        .select("workspace_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (conversation) {
        const { data: message_data, error: messageError } = await supabase
          .from("messages")
          .insert({
            workspace_id: conversation.workspace_id,
            conversation_id: conversationId,
            external_id: messageId,
            content: message,
            message_type: messageType,
            sender_type: senderId ? "user" : "system",
            sender_id: senderId || null,
            status: "sent",
            file_url: fileUrl || null,
            file_name: fileName || null,
            mime_type: mimeType || null,
            metadata: zapiResult,
          })
          .select()
          .single();

        if (messageError) {
          console.error("❌ Error saving message:", messageError);
        } else {
          savedMessage = message_data;
          console.log("✅ Message saved:", savedMessage.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: messageId,
        zapiResponse: zapiResult,
        savedMessage: savedMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error sending Z-API message:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
