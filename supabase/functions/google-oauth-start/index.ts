import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getGoogleOAuthConfig, googleIntegrationScopes } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401, req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const { returnTo } = await safeJson(req);
    const state = crypto.randomUUID();
    await supabase.from("google_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { error: stateError } = await supabase.from("google_oauth_states").insert({
      state,
      user_id: userData.user.id,
      return_to: sanitizeReturnTo(returnTo)
    });
    if (stateError) return jsonResponse({ error: stateError.message }, 500, req);

    const { clientId, redirectUri } = getGoogleOAuthConfig(req);
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", googleIntegrationScopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    return jsonResponse({ authUrl: authUrl.toString() }, 200, req);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function sanitizeReturnTo(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    const allowedOrigins = [
      Deno.env.get("APP_URL"),
      ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")
    ]
      .map((origin) => origin?.trim())
      .filter(Boolean)
      .map((origin) => safeOrigin(origin!))
      .filter((origin): origin is string => Boolean(origin));

    return allowedOrigins.length === 0 || allowedOrigins.includes(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
