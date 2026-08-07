import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req, "POST, OPTIONS") });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!claudeKey) return jsonResponse({ error: "ANTHROPIC_API_KEY not set" }, 500, req);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401, req);

  const body = await req.json().catch(() => ({}));
  const reportId: string | undefined = body?.reportId;
  if (!reportId) return jsonResponse({ error: "reportId required" }, 400, req);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: report } = await db
    .from("market_reports")
    .select("id, industry, region")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .single();
  if (!report) return jsonResponse({ error: "Report not found" }, 404, req);

  // Top 10 companies by opportunity score
  const { data: companies } = await db
    .from("market_companies")
    .select("id, name, address, google_rating, review_count, website_url, opportunity_score, score_reason")
    .eq("report_id", reportId)
    .not("opportunity_score", "is", null)
    .order("opportunity_score", { ascending: false })
    .limit(10);

  if (!companies || companies.length === 0) {
    return jsonResponse({ error: "No scored companies. Run the report first." }, 400, req);
  }

  const companyIds = companies.map(c => c.id as string);
  const { data: analyses } = await db
    .from("market_website_analysis")
    .select("company_id, has_website, ssl, pagespeed_mobile, contact_email")
    .in("company_id", companyIds);
  const analysisMap = new Map((analyses ?? []).map(a => [a.company_id as string, a]));

  // Delete previously generated emails for this report
  await db.from("market_cold_emails").delete().eq("report_id", reportId);

  // Generate all emails in parallel
  const emailPromises = companies.map(async company => {
    const wa = analysisMap.get(company.id as string);

    const issues: string[] = [];
    if (company.score_reason) issues.push(...(company.score_reason as string).split(", ").filter(Boolean));

    const contextLines = [
      `Firma: ${company.name}`,
      company.address ? `Adres: ${company.address}` : null,
      company.google_rating != null ? `Ocena Google: ${company.google_rating}★ (${company.review_count ?? 0} recenzji)` : null,
      wa?.has_website === false ? "Brak strony internetowej" : null,
      wa?.has_website && !wa?.ssl ? "Strona bez SSL (http://)" : null,
      wa?.pagespeed_mobile != null ? `PageSpeed mobile: ${wa.pagespeed_mobile}/100` : null,
      issues.length > 0 ? `Zidentyfikowane problemy: ${issues.join(", ")}` : null,
    ].filter(Boolean);

    const prompt = `Piszesz spersonalizowany cold email B2B po polsku w imieniu agencji webowej CodeSpade do firmy "${company.name as string}" z branży "${report.industry as string}" w "${report.region as string}".

Dane o firmie:
${contextLines.join("\n")}

Zasady:
- Odnieś się do 1-2 KONKRETNYCH problemów z powyższych danych
- Nie używaj ogólnych fraz ("chciałbym zaproponować", "jestem z agencji")
- Jeden akapit wstęp (pokazujesz że zbadałeś ich konkretnie), jeden akapit korzyść, jedno zdanie CTA
- Maksymalnie 100 słów
- Naturalne, profesjonalne, po polsku

Zwróć TYLKO JSON (bez markdown):
{"subject":"Temat max 60 znaków","body":"Treść emaila","personalization":"Co konkretnie spersonalizowałeś (1 zdanie)"}`;

    try {
      const raw = await callClaude(
        "Jesteś ekspertem cold outreach B2B. Piszesz zwięzłe emaile po polsku. Odpowiadasz TYLKO JSON.",
        prompt,
        claudeKey!,
      );
      const parsed = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as {
        subject: string; body: string; personalization: string;
      };

      const { data: inserted } = await db.from("market_cold_emails").insert({
        report_id: reportId,
        company_id: company.id,
        subject: parsed.subject,
        body_text: parsed.body,
        personalization_notes: parsed.personalization,
      }).select("id").single();

      return {
        id: inserted?.id as string | undefined,
        company_id: company.id as string,
        company_name: company.name as string,
        contact_email: (wa?.contact_email ?? null) as string | null,
        subject: parsed.subject,
        body_text: parsed.body,
        personalization_notes: parsed.personalization,
      };
    } catch {
      return null;
    }
  });

  const results = await Promise.all(emailPromises);
  const emails = results.filter(Boolean);

  return jsonResponse({ emails, count: emails.length }, 200, req);
});

async function callClaude(system: string, user: string, key: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const json = await res.json() as { content: Array<{ text: string }> };
  return json.content[0]?.text ?? "";
}
