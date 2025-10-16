import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user info from headers
    const userId = req.headers.get('x-system-user-id');
    const userEmail = req.headers.get('x-system-user-email');

    if (!userId || !userEmail) {
      throw new Error('User authentication required');
    }

    console.log('📊 Getting workspace stats for user:', userId);

    // Get user profile to check if master
    const { data: userProfile } = await supabase
      .from('system_users')
      .select('profile')
      .eq('id', userId)
      .single();

    const isMaster = userProfile?.profile === 'master';

    // Get workspaces
    let workspacesQuery = supabase.from('workspaces').select('id, name');
    
    if (!isMaster) {
      // Non-master users only see their workspaces
      const { data: memberWorkspaces } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId);
      
      const workspaceIds = memberWorkspaces?.map(w => w.workspace_id) || [];
      workspacesQuery = workspacesQuery.in('id', workspaceIds);
    }

    const { data: workspaces, error: workspacesError } = await workspacesQuery;

    if (workspacesError) {
      throw workspacesError;
    }

    console.log(`✅ Found ${workspaces?.length || 0} workspaces`);

    // Get stats for each workspace using service role (bypasses RLS)
    const stats = await Promise.all(
      (workspaces || []).map(async (workspace) => {
        const [
          { count: connectionsCount },
          { count: conversationsCount },
          { count: messagesCount },
          { count: activeConversations }
        ] = await Promise.all([
          supabase.from('connections').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
          supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
          supabase.from('conversations').select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspace.id)
            .gte('last_activity_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        ]);

        return {
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          connections_count: connectionsCount || 0,
          conversations_count: conversationsCount || 0,
          messages_count: messagesCount || 0,
          active_conversations: activeConversations || 0,
        };
      })
    );

    console.log('✅ Stats collected successfully');

    return new Response(
      JSON.stringify({ stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})