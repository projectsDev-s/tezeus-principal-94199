import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-force-queue-history',
};

serve(async (req) => {
  console.log('🔄 [update-conversation-queue] Iniciando requisição');
  console.log('📝 Method:', req.method);
  console.log('🌐 Origin:', req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Retornando headers CORS para OPTIONS');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('📦 Body recebido:', JSON.stringify(body, null, 2));
    
    const { 
      conversation_id, 
      queue_id, 
      assigned_user_id,
      activate_queue_agent = true // Por padrão, ativar o agente da fila
    } = body;

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🔧 [update-conversation-queue] Atualizando conversa ${conversation_id}`);
    console.log(`📋 Queue ID: ${queue_id || 'não especificado'}`);
    console.log(`👤 Assigned User: ${assigned_user_id || 'não especificado'}`);
    console.log(`🤖 Ativar agente da fila? ${activate_queue_agent}`);

    // Buscar estado atual da conversa para registrar histórico
    const { data: currentConversation, error: fetchError } = await supabase
      .from('conversations')
      .select('queue_id, assigned_user_id')
      .eq('id', conversation_id)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar conversa atual:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar conversa', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const previousQueueId = currentConversation?.queue_id;
    const previousUserId = currentConversation?.assigned_user_id;
    
    console.log(`📋 Estado atual da conversa:`);
    console.log(`   • previousQueueId: ${previousQueueId}`);
    console.log(`   • previousUserId: ${previousUserId}`);
    console.log(`   • novo queue_id: ${queue_id}`);
    console.log(`   • novo assigned_user_id: ${assigned_user_id}`);

    const updateData: any = {};

    // Atualizar queue_id (inclusive null para remover)
    if (queue_id !== undefined) {
      updateData.queue_id = queue_id;

      if (queue_id) {
        // Buscar detalhes da fila para obter o agente
        if (activate_queue_agent) {
          const { data: queueData, error: queueError } = await supabase
            .from('queues')
            .select('ai_agent_id, name')
            .eq('id', queue_id)
            .single();

          if (queueError) {
            console.error('❌ Erro ao buscar fila:', queueError);
          } else if (queueData) {
            console.log(`✅ Fila encontrada: ${queueData.name}`);
            
            if (queueData.ai_agent_id) {
              updateData.agent_active_id = queueData.ai_agent_id;
              updateData.agente_ativo = true;
              console.log(`🤖 Ativando agente da fila: ${queueData.ai_agent_id}`);
            } else {
              updateData.agente_ativo = false;
              updateData.agent_active_id = null;
              console.log(`⚠️ Fila não tem agente - desativando agente atual`);
            }
          }
        }
      } else {
        // queue_id é null - remover fila e desativar agente
        updateData.agent_active_id = null;
        updateData.agente_ativo = false;
        console.log(`🗑️ Removendo fila e desativando agente`);
      }
    }

    // Atualizar assigned_user_id (inclusive null para remover)
    if (assigned_user_id !== undefined) {
      updateData.assigned_user_id = assigned_user_id;
      if (assigned_user_id) {
        updateData.assigned_at = new Date().toISOString();
        console.log(`👤 Atribuindo responsável: ${assigned_user_id}`);
      } else {
        console.log(`🗑️ Removendo responsável`);
      }
    }

    // Executar atualização
    const { data: updatedConversation, error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversation_id)
      .select('id, queue_id, assigned_user_id, agent_active_id, agente_ativo')
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar conversa:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar conversa', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Conversa atualizada com sucesso:', updatedConversation);

    // Obter current_system_user_id do header ou usar null
    const systemUserId = req.headers.get('x-system-user-id') || null;
    const forceQueueHistory = req.headers.get('x-force-queue-history') === 'true';

    // Registrar histórico de transferência de fila se queue_id mudou OU se forçado
    console.log(`🔍 Verificando se deve registrar histórico de fila:`);
    console.log(`   • queue_id !== undefined: ${queue_id !== undefined}`);
    console.log(`   • previousQueueId: ${previousQueueId}`);
    console.log(`   • queue_id: ${queue_id}`);
    console.log(`   • previousQueueId !== queue_id: ${previousQueueId !== queue_id}`);
    console.log(`   • forceQueueHistory: ${forceQueueHistory}`);
    
    if (queue_id !== undefined && (previousQueueId !== queue_id || forceQueueHistory)) {
      console.log(`📝 ✅ Registrando transferência de fila: ${previousQueueId} → ${queue_id}`);
      
      const { error: queueHistoryError } = await supabase
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation_id,
          action: 'queue_transfer',
          from_queue_id: previousQueueId,
          to_queue_id: queue_id,
          changed_by: systemUserId,
          changed_at: new Date().toISOString()
        });

      if (queueHistoryError) {
        console.error('⚠️ Erro ao registrar histórico de fila (não-bloqueante):', queueHistoryError);
      } else {
        console.log('✅ Histórico de transferência de fila registrado com sucesso');
      }
    } else {
      console.log(`⏭️ Não registrar histórico de fila (condição não satisfeita)`);
    }

    // Registrar histórico de mudança de responsável se assigned_user_id mudou
    if (assigned_user_id !== undefined && previousUserId !== assigned_user_id) {
      console.log(`📝 Registrando mudança de responsável: ${previousUserId} → ${assigned_user_id}`);
      
      const action = previousUserId ? 'transfer' : 'assign';
      const { error: userHistoryError } = await supabase
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation_id,
          action: action,
          from_assigned_user_id: previousUserId,
          to_assigned_user_id: assigned_user_id,
          changed_by: systemUserId,
          changed_at: new Date().toISOString()
        });

      if (userHistoryError) {
        console.error('⚠️ Erro ao registrar histórico de responsável (não-bloqueante):', userHistoryError);
      } else {
        console.log('✅ Histórico de mudança de responsável registrado');
      }
    }

    // Registrar no histórico de agente se mudou
    if (updateData.agent_active_id) {
      const { error: historyError } = await supabase
        .from('conversation_agent_history')
        .insert({
          conversation_id: conversation_id,
          agent_id: updateData.agent_active_id,
          agent_name: 'Agente da Fila',
          action: 'activated',
          changed_by: assigned_user_id || null,
          metadata: { 
            queue_id,
            reason: 'Transferência de negócio com mudança de fila'
          }
        });

      if (historyError) {
        console.error('⚠️ Erro ao registrar histórico de agente (não-bloqueante):', historyError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation: updatedConversation,
        message: 'Conversa atualizada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no update-conversation-queue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
