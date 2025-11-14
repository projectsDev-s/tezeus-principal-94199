import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`🔥 [${id}] Z-API WEBHOOK - Method: ${req.method}`);

  try {
    const data = await req.json();
    console.log(`📦 [${id}] Data:`, JSON.stringify(data, null, 2));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Z-API pode enviar instanceName OU instanceId
    const instanceName = data.instanceName || data.instance || data.instanceId;
    
    if (!instanceName) {
      console.error(`❌ [${id}] No instance identifier found in payload`);
      return new Response(
        JSON.stringify({ success: false, error: "No instance name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📍 [${id}] Looking for instance: ${instanceName}`);

    // Buscar conexão pelo instance_name OU instance_id (para Z-API)
    const { data: conn, error: connError } = await supabase
      .from("connections")
      .select("*, provider:whatsapp_providers!connections_provider_id_fkey(n8n_webhook_url)")
      .or(`instance_name.eq.${instanceName},metadata->>instanceId.eq.${instanceName}`)
      .maybeSingle();

    if (connError) {
      console.error(`❌ [${id}] Database error:`, connError);
    }

    if (!conn) {
      console.error(`❌ [${id}] Connection not found for instance: ${instanceName}`);
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${id}] Connection: ${conn.id}, Workspace: ${conn.workspace_id}, Instance Name: ${conn.instance_name}`);

    const n8nUrl = conn.provider?.n8n_webhook_url;
    
    if (n8nUrl) {
      console.log(`🚀 [${id}] Forwarding to: ${n8nUrl}`);
      
      // Extrair external_id do messageId do Z-API
      const externalId = data.messageId || data.id || null;
      
      fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: data.event || data.type || 'UNKNOWN',
          provider: 'zapi',
          instance_name: conn.instance_name, // ✅ Usar o instance_name da conexão, não o instanceId do payload
          workspace_id: conn.workspace_id,
          connection_id: conn.id,
          external_id: externalId,
          timestamp: new Date().toISOString(),
          webhook_data: data
        })
      })
        .then(r => console.log(`✅ [${id}] N8N: ${r.status}`))
        .catch(e => console.error(`❌ [${id}] N8N error:`, e));
    } else {
      console.warn(`⚠️ [${id}] No N8N webhook URL configured for this provider`);
    }

    return new Response(
      JSON.stringify({ success: true, id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`❌ [${id}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
