import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { exchangeGoogleCode, readGoogleJson } from "../_shared/google.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const fallbackReturnTo = Deno.env.get("APP_URL") ?? "/";

  try {
    if (error) return redirectWithParam(fallbackReturnTo, "google_error", error);
    if (!code || !state) return redirectWithParam(fallbackReturnTo, "google_error", "missing_code_or_state");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: stateRow, error: stateError } = await supabase
      .from("google_oauth_states")
      .select("*")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRow) return redirectWithParam(fallbackReturnTo, "google_error", "invalid_state");

    const tokenResult = await exchangeGoogleCode(req, code);
    const accessToken = typeof tokenResult.access_token === "string" ? tokenResult.access_token : null;
    const newRefreshToken = typeof tokenResult.refresh_token === "string" ? tokenResult.refresh_token : null;

    const { data: existingIntegration } = await supabase
      .from("google_user_integrations")
      .select("refresh_token, google_email, scope")
      .eq("user_id", stateRow.user_id)
      .maybeSingle();

    const refreshToken = newRefreshToken ?? existingIntegration?.refresh_token ?? null;
    if (!refreshToken) {
      await supabase.from("google_oauth_states").delete().eq("state", state);
      return redirectWithParam(
        stateRow.return_to ?? fallbackReturnTo,
        "google_error",
        "Google nie zwrocil tokena odswiezania. Sprobuj polaczyc ponownie i zaakceptuj zgode."
      );
    }

    const googleEmail = accessToken ? await readGoogleUserEmail(accessToken) : existingIntegration?.google_email ?? null;
    const { error: upsertError } = await supabase.from("google_user_integrations").upsert({
      user_id: stateRow.user_id,
      google_email: googleEmail,
      refresh_token: refreshToken,
      scope: typeof tokenResult.scope === "string" ? tokenResult.scope : existingIntegration?.scope ?? null,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    await supabase.from("google_oauth_states").delete().eq("state", state);
    return redirectWithParam(stateRow.return_to ?? fallbackReturnTo, "google_connected", "1");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "unknown_error";
    return redirectWithParam(fallbackReturnTo, "google_error", message.slice(0, 160));
  }
});

function redirect(location: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location }
  });
}

function redirectWithParam(location: string, key: string, value: string) {
  try {
    const url = new URL(location);
    url.searchParams.set(key, value);
    return redirect(url.toString());
  } catch {
    return redirect("/");
  }
}

async function readGoogleUserEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  const body = await readGoogleJson(response);
  return typeof body.email === "string" ? body.email : null;
}
