import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { conversationId, testMessage = "🧪 Teste de status de mensagem" } = await req.json();
    
    console.log(`🧪 Starting webhook status flow test for conversation: ${conversationId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar informações da conversa
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        workspace_id,
        contact:contacts(phone, name),
        connection:connections(
          id,
          instance_name,
          connection_secrets(token, evolution_url)
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Conversation not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const contact = Array.isArray(conversation.contact)
      ? conversation.contact[0]
      : conversation.contact;

    const connection = Array.isArray(conversation.connection) 
      ? conversation.connection[0] 
      : conversation.connection;

    const secrets = Array.isArray(connection.connection_secrets)
      ? connection.connection_secrets[0]
      : connection.connection_secrets;

    if (!secrets?.token || !secrets?.evolution_url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Connection credentials not found'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Criar mensagem de teste no banco
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        workspace_id: conversation.workspace_id,
        content: testMessage,
        message_type: 'text',
        sender_type: 'agent',
        status: 'sending',
        direction: 'outbound'
      })
      .select()
      .single();

    if (msgError || !newMessage) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create test message'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📝 Test message created: ${newMessage.id}`);

    // Enviar mensagem via Evolution API
    const sendPayload = {
      number: contact.phone,
      text: testMessage
    };

    console.log(`📤 Sending test message via Evolution API to ${contact.phone}`);

    const sendResponse = await fetch(
      `${secrets.evolution_url}/message/sendText/${connection.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': secrets.token
        },
        body: JSON.stringify(sendPayload)
      }
    );

    const sendResult = await sendResponse.json();
    console.log(`📥 Evolution send response:`, sendResult);

    // Atualizar mensagem com external_id
    if (sendResult.key?.id) {
      await supabase
        .from('messages')
        .update({ 
          external_id: sendResult.key.id,
          status: 'sent'
        })
        .eq('id', newMessage.id);
    }

    // Aguardar webhooks de status (5 segundos)
    console.log(`⏳ Waiting 5 seconds for status webhooks...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verificar updates recebidos
    const { data: updatedMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('id', newMessage.id)
      .single();

    // Buscar logs de webhook
    const { data: webhookLogs } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('workspace_id', conversation.workspace_id)
      .gte('created_at', new Date(Date.now() - 10000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    const receivedUpdates = webhookLogs?.filter(log => 
      log.event_type === 'messages.update' || 
      log.event_type === 'send.message'
    ) || [];

    const diagnosis = {
      test_successful: true,
      message_sent: !!sendResult.key?.id,
      message_id: newMessage.id,
      external_id: sendResult.key?.id,
      initial_status: 'sending',
      current_status: updatedMessage?.status,
      status_updates_received: receivedUpdates.length,
      webhook_events_received: receivedUpdates.map(log => ({
        event_type: log.event_type,
        status: log.status,
        created_at: log.created_at
      })),
      evolution_response: sendResult,
      recommendations: [] as string[]
    };

    // Diagnóstico e recomendações
    if (receivedUpdates.length === 0) {
      diagnosis.recommendations.push('❌ Nenhum webhook de status foi recebido. Verifique a configuração do webhook na instância Evolution.');
      diagnosis.recommendations.push('💡 Execute a reconfiguração de webhooks para esta instância.');
    } else if (receivedUpdates.length === 1) {
      diagnosis.recommendations.push('⚠️ Apenas 1 webhook recebido. Esperado: send.message + messages.update');
    } else {
      diagnosis.recommendations.push('✅ Webhooks de status estão sendo recebidos corretamente!');
    }

    if (updatedMessage?.status === 'sending') {
      diagnosis.recommendations.push('⚠️ Status da mensagem não foi atualizado. Verifique se messages.update está configurado.');
    }

    console.log(`✅ Test completed. Updates received: ${receivedUpdates.length}`);

    return new Response(JSON.stringify(diagnosis), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in test-webhook-status-flow:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
