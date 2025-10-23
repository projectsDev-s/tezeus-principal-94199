import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActionMatch {
  type: 'add_tag' | 'transfer_queue' | 'create_crm_card' | 'save_info' | 'transfer_connection';
  params: any;
  fullMatch: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      agentResponse, 
      contactId, 
      conversationId,
      workspaceId 
    } = await req.json();

    console.log('🤖 Processando resposta do agente:', {
      contactId,
      conversationId,
      workspaceId,
      responsePreview: agentResponse?.substring(0, 100)
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Regex patterns para cada tipo de ação
    const patterns = {
      add_tag: /\[Adicionar Tag: ([^\]]+)\]/g,
      transfer_queue: /\[Transferir Fila: ([^\]]+)\]/g,
      transfer_connection: /\[Transferir Conexão: ([^\]]+)\]/g,
      create_crm_card: /\[Criar Card CRM: ([^\|]+)\|([^\]]+)\]/g,
      save_info: /\[Salvar Info: ([^=]+)=([^\]]+)\]/g,
    };

    const actions: ActionMatch[] = [];
    let cleanText = agentResponse;

    // Detectar: [Adicionar Tag: Nome da Tag]
    let match;
    while ((match = patterns.add_tag.exec(agentResponse)) !== null) {
      const tagName = match[1].trim();
      actions.push({
        type: 'add_tag',
        params: { tagName },
        fullMatch: match[0]
      });
      console.log('📌 Ação detectada: Adicionar Tag ->', tagName);
    }

    // Detectar: [Transferir Fila: Nome da Fila]
    while ((match = patterns.transfer_queue.exec(agentResponse)) !== null) {
      const queueName = match[1].trim();
      actions.push({
        type: 'transfer_queue',
        params: { queueName },
        fullMatch: match[0]
      });
      console.log('🔀 Ação detectada: Transferir Fila ->', queueName);
    }

    // Detectar: [Transferir Conexão: Nome da Conexão]
    while ((match = patterns.transfer_connection.exec(agentResponse)) !== null) {
      const connectionName = match[1].trim();
      actions.push({
        type: 'transfer_connection',
        params: { connectionName },
        fullMatch: match[0]
      });
      console.log('🔀 Ação detectada: Transferir Conexão ->', connectionName);
    }

    // Detectar: [Criar Card CRM: Pipeline | Coluna]
    while ((match = patterns.create_crm_card.exec(agentResponse)) !== null) {
      const pipelineName = match[1].trim();
      const columnName = match[2].trim();
      actions.push({
        type: 'create_crm_card',
        params: { pipelineName, columnName },
        fullMatch: match[0]
      });
      console.log('📋 Ação detectada: Criar Card CRM ->', pipelineName, '|', columnName);
    }

    // Detectar: [Salvar Info: chave=valor]
    while ((match = patterns.save_info.exec(agentResponse)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      actions.push({
        type: 'save_info',
        params: { key, value },
        fullMatch: match[0]
      });
      console.log('💾 Ação detectada: Salvar Info ->', key, '=', value);
    }

    // Executar todas as ações
    const executionResults = [];
    for (const action of actions) {
      try {
        const result = await supabase.functions.invoke('execute-agent-action', {
          body: {
            action: action.type,
            params: action.params,
            contactId,
            conversationId,
            workspaceId
          }
        });

        executionResults.push({
          action: action.type,
          params: action.params,
          success: result.data?.success || false,
          error: result.error?.message
        });

        console.log(`✅ Ação ${action.type} executada:`, result.data);
      } catch (error) {
        console.error(`❌ Erro ao executar ${action.type}:`, error);
        executionResults.push({
          action: action.type,
          params: action.params,
          success: false,
          error: (error as Error).message
        });
      }

      // Remover marcação do texto
      cleanText = cleanText.replace(action.fullMatch, '');
    }

    // Limpar espaços extras
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

    console.log('✨ Processamento concluído:', {
      actionsDetected: actions.length,
      actionsExecuted: executionResults.filter(r => r.success).length,
      cleanTextPreview: cleanText.substring(0, 100)
    });

    return new Response(JSON.stringify({
      success: true,
      cleanText,
      actionsExecuted: executionResults,
      actionsCount: actions.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro process-agent-response:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
