import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { evolutionUrl, evolutionApiKey, instanceName } = await req.json();

    if (!evolutionUrl || !evolutionApiKey || !instanceName) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Missing required parameters: evolutionUrl, evolutionApiKey, and instanceName are required' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🧪 Test webhook config started');
    console.log(`🔧 Instance: ${instanceName}`);
    console.log(`🔗 Evolution URL: ${evolutionUrl}`);
    
    const webhookUrl = 'https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/evolution-webhook-v2';
    
    console.log(`🔧 Configuring webhook for instance: ${instanceName}`);
    console.log(`🔗 Webhook URL: ${webhookUrl}`);
    
    const response = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: true,
        webhook_base64: true,
        events: [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE', 
          'MESSAGES_UPSERT'
        ]
      })
    });

    const result = await response.text();
    console.log(`📊 Evolution API response status: ${response.status}`);
    console.log(`📊 Evolution API response: ${result}`);

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      response: result,
      message: response.ok ? 'Webhook configurado corretamente para evolution-webhook-v2' : 'Erro ao configurar webhook'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});