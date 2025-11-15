import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
      phone,
      connection_id: connectionId
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

    // ⚠️ EXIGIR phone E connection_id (chave de busca mais estável)
    if (!phone || !connectionId) {
      console.error('❌ phone e connection_id são OBRIGATÓRIOS!');
      console.log('💡 AÇÃO NECESSÁRIA: Configure o N8N Function Node para enviar:');
      console.log('   phone: $json.phone');
      console.log('   connection_id: $json.connection_id');
      
      return new Response(JSON.stringify({
        success: false,
        error: 'phone e connection_id são obrigatórios',
        action_required: 'Configure o N8N para enviar phone e connection_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalizar status
    const normalizedStatus = rawStatus === 'received' ? 'delivered' : rawStatus.toLowerCase();
    console.log('📊 Status:', rawStatus, '->', normalizedStatus);

    // ✅ BUSCAR ÚLTIMA MENSAGEM ENVIADA PARA ESSE TELEFONE/CONEXÃO
    // Estratégia: buscar pela última mensagem enviada para aquele phone + connection
    // Porque phone + connection_id são mais estáveis que conversation_id
    console.log('🔍 Buscando última mensagem enviada:', { phone, connectionId, workspaceId });
    
    // Primeiro, buscar a conversa desse telefone nessa conexão
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('connection_id', connectionId)
      .eq('contact_id', (await supabase
        .from('contacts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('phone', phone)
        .single()
      ).data?.id)
      .single();
    
    if (!conversation) {
      console.error('❌ Conversa não encontrada para phone:', phone);
      return new Response(JSON.stringify({
        success: false,
        error: 'Conversa não encontrada'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { data: message, error: searchError } = await supabase
      .from('messages')
      .select('id, external_id, status, delivered_at, read_at, content, created_at, sender_type, conversation_id')
      .eq('conversation_id', conversation.id)
      .eq('workspace_id', workspaceId)
      .in('sender_type', ['user', 'agent', 'system']) // Apenas mensagens ENVIADAS
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
      
      // Debug completo: mostrar últimas 5 mensagens
      const { data: debugAll } = await supabase
        .from('messages')
        .select('id, status, sender_type, created_at, external_id, content, conversation_id')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('🔍 Últimas 10 mensagens do workspace:', JSON.stringify(debugAll, null, 2));
      console.log('🔍 Critérios de busca:', {
        phone,
        connectionId,
        workspaceId,
        conversation_id: conversation?.id,
        strategy: 'Última mensagem outbound por phone + connection',
        sender_types: ['user', 'agent', 'system']
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Mensagem não encontrada',
        debug: {
          search_criteria: {
            phone,
            connection_id: connectionId,
            workspace_id: workspaceId,
            conversation_id: conversation?.id,
            strategy: 'Última mensagem outbound por phone + connection',
            sender_types: ['user', 'agent', 'system']
          },
          last_messages: debugAll
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log detalhado da mensagem encontrada
    const ageSeconds = Math.floor((Date.now() - new Date(message.created_at).getTime()) / 1000);
    console.log('✅ Mensagem encontrada:', {
      id: message.id,
      external_id: message.external_id,
      current_status: message.status,
      sender_type: message.sender_type,
      created_at: message.created_at,
      age_seconds: ageSeconds,
      will_update_to: normalizedStatus
    });

    // Hierarquia de status: sending < sent < delivered < read
    const statusHierarchy: Record<string, number> = {
      'sending': 1,
      'sent': 2,
      'delivered': 3,
      'read': 4
    };

    const currentLevel = statusHierarchy[message.status] || 0;
    const newLevel = statusHierarchy[normalizedStatus] || 0;

    if (newLevel <= currentLevel) {
      console.log('⏩ Status não precisa ser atualizado:', {
        current: message.status,
        new: normalizedStatus,
        currentLevel,
        newLevel,
        reason: 'Status atual é igual ou superior'
      });
      
      return new Response(JSON.stringify({
        success: true,
        action: 'skipped',
        reason: 'Status já está atualizado ou superior',
        data: {
          id: message.id,
          status: message.status,
          delivered_at: message.delivered_at,
          read_at: message.read_at
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    console.log('🔄 Atualizando status:', {
      message_id: message.id,
      from: message.status,
      to: normalizedStatus,
      fields: Object.keys(updateData)
    });

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

    console.log('✅✅✅ STATUS ATUALIZADO COM SUCESSO:', {
      message_id: updated.id,
      old_status: message.status,
      new_status: updated.status,
      delivered_at: updated.delivered_at,
      read_at: updated.read_at
    });

    return new Response(JSON.stringify({
      success: true,
      action: 'updated',
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
