import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id",
  "Access-Control-Max-Age": "86400",
};

// Get active WhatsApp provider for workspace
async function getActiveProvider(workspaceId: string, supabase: any) {
  try {
    console.log("🔧 Getting active provider for workspace:", workspaceId);

    const { data: provider, error } = await supabase
      .from("whatsapp_providers")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    if (error || !provider) {
      console.error("❌ No active provider found:", error);
      throw new Error(
        "⚠️ Nenhum provedor WhatsApp ativo configurado. Configure um provedor (Evolution ou Z-API) antes de criar uma instância.",
      );
    }

    console.log("✅ Active provider found:", {
      provider: provider.provider,
      hasEvolutionUrl: !!provider.evolution_url,
      hasEvolutionToken: !!provider.evolution_token,
      hasZapiUrl: !!provider.zapi_url,
      hasZapiToken: !!provider.zapi_token,
    });

    return provider;
  } catch (error) {
    console.error("❌ Error getting active provider:", error);
    throw error;
  }
}

serve(async (req) => {
  console.log("🔥 EVOLUTION CREATE INSTANCE - BUILD 2025-10-14-16:45 UTC");
  console.log("🔥 EVOLUTION CREATE INSTANCE STARTED");
  console.log("🔥 Method:", req.method);
  console.log("🔥 URL:", req.url);
  console.log("🔥 Headers:", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests first
  if (req.method === "OPTIONS") {
    console.log("⚡ CORS preflight request received");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Test endpoint
  if (req.url.includes("test")) {
    console.log("🧪 Test endpoint called");
    return new Response(
      JSON.stringify({ success: true, message: "Function is working", timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    console.log("🚀 Evolution Create Instance Function Started - Method:", req.method);

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("📋 Parsed request body:", requestBody);
    const { 
      instanceName, 
      workspaceId, 
      autoCreateCrmCard, 
      defaultPipelineId,
      defaultColumnId,
      defaultColumnName,
      queueId,
      historyRecovery = 'none',
      phoneNumber,
      metadata
    } = requestBody;
    
    // Map historyRecovery to days
    const historyDaysMap: Record<string, number> = {
      none: 0,
      week: 7,
      month: 30,
      quarter: 90,
    };
    
    const historyDays = historyDaysMap[historyRecovery] || 0;
    
    console.log("📋 Request params:", {
      instanceName,
      workspaceId,
      autoCreateCrmCard,
      defaultPipelineId,
      defaultColumnId,
      defaultColumnName,
      historyRecovery,
      historyDays,
      phoneNumber: phoneNumber || 'not provided',
    });

    if (!instanceName || !workspaceId) {
      console.error("❌ Missing required fields:", { instanceName: !!instanceName, workspaceId: !!workspaceId });
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: instanceName and workspaceId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Initialize Supabase client
    console.log("🔧 Initializing Supabase client...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Missing Supabase environment variables");
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("✅ Supabase client initialized");

    console.log("Supabase URL:", supabaseUrl ? "Present" : "Missing");
    console.log("Supabase Service Key:", supabaseServiceKey ? "Present" : "Missing");

    // Get active provider configuration
    const activeProvider = await getActiveProvider(workspaceId, supabase);
    console.log("Active Provider:", activeProvider.provider);
    console.log("Creating instance for workspace:", workspaceId, "instance:", instanceName);

    // Check workspace connection limit
    const { data: limitData, error: limitError } = await supabase
      .from("workspace_limits")
      .select("connection_limit")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (limitError) {
      console.error("Error checking workspace limits:", limitError);
      return new Response(JSON.stringify({ success: false, error: "Error checking workspace limits" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionLimit = limitData?.connection_limit || 1;
    console.log("Workspace connection limit:", connectionLimit);

    // Check current connection count
    const { data: existingConnections, error: countError } = await supabase
      .from("connections")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (countError) {
      console.error("Error counting existing connections:", countError);
      return new Response(JSON.stringify({ success: false, error: "Error counting existing connections" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentConnectionCount = existingConnections?.length || 0;
    console.log("Current connection count:", currentConnectionCount, "Limit:", connectionLimit);

    if (currentConnectionCount >= connectionLimit) {
      console.error("Connection limit reached:", currentConnectionCount, ">=", connectionLimit);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Connection limit reached. Current: ${currentConnectionCount}, Limit: ${connectionLimit}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if instance name already exists for this workspace
    const { data: existingInstance } = await supabase
      .from("connections")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (existingInstance) {
      console.error("Instance name already exists:", instanceName);
      return new Response(
        JSON.stringify({ success: false, error: "Instance name already exists for this workspace" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create connection record first
    // Ensure column values are properly saved - only set null if truly empty/undefined
    const connectionDataToInsert: any = {
      instance_name: instanceName,
      workspace_id: workspaceId,
      provider_id: activeProvider.id,  // ✅ NOVO: Vincular ao provider usado
      status: "creating",
      history_recovery: historyRecovery,
      history_days: historyDays,
      phone_number: phoneNumber || null,
      auto_create_crm_card: autoCreateCrmCard || false,
      queue_id: queueId || null,
      metadata: metadata || null,
    };

    // Handle pipeline and column fields - ensure they're saved when provided
    if (defaultPipelineId && typeof defaultPipelineId === 'string' && defaultPipelineId.trim() !== '') {
      connectionDataToInsert.default_pipeline_id = defaultPipelineId;
    } else {
      connectionDataToInsert.default_pipeline_id = null;
    }

    if (defaultColumnId && typeof defaultColumnId === 'string' && defaultColumnId.trim() !== '') {
      connectionDataToInsert.default_column_id = defaultColumnId;
    } else {
      connectionDataToInsert.default_column_id = null;
    }

    if (defaultColumnName && typeof defaultColumnName === 'string' && defaultColumnName.trim() !== '') {
      connectionDataToInsert.default_column_name = defaultColumnName;
    } else {
      connectionDataToInsert.default_column_name = null;
    }

    console.log("💾 Inserting connection data:", JSON.stringify(connectionDataToInsert, null, 2));

    const { data: connectionData, error: insertError } = await supabase
      .from("connections")
      .insert(connectionDataToInsert)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating connection record:", insertError);
      return new Response(JSON.stringify({ success: false, error: "Error creating connection record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Connection record created:", connectionData.id);

    // Generate unique token and store connection secrets
    const token = crypto.randomUUID();

    const providerUrl = activeProvider.provider === 'evolution' 
      ? activeProvider.evolution_url 
      : activeProvider.zapi_url;

    const { error: secretError } = await supabase.from("connection_secrets").insert({
      connection_id: connectionData.id,
      token: token,
      evolution_url: providerUrl,
    });

    if (secretError) {
      console.error("Error storing connection secrets:", secretError);
      // Clean up connection record
      await supabase.from("connections").delete().eq("id", connectionData.id);
      return new Response(JSON.stringify({ success: false, error: "Error storing connection secrets" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Connection secrets stored");

    // ✅ VERIFICAR SE PROVIDER SUPORTA CRIAÇÃO AUTOMÁTICA
    if (activeProvider.provider === 'zapi') {
      console.error("❌ Z-API não suporta criação automática de instância");
      await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
      await supabase.from("connections").delete().eq("id", connectionData.id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Z-API não suporta criação automática de instâncias. Por favor, crie a instância manualmente no painel Z-API." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Using Evolution provider, proceeding with instance creation");

    // Prepare Evolution API request
    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook-v2`;

    // Payload seguindo formato Evolution API v2 (camelCase)
    const evolutionPayload: any = {
      instanceName: instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      rejectCall: false,
      msgCall: "",
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
      webhook: {
        url: webhookUrl,
        byEvents: true,
        base64: true,
        events: [
          "QRCODE_UPDATED",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE"
        ]
      }
    };

    // Only add number if provided
    if (phoneNumber) {
      evolutionPayload.number = phoneNumber;
    }
    
    console.log('📤 Payload being sent to Evolution API:', JSON.stringify(evolutionPayload, null, 2));

    // Normalize URL to avoid double slashes
    const baseUrl = activeProvider.evolution_url!.endsWith("/") 
      ? activeProvider.evolution_url!.slice(0, -1) 
      : activeProvider.evolution_url!;
    const fullUrl = `${baseUrl}/instance/create`;

    console.log("🔗 URL:", fullUrl);
    console.log("🔑 Using apikey authentication (consistent with webhook)");

    // Call Evolution API with error handling and timeout
    let evolutionResponse;
    try {
      console.log("🔑 Making Evolution API request");
      console.log("🔗 URL:", fullUrl);

      // Create fetch with timeout to prevent 502 errors
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      evolutionResponse = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: activeProvider.evolution_token!,
        },
        body: JSON.stringify(evolutionPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("✅ Evolution API response status:", evolutionResponse.status);
    } catch (fetchError) {
      console.error("❌ Evolution API request failed:", fetchError);
      await supabase.from("connections").delete().eq("id", connectionData.id);

      const errorMessage =
        (fetchError as any).name === "AbortError"
          ? "Request timeout - Evolution API não respondeu em 30 segundos"
          : `Falha na conexão com Evolution API: ${(fetchError as Error).message}`;

      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!evolutionResponse.ok) {
      let errorData;
      try {
        errorData = await evolutionResponse.json();
      } catch {
        errorData = { message: await evolutionResponse.text() };
      }

      console.error("Evolution API error:", {
        status: evolutionResponse.status,
        error: errorData,
        payload: evolutionPayload,
      });

      // Parse error message for better user feedback
      let userFriendlyError = `Erro na Evolution API (${evolutionResponse.status})`;
      
      if (errorData?.response?.message) {
        const messages = Array.isArray(errorData.response.message) 
          ? errorData.response.message 
          : [errorData.response.message];
        
        // Check for specific error types
        const errorText = messages.join(' ');
        
        if (errorText.includes("Can't reach database server")) {
          userFriendlyError = '⚠️ O servidor Evolution API está com problemas de conexão ao banco de dados. Verifique se o PostgreSQL do Evolution está rodando e acessível.';
        } else if (errorText.includes('PrismaClientKnownRequestError')) {
          userFriendlyError = '⚠️ Erro interno no servidor Evolution API (Prisma Database). Verifique os logs do servidor Evolution.';
        } else if (errorText.includes('ECONNREFUSED')) {
          userFriendlyError = '⚠️ Não foi possível conectar ao servidor Evolution API. Verifique se o servidor está rodando.';
        } else if (errorText.includes('ETIMEDOUT')) {
          userFriendlyError = '⚠️ Timeout ao conectar com o servidor Evolution API. Verifique a conectividade de rede.';
        } else {
          // Use first message if available, truncate to reasonable length
          userFriendlyError = messages[0].substring(0, 300);
        }
      } else if (errorData?.message) {
        userFriendlyError = errorData.message.substring(0, 300);
      }

      // Clean up database records
      await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
      await supabase.from("connections").delete().eq("id", connectionData.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: userFriendlyError,
          details: errorData,
          technicalInfo: `Status: ${evolutionResponse.status}`
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const evolutionData = await evolutionResponse.json();
    console.log("Evolution API response data:", evolutionData);

    // Update connection with Evolution API response
    const updateData: any = {
      metadata: evolutionData,
    };

    // Determine status and extract QR code
    if (evolutionData.instance?.qrcode?.base64) {
      updateData.status = "qr";
      updateData.qr_code = `data:image/png;base64,${evolutionData.instance.qrcode.base64}`;
    } else if (evolutionData.instance?.qrcode?.code) {
      updateData.status = "qr";
      updateData.qr_code = evolutionData.instance.qrcode.code;
    } else if (evolutionData.qrcode?.base64) {
      updateData.status = "qr";
      updateData.qr_code = `data:image/png;base64,${evolutionData.qrcode.base64}`;
    } else if (evolutionData.qrcode?.code) {
      updateData.status = "qr";
      updateData.qr_code = evolutionData.qrcode.code;
    } else if (evolutionData.instance?.state === "open") {
      updateData.status = "connected";
      
      // ✅ Priorizar número da Evolution, mas manter o manual se não vier
      if (evolutionData.instance?.owner) {
        updateData.phone_number = evolutionData.instance.owner;
        console.log(`📱 Phone from Evolution: ${evolutionData.instance.owner}`);
      } else if (!phoneNumber) {
        console.log(`⚠️ No phone from Evolution and none provided manually`);
      }
      // Se não veio da Evolution e não foi fornecido manualmente, manter null
    } else {
      updateData.status = "creating";
    }
    
    console.log(`💾 Updating connection with:`, {
      status: updateData.status,
      phone_from_evolution: evolutionData.instance?.owner,
      phone_manual: phoneNumber,
      phone_will_save: updateData.phone_number
    });

    const { error: updateError } = await supabase.from("connections").update(updateData).eq("id", connectionData.id);

    if (updateError) {
      console.error("Error updating connection:", updateError);
    }

    console.log("Instance created successfully:", {
      id: connectionData.id,
      instance_name: instanceName,
      status: updateData.status,
    });

    // Atualizar status para syncing - a Evolution enviará histórico automaticamente
    if (historyDays > 0 || historyRecovery !== 'none') {
      await supabase
        .from('connections')
        .update({
          history_sync_status: 'syncing',
          history_sync_started_at: new Date().toISOString()
        })
        .eq('id', connectionData.id);
      
      console.log(`✅ History sync configured for ${instanceName} - waiting for Evolution to send history via webhook`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection: {
          ...connectionData,
          ...updateData,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ CRITICAL ERROR in evolution-create-instance:", error);
    console.error("❌ Error name:", (error as any).name);
    console.error("❌ Error message:", (error as Error).message);
    console.error("❌ Error stack:", (error as Error).stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro interno: ${(error as Error).message || "Erro desconhecido"}`,
        errorType: (error as any).name || "UnknownError",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
