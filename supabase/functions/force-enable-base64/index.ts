import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceName } = await req.json();

    if (!instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Instance name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionUrl = Deno.env.get('EVOLUTION_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!evolutionUrl || !evolutionApiKey || !supabaseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔧 Forcing base64 enable for instance: ${instanceName}`);

    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook-v2`;

    // Atualizar configurações do webhook com base64 explicitamente habilitado
    const response = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: true,
        webhook_base64: true,  // ✅ FORÇA ativação do base64
        events: [
          'MESSAGES_UPDATE',
          'MESSAGES_UPSERT',
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Evolution API error: ${response.status}`,
          details: errorText 
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('✅ Base64 enabled successfully:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error enabling base64:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
