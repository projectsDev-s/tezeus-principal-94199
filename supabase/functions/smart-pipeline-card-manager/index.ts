import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      contactId, 
      conversationId, 
      workspaceId,
      pipelineId 
    } = await req.json();

    console.log('🎯 Smart Pipeline Card Manager - Início', { 
      contactId, 
      conversationId, 
      workspaceId,
      pipelineId 
    });

    // 1. Buscar informações do contato
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, phone, email')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      console.error('❌ Contato não encontrado:', contactError);
      return new Response(
        JSON.stringify({ error: 'Contato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validar identificador do contato (phone > email)
    const identifier = contact.phone || contact.email;
    if (!identifier) {
      console.warn('⚠️ Contato sem identificador válido (phone ou email)');
      return new Response(
        JSON.stringify({ 
          error: 'Contato sem identificador válido',
          message: 'Por favor, adicione telefone ou email ao contato'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Determinar o pipeline a usar
    let targetPipelineId = pipelineId;
    
    if (!targetPipelineId) {
      // Buscar o primeiro pipeline ativo do workspace
      const { data: pipelines, error: pipelineError } = await supabase
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('created_at')
        .limit(1);

      if (pipelineError || !pipelines || pipelines.length === 0) {
        console.error('❌ Nenhum pipeline ativo encontrado:', pipelineError);
        return new Response(
          JSON.stringify({ error: 'Nenhum pipeline ativo encontrado no workspace' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetPipelineId = pipelines[0].id;
    }

    console.log('📋 Pipeline alvo:', targetPipelineId);

    // 4. Permitir múltiplos cards por contato em pipelines diferentes
    // Apenas verificar se já existe card ABERTO neste pipeline específico
    const { data: existingCards, error: searchError } = await supabase
      .from('pipeline_cards')
      .select('id, title, description, responsible_user_id, updated_at')
      .eq('contact_id', contactId)
      .eq('pipeline_id', targetPipelineId)
      .eq('status', 'aberto');

    if (searchError) {
      console.error('❌ Erro ao buscar cards existentes:', searchError);
    }

    // Se encontrou card existente NO MESMO PIPELINE, atualizar
    if (existingCards && existingCards.length > 0) {
      const existingCard = existingCards[0];
      console.log('✅ Card existente encontrado no mesmo pipeline:', existingCard.id);

      // Buscar usuário responsável da conversa (se houver)
      let responsibleUserId = existingCard.responsible_user_id;
      
      if (conversationId) {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('assigned_user_id')
          .eq('id', conversationId)
          .single();

        if (conversation?.assigned_user_id) {
          responsibleUserId = conversation.assigned_user_id;
        }
      }

      // Atualizar card existente com nova informação
      const timestamp = new Date().toLocaleString('pt-BR');
      const newDescription = existingCard.description 
        ? `${existingCard.description}\n\n[${timestamp}] Nova interação registrada`
        : `[${timestamp}] Card atualizado automaticamente`;

      const { data: updatedCard, error: updateError } = await supabase
        .from('pipeline_cards')
        .update({
          description: newDescription,
          responsible_user_id: responsibleUserId,
          conversation_id: conversationId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCard.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Erro ao atualizar card:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar card existente' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Card atualizado com sucesso:', updatedCard);
      
      return new Response(
        JSON.stringify({ 
          card: updatedCard,
          action: 'updated',
          message: 'Card existente atualizado com nova interação'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Se não existe card neste pipeline, criar um novo
    console.log('📝 Criando novo card para este pipeline...');
    console.log('📝 Criando novo card...');

    // Buscar primeira coluna do pipeline
    const { data: columns, error: columnsError } = await supabase
      .from('pipeline_columns')
      .select('id')
      .eq('pipeline_id', targetPipelineId)
      .order('order_position')
      .limit(1);

    if (columnsError || !columns || columns.length === 0) {
      console.error('❌ Nenhuma coluna encontrada:', columnsError);
      return new Response(
        JSON.stringify({ error: 'Pipeline sem colunas configuradas' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar responsável da conversa
    let responsibleUserId = null;
    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('assigned_user_id')
        .eq('id', conversationId)
        .single();

      if (conversation?.assigned_user_id) {
        responsibleUserId = conversation.assigned_user_id;
      }
    }

    // Criar card
    const cardTitle = contact.name || contact.phone || contact.email || 'Contato sem nome';
    const timestamp = new Date().toLocaleString('pt-BR');
    
    const { data: newCard, error: createError } = await supabase
      .from('pipeline_cards')
      .insert({
        pipeline_id: targetPipelineId,
        column_id: columns[0].id,
        contact_id: contactId,
        conversation_id: conversationId,
        responsible_user_id: responsibleUserId,
        title: cardTitle,
        description: `[${timestamp}] Card criado automaticamente`,
        value: 0,
        status: 'aberto',
        tags: []
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar card:', createError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar novo card', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Card criado com sucesso:', newCard);

    return new Response(
      JSON.stringify({ 
        card: newCard,
        action: 'created',
        message: 'Novo card criado no pipeline'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
