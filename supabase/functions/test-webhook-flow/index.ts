import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    console.log('🧪 Testing webhook flow for workspace:', workspaceId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get a connection for this workspace
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('instance_name')
      .eq('workspace_id', workspaceId)
      .limit(1)
      .single();

    if (connectionError || !connection) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No connection found for this workspace'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create a test message payload
    const testPayload = {
      event: 'messages.upsert',
      instance: connection.instance_name,
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: `TEST_${Date.now()}`
        },
        pushName: 'Test Contact',
        message: {
          conversation: '🧪 Esta é uma mensagem de teste do sistema de diagnóstico'
        },
        messageType: 'conversation',
        messageTimestamp: Math.floor(Date.now() / 1000),
        instanceId: connection.instance_name,
        source: 'test'
      },
      destination: Deno.env.get('SUPABASE_URL'),
      date_time: new Date().toISOString(),
      sender: connection.instance_name,
      server_url: Deno.env.get('SUPABASE_URL'),
      apikey: 'test'
    };

    console.log('📨 Sending test payload to evolution-webhook-v2...');

    // Send to evolution-webhook-v2
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook-v2`;
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify(testPayload)
    });

    const webhookResult = await webhookResponse.json();
    
    console.log('✅ Webhook response:', webhookResponse.status, webhookResult);

    // Wait a bit for logs to be saved
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check webhook logs
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Check if test message was saved
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .ilike('content', '%teste do sistema de diagnóstico%')
      .order('created_at', { ascending: false })
      .limit(1);

    return new Response(JSON.stringify({
      success: true,
      test_payload: testPayload,
      webhook_response: {
        status: webhookResponse.status,
        result: webhookResult
      },
      recent_logs: logs,
      test_message_saved: messages && messages.length > 0,
      message_details: messages?.[0],
      summary: {
        webhook_received: webhookResponse.ok,
        logged_to_database: logs && logs.length > 0,
        forwarded_to_n8n: webhookResult.message?.includes('forwarded') || false,
        message_created: messages && messages.length > 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in test-webhook-flow:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
