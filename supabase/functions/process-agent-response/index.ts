import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActionMatch {
  type: 'inserir-tag' | 'transferir-fila' | 'transferir-conexao' | 'criar-card' | 'transferir-coluna' | 'info-adicionais';
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

    // Regex patterns para detectar ações no novo formato
    const patterns = {
      inserir_tag: /\[ENVIE PARA O TOOL `inserir-tag` \(METODO POST\) o id: ([a-f0-9-]+)\]/gi,
      transferir_fila: /\[ENVIE PARA O TOOL `transferir-fila` \(METODO POST\) o id: ([a-f0-9-]+)\]/gi,
      transferir_conexao: /\[ENVIE PARA O TOOL `transferir-conexao` \(METODO POST\) o id: ([a-f0-9-]+)\]/gi,
      criar_card: /\[ENVIE PARA O TOOL `criar-card` \(METODO POST\) o pipeline_id: ([a-f0-9-]+) e a coluna_id: ([a-f0-9-]+)(?:\s+com o title (.+?))?\]/gi,
      transferir_coluna: /\[ENVIE PARA O TOOL `transferir-coluna` \(METODO POST\) (?:o pipeline_id: ([a-f0-9-]+) e a coluna_id: ([a-f0-9-]+)|movendo o card atual para a coluna_id: ([a-f0-9-]+) dentro do pipeline_id: ([a-f0-9-]+))\]/gi,
      info_adicionais: /\[ENVIE PARA O TOOL `info-adicionais` \(METODO POST\) o id: ([a-f0-9-]+) e o valor (.+?)\]/gi,
    };

    const actions: ActionMatch[] = [];
    let cleanText = agentResponse;

    // Detectar: [ENVIE PARA O TOOL `inserir-tag` (METODO POST) o id: ID_DA_TAG]
    let match;
    while ((match = patterns.inserir_tag.exec(agentResponse)) !== null) {
      const tagId = match[1].trim();
      actions.push({
        type: 'inserir-tag',
        params: { id: tagId },
        fullMatch: match[0]
      });
      console.log('📌 Ação detectada: Inserir Tag ->', tagId);
    }

    // Detectar: [ENVIE PARA O TOOL `transferir-fila` (METODO POST) o id: ID_DA_FILA]
    while ((match = patterns.transferir_fila.exec(agentResponse)) !== null) {
      const queueId = match[1].trim();
      actions.push({
        type: 'transferir-fila',
        params: { id: queueId },
        fullMatch: match[0]
      });
      console.log('🔀 Ação detectada: Transferir Fila ->', queueId);
    }

    // Detectar: [ENVIE PARA O TOOL `transferir-conexao` (METODO POST) o id: ID_DA_CONEXAO]
    while ((match = patterns.transferir_conexao.exec(agentResponse)) !== null) {
      const connectionId = match[1].trim();
      actions.push({
        type: 'transferir-conexao',
        params: { id: connectionId },
        fullMatch: match[0]
      });
      console.log('🔀 Ação detectada: Transferir Conexão ->', connectionId);
    }

    // Detectar: [ENVIE PARA O TOOL `criar-card` (METODO POST) o pipeline_id: ID_DO_PIPELINE e a coluna_id: ID_DA_COLUNA]
    while ((match = patterns.criar_card.exec(agentResponse)) !== null) {
      const pipelineId = match[1].trim();
      const colunaId = match[2].trim();
      const title = match[3] ? match[3].trim() : 'Novo Card';
      actions.push({
        type: 'criar-card',
        params: { pipeline_id: pipelineId, coluna_id: colunaId, title },
        fullMatch: match[0]
      });
      console.log('📋 Ação detectada: Criar Card CRM ->', pipelineId, colunaId, title);
    }

    // Detectar: [ENVIE PARA O TOOL `transferir-coluna` (METODO POST) ...]
    while ((match = patterns.transferir_coluna.exec(agentResponse)) !== null) {
      const pipelineId = match[1] || match[4];
      const colunaId = match[2] || match[3];
      if (pipelineId && colunaId) {
        actions.push({
          type: 'transferir-coluna',
          params: { pipeline_id: pipelineId.trim(), coluna_id: colunaId.trim() },
          fullMatch: match[0]
        });
        console.log('↔️ Ação detectada: Transferir Coluna ->', pipelineId, colunaId);
      }
    }

    // Detectar: [ENVIE PARA O TOOL `info-adicionais` (METODO POST) o id: ID_DA_INFO e o valor ...]
    while ((match = patterns.info_adicionais.exec(agentResponse)) !== null) {
      const infoId = match[1].trim();
      const value = match[2].trim();
      actions.push({
        type: 'info-adicionais',
        params: { id: infoId, value },
        fullMatch: match[0]
      });
      console.log('💾 Ação detectada: Info Adicionais ->', infoId, value);
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
