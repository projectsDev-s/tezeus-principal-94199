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

    const { connectionId, phone_number, auto_create_crm_card, default_pipeline_id, default_column_id, default_column_name, queue_id, instance_name } = await req.json();

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

    const trimmedInstanceName = typeof instance_name === 'string' ? instance_name.trim() : undefined;

    // Buscar conexão atual para validar provider e metadados
    const { data: currentConnection, error: currentConnectionError } = await supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        metadata,
        provider_id,
        workspace_id,
        connection_secrets(token)
      `)
      .eq('id', connectionId)
      .maybeSingle();

    if (currentConnectionError || !currentConnection) {
      console.error('update-connection: Connection not found or error fetching:', currentConnectionError);
      throw new Error('Conexão não encontrada');
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
      // Ensure proper handling of empty strings - convert to null
      if (typeof default_pipeline_id === 'string' && default_pipeline_id.trim() !== '') {
        updateData.default_pipeline_id = default_pipeline_id;
      } else {
        updateData.default_pipeline_id = null;
      }
    }

    if (default_column_id !== undefined) {
      // Ensure proper handling of empty strings - convert to null
      if (typeof default_column_id === 'string' && default_column_id.trim() !== '') {
        updateData.default_column_id = default_column_id;
      } else {
        updateData.default_column_id = null;
      }
    }

    if (default_column_name !== undefined) {
      // Ensure proper handling of empty strings - convert to null
      if (typeof default_column_name === 'string' && default_column_name.trim() !== '') {
        updateData.default_column_name = default_column_name;
      } else {
        updateData.default_column_name = null;
      }
    }

    if (queue_id !== undefined) {
      updateData.queue_id = queue_id;
    }

    if (trimmedInstanceName && trimmedInstanceName !== currentConnection.instance_name) {
      // Buscar provider associado
      let provider = null;
      if (currentConnection.provider_id) {
        const { data: providerData, error: providerError } = await supabase
          .from('whatsapp_providers')
          .select('*')
          .eq('id', currentConnection.provider_id)
          .maybeSingle();

        if (providerError) {
          console.error('update-connection: Error fetching provider:', providerError);
          throw new Error('Erro ao buscar provider associado à conexão');
        }
        provider = providerData;
      } else {
        const { data: providers, error: providersError } = await supabase
          .from('whatsapp_providers')
          .select('*')
          .eq('workspace_id', currentConnection.workspace_id)
          .order('updated_at', { ascending: false });

        if (providersError) {
          console.error('update-connection: Error fetching workspace providers:', providersError);
          throw new Error('Erro ao buscar provider do workspace');
        }

        provider = providers?.find(p => p.provider === 'zapi') ?? providers?.[0] ?? null;
      }

      if (provider?.provider === 'zapi') {
        const zapiUrl: string | undefined = provider.zapi_url || provider.metadata?.zapi_url;
        const zapiClientToken: string | undefined = provider.zapi_client_token;

        if (!zapiUrl || !zapiClientToken) {
          throw new Error('Configuração Z-API incompleta (URL ou Client Token ausente)');
        }

        const metadata = currentConnection.metadata || {};
        const zapiInstanceId =
          metadata?.id ??
          metadata?.instanceId ??
          metadata?.instance_id;
        const zapiInstanceToken =
          metadata?.token ??
          metadata?.instanceToken ??
          metadata?.instance_token ??
          metadata?.accessToken ??
          currentConnection.connection_secrets?.[0]?.token;

        if (!zapiInstanceId || !zapiInstanceToken) {
          console.error('update-connection: Missing Z-API credentials in metadata:', metadata);
          throw new Error('Credenciais da instância Z-API não encontradas. Recrie a conexão ou atualize as credenciais.');
        }

        let baseUrl = zapiUrl;
        if (baseUrl.includes('/instances/integrator')) {
          baseUrl = baseUrl.split('/instances/integrator')[0];
        }
        baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        const renameUrl = `${baseUrl}/instances/${zapiInstanceId}/token/${zapiInstanceToken}/update-name`;

        console.log('update-connection: Renaming Z-API instance via', renameUrl);

        const renameResponse = await fetch(renameUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiClientToken,
          },
          body: JSON.stringify({ value: trimmedInstanceName }),
        });

        if (!renameResponse.ok) {
          const renameErrorText = await renameResponse.text();
          console.error('update-connection: Failed to rename Z-API instance:', renameErrorText);
          throw new Error(`Erro ao renomear instância Z-API: ${renameErrorText}`);
        }

        try {
          const renameResult = await renameResponse.json();
          if (renameResult?.value === false) {
            console.error('update-connection: Z-API rename response indicates failure:', renameResult);
            throw new Error('Falha ao renomear instância Z-API.');
          }
        } catch (_jsonError) {
          // Se não for JSON, assumir sucesso (Z-API pode retornar texto)
          console.log('update-connection: Rename response not JSON, proceeding as success');
        }

        updateData.instance_name = trimmedInstanceName;

        if (metadata && typeof metadata === 'object') {
          updateData.metadata = {
            ...metadata,
            instance_name: trimmedInstanceName,
            instanceName: trimmedInstanceName,
            name: trimmedInstanceName,
            displayName: trimmedInstanceName,
          };
        }
      } else {
        // Se não for Z-API, apenas atualizar banco de dados
        updateData.instance_name = trimmedInstanceName;
      }
    } else if (trimmedInstanceName === '') {
      throw new Error('Nome da instância não pode ser vazio.');
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
        error: error instanceof Error ? error.message : String(error)
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});