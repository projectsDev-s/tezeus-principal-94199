import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
    });
  }

  try {
    const { evolutionUrl, evolutionApiKey, instanceName } = await req.json();

    if (!evolutionUrl || !evolutionApiKey || !instanceName) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters: evolutionUrl, evolutionApiKey, and instanceName are required' 
      }), { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('Configurando webhook...');
    
    const response = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        url: "https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/evolution-webhook-v2",
        webhook_by_events: true,
        webhook_base64: true,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"]
      })
    });

    const result = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', result);

    return new Response(JSON.stringify({
      status: response.status,
      result: result
    }), { 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});