import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/calendar"];
const TOKEN_HEALTHCHECK_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 horas

type SupabaseClient = ReturnType<typeof createClient>;

const getEnvOrThrow = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${key}`);
  }
  return value;
};

const base64UrlEncode = (input: ArrayBuffer | Uint8Array) => {
  const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
  const string = btoa(String.fromCharCode(...buffer));
  return string.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const generateCodeVerifier = () => {
  const random = crypto.getRandomValues(new Uint8Array(64));
  return base64UrlEncode(random);
};

const generateCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
};

const cleanupExpiredStates = async (client: SupabaseClient) => {
  const now = new Date().toISOString();
  const { error: expiredError } = await client
    .from("google_calendar_oauth_states")
    .delete()
    .lt("expires_at", now);

  if (expiredError) {
    console.warn("⚠️ Erro ao limpar states expirados", expiredError);
  }

  const { error: usedError } = await client
    .from("google_calendar_oauth_states")
    .delete()
    .not("used_at", "is", null);

  if (usedError) {
    console.warn("⚠️ Erro ao limpar states já utilizados", usedError);
  }
};

const tryRefreshAccessToken = async (refreshToken: string) => {
  const clientId = getEnvOrThrow("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getEnvOrThrow("GOOGLE_OAUTH_CLIENT_SECRET");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await response.json();

  if (!response.ok) {
    console.warn("❌ Falha ao renovar access_token com refresh_token", {
      error: data,
      status: response.status,
    });
    return { success: false, error: data };
  }

  return {
    success: true,
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
    grantedScopes: (data.scope as string)?.split(" ") ?? REQUIRED_SCOPES,
  };
};

const revokeRefreshToken = async (refreshToken: string) => {
  const clientId = getEnvOrThrow("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getEnvOrThrow("GOOGLE_OAUTH_CLIENT_SECRET");

  const params = new URLSearchParams({
    token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.warn("⚠️ Não foi possível revogar token com Google", {
      status: response.status,
      payload,
    });
  } else {
    console.log("✅ Refresh token revogado junto ao Google");
  }
};

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface GoogleAuthorization {
  id: string;
  google_email: string;
  refresh_token: string;
  scopes: string[] | null;
  authorized_at: string;
  last_token_check_at: string | null;
  revoked_at: string | null;
}

const handleStatus = async (
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
) => {
  const { data, error } = await client
    .from("google_calendar_authorizations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ Erro ao buscar status da integração", error);
    throw error;
  }

  const authorization = data as GoogleAuthorization | null;

  if (!authorization) {
    return respond({
      connected: false,
      requiresReconnect: false,
      googleEmail: null,
      authorizedAt: null,
      scopes: [],
      revokedAt: null,
    });
  }

  let requiresReconnect = Boolean(authorization.revoked_at);

  if (!requiresReconnect) {
    const lastCheck = authorization.last_token_check_at
      ? new Date(authorization.last_token_check_at).getTime()
      : 0;
    const now = Date.now();

    if (now - lastCheck > TOKEN_HEALTHCHECK_INTERVAL_MS) {
      const refreshResult = await tryRefreshAccessToken(
        authorization.refresh_token,
      );
      if (!refreshResult.success) {
        requiresReconnect = true;
        await revokeRefreshToken(authorization.refresh_token);
        const { error: revokeError } = await client
          .from("google_calendar_authorizations")
          .update({
            revoked_at: new Date().toISOString(),
            last_token_check_at: new Date().toISOString(),
          })
          .eq("id", authorization.id);

        if (revokeError) {
          console.warn(
            "⚠️ Falha ao marcar autorização Google como revogada",
            revokeError,
          );
        }
      } else {
        const { error: updateError } = await client
          .from("google_calendar_authorizations")
          .update({
            last_token_check_at: new Date().toISOString(),
            scopes: refreshResult.grantedScopes,
          })
          .eq("id", authorization.id);

        if (updateError) {
          console.warn(
            "⚠️ Falha ao atualizar dados de autorização Google",
            updateError,
          );
        }
      }
    }
  }

  return respond({
    connected: !requiresReconnect,
    requiresReconnect,
    googleEmail: authorization.google_email,
    authorizedAt: authorization.authorized_at,
    scopes: authorization.scopes ?? [],
    revokedAt: authorization.revoked_at,
    lastTokenCheckAt: authorization.last_token_check_at,
  });
};

const handleAuthUrl = async (
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
  body: Record<string, unknown>,
) => {
  const redirectUriEnv = getEnvOrThrow("GOOGLE_OAUTH_REDIRECT_URI");
  const requestedRedirectUri = typeof body?.redirectUri === "string"
    ? (body.redirectUri as string)
    : redirectUriEnv;

  if (requestedRedirectUri !== redirectUriEnv) {
    throw new Error("Redirect URI inválido para Google OAuth");
  }

  const clientId = getEnvOrThrow("GOOGLE_OAUTH_CLIENT_ID");
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await client.from("google_calendar_oauth_states").insert({
    state,
    user_id: userId,
    workspace_id: workspaceId,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
  });

  if (error) {
    console.error(
      "❌ Não foi possível registrar state para OAuth do Google",
      error,
    );
    throw error;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUriEnv,
    response_type: "code",
    scope: REQUIRED_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return respond({
    authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    state,
    expiresAt,
  });
};

const exchangeAuthorizationCode = async (
  code: string,
  codeVerifier: string,
  redirectUri: string,
) => {
  const clientId = getEnvOrThrow("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getEnvOrThrow("GOOGLE_OAUTH_CLIENT_SECRET");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
    access_type: "offline",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const payload = await response.json();

  if (!response.ok) {
    console.error("❌ Falha ao trocar authorization_code pelo Google", payload);
    throw new Error(
      payload.error_description ?? "Não foi possível finalizar o OAuth com o Google",
    );
  }

  return payload;
};

const handleExchangeCode = async (
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
  body: Record<string, unknown>,
) => {
  const code = body?.code as string | undefined;
  const state = body?.state as string | undefined;

  if (!code || !state) {
    throw new Error("Código de autorização ou state ausentes");
  }

  const redirectUriEnv = getEnvOrThrow("GOOGLE_OAUTH_REDIRECT_URI");
  const providedRedirectUri = typeof body?.redirectUri === "string"
    ? (body.redirectUri as string)
    : redirectUriEnv;

  if (providedRedirectUri !== redirectUriEnv) {
    throw new Error("Redirect URI inválido para finalizar o OAuth");
  }

  const { data: oauthState, error: stateError } = await client
    .from("google_calendar_oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();

  if (stateError) {
    console.error("❌ Erro ao validar state da integração Google", stateError);
    throw stateError;
  }

  if (!oauthState) {
    throw new Error("State inválido ou expirado. Tente novamente.");
  }

  if (oauthState.user_id !== userId || oauthState.workspace_id !== workspaceId) {
    throw new Error("State não pertence a este usuário/workspace.");
  }

  if (oauthState.used_at) {
    throw new Error("Este state já foi utilizado.");
  }

  if (new Date(oauthState.expires_at) < new Date()) {
    throw new Error("State expirado. Inicie o processo novamente.");
  }

  const tokenPayload = await exchangeAuthorizationCode(
    code,
    oauthState.code_verifier,
    redirectUriEnv,
  );

  if (!tokenPayload.refresh_token) {
    throw new Error(
      "O Google não retornou um refresh_token. Revogue o acesso anterior na sua conta Google e tente novamente.",
    );
  }

  const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });

  const profileData = await profileResponse.json();

  if (!profileResponse.ok) {
    console.error("❌ Erro ao buscar dados do usuário Google", profileData);
    throw new Error("Não foi possível validar os dados da conta Google.");
  }

  if (!profileData?.email) {
    throw new Error("Não recebemos o e-mail da conta Google autenticada.");
  }

  const scopes = (tokenPayload.scope as string)?.split(" ") ?? REQUIRED_SCOPES;

  const { error: upsertError } = await client.from(
    "google_calendar_authorizations",
  ).upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      google_user_id: profileData.id,
      google_email: profileData.email,
      refresh_token: tokenPayload.refresh_token,
      scopes,
      authorized_at: new Date().toISOString(),
      last_token_check_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "workspace_id,user_id" },
  );

  if (upsertError) {
    console.error("❌ Erro ao salvar autorização da Google Agenda", upsertError);
    throw upsertError;
  }

  const { error: stateUpdateError } = await client
    .from("google_calendar_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("state", state);

  if (stateUpdateError) {
    console.warn("⚠️ Não foi possível marcar state como utilizado", {
      state,
      error: stateUpdateError,
    });
  }

  return respond({
    success: true,
    googleEmail: profileData.email,
    scopes,
  });
};

const handleDisconnect = async (
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
) => {
  const { data, error } = await client
    .from("google_calendar_authorizations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ Erro ao buscar autorização Google para desconectar", error);
    throw error;
  }

  if (!data) {
    return respond({ success: true });
  }

  await revokeRefreshToken(data.refresh_token);

  const { error: deleteError } = await client
    .from("google_calendar_authorizations")
    .delete()
    .eq("id", data.id);

  if (deleteError) {
    console.error("❌ Erro ao excluir autorização Google ao desconectar", {
      error: deleteError,
    });
    throw deleteError;
  }

  return respond({ success: true });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      getEnvOrThrow("SUPABASE_URL"),
      getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const workspaceId = req.headers.get("x-workspace-id");
    const userId = req.headers.get("x-system-user-id");

    if (!workspaceId || !userId) {
      return respond(
        { error: "Cabeçalhos de workspace/usuário ausentes" },
        400,
      );
    }

    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const action = segments[segments.length - 1] ?? "status";
    const body =
      req.method === "GET" ? {} : await req.json().catch(() => ({}));

    await cleanupExpiredStates(supabaseClient);

    switch (action) {
      case "status":
        return await handleStatus(supabaseClient, workspaceId, userId);
      case "auth-url":
        return await handleAuthUrl(supabaseClient, workspaceId, userId, body);
      case "exchange-code":
        return await handleExchangeCode(
          supabaseClient,
          workspaceId,
          userId,
          body,
        );
      case "disconnect":
        return await handleDisconnect(supabaseClient, workspaceId, userId);
      default:
        return respond({ error: `Ação não suportada: ${action}` }, 400);
    }
  } catch (error) {
    console.error("❌ Erro na função google-calendar-integration", error);
    return respond(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

