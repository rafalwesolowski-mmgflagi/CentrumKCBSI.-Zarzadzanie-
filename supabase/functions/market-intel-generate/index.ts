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
    .select("id, industry, region, status, report_type")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .single();

  if (!report) return jsonResponse({ error: "Report not found" }, 404, req);
  if (report.status === "in_progress") return jsonResponse({ error: "Already running" }, 409, req);

  await db.from("market_reports").update({ status: "in_progress" }).eq("id", reportId);
  await db.from("market_report_sections")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("report_id", reportId).eq("section_key", "places");

  void runPipeline(reportId, report.industry, report.region, (report.report_type as string) ?? "services", db);

  return jsonResponse({ started: true }, 200, req);
});

async function runPipeline(reportId: string, industry: string, region: string, reportType: string, db: DB) {
  const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  const psKey = Deno.env.get("GOOGLE_PAGESPEED_API_KEY") ?? null;
  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY") ?? null;

  // For products mode, search for retailers/shops instead of service providers
  const placesQuery = reportType === "products"
    ? `sklep ${industry} ${region}`
    : `${industry} ${region}`;

  // ── Step 1: Google Places ──────────────────────────────────────────────────
  if (!placesKey) {
    await sectionFail(db, reportId, "places", "GOOGLE_PLACES_API_KEY not set");
    await finalize(db, reportId, "partial");
    return;
  }

  let places: PlaceResult[] = [];
  try {
    places = await fetchPlacesQuery(placesQuery, placesKey);
  } catch (err: unknown) {
    await sectionFail(db, reportId, "places", err instanceof Error ? err.message : String(err));
    await finalize(db, reportId, "partial");
    return;
  }

  await db.from("market_report_sections")
    .update({ items_total: places.length, items_done: 0 })
    .eq("report_id", reportId).eq("section_key", "places");

  const companyRows = [];
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    let details: Partial<PlaceDetails> = {};
    try { details = await fetchPlaceDetails(p.place_id, placesKey); } catch { /* non-fatal */ }

    companyRows.push({
      report_id: reportId,
      place_id: p.place_id,
      name: p.name,
      address: p.formatted_address,
      phone: details.formatted_phone_number ?? null,
      website_url: details.website ?? null,
      google_rating: p.rating ?? null,
      review_count: p.user_ratings_total ?? null,
      maps_url: details.url ?? `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
    });

    await db.from("market_report_sections")
      .update({ items_done: i + 1 })
      .eq("report_id", reportId).eq("section_key", "places");
  }

  const { error: insErr } = await db.from("market_companies").insert(companyRows);
  if (insErr) {
    await sectionFail(db, reportId, "places", insErr.message);
    await finalize(db, reportId, "partial");
    return;
  }
  await sectionDone(db, reportId, "places", places.length);

  // ── Step 2: Website analysis ───────────────────────────────────────────────
  await sectionStart(db, reportId, "websites");
  const { data: companies } = await db
    .from("market_companies").select("id, website_url").eq("report_id", reportId);

  if (companies) {
    await db.from("market_report_sections")
      .update({ items_total: companies.length })
      .eq("report_id", reportId).eq("section_key", "websites");

    for (let i = 0; i < companies.length; i++) {
      const c = companies[i];
      const analysis = await analyseWebsite(c.website_url as string | null, psKey);
      await db.from("market_website_analysis").insert({ company_id: c.id, ...analysis });
      await db.from("market_report_sections")
        .update({ items_done: i + 1 })
        .eq("report_id", reportId).eq("section_key", "websites");
    }
  }
  await sectionDone(db, reportId, "websites", companies?.length ?? 0);

  // ── Step 3: Google Reviews + Claude grouping ───────────────────────────────
  await sectionStart(db, reportId, "reviews");
  const { data: companiesForReviews } = await db
    .from("market_companies").select("id, name, place_id").eq("report_id", reportId);

  const allReviews: Array<{ company: string; rating: number; text: string }> = [];

  if (companiesForReviews && placesKey) {
    await db.from("market_report_sections")
      .update({ items_total: companiesForReviews.length })
      .eq("report_id", reportId).eq("section_key", "reviews");

    for (let i = 0; i < companiesForReviews.length; i++) {
      const c = companiesForReviews[i];
      try {
        const reviews = await fetchPlaceReviews(c.place_id as string, placesKey);
        for (const r of reviews) allReviews.push({ company: c.name as string, rating: r.rating, text: r.text });
      } catch { /* non-fatal */ }
      await db.from("market_report_sections")
        .update({ items_done: i + 1 })
        .eq("report_id", reportId).eq("section_key", "reviews");
    }

    if (allReviews.length > 0 && claudeKey) {
      const reviewsText = allReviews
        .map(r => `[${r.company}] (${r.rating}★): ${r.text}`)
        .join("\n")
        .slice(0, 10000);

      const prompt = `Analizujesz recenzje firm z branży "${industry}" w regionie "${region}".

Recenzje (${allReviews.length} łącznie):
${reviewsText}

Zwróć TYLKO JSON (bez markdown) — tablicę 5-8 kategorii:
[{"category":"Przykładowa kategoria","percentage":45,"review_count":23,"sample_quotes":["cytat 1","cytat 2"],"confidence":"high","low_confidence_note":null}]

Zasady:
- category: krótka nazwa tematyczna (np. "Jakość obsługi", "Ceny", "Czas oczekiwania")
- percentage: % recenzji poruszających ten temat (suma może przekroczyć 100%)
- sample_quotes: max 2 oryginalne cytaty z recenzji
- confidence: "high" (>20 recenzji), "medium" (5-19), "low" (<5)`;

      try {
        const raw = await callClaude("Jesteś analitykiem rynkowym. Odpowiadasz TYLKO JSON.", prompt, claudeKey);
        const insights = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as Array<{
          category: string; percentage: number; review_count: number;
          sample_quotes: string[]; confidence: string; low_confidence_note: string | null;
        }>;

        const rows = insights.map(ins => ({
          report_id: reportId,
          category: ins.category,
          percentage: ins.percentage,
          review_count: ins.review_count,
          sample_quotes: ins.sample_quotes ?? [],
          sources: [`Google Reviews — ${industry} ${region} (${allReviews.length} recenzji)`],
          confidence: ins.confidence ?? "medium",
          low_confidence_note: ins.low_confidence_note ?? null,
        }));
        await db.from("market_review_insights").insert(rows);
      } catch { /* non-fatal */ }
    }
  }
  await sectionDone(db, reportId, "reviews", companiesForReviews?.length ?? 0);

  // ── Step 4: YouTube market signals ────────────────────────────────────────
  const youtubeSection = await db.from("market_report_sections")
    .select("id").eq("report_id", reportId).eq("section_key", "youtube").maybeSingle();

  if (youtubeSection.data) {
    await sectionStart(db, reportId, "youtube");
    const ytKey = Deno.env.get("YOUTUBE_API_KEY") ?? placesKey;

    try {
      const ytQuery = encodeURIComponent(`${industry} ${region}`);
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?q=${ytQuery}&type=video&maxResults=15&key=${ytKey}&order=viewCount&part=snippet&relevanceLanguage=pl`;
      const ytRes = await fetch(ytUrl, { signal: AbortSignal.timeout(15000) });

      if (ytRes.ok) {
        const ytJson = await ytRes.json() as {
          items?: Array<{ snippet: { title: string; channelTitle: string } }>;
          error?: { message: string };
        };

        if (!ytJson.error && ytJson.items && ytJson.items.length > 0 && claudeKey) {
          const videosList = ytJson.items
            .map((v, i) => `${i + 1}. "${v.snippet.title}" — ${v.snippet.channelTitle}`)
            .join("\n");

          const ytPrompt = `Analizujesz wyniki wyszukiwania YouTube dla branży "${industry}" w regionie "${region}".

Znalezione filmy (sortowane wg popularności):
${videosList}

Na podstawie tytułów wygeneruj 4-6 sygnałów rynkowych — co interesuje klientów, jakie mają pytania, jakie problemy szukają.

Zwróć TYLKO JSON (bez markdown):
[
  {
    "signal_type": "trending_topic",
    "title": "Jak wybrać dentystę w Warszawie",
    "description": "Klienci intensywnie szukają poradników wyboru, co sugeruje że decyzja zakupowa jest trudna i wymaga edukacji",
    "example_titles": ["Tytuł 1", "Tytuł 2"],
    "confidence": "high"
  }
]

signal_type: "trending_topic" (co popularyzuje branżę), "common_question" (jakie pytania zadają klienci), "market_opportunity" (niezaspokojona potrzeba widoczna z tytułów)
confidence: "high" (3+ filmów na temat), "medium" (1-2), "low" (wywnioskowane z jednego)`;

          const raw = await callClaude("Jesteś analitykiem rynkowym. Odpowiadasz TYLKO JSON.", ytPrompt, claudeKey);
          const signals = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as Array<{
            signal_type: string; title: string; description: string;
            example_titles: string[]; confidence: string;
          }>;

          await db.from("market_youtube_signals").insert(
            signals.map(s => ({
              report_id: reportId,
              signal_type: s.signal_type,
              title: s.title,
              description: s.description,
              video_count: ytJson.items!.length,
              example_titles: s.example_titles ?? [],
              confidence: s.confidence ?? "medium",
            }))
          );
          await sectionDone(db, reportId, "youtube", signals.length);
        } else {
          await sectionDone(db, reportId, "youtube", 0);
        }
      } else {
        await sectionDone(db, reportId, "youtube", 0);
      }
    } catch {
      await sectionDone(db, reportId, "youtube", 0);
    }
  }

  // ── Step 5: Market size estimate ───────────────────────────────────────────
  await sectionStart(db, reportId, "market");

  const companyIds = (companiesForReviews ?? []).map(c => c.id as string);
  let websiteStats: Array<{ has_website: boolean; ssl: boolean | null; pagespeed_mobile: number | null }> = [];
  if (companyIds.length > 0) {
    const { data } = await db
      .from("market_website_analysis")
      .select("has_website, ssl, pagespeed_mobile")
      .in("company_id", companyIds);
    websiteStats = data ?? [];
  }

  const totalFirms = companiesForReviews?.length ?? 0;
  const withWebsite = websiteStats.filter(w => w.has_website).length;
  const withSsl = websiteStats.filter(w => w.ssl).length;
  const speedSamples = websiteStats.filter(w => w.pagespeed_mobile != null);
  const avgSpeed = speedSamples.length > 0
    ? Math.round(speedSamples.reduce((s, w) => s + (w.pagespeed_mobile as number), 0) / speedSamples.length)
    : null;

  if (claudeKey && totalFirms > 0) {
    const marketPrompt = `Oszacuj rynek dla branży "${industry}" w regionie "${region}".

Dane zebrane:
- Liczba firm: ${totalFirms}
- Z własną stroną: ${withWebsite}/${totalFirms}
- Z SSL: ${withSsl}/${totalFirms}
- Średni PageSpeed mobile: ${avgSpeed ?? "brak danych"}

Zwróć TYLKO JSON (bez markdown):
{"value_low_pln":5000000,"value_high_pln":15000000,"confidence":"medium","rationale":"Krótkie uzasadnienie (2-3 zdania).","market_gaps":["Luka 1","Luka 2","Luka 3"],"sources":["Liczba firm z Google Places","Szacunkowe przychody branżowe"]}`;

    try {
      const raw = await callClaude("Jesteś analitykiem rynkowym. Odpowiadasz TYLKO JSON.", marketPrompt, claudeKey);
      const est = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as {
        value_low_pln: number; value_high_pln: number; confidence: string;
        rationale: string; market_gaps: string[]; sources: string[];
      };
      await db.from("market_estimates").insert({
        report_id: reportId,
        value_low_pln: est.value_low_pln,
        value_high_pln: est.value_high_pln,
        confidence: est.confidence ?? "low",
        rationale: est.rationale,
        market_gaps: est.market_gaps ?? [],
        sources: est.sources ?? [],
      });
    } catch { /* non-fatal */ }
  }
  await sectionDone(db, reportId, "market", 1);

  // ── Step 5: Opportunity scoring ────────────────────────────────────────────
  await sectionStart(db, reportId, "scoring");
  const { data: companiesForScoring } = await db
    .from("market_companies")
    .select("id, google_rating, review_count, website_url")
    .eq("report_id", reportId);

  if (companiesForScoring) {
    await db.from("market_report_sections")
      .update({ items_total: companiesForScoring.length })
      .eq("report_id", reportId).eq("section_key", "scoring");

    for (let i = 0; i < companiesForScoring.length; i++) {
      const c = companiesForScoring[i];
      const { data: wa } = await db
        .from("market_website_analysis")
        .select("has_website, ssl, pagespeed_mobile, reachable")
        .eq("company_id", c.id)
        .maybeSingle();

      const reasons: string[] = [];
      let score = 0;

      if (!wa?.has_website || !c.website_url) {
        score += 35; reasons.push("brak strony www");
      } else {
        if (!wa.ssl) { score += 15; reasons.push("brak SSL"); }
        const spd = wa.pagespeed_mobile as number | null;
        if (spd != null && spd < 50) { score += 20; reasons.push(`PageSpeed ${spd}/100`); }
        else if (spd != null && spd < 70) { score += 10; reasons.push(`PageSpeed ${spd}/100`); }
        if (!wa.reachable) { score += 10; reasons.push("strona niedostępna"); }
      }

      const rating = c.google_rating as number | null;
      if (rating != null && rating < 3.5) { score += 20; reasons.push(`ocena ${rating}★`); }
      else if (rating != null && rating < 4.0) { score += 10; reasons.push(`ocena ${rating}★`); }

      const reviews = c.review_count as number | null;
      if (reviews != null && reviews < 5) { score += 10; reasons.push("mało recenzji"); }

      score = Math.min(score, 100);
      await db.from("market_companies")
        .update({ opportunity_score: score, score_reason: reasons.join(", ") || "dobra obecność online" })
        .eq("id", c.id);

      await db.from("market_report_sections")
        .update({ items_done: i + 1 })
        .eq("report_id", reportId).eq("section_key", "scoring");
    }
  }
  await sectionDone(db, reportId, "scoring", companiesForScoring?.length ?? 0);

  // ── Step 6: Customer Personas ──────────────────────────────────────────────
  const personasSection = await db.from("market_report_sections")
    .select("id").eq("report_id", reportId).eq("section_key", "personas").maybeSingle();

  if (personasSection.data) {
    await sectionStart(db, reportId, "personas");

    if (claudeKey && allReviews.length > 0) {
      const { data: insightsData } = await db
        .from("market_review_insights").select("category, percentage").eq("report_id", reportId);
      const insightsSummary = (insightsData ?? [])
        .map(i => `${i.category} (${(i.percentage as number).toFixed(0)}%)`)
        .join(", ");

      const { data: estimateData } = await db
        .from("market_estimates").select("market_gaps").eq("report_id", reportId).maybeSingle();
      const gapsSummary = ((estimateData?.market_gaps as string[]) ?? []).join(", ");

      const personaPrompt = `Wygeneruj 3 persony klientów dla firm z branży "${industry}" w regionie "${region}".

Dane rynkowe:
- Najczęstsze problemy z recenzji: ${insightsSummary || "brak danych"}
- Luki rynkowe: ${gapsSummary || "brak danych"}
- Firm znalezionych: ${totalFirms}

Zwróć TYLKO JSON (bez markdown) — tablicę 3 person:
[
  {
    "name": "Marta — właścicielka małej firmy",
    "age_range": "35-45",
    "role": "Właścicielka gabinetu kosmetycznego",
    "pain_points": ["Problem 1", "Problem 2", "Problem 3"],
    "goals": ["Cel 1", "Cel 2"],
    "buying_triggers": ["Klient zobaczył lepszą stronę konkurencji", "Stara strona wstydzi przy networkingu"]
  }
]

Zasady: persony to KLIENCI firm z tej branży (end-użytkownicy usług), nie właściciele firm. Bazuj wyłącznie na podanych danych.`;

      try {
        const raw = await callClaude("Jesteś analitykiem rynkowym. Odpowiadasz TYLKO JSON.", personaPrompt, claudeKey);
        const personas = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as Array<{
          name: string; age_range: string; role: string;
          pain_points: string[]; goals: string[]; buying_triggers: string[];
        }>;
        await db.from("market_personas").insert(
          personas.map(p => ({
            report_id: reportId,
            name: p.name,
            age_range: p.age_range ?? null,
            role: p.role,
            pain_points: p.pain_points ?? [],
            goals: p.goals ?? [],
            buying_triggers: p.buying_triggers ?? [],
            sources: [`Google Reviews — ${industry} ${region}`],
          }))
        );
      } catch { /* non-fatal */ }
    }
    await sectionDone(db, reportId, "personas", 1);
  }

  // ── Step 7: Service Proposals ──────────────────────────────────────────────
  const proposalsSection = await db.from("market_report_sections")
    .select("id").eq("report_id", reportId).eq("section_key", "proposals").maybeSingle();

  if (proposalsSection.data) {
    await sectionStart(db, reportId, "proposals");

    if (claudeKey && totalFirms > 0) {
      const noWebsite = totalFirms - withWebsite;
      const noSsl = withWebsite - withSsl;

      const { data: estimateData } = await db
        .from("market_estimates").select("market_gaps").eq("report_id", reportId).maybeSingle();
      const gapsSummary = ((estimateData?.market_gaps as string[]) ?? []).join("\n- ");

      const proposalsPrompt = `Zaproponuj 4-5 konkretnych usług jakie agencja marketingowa / web studio może zaoferować firmom z branży "${industry}" w regionie "${region}".

Dane rynkowe:
- Firm bez strony www: ${noWebsite}/${totalFirms} (${Math.round(noWebsite / totalFirms * 100)}%)
- Firm bez SSL: ${noSsl}/${totalFirms}
- Średni PageSpeed mobile: ${avgSpeed ?? "brak danych"}
- Luki rynkowe zidentyfikowane:
${gapsSummary ? `- ${gapsSummary}` : "- brak danych"}

Zwróć TYLKO JSON (bez markdown):
[
  {
    "title": "Strona internetowa pod klucz",
    "description": "Profesjonalna strona www z SSL, formularzem kontaktowym i optymalizacją mobilną.",
    "target_segment": "Firmy bez strony www lub z niedziałającą stroną",
    "estimated_value_pln": 3500,
    "priority": 1,
    "rationale": "Dlaczego ta usługa ma sens na tym rynku (1-2 zdania)"
  }
]

Zasady:
- estimated_value_pln: szacunkowa jednorazowa wartość zlecenia w PLN
- priority: 1 (najwyższy) do 5
- Usługi muszą wynikać z konkretnych luk widocznych w danych`;

      try {
        const raw = await callClaude("Jesteś konsultantem sprzedaży dla agencji marketingowej. Odpowiadasz TYLKO JSON.", proposalsPrompt, claudeKey);
        const proposals = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as Array<{
          title: string; description: string; target_segment: string;
          estimated_value_pln: number; priority: number; rationale: string;
        }>;
        await db.from("market_service_proposals").insert(
          proposals.map(p => ({
            report_id: reportId,
            title: p.title,
            description: p.description,
            target_segment: p.target_segment,
            estimated_value_pln: p.estimated_value_pln ?? null,
            priority: p.priority ?? 3,
            rationale: p.rationale,
            sources: [`Google Places — ${industry} ${region}`, "PageSpeed Insights"],
          }))
        );
      } catch { /* non-fatal */ }
    }
    await sectionDone(db, reportId, "proposals", 1);
  }

  // ── Step 8: Marketplace / Pricing summary ─────────────────────────────────
  const marketplaceSection = await db.from("market_report_sections")
    .select("id").eq("report_id", reportId).eq("section_key", "marketplace").maybeSingle();

  if (marketplaceSection.data) {
    await sectionStart(db, reportId, "marketplace");

    const { data: pricesData } = await db
      .from("market_website_analysis")
      .select("price_range_text, source_url")
      .in("company_id", companyIds)
      .not("price_range_text", "is", null);

    if (pricesData && pricesData.length >= 2 && claudeKey) {
      const pricesText = pricesData
        .map(p => `${p.source_url ?? "?"}: ${p.price_range_text}`)
        .join("\n");

      const pricingPrompt = `Przeanalizuj ceny znalezione na stronach firm z branży "${industry}" w "${region}".

Zebrane dane cenowe (${pricesData.length} źródeł):
${pricesText}

Zwróć TYLKO JSON (bez markdown):
{
  "price_min_text": "najniższa znaleziona cena (z jednostką)",
  "price_max_text": "najwyższa znaleziona cena (z jednostką)",
  "price_common_range": "typowy zakres cen w tej branży",
  "outliers": ["cena znacznie poniżej rynku — firma X", "cena premium — firma Y"],
  "claude_summary": "2-3 zdania o cenach i ich rozkładzie w tej branży/regionie",
  "confidence": "high"
}

Zasady:
- confidence: "high" jeśli ≥5 źródeł, "medium" jeśli 2-4, "low" jeśli <2
- Podaj TYLKO to co wynika z danych — nie zgaduj cen których nie ma w danych`;

      try {
        const raw = await callClaude("Jesteś analitykiem rynkowym. Odpowiadasz TYLKO JSON.", pricingPrompt, claudeKey);
        const summary = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as {
          price_min_text: string; price_max_text: string; price_common_range: string;
          outliers: string[]; claude_summary: string; confidence: string;
        };
        await db.from("market_pricing_summary").insert({
          report_id: reportId,
          price_min_text: summary.price_min_text ?? null,
          price_max_text: summary.price_max_text ?? null,
          price_common_range: summary.price_common_range ?? null,
          price_source_count: pricesData.length,
          outliers: summary.outliers ?? [],
          claude_summary: summary.claude_summary ?? null,
          sources: pricesData.map(p => p.source_url).filter(Boolean) as string[],
          confidence: summary.confidence ?? "low",
        });
      } catch { /* non-fatal */ }
    }
    await sectionDone(db, reportId, "marketplace", pricesData?.length ?? 0);
  }

  // ── Step 9: Finalize ───────────────────────────────────────────────────────
  await sectionStart(db, reportId, "report");
  await sectionDone(db, reportId, "report", 1);
  await finalize(db, reportId, "done");
}

