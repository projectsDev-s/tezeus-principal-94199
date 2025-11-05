import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 [Manage Providers] Starting...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, workspaceId, providerId, providerData } = await req.json();

    if (!workspaceId) {
      throw new Error('workspaceId é obrigatório');
    }

    console.log('📍 Action:', action);
    console.log('📍 Workspace:', workspaceId);

    // LIST - Listar providers do workspace
    if (action === 'list') {
      console.log('📋 Listando providers...');
      
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, providers: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CREATE - Criar novo provider
    if (action === 'create') {
      console.log('➕ Criando provider:', providerData.provider);

      // Se o novo provider for ativo, desativar outros
      if (providerData.is_active) {
        console.log('🔄 Desativando outros providers...');
        await supabase
          .from('whatsapp_providers')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('workspace_id', workspaceId);
      }

      const { data, error } = await supabase
        .from('whatsapp_providers')
        .insert({
          workspace_id: workspaceId,
          provider: providerData.provider,
          is_active: providerData.is_active || false,
          evolution_url: providerData.evolution_url,
          evolution_token: providerData.evolution_token,
          zapi_url: providerData.zapi_url,
          zapi_token: providerData.zapi_token,
          n8n_webhook_url: providerData.n8n_webhook_url,
          enable_fallback: providerData.enable_fallback || false,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Provider criado:', data.id);

      return new Response(
        JSON.stringify({ success: true, provider: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE - Atualizar provider existente
    if (action === 'update') {
      if (!providerId) {
        throw new Error('providerId é obrigatório para update');
      }

      console.log('✏️ Atualizando provider:', providerId);

      // Se o provider está sendo ativado, desativar outros
      if (providerData.is_active) {
        console.log('🔄 Desativando outros providers...');
        await supabase
          .from('whatsapp_providers')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('workspace_id', workspaceId)
          .neq('id', providerId);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (providerData.is_active !== undefined) updateData.is_active = providerData.is_active;
      if (providerData.evolution_url !== undefined) updateData.evolution_url = providerData.evolution_url;
      if (providerData.evolution_token !== undefined) updateData.evolution_token = providerData.evolution_token;
      if (providerData.zapi_url !== undefined) updateData.zapi_url = providerData.zapi_url;
      if (providerData.zapi_token !== undefined) updateData.zapi_token = providerData.zapi_token;
      if (providerData.n8n_webhook_url !== undefined) updateData.n8n_webhook_url = providerData.n8n_webhook_url;
      if (providerData.enable_fallback !== undefined) updateData.enable_fallback = providerData.enable_fallback;

      const { data, error } = await supabase
        .from('whatsapp_providers')
        .update(updateData)
        .eq('id', providerId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Provider atualizado');

      return new Response(
        JSON.stringify({ success: true, provider: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Deletar provider
    if (action === 'delete') {
      if (!providerId) {
        throw new Error('providerId é obrigatório para delete');
      }

      console.log('🗑️ Deletando provider:', providerId);

      // Verificar se há connections usando este provider
      const { data: connections, error: connError } = await supabase
        .from('connections')
        .select('id')
        .eq('provider_id', providerId)
        .limit(1);

      if (connError) throw connError;

      if (connections && connections.length > 0) {
        throw new Error('Não é possível deletar provider com connections associadas');
      }

      const { error } = await supabase
        .from('whatsapp_providers')
        .delete()
        .eq('id', providerId)
        .eq('workspace_id', workspaceId);

      if (error) throw error;

      console.log('✅ Provider deletado');

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTIVATE - Ativar provider específico
    if (action === 'activate') {
      if (!providerId) {
        throw new Error('providerId é obrigatório para activate');
      }

      console.log('🔌 Ativando provider:', providerId);

      // Desativar todos
      await supabase
        .from('whatsapp_providers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId);

      // Ativar o selecionado
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', providerId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Provider ativado');

      return new Response(
        JSON.stringify({ success: true, provider: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Ação desconhecida: ${action}`);

  } catch (error: any) {
    console.error('❌ [Manage Providers] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao gerenciar providers',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
