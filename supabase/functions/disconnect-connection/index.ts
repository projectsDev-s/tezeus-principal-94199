import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔌 disconnect-connection: Starting');
    
    const { connectionId } = await req.json();

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to disconnected
    console.log(`💾 Updating connection ${connectionId} status to disconnected`);
    
    const { error: updateError } = await supabase
      .from('connections')
      .update({ 
        status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('❌ Error updating connection status:', updateError);
      // Still return success - we've done our best
    } else {
      console.log('✅ Connection status updated successfully');
    }

    // Try to disconnect from Evolution API in background (don't wait)
    try {
      // Get connection details first
      const { data: connection } = await supabase
        .from('connections')
        .select('instance_name, workspace_id')
        .eq('id', connectionId)
        .single();

      if (connection?.instance_name && connection?.workspace_id) {
        // Get Evolution config
        const { data: config } = await supabase
          .from('evolution_instance_tokens')
          .select('token, evolution_url')
          .eq('workspace_id', connection.workspace_id)
          .single();

        if (config?.token && config?.evolution_url) {
          // Call Evolution API in background (fire and forget)
          fetch(`${config.evolution_url}/instance/logout/${connection.instance_name}`, {
            method: 'DELETE',
            headers: { 'apikey': config.token }
          })
            .then((resp) => {
              console.log(`📡 Evolution API logout response: ${resp.status}`);
            })
            .catch((err) => {
              console.error('❌ Evolution API logout error (non-blocking):', err);
            });
        }
      }
    } catch (evolutionError) {
      console.error('❌ Error calling Evolution API (non-blocking):', evolutionError);
      // Ignore - this is background operation
    }

    // Always return success
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'disconnected',
        message: 'Connection disconnected successfully'
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ disconnect-connection: Error:', error);
    
    // Even on error, return success since we just want to mark as disconnected
    return new Response(
      JSON.stringify({ 
        success: true,
        status: 'disconnected',
        message: 'Connection marked as disconnected'
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

