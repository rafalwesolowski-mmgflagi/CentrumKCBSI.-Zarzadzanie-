export const googleIntegrationScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send"
].join(" ");

export function getGoogleOAuthConfig(req?: Request) {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URL") ?? (req ? inferCallbackUrl(req) : null);

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth configuration");
  }

  return { clientId, clientSecret, redirectUri };
}

function inferCallbackUrl(req: Request) {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/\/google-oauth-start\/?$/, "/google-oauth-callback");
  url.search = "";
  return url.toString();
}

export async function exchangeGoogleCode(req: Request, code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(req);
  if (!redirectUri) throw new Error("Missing Google OAuth redirect URL");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  const body = await readGoogleJson(response);
  if (!response.ok) throw new Error(`Google token exchange failed: ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  const body = await readGoogleJson(response);
  if (!response.ok) throw new Error(`Google refresh failed: ${JSON.stringify(body).slice(0, 500)}`);
  const accessToken = typeof body.access_token === "string" ? body.access_token : null;
  if (!accessToken) throw new Error("Google refresh did not return an access token");
  return accessToken;
}

export async function readGoogleJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : { value };
  } catch {
    return { parseError: "Could not parse Google response" };
  }
}