// ── Google Places helpers ──────────────────────────────────────────────────────

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
}

interface PlaceDetails {
  website?: string;
  formatted_phone_number?: string;
  url?: string;
}

interface PlaceReview {
  rating: number;
  text: string;
}

async function fetchPlacesQuery(query: string, key: string): Promise<PlaceResult[]> {
  query = encodeURIComponent(query);
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  do {
    const url = pageToken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${key}`
      : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${key}`;

    const res = await fetch(url);
    const json = await res.json() as { status: string; results?: PlaceResult[]; next_page_token?: string; error_message?: string };

    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      throw new Error(`Places API: ${json.status} — ${json.error_message ?? ""}`);
    }
    for (const p of json.results ?? []) results.push(p);
    pageToken = json.next_page_token;
    if (pageToken) await new Promise(r => setTimeout(r, 2000));
  } while (pageToken && results.length < 60);

  return results;
}

async function fetchPlaceDetails(placeId: string, key: string): Promise<PlaceDetails> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number,url&key=${key}`;
  const res = await fetch(url);
  const json = await res.json() as { status: string; result?: PlaceDetails };
  if (json.status !== "OK") return {};
  return json.result ?? {};
}

async function fetchPlaceReviews(placeId: string, key: string): Promise<PlaceReview[]> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${key}&language=pl`;
  const res = await fetch(url);
  const json = await res.json() as { status: string; result?: { reviews?: PlaceReview[] } };
  if (json.status !== "OK") return [];
  return (json.result?.reviews ?? []).filter(r => r.text && r.text.length > 10);
}

