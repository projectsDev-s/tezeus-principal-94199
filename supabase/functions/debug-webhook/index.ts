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

    console.log('Verificando instância...');
    
    // Primeiro vamos verificar se a instância existe
    const checkResponse = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey
      }
    });

    const instances = await checkResponse.text();
    console.log('Instâncias disponíveis:', instances);

    // Agora vamos tentar configurar via settings
    console.log('Configurando webhook via settings...');
    
    const settingsResponse = await fetch(`${evolutionUrl}/settings/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        webhook: {
          url: "https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/evolution-webhook-v2",
          webhook_by_events: true,
          webhook_base64: true,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"]
        }
      })
    });

    const settingsResult = await settingsResponse.text();
    console.log('Settings Status:', settingsResponse.status);
    console.log('Settings Response:', settingsResult);

    return new Response(JSON.stringify({
      instances: instances,
      settings_status: settingsResponse.status,
      settings_result: settingsResult
    }), { 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: (error as Error).message || 'Unknown error' }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});