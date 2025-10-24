import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('update-connection: Starting request processing');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { connectionId, phone_number, auto_create_crm_card, default_pipeline_id, default_column_id, default_column_name, queue_id } = await req.json();

    console.log('update-connection: Received data:', { 
      connectionId, 
      phone_number, 
      auto_create_crm_card, 
      default_pipeline_id,
      default_column_id,
      default_column_name
    });

    if (!connectionId) {
      throw new Error('Connection ID is required');
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (phone_number !== undefined) {
      updateData.phone_number = phone_number;
    }

    if (auto_create_crm_card !== undefined) {
      updateData.auto_create_crm_card = auto_create_crm_card;
    }

    if (default_pipeline_id !== undefined) {
      updateData.default_pipeline_id = default_pipeline_id;
    }

    if (default_column_id !== undefined) {
      updateData.default_column_id = default_column_id;
    }

    if (default_column_name !== undefined) {
      updateData.default_column_name = default_column_name;
    }

    if (queue_id !== undefined) {
      updateData.queue_id = queue_id;
    }

    console.log('update-connection: Updating with data:', updateData);

    // Update the connection
    const { data, error } = await supabase
      .from('connections')
      .update(updateData)
      .eq('id', connectionId)
      .select()
      .single();

    if (error) {
      console.error('update-connection: Database error:', error);
      throw error;
    }

    console.log('update-connection: Successfully updated connection:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        connection: data,
        message: 'Connection updated successfully'
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('update-connection: Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});