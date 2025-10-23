import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      action, 
      params, 
      contactId, 
      conversationId,
      workspaceId 
    } = await req.json();

    console.log('⚡ Executando ação:', action, params);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result: any = { success: false };

    switch (action) {
      case 'add_tag': {
        // Buscar tag pelo nome
        const { data: tag } = await supabase
          .from('tags')
          .select('id')
          .eq('workspace_id', workspaceId)
          .ilike('name', params.tagName)
          .single();

        if (!tag) {
          throw new Error(`Tag "${params.tagName}" não encontrada`);
        }

        // Adicionar tag ao contato
        const { error: tagError } = await supabase
          .from('contact_tags')
          .insert({
            contact_id: contactId,
            tag_id: tag.id
          });

        if (tagError && !tagError.message.includes('duplicate')) {
          throw tagError;
        }

        result = { 
          success: true, 
          message: `Tag "${params.tagName}" adicionada ao contato`,
          tagId: tag.id
        };
        console.log('✅ Tag adicionada:', params.tagName);
        break;
      }

      case 'transfer_queue': {
        // Buscar fila pelo nome
        const { data: queue } = await supabase
          .from('queues')
          .select('id')
          .eq('workspace_id', workspaceId)
          .ilike('name', params.queueName)
          .single();

        if (!queue) {
          throw new Error(`Fila "${params.queueName}" não encontrada`);
        }

        // Atualizar conversa
        const { error: convError } = await supabase
          .from('conversations')
          .update({ 
            queue_id: queue.id,
            assigned_user_id: null, // Resetar atribuição ao transferir
            status: 'open'
          })
          .eq('id', conversationId);

        if (convError) throw convError;

        result = { 
          success: true, 
          message: `Conversa transferida para fila "${params.queueName}"`,
          queueId: queue.id
        };
        console.log('✅ Transferido para fila:', params.queueName);
        break;
      }

      case 'transfer_connection': {
        // Buscar conexão pelo nome
        const { data: connection } = await supabase
          .from('connections')
          .select('id')
          .eq('workspace_id', workspaceId)
          .ilike('instance_name', params.connectionName)
          .single();

        if (!connection) {
          throw new Error(`Conexão "${params.connectionName}" não encontrada`);
        }

        // Atualizar conversa
        const { error: convError } = await supabase
          .from('conversations')
          .update({ 
            connection_id: connection.id,
            assigned_user_id: null,
            status: 'open'
          })
          .eq('id', conversationId);

        if (convError) throw convError;

        result = { 
          success: true, 
          message: `Conversa transferida para conexão "${params.connectionName}"`,
          connectionId: connection.id
        };
        console.log('✅ Transferido para conexão:', params.connectionName);
        break;
      }

      case 'create_crm_card': {
        // Buscar pipeline
        const { data: pipeline } = await supabase
          .from('pipelines')
          .select('id')
          .eq('workspace_id', workspaceId)
          .ilike('name', params.pipelineName)
          .single();

        if (!pipeline) {
          throw new Error(`Pipeline "${params.pipelineName}" não encontrado`);
        }

        // Buscar coluna
        const { data: column } = await supabase
          .from('pipeline_columns')
          .select('id')
          .eq('pipeline_id', pipeline.id)
          .ilike('name', params.columnName)
          .single();

        if (!column) {
          throw new Error(`Coluna "${params.columnName}" não encontrada no pipeline`);
        }

        // Verificar se já existe card aberto para este contato neste pipeline
        const { data: existingCard } = await supabase
          .from('pipeline_cards')
          .select('id')
          .eq('contact_id', contactId)
          .eq('pipeline_id', pipeline.id)
          .eq('status', 'aberto')
          .single();

        if (existingCard) {
          result = {
            success: true,
            message: 'Card já existe para este contato',
            cardId: existingCard.id,
            alreadyExists: true
          };
          console.log('ℹ️ Card já existe');
          break;
        }

        // Buscar nome do contato
        const { data: contact } = await supabase
          .from('contacts')
          .select('name')
          .eq('id', contactId)
          .single();

        // Criar card
        const { data: newCard, error: cardError } = await supabase
          .from('pipeline_cards')
          .insert({
            pipeline_id: pipeline.id,
            column_id: column.id,
            contact_id: contactId,
            conversation_id: conversationId,
            title: `Card - ${contact?.name || 'Cliente'}`,
            status: 'aberto'
          })
          .select()
          .single();

        if (cardError) throw cardError;

        result = { 
          success: true, 
          message: `Card CRM criado em "${params.pipelineName} | ${params.columnName}"`,
          cardId: newCard.id
        };
        console.log('✅ Card CRM criado:', newCard.id);
        break;
      }

      case 'save_info': {
        // Salvar/atualizar informação adicional do contato
        const { error: infoError } = await supabase
          .from('contact_extra_info')
          .upsert({
            contact_id: contactId,
            workspace_id: workspaceId,
            field_name: params.key,
            field_value: params.value
          }, {
            onConflict: 'contact_id,workspace_id,field_name'
          });

        if (infoError) throw infoError;

        result = { 
          success: true, 
          message: `Informação "${params.key}" salva com valor "${params.value}"`,
          key: params.key,
          value: params.value
        };
        console.log('✅ Info salva:', params.key, '=', params.value);
        break;
      }

      default:
        throw new Error(`Ação "${action}" não suportada`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro execute-agent-action:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
