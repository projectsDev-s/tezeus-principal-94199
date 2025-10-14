import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id",
  "Access-Control-Max-Age": "86400",
};

// Get Evolution API configuration from workspace settings
async function getEvolutionConfig(workspaceId: string, supabase: any) {
  try {
    console.log("🔧 Getting Evolution config for workspace:", workspaceId);

    // Try to get workspace-specific configuration first
    const { data: configData, error: configError } = await supabase
      .from("evolution_instance_tokens")
      .select("evolution_url, token")
      .eq("workspace_id", workspaceId)
      .eq("instance_name", "_master_config")
      .maybeSingle();

    if (configError) {
      console.log("⚠️ Error querying evolution_instance_tokens:", configError);
    }

    console.log("📋 Config data from database:", {
      found: !!configData,
      hasUrl: !!configData?.evolution_url,
      hasToken: !!configData?.token,
      tokenType: configData?.token === "config_only" ? "config_only" : "actual_token",
      tokenLength: configData?.token ? configData.token.length : 0,
      urlFromDb: configData?.evolution_url,
    });

    // If no config found, try to create one with default values
    if (!configData) {
      console.log("🔧 No config found, creating default configuration...");

      // Get default values from environment or another workspace
      const defaultUrl = Deno.env.get("EVOLUTION_URL") || "https://evolution-evolution.upvzfg.easypanel.host";
      const defaultApiKey = Deno.env.get("EVOLUTION_API_KEY");

      if (!defaultApiKey) {
        console.error("❌ No default Evolution API key available");
        throw new Error(
          "Evolution API não está configurado para este workspace. Configure URL e API key nas configurações da Evolution.",
        );
      }

      // Create default configuration
      const { error: insertError } = await supabase.from("evolution_instance_tokens").insert({
        workspace_id: workspaceId,
        instance_name: "_master_config",
        evolution_url: defaultUrl,
        token: defaultApiKey,
      });

      if (insertError) {
        console.error("❌ Failed to create default config:", insertError);
        throw new Error("Falha ao criar configuração padrão da Evolution API.");
      }

      console.log("✅ Created default configuration for workspace");
      return { url: defaultUrl, apiKey: defaultApiKey };
    }

    let url = null;
    let apiKey = null;

    if (configData?.evolution_url) {
      url = configData.evolution_url;
      console.log("✅ Using workspace-specific URL:", url);
    } else {
      console.error("❌ No workspace Evolution URL found in configuration");
      throw new Error(
        "Evolution URL não configurado para este workspace. Configure a URL nas configurações da Evolution.",
      );
    }

    if (configData?.token && configData.token !== "config_only") {
      apiKey = configData.token; // Use workspace-specific API Key
      console.log("✅ Using workspace-specific API key");
    } else {
      console.error("❌ No valid workspace API key found in configuration");
      throw new Error(
        "Evolution API key não configurado para este workspace. Configure a chave da API nas configurações da Evolution.",
      );
    }

    console.log("🔧 Final config:", {
      url,
      hasApiKey: !!apiKey,
      source: "workspace",
    });

    console.log("✅ API key and URL validation passed");

    return { url, apiKey };
  } catch (error) {
    console.error("❌ Error getting workspace config:", error);
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
    const { instanceName, workspaceId, autoCreateCrmCard, defaultPipelineId } = requestBody;
    
    console.log("📋 Request params:", {
      instanceName,
      workspaceId,
      autoCreateCrmCard,
      defaultPipelineId,
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

    const evolutionConfig = await getEvolutionConfig(workspaceId, supabase);
    console.log("Evolution URL:", evolutionConfig.url);
    console.log("Evolution API Key exists:", !!evolutionConfig.apiKey);

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
    const { data: connectionData, error: insertError } = await supabase
      .from("connections")
      .insert({
        instance_name: instanceName,
        workspace_id: workspaceId,
        status: "creating",
        auto_create_crm_card: autoCreateCrmCard || false,
        default_pipeline_id: defaultPipelineId || null,
      })
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

    const { error: secretError } = await supabase.from("connection_secrets").insert({
      connection_id: connectionData.id,
      token: token,
      evolution_url: evolutionConfig.url,
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

    // Validate API key exists
    if (!evolutionConfig.apiKey) {
      console.error("❌ Missing Evolution API key");
      await supabase.from("connections").delete().eq("id", connectionData.id);
      return new Response(JSON.stringify({ success: false, error: "Missing Evolution API key configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ API key found, proceeding with instance creation");

    // Prepare Evolution API request
    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook-v2`;

    // ✅ PAYLOAD CORRETO conforme documentação Evolution API v2
    // settings vai separado de config/webhook
    const evolutionPayload = {
      instanceName: instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      settings: {
        rejectCall: false,
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: true,
      },
      webhook: {
        url: webhookUrl,
        headers: {
          apikey: token,
          "Content-Type": "application/json",
        },
        events: [
          "MESSAGES_UPDATE",
          "MESSAGES_UPSERT",
          "QRCODE_UPDATED",
          "CONNECTION_UPDATE",
          "CONTACTS_UPSERT",
          "CONTACTS_UPDATE",
        ],
      },
    };

    // Primeiro fetch descartado, usando só o evolutionPayload abaixo

    // Normalize URL to avoid double slashes
    const baseUrl = evolutionConfig.url.endsWith("/") ? evolutionConfig.url.slice(0, -1) : evolutionConfig.url;
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
          apikey: evolutionConfig.apiKey,
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

      // Clean up database records
      await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
      await supabase.from("connections").delete().eq("id", connectionData.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Evolution API error (${evolutionResponse.status}): ${errorData.message || JSON.stringify(errorData)}`,
          details: errorData,
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
      if (evolutionData.instance?.owner) {
        updateData.phone_number = evolutionData.instance.owner;
      }
    } else {
      updateData.status = "creating";
    }

    const { error: updateError } = await supabase.from("connections").update(updateData).eq("id", connectionData.id);

    if (updateError) {
      console.error("Error updating connection:", updateError);
    }

    console.log("Instance created successfully:", {
      id: connectionData.id,
      instance_name: instanceName,
      status: updateData.status,
    });

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
