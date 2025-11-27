import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Database {
  public: {
    Tables: {
      pipelines: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          type: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          name: string;
          type?: string;
          is_active?: boolean;
        };
      };
      pipeline_columns: {
        Row: {
          id: string;
          pipeline_id: string;
          name: string;
          color: string;
          icon: string;
          order_position: number;
          created_at: string;
          permissions: string[]; // Array de user_ids
        };
        Insert: {
          pipeline_id: string;
          name: string;
          color?: string;
          icon?: string;
          order_position?: number;
          permissions?: string[];
        };
        Update: {
          name?: string;
          color?: string;
          icon?: string;
          permissions?: string[];
          order_position?: number;
        };
      };
      pipeline_cards: {
        Row: {
          id: string;
          pipeline_id: string;
          column_id: string;
          conversation_id: string | null;
          contact_id: string | null;
          description: string | null;
          value: number;
          status: string;
          tags: any;
          created_at: string;
          updated_at: string;
          responsible_user_id: string | null;
          moved_to_column_at: string | null;
        };
        Insert: {
          pipeline_id: string;
          column_id: string;
          conversation_id?: string;
          contact_id?: string;
          description?: string;
          value?: number;
          status?: string;
          tags?: any;
          responsible_user_id?: string;
        };
      };
    };
  };
}

