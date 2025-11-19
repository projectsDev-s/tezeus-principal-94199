import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id',
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
