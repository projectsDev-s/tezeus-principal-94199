import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('🔄 [Z-API Status] Payload recebido:', JSON.stringify(payload, null, 2));

    const { 
      workspace_id: workspaceId, 
      status: rawStatus, 
      conversation_id: conversationId 
    } = payload;

    // Validações
    if (!workspaceId || !rawStatus) {
      return new Response(JSON.stringify({ 
        error: 'workspace_id e status são obrigatórios' 
      }), {
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ⚠️ EXIGIR conversation_id (fundamental para Z-API)
    if (!conversationId) {
      console.error('❌ conversation_id é OBRIGATÓRIO!');
      console.log('💡 AÇÃO NECESSÁRIA: Configure o N8N Function Node para enviar:');
      console.log('   conversation_id: $json.processed_data?.conversation?.id');
      
      return new Response(JSON.stringify({
        success: false,
        error: 'conversation_id é obrigatório',
        action_required: 'Configure o N8N para enviar conversation_id',
        example: 'conversation_id: $json.processed_data?.conversation?.id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalizar status
    const normalizedStatus = rawStatus === 'received' ? 'delivered' : rawStatus.toLowerCase();
    console.log('📊 Status:', rawStatus, '->', normalizedStatus);

    // ✅ BUSCAR MENSAGEM RECENTE DA CONVERSA
    // Não usamos external_id porque Z-API retorna IDs diferentes no envio vs webhook
    console.log('🔍 Buscando última mensagem enviada da conversa:', conversationId);
    
    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
    
    const { data: message, error: searchError } = await supabase
      .from('messages')
      .select('id, external_id, status, delivered_at, read_at, content, created_at')
      .eq('conversation_id', conversationId)
      .eq('workspace_id', workspaceId)
      .in('sender_type', ['user', 'agent', 'system'])
      .in('status', ['sending', 'sent'])
      .gte('created_at', twoMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (searchError) {
      console.error('❌ Erro na busca:', searchError);
      return new Response(JSON.stringify({
        success: false,
        error: searchError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!message) {
      console.warn('⚠️ Nenhuma mensagem encontrada');
      
      // Debug: mostrar últimas mensagens
      const { data: debug } = await supabase
        .from('messages')
        .select('id, status, sender_type, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(3);
      
      console.log('🔍 Últimas mensagens da conversa:', debug);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Mensagem não encontrada',
        debug_info: debug
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Mensagem encontrada:', {
      id: message.id,
      current_status: message.status,
      will_update_to: normalizedStatus
    });

    // Preparar update
    const updateData: any = { status: normalizedStatus };

    if (normalizedStatus === 'delivered' && !message.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }
    
    if (normalizedStatus === 'read') {
      updateData.read_at = new Date().toISOString();
      if (!message.delivered_at) {
        updateData.delivered_at = new Date().toISOString();
      }
    }

    console.log('🔄 Atualizando:', updateData);

    // Atualizar
    const { data: updated, error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', message.id)
      .select('id, status, delivered_at, read_at')
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError);
      return new Response(JSON.stringify({
        success: false,
        error: updateError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅✅✅ ATUALIZADO COM SUCESSO:', updated);

    return new Response(JSON.stringify({
      success: true,
      data: updated
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
