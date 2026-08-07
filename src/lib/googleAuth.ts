import { supabase } from "./supabase";

const googleAuthScopes = [
  "openid",
  "email",
  "profile"
].join(" ");

export interface GoogleIntegrationStatus {
  connected: boolean;
  needsReconnect: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
  scopes: string[];
  missingScopes: string[];
  message: string | null;
}

export async function signInWithGoogle() {
  const result = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: googleAuthScopes,
      redirectTo: window.location.origin,
      queryParams: {}
    }
  });
  redirectIfSupabaseReturnsUrl(result);
  return result;
}

export async function connectGoogleIdentity() {
  const result = await supabase.functions.invoke("google-oauth-start", {
    body: { returnTo: buildGoogleReturnToUrl() }
  });
  if (result.error) throw result.error;
  const authUrl = result.data && typeof result.data.authUrl === "string" ? result.data.authUrl : null;
  if (!authUrl) throw new Error("Nie udało się rozpocząć autoryzacji Google.");
  window.location.assign(authUrl);
}

export async function getGoogleIntegrationStatus(): Promise<GoogleIntegrationStatus> {
  const result = await supabase.functions.invoke("google-integration-status", {
    body: {}
  });
  if (result.error) throw result.error;
  return {
    connected: Boolean(result.data?.connected),
    needsReconnect: Boolean(result.data?.needsReconnect),
    googleEmail: typeof result.data?.googleEmail === "string" ? result.data.googleEmail : null,
    connectedAt: typeof result.data?.connectedAt === "string" ? result.data.connectedAt : null,
    updatedAt: typeof result.data?.updatedAt === "string" ? result.data.updatedAt : null,
    scopes: Array.isArray(result.data?.scopes) ? result.data.scopes.filter((scope: unknown): scope is string => typeof scope === "string") : [],
    missingScopes: Array.isArray(result.data?.missingScopes) ? result.data.missingScopes.filter((scope: unknown): scope is string => typeof scope === "string") : [],
    message: typeof result.data?.message === "string" ? result.data.message : null
  };
}

function redirectIfSupabaseReturnsUrl(result: { data?: { url?: string | null } | null; error?: unknown }) {
  if (!result.error && result.data?.url) window.location.assign(result.data.url);
}

function buildGoogleReturnToUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("google_connected");
  url.searchParams.delete("google_error");
  return url.toString();
}
