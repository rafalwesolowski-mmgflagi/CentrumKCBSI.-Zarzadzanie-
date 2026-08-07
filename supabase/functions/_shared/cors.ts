const DEFAULT_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";

export const corsHeaders = getCorsHeaders();

export function getCorsHeaders(req?: Request, methods = "POST, OPTIONS") {
  const origin = req?.headers.get("Origin") ?? "";
  const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowOrigin = configuredOrigins.length
    ? configuredOrigins.includes(origin) ? origin : configuredOrigins[0]
    : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": methods,
    "Vary": "Origin"
  };
}

export function jsonResponse(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json"
    }
  });
}
