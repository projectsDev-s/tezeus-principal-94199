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

  console.log('🚀 [Message Automations] Function invoked');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contactId, conversationId, workspaceId, phoneNumber } = await req.json();

    console.log('🔍 [Message Automations] Verificando automações de mensagens recebidas:', {
      contactId,
      conversationId,
      workspaceId,
      phoneNumber
    });

    // 1. Buscar card ativo do contato
    const { data: cards, error: cardsError } = await supabase
      .from('pipeline_cards')
      .select(`
        id, 
        column_id, 
        pipeline_id, 
        description, 
        conversation_id, 
        contact_id,
        pipelines!inner(workspace_id)
      `)
      .eq('contact_id', contactId)
      .eq('pipelines.workspace_id', workspaceId)
      .eq('status', 'aberto')
      .order('created_at', { ascending: false });

    if (cardsError) {
      console.error('❌ Erro ao buscar cards:', cardsError);
      return new Response(JSON.stringify({ error: cardsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!cards || cards.length === 0) {
      console.log('ℹ️ Nenhum card ativo encontrado para o contato');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active cards found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Encontrado(s) ${cards.length} card(s) ativo(s)`);

    // 2. Para cada card, verificar automações da coluna
    for (const card of cards) {
      console.log(`\n🔍 Verificando automações para card ${card.id} na coluna ${card.column_id}`);

      // Buscar automações da coluna
      const { data: automations, error: automationsError } = await supabase
        .rpc('get_column_automations', { p_column_id: card.column_id });

      if (automationsError) {
        console.error('❌ Erro ao buscar automações:', automationsError);
        continue;
      }

      if (!automations || automations.length === 0) {
        console.log('ℹ️ Nenhuma automação encontrada nesta coluna');
        continue;
      }

      console.log(`✅ ${automations.length} automação(ões) encontrada(s)`);

      // 3. Filtrar automações com trigger "message_received"
      for (const automation of automations) {
        if (!automation.is_active) {
          console.log(`⏭️ Automação "${automation.name}" está inativa`);
          continue;
        }

        // Buscar triggers
        const { data: triggers } = await supabase
          .from('crm_column_automation_triggers')
          .select('*')
          .eq('automation_id', automation.id);

        // Buscar actions
        const { data: actions } = await supabase
          .from('crm_column_automation_actions')
          .select('*')
          .eq('automation_id', automation.id)
          .order('action_order', { ascending: true });

        // Verificar se tem trigger message_received
        const messageReceivedTrigger = triggers?.find(
          (t: any) => t.trigger_type === 'message_received'
        );

        if (!messageReceivedTrigger) {
          console.log(`⏭️ Automação "${automation.name}" não tem trigger message_received`);
          continue;
        }

        console.log(`✅ Automação "${automation.name}" com trigger message_received encontrada`);

        // Obter configuração do trigger
        const triggerConfig = messageReceivedTrigger.trigger_config || {};
        const requiredMessageCount = triggerConfig.message_count || 1;
        console.log(`📊 Mensagens necessárias: ${requiredMessageCount}`);

        // Buscar quando o card entrou na coluna atual
        // Primeiro tenta buscar histórico de entrada na coluna
        const { data: cardHistory } = await supabase
          .from('pipeline_card_history')
          .select('changed_at, metadata')
          .eq('card_id', card.id)
          .order('changed_at', { ascending: false });

        let columnEntryDate: string;
        
        // Procurar o último registro onde o card foi movido para a coluna atual
        const columnEntry = cardHistory?.find((h: any) => {
          const metadata = h.metadata || {};
          const newColumnId = metadata.new_column_id || metadata.newColumnId;
          return newColumnId === card.column_id;
        });

        if (columnEntry) {
          columnEntryDate = columnEntry.changed_at;
          console.log('✅ Histórico encontrado - card entrou na coluna em:', columnEntryDate);
        } else {
          // Se não encontrar histórico, usar updated_at do card (última modificação)
          console.log('⚠️ Histórico não encontrado, usando updated_at do card');
          const { data: cardData } = await supabase
            .from('pipeline_cards')
            .select('updated_at')
            .eq('id', card.id)
            .single();
          
          columnEntryDate = cardData?.updated_at || new Date().toISOString();
        }

        console.log(`📅 Card entrou na coluna em: ${columnEntryDate}`);

        // Usar conversation_id do card ou o passado como parâmetro
        const conversationToCheck = card.conversation_id || conversationId;
        
        if (!conversationToCheck) {
          console.log('⚠️ Nenhuma conversa associada ao card - pulando');
          continue;
        }

        // Contar mensagens do contato desde que entrou na coluna
        const { count: messageCount, error: countError } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationToCheck)
          .eq('sender_type', 'contact')
          .gte('created_at', columnEntryDate);

        if (countError) {
          console.error('❌ Erro ao contar mensagens:', countError);
          continue;
        }

        console.log(`📨 Mensagens recebidas desde entrada na coluna: ${messageCount}`);

        // Verificar se atingiu o número necessário de mensagens
        if (!messageCount || messageCount < requiredMessageCount) {
          console.log(`⏭️ Ainda não atingiu ${requiredMessageCount} mensagens (atual: ${messageCount || 0})`);
          continue;
        }

        // 🔒 Verificar se já foi executada NESTA entrada na coluna
        // A automação só pode ser executada UMA VEZ por entrada na coluna
        const { data: existingExecutions, error: existingExecError } = await supabase
          .from('automation_executions')
          .select('id, executed_at')
          .eq('card_id', card.id)
          .eq('column_id', card.column_id)
          .eq('automation_id', automation.id)
          .eq('trigger_type', 'message_received')
          .gte('executed_at', columnEntryDate); // ✅ APENAS execuções após entrada atual

        const executionCount = existingExecutions?.length || 0;
        
        console.log(`📊 Execuções nesta entrada: ${executionCount}`);
        console.log(`📅 Contando apenas execuções após: ${columnEntryDate}`);

        // Apenas uma execução permitida por entrada na coluna
        if (executionCount > 0) {
          console.log(`🚫 Automação "${automation.name}" já foi executada nesta entrada na coluna`);
          continue;
        }

        console.log(`✅ Condições atendidas! Executando automação "${automation.name}" pela primeira vez nesta entrada`);

        // ✅ Registrar execução ANTES de executar ações (evita duplicatas)
        const { error: execError } = await supabase
          .from('automation_executions')
          .insert({
            card_id: card.id,
            column_id: card.column_id,
            automation_id: automation.id,
            trigger_type: 'message_received',
            workspace_id: workspaceId
          });

        if (execError) {
          console.error(`❌ Erro ao registrar execução:`, execError);
          continue; // Pula para próxima automação se não conseguir registrar
        }
        
        console.log(`📝 Execução registrada para automação "${automation.name}"`);
        console.log(`🎬 Executando ${actions?.length || 0} ação(ões)...`);

        // 4. Executar ações
        if (actions && actions.length > 0) {
          for (const action of actions) {
            try {
              await executeAction(action, card, supabase, workspaceId);
            } catch (actionError) {
              console.error(`❌ Erro ao executar ação:`, actionError);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed_cards: cards.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function executeAction(action: any, card: any, supabaseClient: any, workspaceId: string) {
  console.log(`🎬 Executando ação: ${action.action_type}`);

  // Normalizar action_config
  let actionConfig = action.action_config || {};
  if (typeof actionConfig === 'string') {
    try {
      actionConfig = JSON.parse(actionConfig);
    } catch (e) {
      console.warn('⚠️ action_config inválido:', actionConfig);
      actionConfig = {};
    }
  }

  switch (action.action_type) {
    case 'send_message': {
      const messageText = actionConfig.message || '';
      if (!messageText) {
        console.warn('⚠️ send_message sem mensagem configurada');
        return;
      }

      if (!card.conversation_id) {
        console.error('❌ Card sem conversation_id');
        return;
      }

      // Buscar contato
      const { data: contact } = await supabaseClient
        .from('contacts')
        .select('phone')
        .eq('id', card.contact_id)
        .single();

      if (!contact) {
        console.error('❌ Contato não encontrado');
        return;
      }

      // Buscar connection_id da conversa
      const { data: conversation } = await supabaseClient
        .from('conversations')
        .select('connection_id')
        .eq('id', card.conversation_id)
        .single();

      if (!conversation?.connection_id) {
        console.error('❌ Connection não encontrada');
        return;
      }

      console.log(`📤 Enviando mensagem para ${contact.phone}`);

      // Chamar test-send-msg com os campos corretos
      const { error: sendError } = await supabaseClient.functions.invoke('test-send-msg', {
        body: {
          conversation_id: card.conversation_id,
          content: messageText,
          message_type: 'text'
        }
      });

      if (sendError) {
        console.error('❌ Erro ao enviar mensagem:', sendError);
      } else {
        console.log('✅ Mensagem enviada com sucesso');
      }
      break;
    }

    case 'send_funnel': {
      const funnelId = actionConfig.funnel_id;
      if (!funnelId) {
        console.warn('⚠️ send_funnel sem funnel_id configurado');
        return;
      }

      if (!card.conversation_id) {
        console.error('❌ Card sem conversation_id');
        return;
      }

      // Buscar funil
      const { data: funnel } = await supabaseClient
        .from('quick_funnels')
        .select('*')
        .eq('id', funnelId)
        .single();

      if (!funnel) {
        console.error('❌ Funil não encontrado:', funnelId);
        return;
      }

      console.log(`📊 Enviando funil: ${funnel.title}`);

      // Buscar contato
      const { data: contact } = await supabaseClient
        .from('contacts')
        .select('phone')
        .eq('id', card.contact_id)
        .single();

      // Buscar connection_id da conversa
      const { data: conversation } = await supabaseClient
        .from('conversations')
        .select('connection_id')
        .eq('id', card.conversation_id)
        .single();

      if (!contact || !conversation?.connection_id) {
        console.error('❌ Dados insuficientes para enviar funil');
        return;
      }

      // Processar steps do funil
      const steps = funnel.steps || [];
      const sortedSteps = steps.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

      console.log(`📝 Funil tem ${sortedSteps.length} etapa(s)`);

      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        
        // Aplicar delay se não for primeiro item
        if (i > 0 && step.delay > 0) {
          console.log(`⏳ Aguardando ${step.delay} segundo(s)...`);
          await new Promise(resolve => setTimeout(resolve, step.delay * 1000));
        }

        let messagePayload: any = null;

        // Normalizar tipo
        const stepType = (step.type || '').toLowerCase();

        switch (stepType) {
          case 'message':
          case 'messages': {
            const { data: message } = await supabaseClient
              .from('quick_messages')
              .select('*')
              .eq('id', step.item_id)
              .single();

            if (message) {
              messagePayload = {
                conversation_id: card.conversation_id,
                content: message.content,
                message_type: 'text'
              };
            }
            break;
          }

          case 'audio':
          case 'audios': {
            const { data: audio } = await supabaseClient
              .from('quick_audios')
              .select('*')
              .eq('id', step.item_id)
              .single();

            if (audio) {
              messagePayload = {
                conversation_id: card.conversation_id,
                content: '',
                message_type: 'audio',
                file_url: audio.file_url,
                file_name: audio.file_name || audio.title || 'audio.mp3'
              };
            }
            break;
          }

          case 'media':
          case 'midias': {
            const { data: media } = await supabaseClient
              .from('quick_media')
              .select('*')
              .eq('id', step.item_id)
              .single();

            if (media) {
              // Determinar tipo baseado no file_type ou URL
              let mediaType = 'image';
              if (media.file_type?.startsWith('video/')) {
                mediaType = 'video';
              } else if (media.file_url) {
                const url = media.file_url.toLowerCase();
                if (url.includes('.mp4') || url.includes('.mov') || url.includes('.avi')) {
                  mediaType = 'video';
                }
              }
              
              messagePayload = {
                conversation_id: card.conversation_id,
                content: media.title || '',
                message_type: mediaType,
                file_url: media.file_url,
                file_name: media.file_name || media.title || `media.${mediaType === 'video' ? 'mp4' : 'jpg'}`
              };
            }
            break;
          }

          case 'document':
          case 'documents':
          case 'documentos': {
            const { data: document } = await supabaseClient
              .from('quick_documents')
              .select('*')
              .eq('id', step.item_id)
              .single();

            if (document) {
              messagePayload = {
                conversation_id: card.conversation_id,
                content: document.title || '',
                message_type: 'document',
                file_url: document.file_url,
                file_name: document.file_name || document.title || 'document.pdf'
              };
            }
            break;
          }
        }

        if (messagePayload) {
          console.log(`📦 Enviando item ${i + 1}/${sortedSteps.length}...`);

          const { error: sendError } = await supabaseClient.functions.invoke('test-send-msg', {
            body: messagePayload
          });

          if (sendError) {
            console.error(`❌ Erro ao enviar item ${i + 1}:`, sendError);
          } else {
            console.log(`✅ Item ${i + 1} enviado`);
          }
        }
      }
      break;
    }

    case 'change_column': {
      const targetColumnId = actionConfig.column_id;
      if (!targetColumnId) {
        console.warn('⚠️ change_column sem column_id configurado');
        return;
      }

      console.log(`🔀 Movendo card para coluna ${targetColumnId}`);

      const { error: moveError } = await supabaseClient
        .from('pipeline_cards')
        .update({ 
          column_id: targetColumnId,
          updated_at: new Date().toISOString()
        })
        .eq('id', card.id);

      if (moveError) {
        console.error('❌ Erro ao mover card:', moveError);
      } else {
        console.log('✅ Card movido com sucesso');
      }
      break;
    }

    case 'add_tag': {
      const tagId = actionConfig.tag_id;
      if (!tagId) {
        console.warn('⚠️ add_tag sem tag_id configurado');
        return;
      }

      console.log(`🏷️ Adicionando tag ${tagId} ao contato`);

      const { error: tagError } = await supabaseClient
        .from('contact_tags')
        .insert({
          contact_id: card.contact_id,
          tag_id: tagId
        });

      if (tagError) {
        if (tagError.code === '23505') {
          console.log('ℹ️ Tag já existe no contato');
        } else {
          console.error('❌ Erro ao adicionar tag:', tagError);
        }
      } else {
        console.log('✅ Tag adicionada com sucesso');
        
        // 📡 Emitir broadcast para atualizar cards em tempo real
        try {
          // O usePipelineRealtime escuta mudanças em contact_tags e atualiza os cards
          console.log('📡 [Broadcast] Tag adicionada, realtime Postgres enviará o evento');
        } catch (err) {
          console.warn('⚠️ [Broadcast] Erro ao processar broadcast:', err);
        }
      }
      break;
    }

    case 'add_agent': {
      if (!card.conversation_id) {
        console.warn('⚠️ Card sem conversation_id');
        return;
      }

      const agentId = actionConfig.agent_id;
      if (!agentId) {
        console.warn('⚠️ add_agent sem agent_id configurado');
        return;
      }

      console.log(`🤖 Ativando agente ${agentId} na conversa ${card.conversation_id}`);

      const { error: agentError } = await supabaseClient
        .from('conversations')
        .update({
          agente_ativo: true,
          agent_active_id: agentId,
          status: 'open'
        })
        .eq('id', card.conversation_id);

      if (agentError) {
        console.error('❌ Erro ao ativar agente:', agentError);
      } else {
        console.log('✅ Agente ativado com sucesso');
        
        // 📡 Emitir broadcast para atualizar cards em tempo real
        try {
          console.log('📡 [Broadcast] Agente ativado, realtime Postgres enviará o evento');
        } catch (err) {
          console.warn('⚠️ [Broadcast] Erro ao processar broadcast:', err);
        }
      }
      break;
    }

    case 'remove_agent': {
      if (!card.conversation_id) {
        console.warn('⚠️ Card sem conversation_id');
        return;
      }

      console.log(`🚫 Desativando agente IA na conversa ${card.conversation_id}`);

      const { error: agentError } = await supabaseClient
        .from('conversations')
        .update({
          agente_ativo: false,
          agent_active_id: null
        })
        .eq('id', card.conversation_id);

      if (agentError) {
        console.error('❌ Erro ao desativar agente:', agentError);
      } else {
        console.log('✅ Agente desativado com sucesso');
        
        // 📡 Emitir broadcast para atualizar cards em tempo real
        try {
          console.log('📡 [Broadcast] Agente desativado, realtime Postgres enviará o evento');
        } catch (err) {
          console.warn('⚠️ [Broadcast] Erro ao processar broadcast:', err);
        }
      }
      break;
    }

    case 'move_to_column': {
      const targetColumnId = actionConfig.column_id;
      if (!targetColumnId) {
        console.warn('⚠️ move_to_column sem column_id configurado');
        return;
      }

      console.log(`🔀 Movendo card para coluna ${targetColumnId}`);

      const { error: moveError } = await supabaseClient
        .from('pipeline_cards')
        .update({ 
          column_id: targetColumnId,
          updated_at: new Date().toISOString()
        })
        .eq('id', card.id);

      if (moveError) {
        console.error('❌ Erro ao mover card:', moveError);
      } else {
        console.log('✅ Card movido com sucesso');
        
        // 📡 Emitir broadcast para atualizar cards em tempo real
        try {
          console.log('📡 [Broadcast] Card movido, realtime Postgres enviará o evento de UPDATE');
        } catch (err) {
          console.warn('⚠️ [Broadcast] Erro ao processar broadcast:', err);
        }
      }
      break;
    }

    default:
      console.warn(`⚠️ Tipo de ação desconhecido: ${action.action_type}`);
  }
}