// ✅ Função para executar ações de automação
async function executeAutomationAction(
  action: any,
  card: any,
  supabaseClient: any
): Promise<void> {
  console.log(`🎬 Executando ação: ${action.action_type}`, action.action_config);
  
  // ✅ Normalizar action_config para objeto sempre
  if (!action.action_config) {
    action.action_config = {};
  } else if (typeof action.action_config === 'string') {
    try {
      action.action_config = JSON.parse(action.action_config);
    } catch (parseError) {
      console.warn('⚠️ action_config veio como string mas não pôde ser parseado:', action.action_config, parseError);
      action.action_config = {};
    }
  }

  switch (action.action_type) {
    case 'add_agent': {
      // Ativar agente de IA na conversa associada ao card
      console.log(`🔍 [add_agent] Iniciando at cenário:`, {
        cardId: card?.id,
        conversation_id: card?.conversation_id,
        action_config: action?.action_config
      });

      // Obter conversation_id
      let conversationId = card?.conversation_id || card?.conversation?.id;
      if (!conversationId && card?.id) {
        const { data: cardData } = await supabaseClient
          .from('pipeline_cards')
          .select('conversation_id')
          .eq('id', card.id)
          .single();
        conversationId = cardData?.conversation_id || null;
      }

      if (!conversationId) {
        console.warn(`⚠️ [add_agent] Card ${card?.id} não possui conversation_id. Ação ignorada.`);
        return;
      }

      // Determinar agent_id a ativar
      let agentIdToActivate = action?.action_config?.agent_id || null;

      if (!agentIdToActivate) {
        // Se não foi especificado na automação, tentar descobrir pela fila da conversa
        const { data: conv } = await supabaseClient
          .from('conversations')
          .select('agent_active_id, queue_id, agente_ativo')
          .eq('id', conversationId)
          .single();

        if (conv?.agent_active_id) {
          agentIdToActivate = conv.agent_active_id; // reaproveitar último agente ativo
        } else if (conv?.queue_id) {
          const { data: queue } = await supabaseClient
            .from('queues')
            .select('ai_agent_id')
            .eq('id', conv.queue_id)
            .single();
          agentIdToActivate = queue?.ai_agent_id || null;
        }
      }

      if (!agentIdToActivate) {
        console.warn(`⚠️ [add_agent] Nenhum agent_id definido ou detectado para a conversa ${conversationId}. Ação ignorada.`);
        return;
      }

      console.log(`🤖 [add_agent] Ativando agente ${agentIdToActivate} para conversa ${conversationId}`);

      const { error: activateError } = await supabaseClient
        .from('conversations')
        .update({
          agente_ativo: true,
          agent_active_id: agentIdToActivate,
          status: 'open'
        })
        .eq('id', conversationId);

      if (activateError) {
        console.error('❌ [add_agent] Erro ao ativar agente na conversa:', activateError);
        throw activateError;
      }

      // Verificação
      const { data: convAfter } = await supabaseClient
        .from('conversations')
        .select('agente_ativo, agent_active_id')
        .eq('id', conversationId)
        .single();

      console.log(`✅ [add_agent] Estado após ativação:`, convAfter);

      // 📡 Enviar broadcast manual para atualização instantânea no frontend
      if (realtimeClient && card.pipeline_id) {
        try {
          const channelName = `pipeline-${card.pipeline_id}`;
          const channel = realtimeClient.channel(channelName);
          await channel.subscribe();
          await channel.send({
            type: 'broadcast',
            event: 'conversation-agent-updated',
            payload: { 
              conversationId, 
              agente_ativo: true, 
              agent_active_id: agentIdToActivate 
            }
          });
          console.log(`📡 [add_agent] Broadcast enviado para canal ${channelName}`);
          await realtimeClient.removeChannel(channel);
        } catch (broadcastErr) {
          console.error('❌ [add_agent] Erro ao enviar broadcast:', broadcastErr);
        }
      }
      break;
    }
    case 'send_message': {
      console.log(`\n📨 ========== INICIANDO SEND_MESSAGE ==========`);
      
      // Buscar conversa do card
      let conversationId = card.conversation?.id || card.conversation_id;
      let conversation = card.conversation;
      
      console.log(`🔍 Dados iniciais do card:`, {
        card_id: card.id,
        conversation_id: conversationId,
        contact_id: card.contact_id,
        has_conversation_object: !!conversation
      });
      
      // Se não tem conversa, tentar buscar por contact_id
      if (!conversationId && card.contact_id) {
        console.log(`🔍 Tentando buscar conversa pelo contact_id: ${card.contact_id}`);
        const workspaceId = card.pipelines?.workspace_id || card.conversation?.workspace_id;
        
        if (workspaceId) {
          // Buscar conversa existente para o contato com connection_id válido
          const { data: existingConversation } = await supabaseClient
            .from('conversations')
            .select('id, connection_id, workspace_id')
            .eq('contact_id', card.contact_id)
            .eq('workspace_id', workspaceId)
            .not('connection_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (existingConversation) {
            conversationId = existingConversation.id;
            conversation = existingConversation;
            console.log(`✅ Conversa encontrada: ${conversationId}`);
          } else {
            console.log(`⚠️ Nenhuma conversa encontrada para o contato`);
          }
        }
      }
      
      if (!conversationId) {
        console.error(`❌ ERRO: Card não tem conversa associada`);
        console.error(`   Card ID: ${card.id}`);
        console.error(`   Contact ID: ${card.contact_id}`);
        console.error(`   Não é possível enviar mensagem sem conversation_id`);
        return;
      }
      
      console.log(`✅ conversation_id confirmado: ${conversationId}`);
      
      // Se não tem conversation object completo, buscar
      if (!conversation || !conversation.connection_id) {
        console.log(`🔍 Buscando dados completos da conversa...`);
        const { data: conversationData } = await supabaseClient
          .from('conversations')
          .select('id, connection_id, workspace_id')
          .eq('id', conversationId)
          .single();
        
        if (!conversationData) {
          console.error(`❌ ERRO: Conversa ${conversationId} não encontrada`);
          return;
        }
        
        conversation = conversationData;
        console.log(`✅ Dados da conversa obtidos:`, {
          id: conversation.id,
          connection_id: conversation.connection_id,
          workspace_id: conversation.workspace_id
        });
      }

      // 🔧 IMPLEMENTAR LÓGICA DE connection_mode
      const connectionMode = action.action_config?.connection_mode || 'last';
      let finalConnectionId = null;
      
      console.log(`\n🔌 ========== RESOLUÇÃO DE CONEXÃO ==========`);
      console.log(`🔌 Modo de conexão configurado: ${connectionMode}`);
      
      if (connectionMode === 'last') {
        // Modo "Última conversa" - buscar a última mensagem do contato que tem connection_id
        console.log(`🔍 Buscando última conexão usada pelo contato...`);
        const { data: lastMessage } = await supabaseClient
          .from('messages')
          .select('conversation_id, conversations!inner(connection_id, workspace_id)')
          .eq('conversations.contact_id', card.contact_id)
          .not('conversations.connection_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (lastMessage?.conversations?.connection_id) {
          finalConnectionId = lastMessage.conversations.connection_id;
          console.log(`✅ Última conexão encontrada: ${finalConnectionId}`);
        } else {
          // Fallback: usar a connection_id da conversa atual
          finalConnectionId = conversation.connection_id;
          console.log(`⚠️ Nenhuma última conexão encontrada, usando conversa atual: ${finalConnectionId}`);
        }
      } else if (connectionMode === 'default') {
        // Modo "Conexão padrão" - buscar a primeira conexão ativa do workspace
        console.log(`🔍 Buscando conexão padrão do workspace...`);
        const { data: defaultConnection } = await supabaseClient
          .from('connections')
          .select('id')
          .eq('workspace_id', conversation.workspace_id)
          .eq('status', 'connected')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        
        if (defaultConnection?.id) {
          finalConnectionId = defaultConnection.id;
          console.log(`✅ Conexão padrão encontrada: ${finalConnectionId}`);
        } else {
          // Fallback: usar a connection_id da conversa atual
          finalConnectionId = conversation.connection_id;
          console.log(`⚠️ Nenhuma conexão padrão ativa, usando conversa atual: ${finalConnectionId}`);
        }
      } else if (connectionMode === 'specific') {
        // Modo "Conexão específica" - usar o connection_id configurado
        const specificConnectionId = action.action_config?.connection_id;
        if (specificConnectionId) {
          console.log(`🔍 Validando conexão específica: ${specificConnectionId}`);
          
          // Validar se a conexão existe e está ativa
          const { data: specificConnection } = await supabaseClient
            .from('connections')
            .select('id, status, instance_name')
            .eq('id', specificConnectionId)
            .single();
          
          if (specificConnection) {
            if (specificConnection.status === 'connected') {
              finalConnectionId = specificConnectionId;
              console.log(`✅ Conexão específica válida: ${specificConnection.instance_name}`);
            } else {
              console.error(`❌ ERRO: Conexão ${specificConnection.instance_name} não está ativa (status: ${specificConnection.status})`);
              console.error(`   Mensagem não será enviada`);
              return;
            }
          } else {
            console.error(`❌ ERRO: Conexão específica ${specificConnectionId} não encontrada`);
            console.error(`   Mensagem não será enviada`);
            return;
          }
        } else {
          console.error(`❌ ERRO: connection_mode é 'specific' mas connection_id não foi configurado`);
          console.error(`   Mensagem não será enviada`);
          return;
        }
      }
      
      // Validar se temos uma conexão válida
      if (!finalConnectionId) {
        console.error(`❌ ERRO: Não foi possível determinar uma conexão válida`);
        console.error(`   connection_mode: ${connectionMode}`);
        console.error(`   conversation.connection_id: ${conversation.connection_id}`);
        console.error(`   Mensagem não será enviada`);
        return;
      }
      
      console.log(`✅ Conexão final determinada: ${finalConnectionId}`);
      console.log(`=========================================\n`);
      
      // Obter conteúdo da mensagem do action_config
      const messageContent = action.action_config?.message || action.action_config?.content || '';
      
      if (!messageContent) {
        console.error(`❌ ERRO: Ação send_message não tem conteúdo configurado`);
        console.error(`   action_config:`, action.action_config);
        return;
      }
      
      console.log(`📝 Mensagem a ser enviada (${messageContent.length} caracteres):`, 
        messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent);
      
      // Chamar função test-send-msg que já busca automaticamente:
      // 1. Webhook URL do N8N (workspace_webhook_settings ou workspace_webhook_secrets)
      // 2. Credenciais Evolution API do _master_config (evolution_url + token)
      // 3. Dispara o webhook do N8N com todos os dados necessários
      try {
        console.log(`\n📤 ========== PREPARANDO ENVIO VIA N8N ==========`);
        console.log(`📤 Conversa ID: ${conversationId}`);
        console.log(`📤 Workspace ID: ${conversation.workspace_id}`);
        console.log(`📤 Connection ID (resolvida): ${finalConnectionId}`);
        
        // Preparar payload seguindo exatamente o padrão do envio manual
        const payload = {
          conversation_id: conversationId,
          content: messageContent,
          message_type: 'text',
          sender_type: 'system', // Sistema (automação)
          sender_id: null, // Sistema não tem sender_id
          clientMessageId: `automation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // ID único para deduplicação
        };
        
        console.log(`📦 Payload completo:`, JSON.stringify(payload, null, 2));
        
        // Usar fetch direto com as credenciais corretas (sem JWT)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const sendMessageUrl = `${supabaseUrl}/functions/v1/test-send-msg`;
        
        console.log(`🌐 URL da edge function: ${sendMessageUrl}`);
        console.log(`⏱️ Iniciando requisição HTTP...`);
        
        const sendResponse = await fetch(sendMessageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        
        console.log(`✅ Resposta recebida - Status: ${sendResponse.status} ${sendResponse.statusText}`);
        
        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          
          console.error(`❌ ERRO HTTP ao enviar mensagem:`, {
            status: sendResponse.status,
            statusText: sendResponse.statusText,
            error: errorData
          });
          
          throw new Error(errorData.error || errorData.details || `Erro HTTP ${sendResponse.status}: ${sendResponse.statusText}`);
        }
        
        let sendResult: any;
        try {
          sendResult = await sendResponse.json();
        } catch (parseError) {
          // Se não for JSON, assumir sucesso se status for 200
          if (sendResponse.ok) {
            sendResult = { success: true, message: 'Message sent (empty response)' };
          } else {
            throw new Error(`Erro ao parsear resposta: ${parseError}`);
          }
        }
        
        console.log(`📨 Resposta do servidor:`, JSON.stringify(sendResult, null, 2));
        
        // Verificar sucesso - a função test-send-msg retorna success: true quando bem-sucedido
        if (!sendResult || (sendResult.error && !sendResult.success)) {
          const errorMsg = sendResult?.error || sendResult?.details || 'Erro desconhecido ao enviar mensagem';
          console.error(`❌ Falha ao enviar mensagem:`, errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log(`\n✅ ========== MENSAGEM ENVIADA COM SUCESSO ==========`);
        console.log(`✅ Status: ${sendResult?.status || 'success'}`);
        console.log(`✅ Message ID: ${sendResult?.message_id || sendResult?.message?.id || 'N/A'}`);
        console.log(`✅ Phone: ${sendResult?.phone_number || 'N/A'}`);
        
        // Log adicional sobre o que aconteceu
        if (sendResult?.status === 'duplicate') {
          console.log(`ℹ️ Nota: Mensagem duplicada detectada (já foi enviada anteriormente)`);
        }
        
        console.log(`📨 ========== FIM SEND_MESSAGE ==========\n`);
        
      } catch (sendError) {
        console.error(`\n❌ ========== ERRO NO SEND_MESSAGE ==========`);
        console.error(`❌ Mensagem: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
        if (sendError instanceof Error && sendError.stack) {
          console.error(`❌ Stack trace:`, sendError.stack);
        }
        console.error(`❌ ========== FIM DO ERRO ==========\n`);
        
        // NÃO lançar erro aqui - apenas logar e retornar
        // A automação pode continuar com outras ações mesmo se uma falhar
        // Isso evita que o erro cause "shutdown" da função
        console.warn(`⚠️ Continuando com outras ações da automação apesar do erro no envio de mensagem`);
        return; // Retornar silenciosamente sem lançar erro
      }
      break;
    }
    
    case 'move_to_column': {
      const targetColumnId = action.action_config?.target_column_id || action.action_config?.column_id;
      if (!targetColumnId) {
        console.warn(`⚠️ Ação move_to_column não tem target_column_id configurado.`);
        return;
      }
      
      // Atualizar card para nova coluna
      await supabaseClient
        .from('pipeline_cards')
        .update({ column_id: targetColumnId })
        .eq('id', card.id);
      
      console.log(`✅ Card movido para coluna ${targetColumnId}`);
      break;
    }
    
    case 'add_tag': {
      const tagId = action.action_config?.tag_id;
      if (!tagId || !card.contact_id) {
        console.warn(`⚠️ Ação add_tag não tem tag_id ou card não tem contact_id.`);
        return;
      }
      
      // Adicionar tag ao contato (se ainda não tiver)
      await supabaseClient
        .from('contact_tags')
        .upsert({
          contact_id: card.contact_id,
          tag_id: tagId
        }, {
          onConflict: 'contact_id,tag_id'
        });
      
      console.log(`✅ Tag ${tagId} adicionada ao contato`);
      break;
    }
    
    case 'add_agent': {
      // Lógica para adicionar agente de IA será implementada se necessário
      console.log(`ℹ️ Ação add_agent ainda não implementada`);
      break;
    }
    
    case 'remove_agent': {
      // Remover agente de IA da conversa associada ao card
      console.log(`🔍 [remove_agent] Verificando conversation_id do card:`, {
        cardId: card.id,
        conversation_id: card.conversation_id,
        conversation_object: card.conversation,
        hasConversationId: !!card.conversation_id,
        hasConversationObject: !!card.conversation
      });

      // Tentar obter conversation_id de diferentes fontes
      let conversationId = card.conversation_id || card.conversation?.id;
      
      // Se ainda não tem, buscar do banco
      if (!conversationId && card.id) {
        console.log(`🔄 [remove_agent] conversation_id não encontrado no card, buscando do banco...`);
        const { data: cardData, error: cardError } = await supabaseClient
          .from('pipeline_cards')
          .select('conversation_id')
          .eq('id', card.id)
          .single();
        
        if (cardError) {
          console.error(`❌ [remove_agent] Erro ao buscar conversation_id do card:`, cardError);
        } else if (cardData?.conversation_id) {
          conversationId = cardData.conversation_id;
          console.log(`✅ [remove_agent] conversation_id encontrado no banco: ${conversationId}`);
        }
      }

      if (!conversationId) {
        console.warn(`⚠️ Ação remove_agent não pode ser executada: card não tem conversation_id`);
        console.warn(`⚠️ Dados do card:`, JSON.stringify({
          id: card.id,
          conversation_id: card.conversation_id,
          conversation: card.conversation
        }, null, 2));
        return;
      }

      console.log(`✅ [remove_agent] conversation_id válido: ${conversationId}`);

      // ✅ DEBUG: Verificar configuração da ação
      console.log(`🔍 [remove_agent] DEBUG - action_config completo:`, JSON.stringify(action.action_config, null, 2));
      console.log(`🔍 [remove_agent] DEBUG - typeof action.action_config:`, typeof action.action_config);
      console.log(`🔍 [remove_agent] DEBUG - action.action_config?.remove_current:`, action.action_config?.remove_current);
      console.log(`🔍 [remove_agent] DEBUG - action.action_config?.remove_current === true:`, action.action_config?.remove_current === true);
      console.log(`🔍 [remove_agent] DEBUG - action.action_config?.agent_id:`, action.action_config?.agent_id);

      // ✅ NORMALIZAR: Garantir que remove_current seja booleano
      const removeCurrent = action.action_config?.remove_current === true || 
                            action.action_config?.remove_current === 'true' ||
                            (action.action_config?.remove_current !== false && 
                             action.action_config?.remove_current !== 'false' && 
                             !action.action_config?.agent_id);
      const agentIdToRemove = action.action_config?.agent_id;

      console.log(`🔍 [remove_agent] Configuração da ação (após normalização):`, {
        removeCurrent,
        agentIdToRemove,
        action_config: action.action_config
      });

      if (removeCurrent) {
        // Remover agente atual (qualquer que esteja ativo)
        console.log(`🚫 [remove_agent] Removendo agente atual da conversa ${conversationId}`);
        
        // Primeiro verificar estado atual
        const { data: currentConversation, error: fetchError } = await supabaseClient
          .from('conversations')
          .select('agente_ativo, agent_active_id')
          .eq('id', conversationId)
          .single();

        if (fetchError) {
          console.error(`❌ [remove_agent] Erro ao buscar estado atual da conversa:`, fetchError);
          throw fetchError;
        }

        console.log(`📊 [remove_agent] Estado atual da conversa:`, {
          agente_ativo: currentConversation?.agente_ativo,
          agent_active_id: currentConversation?.agent_active_id
        });

        if (!currentConversation?.agente_ativo) {
          console.log(`ℹ️ [remove_agent] Conversa ${conversationId} já não tem agente ativo, nada a fazer`);
          return;
        }

        const { error: removeError } = await supabaseClient
          .from('conversations')
          .update({ 
            agente_ativo: false,
            agent_active_id: null
          })
          .eq('id', conversationId);

        if (removeError) {
          console.error(`❌ Erro ao remover agente atual da conversa ${conversationId}:`, removeError);
          throw removeError;
        }

        // Verificar se a atualização foi aplicada
        const { data: updatedConversation, error: verifyError } = await supabaseClient
          .from('conversations')
          .select('agente_ativo, agent_active_id')
          .eq('id', conversationId)
          .single();

        if (verifyError) {
          console.error(`❌ [remove_agent] Erro ao verificar atualização:`, verifyError);
        } else {
          console.log(`✅ [remove_agent] Agente atual removido da conversa ${conversationId}`);
          console.log(`📊 [remove_agent] Estado após remoção:`, {
            agente_ativo: updatedConversation?.agente_ativo,
            agent_active_id: updatedConversation?.agent_active_id
          });
          
          // ✅ VERIFICAÇÃO FINAL: Se ainda está ativo, tentar novamente
          if (updatedConversation?.agente_ativo) {
            console.warn(`⚠️ [remove_agent] Agente ainda está ativo após atualização! Tentando novamente...`);
            const { error: retryError } = await supabaseClient
              .from('conversations')
              .update({ 
                agente_ativo: false,
                agent_active_id: null
              })
              .eq('id', conversationId);
            
            if (retryError) {
              console.error(`❌ [remove_agent] Erro no retry:`, retryError);
              throw retryError;
            }
            
            // Verificar novamente
            const { data: finalCheck } = await supabaseClient
              .from('conversations')
              .select('agente_ativo, agent_active_id')
              .eq('id', conversationId)
              .single();
            
            console.log(`📊 [remove_agent] Estado após retry:`, {
              agente_ativo: finalCheck?.agente_ativo,
              agent_active_id: finalCheck?.agent_active_id
            });
          }
        }

        // 📡 Enviar broadcast manual para atualização instantânea no frontend
        if (realtimeClient && card.pipeline_id) {
          try {
            const channelName = `pipeline-${card.pipeline_id}`;
            const channel = realtimeClient.channel(channelName);
            await channel.subscribe();
            await channel.send({
              type: 'broadcast',
              event: 'conversation-agent-updated',
              payload: { 
                conversationId, 
                agente_ativo: false, 
                agent_active_id: null 
              }
            });
            console.log(`📡 [remove_agent] Broadcast enviado para canal ${channelName}`);
            await realtimeClient.removeChannel(channel);
          } catch (broadcastErr) {
            console.error('❌ [remove_agent] Erro ao enviar broadcast:', broadcastErr);
          }
        }
      } else if (agentIdToRemove) {
        // Remover agente específico (só remove se for o agente ativo)
        console.log(`🚫 [remove_agent] Removendo agente específico ${agentIdToRemove} da conversa ${conversationId}`);
        
        const { data: conversation } = await supabaseClient
          .from('conversations')
          .select('agent_active_id, agente_ativo')
          .eq('id', conversationId)
          .single();

        if (!conversation) {
          console.error(`❌ [remove_agent] Conversa ${conversationId} não encontrada`);
          throw new Error(`Conversa não encontrada: ${conversationId}`);
        }

        console.log(`📊 [remove_agent] Estado da conversa:`, {
          agent_active_id: conversation.agent_active_id,
          agente_ativo: conversation.agente_ativo,
          agentIdToRemove,
          matches: conversation.agent_active_id === agentIdToRemove && conversation.agente_ativo
        });

        if (conversation.agent_active_id === agentIdToRemove && conversation.agente_ativo) {
          const { error: removeError } = await supabaseClient
            .from('conversations')
            .update({ 
              agente_ativo: false,
              agent_active_id: null
            })
            .eq('id', conversationId)
            .eq('agent_active_id', agentIdToRemove);

          if (removeError) {
            console.error(`❌ Erro ao remover agente ${agentIdToRemove} da conversa ${conversationId}:`, removeError);
            throw removeError;
          }

          console.log(`✅ Agente ${agentIdToRemove} removido da conversa ${conversationId}`);

          // 📡 Enviar broadcast manual para atualização instantânea no frontend
          if (realtimeClient && card.pipeline_id) {
            try {
              const channelName = `pipeline-${card.pipeline_id}`;
              const channel = realtimeClient.channel(channelName);
              await channel.subscribe();
              await channel.send({
                type: 'broadcast',
                event: 'conversation-agent-updated',
                payload: { 
                  conversationId, 
                  agente_ativo: false, 
                  agent_active_id: null 
                }
              });
              console.log(`📡 [remove_agent] Broadcast enviado para canal ${channelName}`);
              await realtimeClient.removeChannel(channel);
            } catch (broadcastErr) {
              console.error('❌ [remove_agent] Erro ao enviar broadcast:', broadcastErr);
            }
          }
        } else {
          console.log(`ℹ️ Agente ${agentIdToRemove} não está ativo na conversa ${conversationId}, nada a fazer`);
        }
      } else {
        console.warn(`⚠️ Ação remove_agent não tem configuração válida (remove_current ou agent_id)`);
        console.warn(`⚠️ action_config recebido:`, JSON.stringify(action.action_config, null, 2));
      }
      break;
    }
    
    case 'send_funnel': {
      console.log(`🎯 ========== EXECUTANDO AÇÃO: ENVIAR FUNIL ==========`);
      
      const funnelId = action.action_config?.funnel_id;
      
      if (!funnelId) {
        console.warn(`⚠️ Ação send_funnel não tem funnel_id configurado.`);
        return;
      }
      
      // Buscar conversa do card
      let conversationId = card.conversation?.id || card.conversation_id;
      let conversation = card.conversation;
      
      // Se não tem conversa, tentar buscar por contact_id
      if (!conversationId && card.contact_id) {
        const workspaceId = card.pipelines?.workspace_id || card.conversation?.workspace_id;
        
        if (workspaceId) {
          const { data: existingConversation } = await supabaseClient
            .from('conversations')
            .select('id, connection_id, workspace_id')
            .eq('contact_id', card.contact_id)
            .eq('workspace_id', workspaceId)
            .not('connection_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (existingConversation) {
            conversationId = existingConversation.id;
            conversation = existingConversation;
          }
        }
      }
      
      if (!conversationId) {
        console.warn(`⚠️ Card não tem conversa associada. Não é possível enviar funil. Card ID: ${card.id}, Contact ID: ${card.contact_id}`);
        return;
      }
      
      // Buscar dados completos da conversa se necessário
      if (!conversation || !conversation.connection_id) {
        const { data: conversationData } = await supabaseClient
          .from('conversations')
          .select('id, connection_id, workspace_id')
          .eq('id', conversationId)
          .single();
        
        if (!conversationData || !conversationData.connection_id) {
          console.warn(`⚠️ Conversa ${conversationId} não tem connection_id. Não é possível enviar funil.`);
          return;
        }
        
        conversation = conversationData;
      }
      
      console.log(`📋 Conversa encontrada:`, {
        id: conversationId,
        connection_id: conversation.connection_id,
        workspace_id: conversation.workspace_id
      });
      
      // Buscar o funil
      console.log(`🔍 Buscando funil: ${funnelId}`);
      const { data: funnel, error: funnelError } = await supabaseClient
        .from('quick_funnels')
        .select('*')
        .eq('id', funnelId)
        .single();
      
      if (funnelError || !funnel) {
        console.error(`❌ Erro ao buscar funil:`, funnelError);
        throw new Error(`Funil não encontrado: ${funnelId}`);
      }
      
      console.log(`✅ Funil encontrado: "${funnel.title}" com ${funnel.steps?.length || 0} steps`);
      
      if (!funnel.steps || funnel.steps.length === 0) {
        console.warn(`⚠️ Funil ${funnelId} não tem steps configurados.`);
        return;
      }
      
      // Ordenar steps por order
      const sortedSteps = [...funnel.steps].sort((a, b) => (a.order || 0) - (b.order || 0));
      
      console.log(`📤 Iniciando envio de ${sortedSteps.length} mensagens do funil...`);
      
      // Preparar URL do test-send-msg
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const sendMessageUrl = `${supabaseUrl}/functions/v1/test-send-msg`;
      
      // Processar cada step
      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        console.log(`\n📨 Processando step ${i + 1}/${sortedSteps.length}:`, {
          type: step.type,
          item_id: step.item_id,
          delay_seconds: step.delay_seconds
        });
        
        try {
          let messagePayload: any = null;
          
          // Buscar item de acordo com o tipo
          // Normalizar tipo para aceitar tanto singular em inglês quanto plural em português
          const normalizedType = step.type.toLowerCase();
          
          switch (normalizedType) {
            case 'message':
            case 'messages':
            case 'mensagens': {
              const { data: message } = await supabaseClient
                .from('quick_messages')
                .select('*')
                .eq('id', step.item_id)
                .single();
              
              if (message) {
                messagePayload = {
                  conversation_id: conversationId,
                  content: message.content,
                  message_type: 'text',
                  sender_type: 'system',
                  sender_id: null,
                  clientMessageId: `funnel_${funnelId}_step_${i}_${Date.now()}`
                };
              }
              break;
            }
            
            case 'audio':
            case 'audios': {
              const { data: audio, error: audioError } = await supabaseClient
                .from('quick_audios')
                .select('*')
                .eq('id', step.item_id)
                .single();
              
              console.log(`🔍 Audio query result:`, { audio, audioError, file_url: audio?.file_url });
              
              if (audio) {
                messagePayload = {
                  conversation_id: conversationId,
                  content: '',
                  message_type: 'audio',
                  file_url: audio.file_url,
                  file_name: audio.file_name || audio.title || 'audio.mp3',
                  sender_type: 'system',
                  sender_id: null,
                  clientMessageId: `funnel_${funnelId}_step_${i}_${Date.now()}`
                };
              }
              break;
            }
            
            case 'media':
            case 'midias': {
              const { data: media, error: mediaError } = await supabaseClient
                .from('quick_media')
                .select('*')
                .eq('id', step.item_id)
                .single();
              
              console.log(`🔍 Media query result:`, { media, mediaError, file_url: media?.file_url });
              
              if (media) {
                // Determinar tipo baseado no file_type ou URL/extensão
                let mediaType = 'image';
                if (media.file_type) {
                  if (media.file_type.startsWith('video/')) {
                    mediaType = 'video';
                  }
                } else if (media.file_url) {
                  const url = media.file_url.toLowerCase();
                  if (url.includes('.mp4') || url.includes('.mov') || url.includes('.avi')) {
                    mediaType = 'video';
                  }
                }
                
                messagePayload = {
                  conversation_id: conversationId,
                  content: media.title || '',
                  message_type: mediaType,
                  file_url: media.file_url,
                  file_name: media.file_name || media.title || `media.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
                  sender_type: 'system',
                  sender_id: null,
                  clientMessageId: `funnel_${funnelId}_step_${i}_${Date.now()}`
                };
              }
              break;
            }
            
            case 'document':
            case 'documents':
            case 'documentos': {
              const { data: document, error: docError } = await supabaseClient
                .from('quick_documents')
                .select('*')
                .eq('id', step.item_id)
                .single();
              
              console.log(`🔍 Document query result:`, { document, docError, file_url: document?.file_url });
              
              if (document) {
                messagePayload = {
                  conversation_id: conversationId,
                  content: document.title || '',
                  message_type: 'document',
                  file_url: document.file_url,
                  file_name: document.file_name || document.title || 'document.pdf',
                  sender_type: 'system',
                  sender_id: null,
                  clientMessageId: `funnel_${funnelId}_step_${i}_${Date.now()}`
                };
              }
              break;
            }
            
            default:
              console.error(`❌ Tipo de step não reconhecido: "${step.type}"`);
              console.error(`   Tipos aceitos: message/messages/mensagens, audio/audios, media/midias, document/documents/documentos`);
              console.error(`   Step completo:`, JSON.stringify(step, null, 2));
          }
          
          if (!messagePayload) {
            console.error(`❌ Falha ao criar payload para step ${i + 1}`);
            console.error(`   Tipo recebido: "${step.type}"`);
            console.error(`   Item ID: ${step.item_id}`);
            console.error(`   Verifique se o item existe na tabela correspondente`);
            continue;
          }
          
          console.log(`📦 Enviando mensagem ${i + 1}/${sortedSteps.length}...`);
          console.log(`📋 Payload completo:`, JSON.stringify(messagePayload, null, 2));
          
          // Enviar mensagem
          const sendResponse = await fetch(sendMessageUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload)
          });
          
          if (!sendResponse.ok) {
            const errorText = await sendResponse.text();
            console.error(`❌ Erro ao enviar step ${i + 1}:`, {
              status: sendResponse.status,
              error: errorText
            });
            // Continuar com próximo step mesmo se um falhar
            continue;
          }
          
          const sendResult = await sendResponse.json();
          console.log(`✅ Mensagem ${i + 1}/${sortedSteps.length} enviada com sucesso:`, {
            message_id: sendResult?.message_id,
            status: sendResult?.status
          });
          
          // Aguardar delay antes do próximo step (se houver)
          if (step.delay_seconds && step.delay_seconds > 0 && i < sortedSteps.length - 1) {
            console.log(`⏳ Aguardando ${step.delay_seconds} segundos antes do próximo step...`);
            await new Promise(resolve => setTimeout(resolve, step.delay_seconds * 1000));
          }
          
        } catch (stepError) {
          console.error(`❌ Erro ao processar step ${i + 1}:`, {
            error: stepError instanceof Error ? stepError.message : String(stepError),
            step
          });
          // Continuar com próximos steps mesmo se um falhar
        }
      }
      
      console.log(`✅ ========== FUNIL ENVIADO COM SUCESSO ==========`);
      break;
    }
    
    default:
      console.warn(`⚠️ Tipo de ação desconhecido: ${action.action_type}`);
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const realtimeClient = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Detailed logging for debugging
    console.log('🚀 Pipeline Management Function Started');
    console.log('📋 Headers received:', {
      'x-system-user-id': req.headers.get('x-system-user-id'),
      'x-system-user-email': req.headers.get('x-system-user-email'),
      'x-workspace-id': req.headers.get('x-workspace-id'),
      'user-agent': req.headers.get('user-agent')
    });

    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Enhanced user context validation and logging
    const userEmail = req.headers.get('x-system-user-email');
    const userId = req.headers.get('x-system-user-id');
    const workspaceId = req.headers.get('x-workspace-id');
    
    console.log('🔐 Authentication check:', { userId, userEmail, workspaceId });
    
    if (!userId || !userEmail) {
      console.error('❌ Missing user authentication headers');
      return new Response(
        JSON.stringify({ error: 'User authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!workspaceId) {
      console.error('❌ Missing workspace ID');
      return new Response(
        JSON.stringify({ error: 'Workspace ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Set user context for RLS with error handling (non-critical since we use service_role)
    try {
      console.log('🔧 Setting user context:', { userId, userEmail, workspaceId });
      
      const { error: contextError } = await supabaseClient.rpc('set_current_user_context', {
        user_id: userId,
        user_email: userEmail
      } as any);
      
      if (contextError) {
        console.warn('⚠️ RPC set_current_user_context failed (non-critical):', contextError);
        // Não falhar - service_role pode não precisar disso
      } else {
        console.log('✅ User context set successfully');
      }
    } catch (contextError) {
      console.warn('⚠️ Failed to set user context (non-critical):', contextError);
      // Não falhar - continuar execução
    }

    const { method } = req;
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(segment => segment !== '');
    const action = pathSegments[pathSegments.length - 1];
    
    console.log('📍 Request details:', { method, action, url: url.pathname });

    switch (action) {
      case 'check-time-automations':
        // ⏰ Verificar e executar automações baseadas em tempo
        console.log('⏰ ========== VERIFICANDO AUTOMAÇÕES DE TEMPO ==========');
        
        try {
          // 1. Buscar todos os cards com suas colunas
          const { data: cards, error: cardsError } = await supabaseClient
            .from('pipeline_cards')
            .select(`
              *,
              column:pipeline_columns!inner(
                id,
                pipeline_id,
                name
              ),
              conversation:conversations(id, contact_id, connection_id),
              contact:contacts(id, phone, name)
            `)
            .order('updated_at', { ascending: true });

          if (cardsError) {
            console.error('❌ Erro ao buscar cards:', cardsError);
            throw cardsError;
          }

          console.log(`📊 ${cards?.length || 0} cards encontrados para verificação`);

          let executedCount = 0;
          const results: any[] = [];

          // 2. Para cada card, verificar se há automações de tempo
          for (const card of (cards || []) as any[]) {
            const columnId = (card as any).column_id;
            const movedToColumnAtRaw = (card as any).moved_to_column_at || (card as any).updated_at || (card as any).created_at;
            const cardMovedAt = movedToColumnAtRaw ? new Date(movedToColumnAtRaw) : new Date((card as any).updated_at);
            const now = new Date();
            const timeInColumnMs = now.getTime() - cardMovedAt.getTime();
            const timeInColumnMinutes = Math.floor(timeInColumnMs / (1000 * 60));

            console.log(`\n🔍 Verificando card ${(card as any).id}`);
            console.log(`   ⏱️  Tempo na coluna: ${timeInColumnMinutes} minuto(s)`);

            // 3. Buscar automações time_in_column para esta coluna
            const { data: automations, error: automationsError } = await (supabaseClient as any)
              .rpc('get_column_automations', { p_column_id: columnId });

            if (automationsError) {
              console.error(`❌ Erro ao buscar automações da coluna ${columnId}:`, automationsError);
              continue;
            }

            if (!automations || automations.length === 0) {
              console.log(`   ℹ️  Nenhuma automação configurada nesta coluna`);
              continue;
            }

            console.log(`   📋 ${automations.length} automação(ões) encontrada(s)`);

            // 4. Processar cada automação
            for (const automation of automations) {
              if (!automation.is_active) {
                console.log(`   ⏭️  Automação "${automation.name}" está inativa, pulando`);
                continue;
              }

              // Buscar triggers e actions
              const { data: triggers } = await supabaseClient
                .from('crm_column_automation_triggers')
                .select('*')
                .eq('automation_id', automation.id);

              const { data: actions } = await supabaseClient
                .from('crm_column_automation_actions')
                .select('*')
                .eq('automation_id', automation.id)
                .order('action_order', { ascending: true }) as { data: any[] | null };

              // Verificar se tem trigger time_in_column
              const timeInColumnTrigger = (triggers || []).find(
                (t: any) => t.trigger_type === 'time_in_column' || t.trigger_type === 'tempo_na_coluna'
              ) as any;
              
              if (!timeInColumnTrigger) {
                continue;
              }

              console.log(`   ⏰ Automação "${automation.name}" com trigger de tempo encontrada`);

              // Parse trigger_config
              let triggerConfig = timeInColumnTrigger.trigger_config || {};
              if (typeof triggerConfig === 'string') {
                try {
                  triggerConfig = JSON.parse(triggerConfig);
                } catch (e) {
                  console.error(`   ❌ Erro ao fazer parse do trigger_config:`, e);
                  continue;
                }
              }

              const timeValue = parseInt(triggerConfig.time_value || '0');
              const timeUnit = triggerConfig.time_unit || 'minutes';

              if (!timeValue) {
                console.log(`   ⚠️  Tempo não configurado, pulando`);
                continue;
              }

              // Converter para minutos
              let requiredMinutes = timeValue;
              if (timeUnit === 'hours') {
                requiredMinutes = timeValue * 60;
              } else if (timeUnit === 'days') {
                requiredMinutes = timeValue * 60 * 24;
              }

              console.log(`   📊 Tempo configurado: ${timeValue} ${timeUnit} (${requiredMinutes} minutos)`);
              console.log(`   📊 Tempo atual do card: ${timeInColumnMinutes} minutos`);

              // Verificar se já passou do tempo
              if (timeInColumnMinutes >= requiredMinutes) {
                // ✅ Verificar se já foi executado (controle de duplicação)
                const { data: existingExecution } = await supabaseClient
                  .from('crm_automation_executions')
                  .select('id')
                  .eq('automation_id', automation.id)
                  .eq('card_id', (card as any).id)
                  .eq('column_id', columnId)
                  .gte('executed_at', cardMovedAt.toISOString())
                  .maybeSingle();

                if (existingExecution) {
                  console.log(`   ⏭️  Automação já foi executada para este card nesta coluna, pulando`);
                  continue;
                }
                
                console.log(`   ✅ TEMPO ATINGIDO! Executando automação "${automation.name}"`);

                // Executar as ações
                if (actions && actions.length > 0) {
                  console.log(`   🎬 Executando ${actions.length} ação(ões)...`);
                  
                  let allActionsSucceeded = true;
                  
                  for (const action of actions) {
                    try {
                      await executeAutomationAction(action, card, supabaseClient);
                      console.log(`   ✅ Ação ${action.action_type} executada`);
                    } catch (actionError) {
                      console.error(`   ❌ Erro ao executar ação ${action.action_type}:`, actionError);
                      allActionsSucceeded = false;
                    }
                  }

                  // Registrar execução apenas se todas as ações foram bem-sucedidas
                  if (allActionsSucceeded) {
                    const { error: insertError } = await (supabaseClient as any)
                      .from('crm_automation_executions')
                      .insert({
                        automation_id: automation.id,
                        card_id: (card as any).id,
                        column_id: columnId,
                        execution_type: 'time_in_column',
                        metadata: {
                          time_in_column_minutes: timeInColumnMinutes,
                          required_minutes: requiredMinutes,
                          actions_executed: actions.length
                        }
                      });

                    if (insertError) {
                      console.error(`   ❌ Erro ao registrar execução:`, insertError);
                    } else {
                      console.log(`   📝 Execução registrada com sucesso`);
                    }
                  }

                  executedCount++;
                  results.push({
                    card_id: (card as any).id,
                    card_description: (card as any).description,
                    automation_name: automation.name,
                    time_in_column_minutes: timeInColumnMinutes,
                    required_minutes: requiredMinutes,
                    status: allActionsSucceeded ? 'executed' : 'partial_failure'
                  });
                }
              } else {
                console.log(`   ⏳ Tempo ainda não atingido (faltam ${requiredMinutes - timeInColumnMinutes} minutos)`);
              }
            }
          }

          console.log(`\n✅ Verificação concluída: ${executedCount} automação(ões) executada(s)`);

          return new Response(JSON.stringify({
            success: true,
            checked_cards: cards?.length || 0,
            executed_automations: executedCount,
            results
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } catch (error) {
          console.error('❌ Erro ao verificar automações de tempo:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'pipelines':
        if (method === 'GET') {
          console.log('📊 Fetching pipelines for workspace:', workspaceId);
          
          const { data: pipelines, error } = await supabaseClient
            .from('pipelines')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Error fetching pipelines:', error);
            throw error;
          }
          
          console.log('✅ Pipelines fetched successfully:', pipelines?.length || 0, 'pipelines found');
          return new Response(JSON.stringify(pipelines || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          const body = await req.json();
          const { data: pipeline, error } = await supabaseClient
            .from('pipelines')
            .insert({
              workspace_id: workspaceId,
              name: body.name,
              type: body.type || 'padrao',
            } as any)
            .select()
            .single() as any;

          if (error) throw error;

          console.log('✅ Pipeline created successfully:', (pipeline as any).id);

          return new Response(JSON.stringify(pipeline), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'DELETE') {
          const pipelineId = url.searchParams.get('id');
          
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting pipeline:', pipelineId);

          // Verificar se o pipeline tem cards
          const { count: cardsCount } = await supabaseClient
            .from('pipeline_cards')
            .select('*', { count: 'exact', head: true })
            .eq('pipeline_id', pipelineId);

          if (cardsCount && cardsCount > 0) {
            return new Response(
              JSON.stringify({ 
                error: 'Não é possível excluir um pipeline com negócios ativos',
                cardsCount 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Deletar colunas primeiro
          const { error: columnsError } = await supabaseClient
            .from('pipeline_columns')
            .delete()
            .eq('pipeline_id', pipelineId);

          if (columnsError) {
            console.error('❌ Error deleting columns:', columnsError);
            throw columnsError;
          }

          // Deletar o pipeline
          const { error: pipelineError } = await supabaseClient
            .from('pipelines')
            .delete()
            .eq('id', pipelineId)
            .eq('workspace_id', workspaceId);

          if (pipelineError) {
            console.error('❌ Error deleting pipeline:', pipelineError);
            throw pipelineError;
          }

          console.log('✅ Pipeline deleted successfully');

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;

      case 'columns':
        if (method === 'GET') {
          const pipelineId = url.searchParams.get('pipeline_id');
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: columns, error } = await supabaseClient
            .from('pipeline_columns')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('order_position', { ascending: true });

          if (error) throw error;
          return new Response(JSON.stringify(columns), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          const body = await req.json();

          // Ícone é obrigatório na criação da coluna
          if (!body.icon || typeof body.icon !== 'string' || !body.icon.trim()) {
            console.error('❌ Column icon is required on create');
            return new Response(
              JSON.stringify({ error: 'Icon is required to create a column' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Get next order position
          const { data: lastColumn } = await supabaseClient
            .from('pipeline_columns')
            .select('order_position')
            .eq('pipeline_id', body.pipeline_id)
            .order('order_position', { ascending: false })
            .limit(1)
            .single() as any;

          const nextPosition = lastColumn ? (lastColumn as any).order_position + 1 : 0;

          const { data: column, error } = await supabaseClient
            .from('pipeline_columns')
            .insert({
              pipeline_id: body.pipeline_id,
              name: body.name,
              color: body.color || '#808080',
              icon: body.icon.trim(),
              order_position: nextPosition,
            } as any)
            .select()
            .single() as any;

          if (error) throw error;
          return new Response(JSON.stringify(column), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'PUT') {
          const columnId = url.searchParams.get('id');
          if (!columnId) {
            return new Response(
              JSON.stringify({ error: 'Column ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const body = await req.json();

          // Se estiver atualizando configurações básicas (nome/cor/ícone), o ícone é obrigatório
          const isSettingsUpdate =
            body.name !== undefined ||
            body.color !== undefined ||
            body.icon !== undefined;

          if (isSettingsUpdate) {
            if (!body.icon || typeof body.icon !== 'string' || !body.icon.trim()) {
              console.error('❌ Column icon is required when updating settings');
              return new Response(
                JSON.stringify({ error: 'Icon is required when updating column settings' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
          
          // Prepare update data - accept permissions, order_position, name, color, and icon
          const updateData: any = {};
          if (body.permissions !== undefined) {
            updateData.permissions = body.permissions;
          }
          if (body.view_all_deals_permissions !== undefined) {
            updateData.view_all_deals_permissions = body.view_all_deals_permissions;
          }
          if (body.order_position !== undefined) {
            updateData.order_position = body.order_position;
          }
          if (body.name !== undefined) {
            updateData.name = body.name;
          }
          if (body.color !== undefined) {
            updateData.color = body.color;
          }
          if (body.icon !== undefined) {
            updateData.icon = body.icon;
          }
          
          console.log('🔄 Updating column:', columnId, 'with data:', updateData);
          
          const { data: column, error } = (await (supabaseClient
            .from('pipeline_columns') as any)
            .update(updateData)
            .eq('id', columnId)
            .select()
            .single()) as any;

          if (error) throw error;
          return new Response(JSON.stringify(column), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'DELETE') {
          const columnId = url.searchParams.get('id');
          if (!columnId) {
            return new Response(
              JSON.stringify({ error: 'Column ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting column:', columnId);

          // First, check if there are any cards in this column
          const { data: cards, error: cardsError } = await supabaseClient
            .from('pipeline_cards')
            .select('id')
            .eq('column_id', columnId);

          if (cardsError) throw cardsError;

          if (cards && cards.length > 0) {
            return new Response(
              JSON.stringify({ 
                error: 'Cannot delete column with existing cards. Move cards to another column first.',
                cardsCount: cards.length 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Delete the column
          const { error } = await supabaseClient
            .from('pipeline_columns')
            .delete()
            .eq('id', columnId);

          if (error) throw error;

          console.log('✅ Column deleted successfully:', columnId);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'cards':
        if (method === 'GET') {
          const pipelineId = url.searchParams.get('pipeline_id');
          const cardId = url.searchParams.get('id');
          
          // Se tiver cardId, buscar card específico
          if (cardId) {
            const { data: card, error } = await supabaseClient
              .from('pipeline_cards')
              .select(`
                *,
                contact:contacts(
                  *,
                  contact_tags(
                    tag_id,
                    tags!contact_tags_tag_id_fkey(id, name, color)
                  )
                ),
                conversation:conversations(
                  *,
                  connection:connections!conversations_connection_id_fkey(
                    id,
                    instance_name,
                    phone_number,
                    status,
                    metadata
                  ),
                  queue:queues!conversations_queue_id_fkey(
                    id,
                    name,
                    ai_agent:ai_agents(
                      id,
                      name
                    )
                  )
                ),
                responsible_user:system_users!responsible_user_id(id, name, avatar),
                products:pipeline_cards_products(
                  id,
                  product_id,
                  quantity,
                  unit_value,
                  total_value,
                  product:products(
                    id,
                    name,
                    value
                  )
                )
              `)
              .eq('id', cardId)
              .maybeSingle();

            if (error) throw error;
            return new Response(JSON.stringify(card), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Caso contrário, buscar todos os cards do pipeline
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID or Card ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log(`📊 Fetching cards for pipeline: ${pipelineId}`);
          
          // Primeiro tentar buscar apenas os cards básicos para identificar se o problema é nos relacionamentos
          const { data: cards, error } = await supabaseClient
            .from('pipeline_cards')
            .select(`
              *,
              contact:contacts(
                *,
                contact_tags(
                  tag_id,
                  tags!contact_tags_tag_id_fkey(id, name, color)
                )
              ),
              conversation:conversations(
                *,
                connection:connections!conversations_connection_id_fkey(
                  id,
                  instance_name,
                  phone_number,
                  status,
                  metadata
                ),
                queue:queues!conversations_queue_id_fkey(
                  id,
                  name,
                  ai_agent:ai_agents(
                    id,
                    name
                  )
                )
              ),
              responsible_user:system_users!responsible_user_id(id, name, avatar),
              products:pipeline_cards_products(
                id,
                product_id,
                quantity,
                unit_value,
                total_value,
                product:products(
                  id,
                  name,
                  value
                )
              )
            `)
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Error fetching cards:', error);
            console.error('❌ Error details:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            throw error;
          }
          
          console.log(`✅ Successfully fetched ${cards?.length || 0} cards`);
          return new Response(JSON.stringify(cards || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          try {
            const body = await req.json();
            console.log('📝 Creating card with data:', body);

            let resolvedConversationId = body.conversation_id || null;
            let resolvedWorkspaceId: string | null = null;

            // Descobrir workspace do pipeline (caso precise criar conversa)
            if (body.pipeline_id) {
              const { data: pipelineRow, error: pipelineError } = await supabaseClient
                .from('pipelines')
                .select('workspace_id')
                .eq('id', body.pipeline_id)
                .maybeSingle() as any;

              if (pipelineError) {
                console.error('❌ Erro ao buscar pipeline para criação de card:', pipelineError);
              } else if (pipelineRow) {
                resolvedWorkspaceId = pipelineRow.workspace_id;
              }
            }

            // Se não veio conversation_id mas temos contact_id, tentar reutilizar ou criar conversa
            if (!resolvedConversationId && body.contact_id) {
              console.log('🔍 Card sem conversation_id informado. Tentando resolver automaticamente...');

              const { data: contactRow, error: contactError } = await supabaseClient
                .from('contacts')
                .select('id, phone, workspace_id, name')
                .eq('id', body.contact_id)
                .maybeSingle() as any;

              if (contactError || !contactRow) {
                console.error('❌ Não foi possível buscar o contato para criação da conversa:', contactError);
              } else {
                const effectiveWorkspaceId = contactRow.workspace_id || resolvedWorkspaceId;
                resolvedWorkspaceId = effectiveWorkspaceId || resolvedWorkspaceId;

                if (!effectiveWorkspaceId) {
                  console.warn('⚠️ Workspace do contato/pipeline não encontrado. Não será possível criar conversa automaticamente.');
                } else {
                  const normalizedPhone = contactRow.phone?.replace(/\D/g, '') || null;

                  if (!normalizedPhone) {
                    console.warn('⚠️ Contato não possui telefone. Não é possível criar conversa automaticamente.');
                  } else {
                    // Procurar conversa aberta existente
                    const { data: existingConversation, error: existingConversationError } = await supabaseClient
                      .from('conversations')
                      .select('id, connection_id')
                      .eq('contact_id', contactRow.id)
                      .eq('workspace_id', effectiveWorkspaceId)
                      .eq('status', 'open')
                      .maybeSingle() as any;

                    if (existingConversationError) {
                      console.error('❌ Erro ao buscar conversa existente:', existingConversationError);
                    } else if (existingConversation?.id) {
                      resolvedConversationId = existingConversation.id;
                      console.log(`✅ Conversa existente reutilizada: ${resolvedConversationId}`);
                    } else {
                      console.log('📡 Nenhuma conversa aberta encontrada. Criando nova conversa automaticamente...');

                      // Buscar conexão padrão/ativa para associar à conversa
                      const { data: defaultConnection, error: connectionError } = await supabaseClient
                        .from('connections')
                        .select('id, instance_name')
                        .eq('workspace_id', effectiveWorkspaceId)
                        .eq('status', 'connected')
                        .order('is_default', { ascending: false })
                        .limit(1)
                        .maybeSingle() as any;

                      if (connectionError) {
                        console.error('❌ Erro ao buscar conexão padrão:', connectionError);
                      }

                      const conversationPayload: any = {
                        contact_id: contactRow.id,
                        workspace_id: effectiveWorkspaceId,
                        status: 'open',
                        canal: 'whatsapp',
                        agente_ativo: false,
                        connection_id: defaultConnection?.id || null,
                        evolution_instance: defaultConnection?.instance_name || null,
                      };

                      const { data: newConversation, error: conversationError }: any = await supabaseClient
                        .from('conversations')
                        .insert(conversationPayload)
                        .select('id')
                        .single();

                      if (conversationError || !newConversation?.id) {
                        console.error('❌ Erro ao criar conversa automaticamente:', conversationError);
                      } else {
                        resolvedConversationId = newConversation.id;
                        console.log(`✅ Conversa criada automaticamente: ${resolvedConversationId}`);
                      }
                    }
                  }
                }
              }
            }

            if (!resolvedConversationId) {
              console.error('❌ Não foi possível resolver conversation_id para o card. Cancelando criação.');
              return new Response(
                JSON.stringify({
                  error: 'Não foi possível vincular o card a uma conversa. Verifique se o contato possui telefone válido e se há uma conexão WhatsApp ativa.',
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }

            const insertPayload = {
              pipeline_id: body.pipeline_id,
              column_id: body.column_id,
              conversation_id: resolvedConversationId,
              contact_id: body.contact_id,
              description: body.description || body.title || '',
              value: body.value || 0,
              status: body.status || 'aberto',
              tags: body.tags || [],
              responsible_user_id: body.responsible_user_id,
            };

            const { data: card, error } = await supabaseClient
              .from('pipeline_cards')
              .insert(insertPayload as any)
              .select(`
                *,
                contact:contacts(
                  *,
                  contact_tags(
                    tag_id,
                    tags!contact_tags_tag_id_fkey(id, name, color)
                  )
                ),
                conversation:conversations(
                  *,
                  connection:connections!conversations_connection_id_fkey(
                    id,
                    instance_name,
                    phone_number,
                    status,
                    metadata
                  )
                ),
                responsible_user:system_users!responsible_user_id(id, name, avatar)
              `)
              .single();

            if (error) {
              console.error('❌ Database error creating card:', error);

              const errorMessage = typeof error?.message === 'string' ? error.message : '';
              const errorDetails = typeof error?.details === 'string' ? error.details : '';

              const isDuplicateError =
                error?.code === '23505' ||
                errorMessage.includes('duplicate key value') ||
                errorMessage.includes('duplicate_open_card') ||
                errorDetails.includes('duplicate_open_card');

              if (isDuplicateError) {
                console.warn('⚠️ Duplicate open card detected for contact:', {
                  contact_id: body.contact_id,
                  pipeline_id: body.pipeline_id,
                  conversation_id: resolvedConversationId
                });

                return new Response(
                  JSON.stringify({
                    error: 'duplicate_open_card',
                    message: 'Já existe um card aberto para este contato neste pipeline.'
                  }),
                  { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }

              throw error;
            }
            
            console.log('✅ Card created successfully:', card);
            return new Response(JSON.stringify(card), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (err) {
            console.error('❌ Error in POST cards:', err);

            const code = (err as any)?.code;
            const message = (err as any)?.message || (err instanceof Error ? err.message : 'Erro desconhecido ao criar card');
            const details = (err as any)?.details;

            // Se for erro conhecido do Postgres, retornar resposta estruturada em vez de 500 genérico
            if (code) {
              const status = code === '23505' ? 409 : 400;

              return new Response(JSON.stringify({
                error: code,
                message,
                details
              }), {
                status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }

            return new Response(JSON.stringify({
              error: 'unexpected_error',
              message,
              details
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        if (method === 'PUT') {
          try {
            const body = await req.json();
            const cardId = url.searchParams.get('id');
            if (!cardId) {
              return new Response(
                JSON.stringify({ error: 'Card ID required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            console.log('📝 ========== ATUALIZANDO CARD ==========');
            console.log('📝 Card ID:', cardId);
            console.log('📝 Dados recebidos:', JSON.stringify(body, null, 2));
            console.log('📝 Body keys:', Object.keys(body));
            console.log('📝 column_id no body:', body.column_id);
            console.log('📝 column_id type:', typeof body.column_id);

            // Validate that column belongs to the target pipeline if both are being updated
            if (body.column_id && body.pipeline_id) {
              const { data: column, error: colError } = await supabaseClient
                .from('pipeline_columns')
                .select('pipeline_id')
                .eq('id', body.column_id)
                .single() as any;

              if (colError) {
                console.error('❌ Column not found:', body.column_id);
                throw new Error('Coluna não encontrada');
              }

              if ((column as any).pipeline_id !== body.pipeline_id) {
                console.error('❌ Column does not belong to pipeline:', {
                  column_id: body.column_id,
                  column_pipeline: (column as any).pipeline_id,
                  target_pipeline: body.pipeline_id
                });
                throw new Error('A coluna não pertence ao pipeline de destino');
              }
            }

            const updateData: any = {};
            if (body.column_id !== undefined) updateData.column_id = body.column_id;
            if (body.pipeline_id !== undefined) updateData.pipeline_id = body.pipeline_id;
            if (body.title !== undefined) updateData.description = body.title; // Map title to description for backwards compatibility
            if (body.description !== undefined) updateData.description = body.description;
            if (body.value !== undefined) updateData.value = body.value;
            if (body.status !== undefined) updateData.status = body.status;
            if (body.tags !== undefined) updateData.tags = body.tags;
            if (body.responsible_user_id !== undefined) updateData.responsible_user_id = body.responsible_user_id;

            console.log('🔄 Update data prepared:', updateData);
            console.log('🔍 ========== VERIFICANDO MUDANÇA DE COLUNA ==========');
            console.log('🔍 body.column_id:', body.column_id);
            console.log('🔍 body.column_id !== undefined:', body.column_id !== undefined);
            console.log('🔍 typeof body.column_id:', typeof body.column_id);

            // ✅ Buscar card atual ANTES da atualização para registrar informações
            console.log(`📋 ========== BUSCANDO CARD ATUAL ==========`);
            let previousColumnId: string | null = null;
            let conversationIdFromCard: string | null = null;
            let previousResponsibleId: string | null = null;
            
            try {
              const { data: currentCard, error: fetchError } = await supabaseClient
                .from('pipeline_cards')
                .select('column_id, conversation_id, contact_id, responsible_user_id')
                .eq('id', cardId)
                .single();
              
              if (fetchError) {
                console.error(`❌ Erro ao buscar card atual:`, {
                  error: fetchError,
                  message: fetchError.message,
                  code: fetchError.code
                });
              } else if (currentCard) {
                previousColumnId = (currentCard as any)?.column_id || null;
                conversationIdFromCard = (currentCard as any)?.conversation_id || null;
                previousResponsibleId = (currentCard as any)?.responsible_user_id || null;
                
                console.log(`📋 ✅ Dados atuais do card:`);
                console.log(`    • Coluna atual: ${previousColumnId}`);
                console.log(`    • conversation_id atual: ${conversationIdFromCard}`);
                console.log(`    • responsável atual: ${previousResponsibleId}`);
                
                if (body.column_id !== undefined) {
                  console.log(`📋 ✅ Nova coluna sendo definida: ${body.column_id}`);
                }
              } else {
                console.warn(`⚠️ Card atual não encontrado antes da atualização`);
              }
            } catch (fetchErr) {
              console.error(`❌ Exception ao buscar card atual:`, fetchErr);
            }

            // ✅ Atualizar moved_to_column_at quando card muda de coluna
            const columnChangedForTimestamp = body.column_id !== undefined &&
              ((previousColumnId && previousColumnId !== body.column_id) || (!previousColumnId && body.column_id));

            if (columnChangedForTimestamp) {
              updateData.moved_to_column_at = new Date().toISOString();
              console.log(`🕒 Atualizando moved_to_column_at para card ${cardId} -> nova coluna: ${body.column_id}`);
            }

            console.log('📋 ========== ATUALIZANDO CARD NO BANCO ==========');
            
            // Fazer update sem select para evitar erro de workspace_id
            const { error: updateError } = (await (supabaseClient
              .from('pipeline_cards') as any)
              .update(updateData)
              .eq('id', cardId)) as any;

            if (updateError) {
              console.error('❌ Database error updating card:', updateError);
              throw updateError;
            }

            // Buscar card atualizado separadamente com join de pipeline
            const { data: card, error: selectError } = (await supabaseClient
              .from('pipeline_cards')
              .select(`
                *,
                conversation:conversations(id, contact_id, connection_id, workspace_id),
                contact:contacts(id, phone, name),
                pipelines:pipelines!inner(id, workspace_id, name)
              `)
              .eq('id', cardId)
              .single()) as any;

            if (selectError) {
              console.error('❌ Database error selecting updated card:', selectError);
              throw selectError;
            }
            
            // ✅ Garantir que conversation_id está presente (pode não vir no select se for null)
            if (!card.conversation_id) {
              if (conversationIdFromCard) {
                card.conversation_id = conversationIdFromCard;
                console.log(`✅ [Post-Update] conversation_id restaurado do cache pre-update: ${card.conversation_id}`);
              } else {
                const { data: cardConversation } = await supabaseClient
                  .from('pipeline_cards')
                  .select('conversation_id')
                  .eq('id', cardId)
                  .single() as any;
                
                if (cardConversation?.conversation_id) {
                  card.conversation_id = cardConversation.conversation_id;
                  console.log(`✅ [Post-Update] conversation_id carregado diretamente: ${card.conversation_id}`);
                } else {
                  console.warn(`⚠️ [Post-Update] conversation_id ainda ausente para card ${cardId}`);
                }
              }
            }
            
            console.log('✅ Card updated successfully:', {
              id: card.id,
              column_id: card.column_id,
              pipeline_id: card.pipeline_id,
              conversation_id: card.conversation_id,
              conversation_object: card.conversation ? { id: card.conversation.id } : null,
              contact_id: card.contact_id
            });

            // ✅ Limpar execuções de automações quando card muda de coluna
            if (previousColumnId && body.column_id && previousColumnId !== body.column_id) {
              console.log('🗑️ Card mudou de coluna, limpando execuções de automações anteriores');
              console.log(`   Coluna anterior: ${previousColumnId} -> Nova coluna: ${body.column_id}`);
              
              try {
                const { error: deleteError } = await (supabaseClient as any)
                  .from('crm_automation_executions')
                  .delete()
                  .eq('card_id', cardId)
                  .eq('column_id', previousColumnId);

                if (deleteError) {
                  console.error('❌ Erro ao deletar execuções anteriores:', deleteError);
                } else {
                  console.log('✅ Execuções de automações anteriores limpas com sucesso');
                }

            const { error: deleteMessageAutomationError } = await (supabaseClient as any)
              .from('automation_executions')
              .delete()
              .eq('card_id', cardId)
              .eq('column_id', previousColumnId);

            if (deleteMessageAutomationError) {
              console.error('❌ Erro ao limpar automation_executions (message_received):', deleteMessageAutomationError);
            } else {
              console.log('✅ automation_executions limpo para column_id anterior');
            }
              } catch (delErr) {
                console.error('❌ Exception ao deletar execuções:', delErr);
              }
            }

          // ✅ EXECUTAR AUTOMAÇÕES quando card entra em nova coluna
          console.log('🔍 ========== VERIFICANDO SE DEVE ACIONAR AUTOMAÇÕES ==========');
          console.log('🔍 Condições:');
          console.log('  - body.column_id !== undefined:', body.column_id !== undefined);
          console.log('  - previousColumnId:', previousColumnId);
          console.log('  - previousColumnId === null:', previousColumnId === null);
          console.log('  - previousColumnId !== body.column_id:', previousColumnId !== body.column_id);
          
          // Verificar: column_id foi atualizado E (houve mudança OU é a primeira vez que entra na coluna)
          const columnChanged = body.column_id !== undefined && 
                                (previousColumnId === null || previousColumnId !== body.column_id);
          
          console.log(`🔍 Resultado da verificação:`, {
            column_id_provided: body.column_id !== undefined,
            previousColumnId: previousColumnId,
            newColumnId: body.column_id,
            columnChanged: columnChanged,
            isFirstTime: previousColumnId === null,
            isDifferentColumn: previousColumnId !== null && previousColumnId !== body.column_id
          });

          if (columnChanged) {
            console.log(`🤖 ✅ COLUNA MUDOU - ACIONANDO AUTOMAÇÕES!`);
            console.log(`🤖 ========== AUTOMAÇÃO TRIGGERED ==========`);
            console.log(`🤖 Card entrou em nova coluna: ${previousColumnId} -> ${body.column_id}`);
            console.log(`📦 Dados do card:`, JSON.stringify({
              id: card.id,
              conversation_id: card.conversation_id,
              contact_id: card.contact_id,
              description: card.description,
              pipeline_id: card.pipeline_id || body.pipeline_id
            }, null, 2));

            try {
              console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`🔍 MOVIMENTO DO CARD:`);
              console.log(`   📤 SAIU da coluna: ${previousColumnId || 'N/A'}`);
              console.log(`   📥 ENTROU na coluna: ${body.column_id}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              
              // ✅ BUSCAR AUTOMAÇÕES DE AMBAS AS COLUNAS
              const automationsToProcess: Array<{ automation: any, triggerType: 'enter_column' | 'leave_column' }> = [];
              
              // 1️⃣ Buscar automações "AO SAIR" da COLUNA ANTERIOR
              if (previousColumnId) {
                console.log(`\n🚪 [1/2] Buscando automações "AO SAIR" da coluna ${previousColumnId}...`);
                
                const { data: leaveAutomations, error: leaveError } = (await (supabaseClient as any)
                  .rpc('get_column_automations', { p_column_id: previousColumnId })) as any;
                
                if (leaveError) {
                  console.error('❌ Erro ao buscar automações:', leaveError);
                } else if (leaveAutomations && leaveAutomations.length > 0) {
                  console.log(`   ✅ ${leaveAutomations.length} automação(ões) encontrada(s) nesta coluna`);
                  
                  let foundLeave = 0;
                  for (const auto of leaveAutomations) {
                    console.log(`   📋 Automação: "${auto.name}" (${auto.is_active ? 'ATIVA' : 'INATIVA'})`);
                    if (auto.is_active) {
                      automationsToProcess.push({ automation: auto, triggerType: 'leave_column' });
                      foundLeave++;
                    }
                  }
                  
                  if (foundLeave === 0) {
                    console.log(`   ⚠️ Nenhuma automação "AO SAIR" configurada ou todas inativas`);
                  } else {
                    console.log(`   ✅ ${foundLeave} automação(ões) "AO SAIR" serão processadas`);
                  }
                } else {
                  console.log(`   ℹ️ Nenhuma automação configurada nesta coluna`);
                }
              }
              
              // 2️⃣ Buscar automações "AO ENTRAR" da NOVA COLUNA
              console.log(`\n🚪 [2/2] Buscando automações "AO ENTRAR" na coluna ${body.column_id}...`);
              
              const { data: enterAutomations, error: enterError } = (await (supabaseClient as any)
                .rpc('get_column_automations', { p_column_id: body.column_id })) as any;
              
              if (enterError) {
                console.error('❌ Erro ao buscar automações:', enterError);
              } else if (enterAutomations && enterAutomations.length > 0) {
                console.log(`   ✅ ${enterAutomations.length} automação(ões) encontrada(s) nesta coluna`);
                
                let foundEnter = 0;
                for (const auto of enterAutomations) {
                  console.log(`   📋 Automação: "${auto.name}" (${auto.is_active ? 'ATIVA' : 'INATIVA'})`);
                  if (auto.is_active) {
                    automationsToProcess.push({ automation: auto, triggerType: 'enter_column' });
                    foundEnter++;
                  }
                }
                
                if (foundEnter === 0) {
                  console.log(`   ⚠️ Nenhuma automação "AO ENTRAR" configurada ou todas inativas`);
                } else {
                  console.log(`   ✅ ${foundEnter} automação(ões) "AO ENTRAR" serão processadas`);
                }
              } else {
                console.log(`   ⚠️ NENHUMA AUTOMAÇÃO ENCONTRADA NESTA COLUNA!`);
                console.log(`   💡 DICA: Configure automações "AO ENTRAR" NESTA coluna (${body.column_id})`);
                console.log(`   💡 Para automações dispararem quando o card ENTRA aqui`);
              }
              
              console.log(`📋 Total de automações a processar: ${automationsToProcess.length}`);
              
              if (automationsToProcess.length === 0) {
                console.log(`ℹ️ Nenhuma automação ativa encontrada para processar`);
              } else {
                // 3️⃣ Processar cada automação
                for (const { automation, triggerType } of automationsToProcess) {
                  try {
                    console.log(`\n🔍 ========== PROCESSANDO AUTOMAÇÃO ==========`);
                    console.log(`🔍 Nome: "${automation.name}"`);
                    console.log(`🔍 ID: ${automation.id}`);
                    console.log(`🔍 Coluna: ${automation.column_id}`);
                    console.log(`🔍 Trigger esperado: ${triggerType}`);
                    console.log(`🔍 Ativa: ${automation.is_active}`);
                    
                    // Buscar triggers e actions da automação
                    console.log(`📥 Buscando detalhes da automação...`);
                    const { data: automationDetails, error: detailsError } = (await (supabaseClient as any)
                      .rpc('get_automation_details', { p_automation_id: automation.id })) as any;
                    
                    if (detailsError) {
                      console.error(`❌ Erro ao buscar detalhes da automação ${automation.id}:`, detailsError);
                      continue;
                    }
                    
                    if (!automationDetails) {
                      console.warn(`⚠️ Detalhes da automação ${automation.id} não encontrados`);
                      continue;
                    }
                    
                    // Parsear JSONB se necessário
                    let parsedDetails = automationDetails;
                    if (typeof automationDetails === 'string') {
                      try {
                        parsedDetails = JSON.parse(automationDetails);
                      } catch (parseError) {
                        console.error(`❌ Erro ao parsear detalhes da automação:`, parseError);
                        continue;
                      }
                    }
                    
                    const triggers = parsedDetails.triggers || [];
                    const actions = parsedDetails.actions || [];
                    
                    console.log(`📋 Automação tem ${triggers.length} trigger(s) e ${actions.length} ação(ões)`);
                    console.log(`📋 Triggers:`, JSON.stringify(triggers, null, 2));
                    console.log(`📋 Actions:`, JSON.stringify(actions.map((a: any) => ({
                      type: a.action_type,
                      order: a.action_order,
                      config: a.action_config
                    })), null, 2));
                    
                    // ✅ Verificar se tem o trigger correto
                    const hasCorrectTrigger = triggers.some((t: any) => {
                      const tType = t.trigger_type || t?.trigger_type;
                      const result = tType === triggerType;
                      console.log(`🔍 Verificando trigger: ${tType} === '${triggerType}' ? ${result}`);
                      return result;
                    });
                    
                    if (!hasCorrectTrigger) {
                      console.log(`⏭️ Automação ${automation.id} não tem trigger ${triggerType}, pulando`);
                      continue;
                    }
                    
                    console.log(`🚀 ========== EXECUTANDO AUTOMAÇÃO ==========`);
                    console.log(`🚀 Nome: "${automation.name}" (${automation.id})`);
                    console.log(`🚀 Trigger: ${triggerType}`);
                    
                    // Executar ações em ordem
                    const sortedActions = [...actions].sort((a: any, b: any) => (a.action_order || 0) - (b.action_order || 0));
                    
                    console.log(`🎬 Ações ordenadas:`, sortedActions.map((a: any) => ({
                      type: a.action_type,
                      order: a.action_order
                    })));
                    
                    // Verificar dados do card antes de executar ações
                    console.log(`📦 Dados do card que serão passados para as ações:`, {
                      id: card.id,
                      conversation_id: card.conversation_id,
                      conversation_object: card.conversation ? {
                        id: card.conversation.id,
                        contact_id: card.conversation.contact_id
                      } : null,
                      contact_id: card.contact_id,
                      description: card.description,
                      column_id: card.column_id,
                      pipeline_id: card.pipeline_id
                    });
                    
                    // ✅ CRÍTICO: Garantir que card tem conversation_id antes de executar remove_agent
                    const hasRemoveAgentAction = sortedActions.some((a: any) => a.action_type === 'remove_agent');
                    if (hasRemoveAgentAction && !card.conversation_id && !card.conversation?.id) {
                      console.error(`❌ ERRO CRÍTICO: Card não tem conversation_id mas há ação remove_agent!`);
                      console.error(`❌ Card completo:`, JSON.stringify(card, null, 2));
                      console.error(`❌ Ações que requerem conversation_id:`, sortedActions
                        .filter((a: any) => a.action_type === 'remove_agent')
                        .map((a: any) => ({ type: a.action_type, config: a.action_config })));
                    }
                    
                    // Executar ações em background (não bloqueante)
                    // Usar Promise.allSettled para garantir que todos executem mesmo se alguns falharem
                    const actionPromises = sortedActions.map(async (action: any) => {
                      try {
                        console.log(`\n🎬 ========== EXECUTANDO AÇÃO ==========`);
                        console.log(`🎬 Tipo: ${action.action_type}`);
                        console.log(`🎬 Ordem: ${action.action_order || 0}`);
                        console.log(`🎬 Config:`, JSON.stringify(action.action_config, null, 2));
                        console.log(`🎬 Card ID: ${card.id}, Conversation ID: ${card.conversation_id || card.conversation?.id || 'NÃO ENCONTRADO'}`);
                        
                        // ✅ CRÍTICO: Para remove_agent, garantir que temos conversation_id
                        if (action.action_type === 'remove_agent') {
                          const finalConversationId = card.conversation_id || card.conversation?.id;
                          if (!finalConversationId) {
                            console.error(`❌ ERRO: Ação remove_agent requer conversation_id mas card não tem!`);
                            console.error(`❌ Card:`, JSON.stringify({
                              id: card.id,
                              conversation_id: card.conversation_id,
                              conversation: card.conversation
                            }, null, 2));
                            throw new Error(`Card ${card.id} não tem conversation_id. Ação remove_agent não pode ser executada.`);
                          }
                          console.log(`✅ [remove_agent] conversation_id confirmado: ${finalConversationId}`);
                        }
                        
                        await executeAutomationAction(action, card, supabaseClient);
                        
                        console.log(`✅ Ação ${action.action_type} executada com sucesso`);
                        return { success: true, action: action.action_type };
                      } catch (actionError) {
                        console.error(`❌ Erro ao executar ação ${action.action_type}:`, {
                          error: actionError,
                          message: actionError instanceof Error ? actionError.message : String(actionError),
                          stack: actionError instanceof Error ? actionError.stack : undefined
                        });
                        return { success: false, action: action.action_type, error: actionError };
                      }
                    });
                    
                    // Aguardar todas as ações (mas não bloquear se alguma falhar)
                    const actionResults = await Promise.allSettled(actionPromises);
                    
                    const successful = actionResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
                    const failed = actionResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)).length;
                    
                    console.log(`✅ Automação "${automation.name}" executada: ${successful} sucesso(s), ${failed} falha(s)\n`);
                  } catch (automationError) {
                    console.error(`❌ Erro ao processar automação ${automation.id}:`, {
                      error: automationError,
                      message: automationError instanceof Error ? automationError.message : String(automationError),
                      stack: automationError instanceof Error ? automationError.stack : undefined
                    });
                    // Continua para próxima automação mesmo se uma falhar
                  }
                }
              }
              
              console.log(`🤖 ========== FIM DA EXECUÇÃO DE AUTOMAÇÕES ==========\n`);
            } catch (automationError) {
              console.error('❌ Erro geral ao executar automações:', {
                error: automationError,
                message: automationError instanceof Error ? automationError.message : String(automationError),
                stack: automationError instanceof Error ? automationError.stack : undefined
              });
              // Não falha a atualização do card se as automações falharem
            } finally {
              console.log(`🤖 ========== FIM DA EXECUÇÃO DE AUTOMAÇÕES ==========\n`);
            }
            }

            // 🔄 Buscar card final APÓS automações para retornar estado atualizado
            let finalCardForResponse = card;
            if (body.column_id !== undefined) {
              const { data: updatedCard } = (await supabaseClient
                .from('pipeline_cards')
                .select(`
                  *,
                  conversation:conversations(id, contact_id, connection_id, workspace_id),
                  contact:contacts(id, phone, name),
                  pipelines:pipelines!inner(id, workspace_id, name)
                `)
                .eq('id', cardId)
                .single()) as any;
              
              if (updatedCard) {
                finalCardForResponse = updatedCard;
                console.log('✅ Card final atualizado após automações:', {
                  id: finalCardForResponse.id,
                  column_id: finalCardForResponse.column_id
                });
              }
            }

            // 📡 Enviar broadcast APÓS automações para garantir coluna correta
            try {
              console.log('📡 [EF] Preparando broadcast após automações:', {
                cardId: finalCardForResponse.id,
                oldColumnId: body.column_id,
                newColumnId: finalCardForResponse.column_id,
                pipelineId: finalCardForResponse.pipeline_id
              });

              if (realtimeClient && finalCardForResponse?.pipeline_id && finalCardForResponse?.id && finalCardForResponse?.column_id) {
                const channelName = `pipeline-${finalCardForResponse.pipeline_id}`;
                const channel = realtimeClient.channel(channelName);
                
                await channel.subscribe(async (status) => {
                  if (status === 'SUBSCRIBED') {
                    const sendResult = await channel.send({
                      type: 'broadcast',
                      event: 'pipeline-card-moved',
                      payload: { 
                        cardId: finalCardForResponse.id, 
                        newColumnId: finalCardForResponse.column_id 
                      }
                    });
                    console.log('✅ [EF] Broadcast enviado com sucesso:', sendResult);
                    
                    // Aguardar um pouco antes de remover o canal
                    setTimeout(async () => {
                      await realtimeClient.removeChannel(channel);
                    }, 100);
                  }
                });
              } else {
                console.warn('⚠️ [EF pipeline-management] Realtime client indisponível ou dados incompletos');
              }
            } catch (bfErr) {
              console.error('❌ [EF pipeline-management] Erro ao enviar broadcast:', bfErr);
            }
            
            // ✅ Se o responsável foi atualizado e há conversa vinculada, sincronizar e logar auditoria
            const finalConversationId = card.conversation_id || conversationIdFromCard;
            if (body.responsible_user_id !== undefined && finalConversationId) {
              const newResponsibleId = body.responsible_user_id || null;
              
              if (previousResponsibleId !== newResponsibleId) {
                console.log(`🔄 Syncing conversation ${finalConversationId} com novo responsável ${newResponsibleId}`);
                
                const { data: currentConversation } = (await supabaseClient
                  .from('conversations')
                  .select('assigned_user_id, workspace_id')
                  .eq('id', finalConversationId)
                  .single()) as any;
                
                if (currentConversation) {
                  const { error: convUpdateError } = (await (supabaseClient
                    .from('conversations') as any)
                    .update({
                      assigned_user_id: newResponsibleId,
                      assigned_at: new Date().toISOString(),
                      status: 'open'
                    })
                    .eq('id', finalConversationId)) as any;
                  
                  if (convUpdateError) {
                    console.error('❌ Error updating conversation:', convUpdateError);
                  } else {
                    const action = previousResponsibleId ? 'transfer' : 'accept';
                    
                    const { error: logError } = await supabaseClient
                      .from('conversation_assignments')
                      .insert({
                        conversation_id: finalConversationId,
                        from_assigned_user_id: previousResponsibleId,
                        to_assigned_user_id: newResponsibleId,
                        changed_by: userId,
                        action
                      } as any);
                    
                    if (logError) {
                      console.error('❌ Error logging assignment:', logError);
                    } else {
                      console.log(`✅ Registro de histórico criado: ${action} ${previousResponsibleId || 'null'} -> ${newResponsibleId}`);
                    }
                  }
                }
              } else {
                console.log('ℹ️ Responsável informado é igual ao atual; nenhuma atualização de histórico necessária');
              }
            }
            
            return new Response(JSON.stringify(finalCardForResponse), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (error) {
            console.error('❌ Error in PUT /cards:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return new Response(
              JSON.stringify({ error: errorMessage }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (method === 'DELETE') {
          const cardId = url.searchParams.get('id');
          if (!cardId) {
            return new Response(
              JSON.stringify({ error: 'Card ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting card:', cardId);

          // Verificar se o card existe e pertence ao workspace
          const { data: card, error: fetchError } = (await supabaseClient
            .from('pipeline_cards')
            .select('pipeline_id, pipelines!inner(workspace_id)')
            .eq('id', cardId)
            .single()) as any;

          if (fetchError || !card) {
            return new Response(
              JSON.stringify({ error: 'Card not found or access denied' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Verificar se o workspace do card é o mesmo do header
          if (card.pipelines.workspace_id !== workspaceId) {
            return new Response(
              JSON.stringify({ error: 'Card does not belong to current workspace' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Deletar o card (CASCADE já está configurado no banco)
          const { error } = await supabaseClient
            .from('pipeline_cards')
            .delete()
            .eq('id', cardId);

          if (error) throw error;

          console.log('✅ Card deleted successfully:', cardId);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'actions':
        console.log('🎯 Entering actions case, method:', method);
        if (method === 'GET') {
          const pipelineId = url.searchParams.get('pipeline_id');
          console.log('📥 GET actions - pipeline_id:', pipelineId);
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: pipelineActions, error } = await supabaseClient
            .from('pipeline_actions')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('order_position');

          if (error) {
            console.error('❌ Error fetching actions:', error);
            throw error;
          }
          
          console.log('✅ Actions fetched successfully:', pipelineActions?.length || 0);
          return new Response(JSON.stringify(pipelineActions || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          try {
            const body = await req.json();
            console.log('📝 Creating pipeline action with data:', body);
            
            const { data: actionData, error } = await supabaseClient
              .from('pipeline_actions')
              .insert({
                pipeline_id: body.pipeline_id,
                action_name: body.action_name,
                target_pipeline_id: body.target_pipeline_id,
                target_column_id: body.target_column_id,
                deal_state: body.deal_state,
                order_position: body.order_position || 0,
              } as any)
              .select()
              .single();

            if (error) {
              console.error('❌ Database error creating action:', error);
              return new Response(JSON.stringify({
                error: 'database_error',
                message: error.message,
                details: error
              }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            
            console.log('✅ Pipeline action created successfully:', actionData);
            return new Response(JSON.stringify(actionData), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (err) {
            console.error('❌ Error in POST actions:', err);
            throw err;
          }
        }

        if (method === 'PUT') {
          try {
            const actionId = url.searchParams.get('id');
            if (!actionId) {
              return new Response(
                JSON.stringify({ error: 'Action ID required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const body = await req.json();
            console.log('📝 Updating pipeline action:', actionId, body);
            
            const { data: actionData, error } = (await (supabaseClient
              .from('pipeline_actions') as any)
              .update({
                action_name: body.action_name,
                target_pipeline_id: body.target_pipeline_id,
                target_column_id: body.target_column_id,
                deal_state: body.deal_state,
                order_position: body.order_position,
              })
              .eq('id', actionId)
              .select()
              .single()) as any;

            if (error) {
              console.error('❌ Database error updating action:', error);
              return new Response(JSON.stringify({
                error: 'database_error',
                message: error.message,
                details: error
              }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            
            console.log('✅ Pipeline action updated successfully');
            return new Response(JSON.stringify(actionData), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (error) {
            console.error('❌ Error in PUT /actions:', error);
            throw error;
          }
        }

        if (method === 'DELETE') {
          const actionId = url.searchParams.get('id');
          if (!actionId) {
            return new Response(
              JSON.stringify({ error: 'Action ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting pipeline action:', actionId);

          const { error } = await supabaseClient
            .from('pipeline_actions')
            .delete()
            .eq('id', actionId);

          if (error) throw error;

          console.log('✅ Pipeline action deleted successfully:', actionId);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.warn('⚠️ No matching method for actions case, method:', method);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Melhor captura de erros para debugging
    console.error('❌ Pipeline Management Function Error:', {
      error: error,
      errorType: typeof error,
      errorString: String(error),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      errorKeys: error ? Object.keys(error) : [],
    });
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Capturar erros do Supabase que não são instâncias de Error
      errorMessage = (error as any).message || (error as any).error_description || JSON.stringify(error);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
        timestamp: new Date().toISOString(),
        action: 'pipeline-management'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});