async function analyseWebsite(url: string | null, psKey: string | null): Promise<Record<string, unknown>> {
  if (!url) return { has_website: false, reachable: false };

  let mobileScore: number | null = null;
  let desktopScore: number | null = null;
  if (psKey) {
    try {
      const [mob, desk] = await Promise.all([fetchPageSpeed(url, "mobile", psKey), fetchPageSpeed(url, "desktop", psKey)]);
      mobileScore = mob;
      desktopScore = desk;
    } catch { /* non-fatal */ }
  }

  let reachable = false;
  let errorNote: string | null = null;
  let priceRangeText: string | null = null;
  let contactEmail: string | null = null;
  let hasPricingPage: boolean | null = null;

  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000) });
    reachable = res.ok || res.status < 500;

    if (res.ok) {
      const html = await res.text();
      const text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
                       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
                       .replace(/<[^>]*>/g, " ")
                       .replace(/\s+/g, " ")
                       .slice(0, 8000);

      // Price detection — PLN / EUR / USD patterns
      const priceMatches: string[] = [];
      const priceRe = /(?:od\s+|from\s+|price[:\s]+|cena[:\s]*|cennik[:\s]*)(\d[\d\s]*(?:[,.]\d{1,2})?)\s*(?:zł|PLN|€|EUR|\$|USD)/gi;
      let m: RegExpExecArray | null;
      while ((m = priceRe.exec(text)) !== null && priceMatches.length < 4) {
        priceMatches.push(m[0].trim().replace(/\s+/g, " "));
      }
      if (priceMatches.length > 0) priceRangeText = priceMatches.join(" | ");

      // Email extraction
      const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = html.match(emailRe) ?? [];
      const filtered = emails.filter(e => !e.includes("example") && !e.includes("domain") && !e.includes("@sentry"));
      if (filtered.length > 0) contactEmail = filtered[0];

      // Pricing page detection
      hasPricingPage = /cennik|pricing|price-list|taryfa|pakiety|oferta/i.test(html);
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message : "timeout";
  }

  return {
    has_website: true,
    ssl: url.startsWith("https"),
    pagespeed_mobile: mobileScore,
    pagespeed_desktop: desktopScore,
    cms: null,
    has_contact_form: null,
    has_cta: null,
    has_blog: null,
    reachable,
    error_note: errorNote,
    source_url: url,
    price_range_text: priceRangeText,
    contact_email: contactEmail,
    has_pricing_page: hasPricingPage,
  };
}

