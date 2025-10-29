import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

// Get Evolution API configuration from workspace-specific settings or connection secrets
async function getEvolutionConfig(supabase: any, workspaceId: string, connectionId?: string) {
  console.log('🔧 Getting Evolution config for workspace:', workspaceId, 'connection:', connectionId);
  
  try {
    // Try workspace-specific config first (master config)
    const { data: config, error } = await supabase
      .from('evolution_instance_tokens')
      .select('token, evolution_url')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .maybeSingle();

    if (!error && config) {
      console.log('✅ Using workspace-specific Evolution config');
      return {
        url: config.evolution_url,
        apiKey: config.token !== 'config_only' ? config.token : null
      };
    }
    
    console.log('⚠️ No workspace config found, trying connection secrets');
    
    // If no workspace config, try connection-specific secrets
    if (connectionId) {
      const { data: connSecret, error: connError } = await supabase
        .from('connection_secrets')
        .select('evolution_url, token')
        .eq('connection_id', connectionId)
        .single();
        
      if (!connError && connSecret) {
        console.log('✅ Using connection-specific Evolution config');
        return {
          url: connSecret.evolution_url,
          apiKey: connSecret.token
        };
      }
    }
    
    console.log('⚠️ No connection secrets found, using environment fallback');
  } catch (error) {
    console.log('⚠️ Error getting config:', error);
  }

  // Fallback to environment variables
  const envUrl = Deno.env.get('EVOLUTION_API_URL');
  const envKey = Deno.env.get('EVOLUTION_API_KEY');
  
  if (envUrl && envKey) {
    console.log('✅ Using environment Evolution config');
    return {
      url: envUrl,
      apiKey: envKey
    };
  }

  // No configuration found
  throw new Error('Evolution API not configured for workspace. Please configure URL and API key in Evolution settings.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Store request body at top level for error handling
  let requestBody: any = {}
  let action = ''
  let connectionId = ''

  try {
    console.log('🚀 evolution-manage-instance started')
    
    // Parse request body with error handling
    try {
      requestBody = await req.json()
      console.log('📋 Request body:', requestBody)
      
      action = requestBody.action
      connectionId = requestBody.connectionId || requestBody.instanceName || ''
    } catch (parseError) {
      console.error('❌ Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const instanceName = requestBody.instanceName

    if (!action || (!connectionId && !instanceName)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Action and connection identifier required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get connection details
    let query = supabase.from('connections').select('*')
    
    if (connectionId) {
      query = query.eq('id', connectionId)
    } else {
      query = query.eq('instance_name', instanceName)
    }

    const { data: connection, error: connectionError } = await query.single()

    if (connectionError || !connection) {
      console.error('❌ Connection not found:', connectionError)
      return new Response(
        JSON.stringify({ success: false, error: `Connection not found: ${connectionError?.message || 'Unknown error'}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Connection found:', connection.id, connection.instance_name, connection.workspace_id)

    // Get Evolution config after we have the connection (for workspace_id and connection_id)
    let evolutionConfig
    try {
      evolutionConfig = await getEvolutionConfig(supabase, connection.workspace_id, connection.id)
    } catch (configError) {
      console.error('❌ Error getting Evolution config:', configError)
      return new Response(
        JSON.stringify({ success: false, error: configError instanceof Error ? configError.message : 'Evolution API configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!evolutionConfig || !evolutionConfig.apiKey) {
      console.error('❌ Evolution API key not configured')
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
        try {
          console.log(`🔌 Disconnecting instance: ${connection.instance_name}`)
          console.log(`🔗 Evolution API URL: ${evolutionConfig.url}`)
          
          // Always set as disconnected - our goal is to update local status
          newStatus = 'disconnected'
          
          // Update database first (synchronously)
          console.log(`💾 Updating connection status to: ${newStatus}`)
          const { error: updateError } = await supabase
            .from('connections')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id)
          
          if (updateError) {
            console.error('❌ Error updating connection status:', updateError)
            // Continue anyway - we'll still return success
          } else {
            console.log('✅ Connection status updated successfully')
          }
          
          // Try to call Evolution API in background (don't wait or fail on errors)
          fetch(`${evolutionConfig.url}/instance/logout/${connection.instance_name}`, {
            method: 'DELETE',
            headers: { 'apikey': evolutionConfig.apiKey }
          })
            .then(async (logoutResponse) => {
              console.log(`📡 Evolution API logout response status: ${logoutResponse.status}`)
              if (!logoutResponse.ok && logoutResponse.status !== 404) {
                try {
                  const errorText = await logoutResponse.text()
                  console.warn(`⚠️ Evolution API logout returned status ${logoutResponse.status}:`, errorText.substring(0, 200))
                } catch {
                  console.warn(`⚠️ Evolution API logout returned status ${logoutResponse.status}`)
                }
              }
            })
            .catch((fetchError) => {
              console.error('❌ Error calling Evolution API for logout (non-blocking):', fetchError)
            })
          
          // Return success immediately - database is already updated
          console.log('✅ Disconnect operation completed, returning success')
          return new Response(
            JSON.stringify({ success: true, status: newStatus }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (disconnectError) {
          console.error('❌ Error in disconnect case:', disconnectError)
          // Even if there's an error, return success since we just want to update status
          return new Response(
            JSON.stringify({ success: true, status: 'disconnected' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

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

    // Only check response.ok for actions that haven't handled it yet
    // Skip this check for 'disconnect' and 'delete' as they handle their own responses
    if (action !== 'disconnect' && action !== 'delete' && action !== 'status' && response && !response.ok) {
      try {
        const errorText = await response.text().catch(() => 'Unknown error')
        let errorData = {}
        
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText || 'Operation failed' }
        }
        
        console.error(`❌ Evolution API operation failed:`, errorData)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Evolution API error: ${errorData.message || 'Operation failed'}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (checkError) {
        console.error('❌ Error checking response:', checkError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to process Evolution API response' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Update connection status
    if (action !== 'delete') {
      try {
        console.log(`💾 Updating connection status to: ${newStatus}`)
        const { error: updateError } = await supabase
          .from('connections')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
        
        if (updateError) {
          console.error('❌ Error updating connection status:', updateError)
          // Don't fail the whole operation if status update fails
          console.warn('⚠️ Continuing despite status update error')
        } else {
          console.log('✅ Connection status updated successfully')
        }
      } catch (updateException) {
        console.error('❌ Exception updating connection status:', updateException)
        // Don't fail the whole operation if status update fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error managing instance:', error)
    console.error('❌ Error type:', typeof error)
    console.error('❌ Error string:', String(error))
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Special handling for disconnect - always return success
    if (action === 'disconnect' && connectionId) {
      console.log('⚠️ Error occurred during disconnect, but returning success anyway')
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey)
          await supabase
            .from('connections')
            .update({ 
              status: 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('id', connectionId)
            .catch(() => {}) // Ignore errors
        }
      } catch {}
      
      return new Response(
        JSON.stringify({ success: true, status: 'disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string'
        ? error
        : 'Internal server error'
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})