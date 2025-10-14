import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-workspace-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { instanceName, workspaceId } = body;

    if (!instanceName || !workspaceId) {
      return new Response(JSON.stringify({ success: false, error: "instanceName e workspaceId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Evolution config (ajuste para buscar no seu banco se necessário)
    const evolutionUrl = Deno.env.get("EVOLUTION_URL")!;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;

    // Cria registro local da conexão
    const { data: connection, error: insertError } = await supabase
      .from("connections")
      .insert({
        instance_name: instanceName,
        workspace_id: workspaceId,
        status: "creating",
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ success: false, error: "Erro ao criar registro da conexão" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payload simples para Evolution
    const payload = {
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      settings: {
        syncFullHistory: true, // ✅ sempre true, filtro é feito no sistema
      },
      webhook: {
        url: `${supabaseUrl}/functions/v1/evolution-webhook-v2`,
        headers: {
          apikey: connection.id,
        },
        events: [
          "MESSAGES_UPDATE",
          "MESSAGES_UPSERT",
          "QRCODE_UPDATED",
          "CONNECTION_UPDATE",
          "CONTACTS_UPSERT",
          "CONTACTS_UPDATE",
        ],
      },
    };

    const fullUrl = `${evolutionUrl}/instance/create`;
    const evolutionResponse = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionApiKey,
      },
      body: JSON.stringify(payload),
    });

    const evolutionData = await evolutionResponse.json();

    // Atualiza registro com status/QR
    const updateData: any = {
      metadata: evolutionData,
    };

    if (evolutionData?.instance?.qrcode?.base64) {
      updateData.status = "qr";
      updateData.qr_code = `data:image/png;base64,${evolutionData.instance.qrcode.base64}`;
    } else if (evolutionData?.instance?.state === "open") {
      updateData.status = "connected";
      updateData.phone_number = evolutionData.instance?.owner;
    }

    await supabase.from("connections").update(updateData).eq("id", connection.id);

    return new Response(JSON.stringify({ success: true, connection: { ...connection, ...updateData } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
