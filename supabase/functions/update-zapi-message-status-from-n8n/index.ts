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

    // ✅ BUSCAR ÚLTIMA MENSAGEM ENVIADA (OUTBOUND) NA CONVERSA
    // Estratégia: buscar a última mensagem enviada, independente do status atual
    // Janela de 5 minutos para capturar callbacks atrasados
    console.log('🔍 Buscando última mensagem enviada da conversa:', conversationId);
    
    const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString(); // 5 minutos
    
    const { data: message, error: searchError } = await supabase
      .from('messages')
      .select('id, external_id, status, delivered_at, read_at, content, created_at, sender_type')
      .eq('conversation_id', conversationId)
      .eq('workspace_id', workspaceId)
      .in('sender_type', ['user', 'agent', 'system']) // Apenas mensagens ENVIADAS
      .gte('created_at', fiveMinutesAgo) // Janela maior
      // ❌ SEM FILTRO DE STATUS - pega qualquer status
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
        .select('id, status, sender_type, created_at, external_id, content')
        .eq('conversation_id', conversationId)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('🔍 Últimas 5 mensagens da conversa:', JSON.stringify(debugAll, null, 2));
      console.log('🔍 Critérios de busca:', {
        conversationId,
        workspaceId,
        janela: '5 minutos',
        sender_types: ['user', 'agent', 'system']
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Mensagem não encontrada',
        debug: {
          search_criteria: {
            conversation_id: conversationId,
            workspace_id: workspaceId,
            time_window: '5 minutes',
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
