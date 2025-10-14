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
    
    // ✅ IMPORTANTE: Evolution API não aceita filtro de dias
    // O parâmetro 'days' e 'historyDays' são ignorados pela API
    // Ela retorna TUDO quando fullHistory=true
    const syncUrl = `${evolutionToken.evolution_url}/chat/syncHistory/${instanceName}`;
    
    console.log('🌐 Calling Evolution API:', syncUrl);
    console.log('📋 Note: historyDays is stored in DB for UI filtering only, Evolution will sync ALL messages');
    
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionToken.token
      },
      body: JSON.stringify({
        fullHistory: true  // ✅ Sempre true - Evolution retorna tudo
      })
    });
    
    const responseText = await response.text();
    console.log('📥 Evolution API response:', { status: response.status, body: responseText });
    
    if (response.ok) {
      // Atualizar status
      const { error: updateError } = await supabase
        .from('connections')
        .update({
          history_sync_status: 'syncing',
          history_sync_started_at: new Date().toISOString()
        })
        .eq('instance_name', instanceName)
        .eq('workspace_id', workspaceId);
      
      if (updateError) {
        console.error('❌ Error updating connection status:', updateError);
      } else {
        console.log('✅ Connection status updated to syncing');
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'History sync triggered successfully',
        evolutionResponse: responseText
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    throw new Error(`Failed to trigger sync: ${response.status} - ${responseText}`);
    
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
