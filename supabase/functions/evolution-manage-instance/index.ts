import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

// Get Evolution API configuration from workspace-specific settings
async function getEvolutionConfig(supabase: any, workspaceId: string) {
  console.log('🔧 Getting Evolution config for workspace:', workspaceId);
  
  try {
    // Get workspace-specific config
    const { data: config, error } = await supabase
      .from('evolution_instance_tokens')
      .select('token, evolution_url')
      .eq('workspace_id', workspaceId)
      .single();

    if (!error && config) {
      console.log('✅ Using workspace-specific Evolution config');
      return {
        url: config.evolution_url,
        apiKey: config.token
      };
    }
    
    console.log('⚠️ No workspace config found, using environment fallback');
  } catch (error) {
    console.log('⚠️ Error getting workspace config:', error);
  }

  // No fallback - require workspace configuration
  throw new Error('Evolution API not configured for workspace. Please configure URL and API key in Evolution settings.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 evolution-manage-instance started')
    const { action, connectionId, instanceName } = await req.json()
    console.log('📋 Request body:', { action, connectionId, instanceName })

    if (!action || (!connectionId && !instanceName)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Action and connection identifier required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get connection details
    let query = supabase.from('connections').select('*')
    
    if (connectionId) {
      query = query.eq('id', connectionId)
    } else {
      query = query.eq('instance_name', instanceName)
    }

    const { data: connection, error } = await query.single()

    if (error || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Evolution config after we have the connection (for workspace_id)
    const evolutionConfig = await getEvolutionConfig(supabase, connection.workspace_id)

    if (!evolutionConfig.apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let response: Response
    let newStatus = connection.status

    switch (action) {
      case 'reconnect':
        response = await fetch(`${evolutionConfig.url}/instance/restart/${connection.instance_name}`, {
          method: 'PUT',
          headers: { 'apikey': evolutionConfig.apiKey }
        })
        newStatus = 'connecting'
        break

      case 'disconnect':
        response = await fetch(`${evolutionConfig.url}/instance/logout/${connection.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': evolutionConfig.apiKey }
        })
        newStatus = 'disconnected'
        break

      case 'delete':
        console.log(`🗑️ Deleting instance: ${connection.instance_name}`)
        
        response = await fetch(`${evolutionConfig.url}/instance/delete/${connection.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': evolutionConfig.apiKey }
        })
        
        console.log(`📡 Evolution API delete response status: ${response.status}`)
        
        // Check if deletion was successful or if instance doesn't exist (404)
        if (response.ok || response.status === 404) {
          console.log('✅ Evolution API deletion successful, removing from database')
          
          // First, delete all related data in the correct order
          
          // 1. Get conversation IDs first
          const { data: conversations } = await supabase
            .from('conversations')
            .select('id')
            .eq('connection_id', connection.id);

          const conversationIds = conversations?.map(c => c.id) || [];

          // Delete messages first (they reference conversations)
          const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .in('conversation_id', conversationIds)
          
          if (messagesError) {
            console.error('⚠️ Error deleting messages:', messagesError)
          } else {
            console.log('✅ Messages deleted')
          }

          // 2. Delete conversation assignments
          const { error: assignmentsError } = await supabase
            .from('conversation_assignments')
            .delete()
            .in('conversation_id', conversationIds)
          
          if (assignmentsError) {
            console.error('⚠️ Error deleting conversation assignments:', assignmentsError)
          } else {
            console.log('✅ Conversation assignments deleted')
          }

          // 3. Delete conversation tags
          const { error: tagsError } = await supabase
            .from('conversation_tags')
            .delete()
            .in('conversation_id', conversationIds)
          
          if (tagsError) {
            console.error('⚠️ Error deleting conversation tags:', tagsError)
          } else {
            console.log('✅ Conversation tags deleted')
          }

          // 4. Delete pipeline cards related to conversations from this connection
          const { error: cardsError } = await supabase
            .from('pipeline_cards')
            .delete()
            .in('conversation_id', conversationIds)
          
          if (cardsError) {
            console.error('⚠️ Error deleting pipeline cards:', cardsError)
          } else {
            console.log('✅ Pipeline cards deleted')
          }

          // 5. Delete conversations
          const { error: conversationsError } = await supabase
            .from('conversations')
            .delete()
            .eq('connection_id', connection.id)
          
          if (conversationsError) {
            console.error('⚠️ Error deleting conversations:', conversationsError)
          } else {
            console.log('✅ Conversations deleted')
          }

          // 6. Delete connection secrets
          const { error: secretsError } = await supabase
            .from('connection_secrets')
            .delete()
            .eq('connection_id', connection.id)
          
          if (secretsError) {
            console.error('❌ Error deleting connection secrets:', secretsError)
          } else {
            console.log('✅ Connection secrets deleted')
          }

          // 7. Finally, delete the connection
          const { error: connectionError } = await supabase
            .from('connections')
            .delete()
            .eq('id', connection.id)
          
          if (connectionError) {
            console.error('❌ Error deleting connection:', connectionError)
            return new Response(
              JSON.stringify({ success: false, error: `Database deletion failed: ${connectionError.message}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          
          console.log('✅ Connection deleted from database successfully')
          return new Response(
            JSON.stringify({ success: true, message: 'Connection deleted successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          console.error(`❌ Evolution API deletion failed with status: ${response.status}`)
          const errorData = await response.json().catch(() => ({}))
          console.error('❌ Evolution API error details:', errorData)
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Evolution API deletion failed: ${errorData.message || response.statusText}` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break

      case 'status':
        console.log(`🔍 Checking status for connection: ${connection.id}, instance: ${connection.instance_name}`);
        
        response = await fetch(`${evolutionConfig.url}/instance/connectionState/${connection.instance_name}`, {
          headers: { 'apikey': evolutionConfig.apiKey }
        })
        
        console.log(`📡 Evolution API response status: ${response.status}`);
        
        if (response.ok) {
          const statusData = await response.json()
          console.log(`📊 Evolution API status data:`, JSON.stringify(statusData, null, 2));
          
          const currentStatus = statusData.instance?.state
          console.log(`🎯 Current status from Evolution: "${currentStatus}"`);
          
          if (currentStatus === 'open') {
            newStatus = 'connected'
          } else if (currentStatus === 'close') {
            newStatus = 'disconnected'
          } else {
            newStatus = 'connecting'
          }
          
          console.log(`✅ Mapped status: "${newStatus}"`);
          
          await supabase
            .from('connections')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString(),
              ...(currentStatus === 'open' && { last_activity_at: new Date().toISOString() })
            })
            .eq('id', connection.id)

          console.log(`💾 Database updated with status: "${newStatus}"`);
          
          const responsePayload = { 
            success: true, 
            status: newStatus, 
            evolutionData: statusData 
          };
          
          console.log(`📤 Returning to client:`, JSON.stringify(responsePayload, null, 2));

          return new Response(
            JSON.stringify(responsePayload),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          console.error(`❌ Evolution API status check failed: ${response.status}`);
          const errorText = await response.text();
          console.error(`❌ Error details:`, errorText);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Failed to get status: ${response.statusText}`,
              details: errorText
            }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`❌ Evolution API operation failed:`, errorData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Evolution API error: ${errorData.message || 'Operation failed'}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update connection status
    if (action !== 'delete') {
      await supabase
        .from('connections')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error managing instance:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})