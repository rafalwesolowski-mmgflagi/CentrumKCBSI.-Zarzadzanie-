import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send"
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401, req);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase
      .from("google_user_integrations")
      .select("google_email, refresh_token, scope, connected_at, updated_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500, req);
    const scopes = parseScopes(data?.scope);
    const missingScopes = scopes.length
      ? REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope))
      : [];
    const hasRefreshToken = typeof data?.refresh_token === "string" && data.refresh_token.trim().length > 0;
    const needsReconnect = Boolean(data) && !hasRefreshToken;

    return jsonResponse({
      connected: Boolean(data) && hasRefreshToken,
      needsReconnect,
      googleEmail: data?.google_email ?? null,
      connectedAt: data?.connected_at ?? null,
      updatedAt: data?.updated_at ?? null,
      scopes,
      missingScopes,
      message: !data
        ? null
        : !hasRefreshToken
        ? "Brakuje tokena odświeżania Google. Połącz konto ponownie."
        : missingScopes.length
        ? "Połączenie Google jest aktywne, ale może nie mieć wszystkich wymaganych uprawnień."
        : null
    }, 200, req);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});

function parseScopes(value: unknown) {
  return typeof value === "string"
    ? value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean)
    : [];
}
