import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    
    console.log('🔄 [update-zapi-message-status] Recebido do N8N:', JSON.stringify(payload, null, 2));

    const { workspace_id, connection_id, status, external_id, timestamp, phone, conversation_id } = payload;

    // Validações básicas
    if (!workspace_id || !external_id || !status) {
      console.error('❌ [update-zapi-message-status] Dados obrigatórios faltando:', { workspace_id, external_id, status });
      return new Response(
        JSON.stringify({ error: 'workspace_id, external_id e status são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar status
    const normalizedStatus = status.toLowerCase();
    console.log('📊 [update-zapi-message-status] Status normalizado:', normalizedStatus);

    // 🎯 ESTRATÉGIA: Primeiro descobrir o conversation_id se não foi fornecido
    let discoveredConversationId = conversation_id;

    if (!discoveredConversationId && connection_id && phone) {
      console.log('🔍 [update-zapi-message-status] Descobrindo conversation_id via connection + phone');
      
      // Buscar contato pelo phone
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('phone', phone)
        .maybeSingle();

      if (contact) {
        // Buscar conversa do contato nesta conexão
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('workspace_id', workspace_id)
          .eq('contact_id', contact.id)
          .eq('connection_id', connection_id)
          .maybeSingle();

        if (conversation) {
          discoveredConversationId = conversation.id;
          console.log('✅ [update-zapi-message-status] conversation_id descoberto:', discoveredConversationId);
        }
      }
    }

    // Buscar mensagem pelo external_id ou evolution_key_id
    console.log('🔍 [update-zapi-message-status] Buscando mensagem - external_id:', external_id, 'conversation_id:', discoveredConversationId);
    
    // Primeira tentativa: buscar por external_id
    let { data: message, error: findError } = await supabase
      .from('messages')
      .select('id, status, delivered_at, read_at, conversation_id')
      .eq('workspace_id', workspace_id)
      .eq('external_id', external_id)
      .maybeSingle();

    // Segunda tentativa: buscar por evolution_key_id (caso Z-API use esse campo)
    if (!message && external_id) {
      console.log('🔍 [update-zapi-message-status] Tentando buscar por evolution_key_id:', external_id);
      const { data: msg2 } = await supabase
        .from('messages')
        .select('id, status, delivered_at, read_at, conversation_id')
        .eq('workspace_id', workspace_id)
        .eq('evolution_key_id', external_id)
        .maybeSingle();
      
      if (msg2) message = msg2;
    }

    // Terceira tentativa: buscar mensagem recente na conversa (usando conversation_id descoberto)
    if (!message && discoveredConversationId) {
      console.log('🔍 [update-zapi-message-status] Buscando mensagem recente por conversation_id:', discoveredConversationId);
      
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: msg3 } = await supabase
        .from('messages')
        .select('id, status, delivered_at, read_at, conversation_id')
        .eq('workspace_id', workspace_id)
        .eq('conversation_id', discoveredConversationId)
        .eq('sender_type', 'user')
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (msg3) {
        console.log('✅ [update-zapi-message-status] Mensagem encontrada por conversation_id');
        message = msg3;
      }
    }

    if (!message) {
      console.warn('⚠️ [update-zapi-message-status] Mensagem não encontrada após todas as tentativas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Mensagem não encontrada - pode ser que ainda não tenha sido salva no banco',
          details: { external_id, phone, workspace_id, connection_id, discoveredConversationId }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [update-zapi-message-status] Mensagem encontrada:', {
      id: message.id,
      currentStatus: message.status,
      newStatus: normalizedStatus
    });

    // Preparar dados para atualização
    const updateData: any = {
      status: normalizedStatus
    };

    // Atualizar timestamps apropriados
    if (normalizedStatus === 'delivered' && !message.delivered_at) {
      updateData.delivered_at = timestamp || new Date().toISOString();
      console.log('📅 [update-zapi-message-status] Definindo delivered_at:', updateData.delivered_at);
    }

    if (normalizedStatus === 'read' && !message.read_at) {
      updateData.read_at = timestamp || new Date().toISOString();
      // Se lida, também deve estar entregue
      if (!message.delivered_at) {
        updateData.delivered_at = timestamp || new Date().toISOString();
      }
      console.log('📅 [update-zapi-message-status] Definindo read_at:', updateData.read_at);
    }

    // Atualizar mensagem
    console.log('🔄 [update-zapi-message-status] Atualizando mensagem:', updateData);
    
    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', message.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [update-zapi-message-status] Erro ao atualizar:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar mensagem', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [update-zapi-message-status] Mensagem atualizada com sucesso:', {
      id: updatedMessage.id,
      status: updatedMessage.status,
      delivered_at: updatedMessage.delivered_at,
      read_at: updatedMessage.read_at
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Status atualizado com sucesso',
        data: updatedMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [update-zapi-message-status] Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
