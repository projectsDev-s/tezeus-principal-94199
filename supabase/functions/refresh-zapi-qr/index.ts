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
  console.log("🔥 REFRESH Z-API QR CODE - BUILD 2025-11-05");
  console.log("🔥 Method:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { connectionId } = await req.json();

    console.log("📋 Request params:", { connectionId });

    if (!connectionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "connectionId é obrigatório",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão com provider
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

    console.log(`✅ Connection found: ${connection.instance_name}`);

    // Verificar se é Z-API
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
    const zapiToken = connection.provider.zapi_token;

    if (!zapiUrl || !zapiToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuração Z-API incompleta (URL ou token ausente)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Z-API provider validated");

    // Verificar status atual da conexão
    if (connection.status === "connected") {
      console.log("⚠️ Connection already connected");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Conexão já está ativa. Desconecte primeiro para obter novo QR code.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter ID da instância Z-API do metadata
    const zapiInstanceId = connection.metadata?.id;
    if (!zapiInstanceId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ID da instância Z-API não encontrado. Recrie a conexão.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chamar Z-API para obter novo QR code
    const baseUrl = zapiUrl.endsWith("/") ? zapiUrl.slice(0, -1) : zapiUrl;
    const fullUrl = `${baseUrl}/${zapiInstanceId}/qr-code/image`;

    console.log("🔗 Z-API URL:", fullUrl);
    console.log("📱 Z-API Instance ID:", zapiInstanceId);
    console.log("📱 Requesting new QR code...");

    const zapiResponse = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Client-Token": zapiToken,
      },
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

      // Se instância não existe, tentar recriar
      if (zapiResponse.status === 404) {
        console.log("🔄 Instance not found, attempting to recreate...");
        
        return new Response(
          JSON.stringify({
            success: false,
            error: "Instância não encontrada no Z-API. Recrie a conexão.",
            needsRecreation: true,
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
    console.log("✅ Z-API QR code response received");

    // Extrair QR code
    const qrCode = zapiResult.qrcode || zapiResult.value || zapiResult.code;

    if (!qrCode) {
      console.error("❌ No QR code in response:", zapiResult);
      
      // Verificar se já está conectado
      if (zapiResult.connected || zapiResult.status === "CONNECTED") {
        await supabase
          .from("connections")
          .update({
            status: "connected",
            qr_code: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connectionId);

        return new Response(
          JSON.stringify({
            success: true,
            alreadyConnected: true,
            message: "Instância já está conectada",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "QR code não disponível na resposta da Z-API",
          details: zapiResult,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar conexão com novo QR code
    const { error: updateError } = await supabase
      .from("connections")
      .update({
        status: "qr",
        qr_code: qrCode,
        updated_at: new Date().toISOString(),
        metadata: zapiResult,
      })
      .eq("id", connectionId);

    if (updateError) {
      console.error("❌ Error updating connection:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Erro ao atualizar conexão no banco de dados",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ QR code refreshed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        qrCode: qrCode,
        instanceName: connection.instance_name,
        message: "QR code atualizado com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error refreshing Z-API QR code:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
