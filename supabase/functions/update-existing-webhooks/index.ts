import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface EvolutionInstanceToken {
  id: string;
  instance_name: string;
  token: string;
  evolution_url: string;
  workspace_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting webhook update for existing instances...');
    
    // Get all Evolution instances
    const { data: instances, error: instancesError } = await supabase
      .from('evolution_instance_tokens')
      .select('*');

    if (instancesError) {
      throw instancesError;
    }

    if (!instances || instances.length === 0) {
      console.log('ℹ️ No instances found to update');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No instances found to update',
          updated: 0,
          failed: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const instance of instances as EvolutionInstanceToken[]) {
      try {
        console.log(`🔄 Updating webhook for instance: ${instance.instance_name}`);
        
        const webhookBody = {
          url: `${supabaseUrl}/functions/v1/evolution-webhook-v2`,
          webhook_by_events: true,
          webhook_base64: true,
          events: [
            "APPLICATION_STARTUP",
            "QRCODE_UPDATED",
            "CONNECTION_UPDATE", 
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "SEND_MESSAGE",
            "CONTACTS_UPDATE",
            "CONTACTS_UPSERT"
          ]
        };

        console.log(`📡 Updating webhook for ${instance.instance_name} at ${instance.evolution_url}`);
        
        const response = await fetch(`${instance.evolution_url}/webhook/set/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': instance.token
          },
          body: JSON.stringify(webhookBody),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const responseData = await response.json();
        console.log(`✅ Webhook updated successfully for ${instance.instance_name}:`, responseData);
        
        results.push({
          instance_name: instance.instance_name,
          workspace_id: instance.workspace_id,
          success: true,
          message: 'Webhook updated successfully'
        });
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to update webhook for ${instance.instance_name}:`, error);
        results.push({
          instance_name: instance.instance_name,
          workspace_id: instance.workspace_id,
          success: false,
          error: error.message
        });
        failCount++;
      }
    }

    console.log(`🏁 Webhook update completed. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook update process completed',
        total: instances.length,
        updated: successCount,
        failed: failCount,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error updating webhooks:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Error updating webhooks', 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})