async function fetchPageSpeed(url: string, strategy: string, key: string): Promise<number | null> {
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${key}&category=PERFORMANCE`;
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) return null;
  const json = await res.json() as { lighthouseResult?: { categories?: { performance?: { score?: number } } } };
  const score = json.lighthouseResult?.categories?.performance?.score;
  return score != null ? Math.round(score * 100) : null;
}

// ── Claude helper ──────────────────────────────────────────────────────────────

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
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const json = await res.json() as { content: Array<{ text: string }> };
  return json.content[0]?.text ?? "";
}

// ── Section state helpers ──────────────────────────────────────────────────────

type DB = ReturnType<typeof createClient>;

async function sectionStart(db: DB, reportId: string, key: string) {
  await db.from("market_report_sections")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("report_id", reportId).eq("section_key", key);
}

async function sectionDone(db: DB, reportId: string, key: string, total: number) {
  await db.from("market_report_sections")
    .update({ status: "done", items_done: total, items_total: total, completed_at: new Date().toISOString() })
    .eq("report_id", reportId).eq("section_key", key);
}

async function sectionFail(db: DB, reportId: string, key: string, msg: string) {
  await db.from("market_report_sections")
    .update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() })
    .eq("report_id", reportId).eq("section_key", key);
}

async function finalize(db: DB, reportId: string, status: string) {
  await db.from("market_reports")
    .update({ status, completed_at: new Date().toISOString() })
    .eq("id", reportId);
}
