import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceName, workspaceId, historyDays, historyRecovery } = await req.json();
    
    console.log('🔄 Triggering history sync:', { instanceName, workspaceId, historyDays, historyRecovery });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Buscar config da Evolution
    const { data: evolutionToken, error: tokenError } = await supabase
      .from('evolution_instance_tokens')
      .select('token, evolution_url')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .single();
    
    if (tokenError || !evolutionToken) {
      throw new Error(`Evolution token not found: ${tokenError?.message}`);
    }
    
    console.log('📡 Evolution config found:', { url: evolutionToken.evolution_url });
    
    // ✅ Evolution API usa /chat/findMessages para buscar histórico completo
    // historyDays/historyRecovery são APENAS para metadata no banco (uso no frontend)
    const findMessagesUrl = `${evolutionToken.evolution_url}/chat/findMessages/${instanceName}`;
    
    console.log('🌐 Calling Evolution API (findMessages):', findMessagesUrl);
    console.log('📋 Note: historyDays is stored in DB for UI filtering only');
    
    // Buscar TODAS as mensagens (sem filtro de data)
    const response = await fetch(findMessagesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionToken.token
      },
      body: JSON.stringify({
        where: {}  // ✅ Sem filtro = retorna tudo
      })
    });
    
    const responseData = await response.json();
    console.log('📥 Evolution API response:', { 
      status: response.status, 
      messageCount: Array.isArray(responseData) ? responseData.length : 0 
    });
    
    if (response.ok && Array.isArray(responseData)) {
      console.log(`📊 Found ${responseData.length} historical messages to process`);
      
      // Atualizar status inicial
      await supabase
        .from('connections')
        .update({
          history_sync_status: 'syncing',
          history_sync_started_at: new Date().toISOString()
        })
        .eq('instance_name', instanceName)
        .eq('workspace_id', workspaceId);
      
      // Processar cada mensagem retornada
      let processedCount = 0;
      let errorCount = 0;
      
      for (const message of responseData) {
        try {
          // Chamar evolution-webhook-v2 para processar cada mensagem histórica
          const webhookResponse = await supabase.functions.invoke('evolution-webhook-v2', {
            body: {
              event: 'messages.upsert',
              instance: instanceName,
              data: {
                key: message.key,
                message: message.message,
                messageTimestamp: message.messageTimestamp,
                pushName: message.pushName,
                // ✅ Marcar explicitamente como histórico
                isHistorical: true
              }
            }
          });
          
          if (webhookResponse.error) {
            console.error(`❌ Error processing message ${message.key?.id}:`, webhookResponse.error);
            errorCount++;
          } else {
            processedCount++;
            
            // Log progresso a cada 10 mensagens
            if (processedCount % 10 === 0) {
              console.log(`⏳ Progress: ${processedCount}/${responseData.length} messages processed`);
            }
          }
          
        } catch (error) {
          console.error(`❌ Error processing historical message:`, error);
          errorCount++;
        }
      }
      
      console.log(`✅ History sync completed: ${processedCount} processed, ${errorCount} errors`);
      
      // Atualizar status final
      await supabase
        .from('connections')
        .update({
          history_sync_status: 'completed',
          history_sync_completed_at: new Date().toISOString(),
          history_messages_synced: processedCount
        })
        .eq('instance_name', instanceName)
        .eq('workspace_id', workspaceId);
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'History sync completed',
        processed: processedCount,
        errors: errorCount,
        total: responseData.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    throw new Error(`Failed to fetch messages: ${response.status} - ${JSON.stringify(responseData)}`);
    
  } catch (error) {
    console.error('❌ Error triggering history sync:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
