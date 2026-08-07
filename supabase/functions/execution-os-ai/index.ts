import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

// Supported actions: triage | calibrate | critique | roadmap | microstep | step_suggestion | transformation_contract
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req, "POST, OPTIONS") });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!claudeKey) return jsonResponse({ error: "ANTHROPIC_API_KEY not set" }, 500, req);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401, req);

  const body = await req.json().catch(() => ({})) as {
    action: string;
    raw_goal?: string;
    path_type?: string | null;
    resource_profile?: Record<string, string>;
    gap_score?: Record<string, number>;
    roadmap?: string;
    cost_declaration?: string;
    assumptions?: string[];
    critique?: {
      weakness_one?: string;
      fallback_one?: string;
      weakness_two?: string;
      fallback_two?: string;
    };
    task?: {
      title?: string;
      status?: string;
      due_at?: string | null;
      gate?: string;
      suggestion?: string;
      blocker?: string;
      fallback?: string;
      evidence?: string;
    };
    tasks?: Array<{
      title?: string;
      status?: string;
      due_at?: string | null;
      gate?: string;
      reward?: string;
      evidence?: string;
      blocker?: string;
      fallback?: string;
    }>;
  };

  const { action, raw_goal } = body;
  if (!action || !raw_goal) return jsonResponse({ error: "action and raw_goal required" }, 400, req);

  if (action === "triage") {
    const prompt = `Jesteś coachem wykonawczym. Analizujesz cel użytkownika i klasyfikujesz go do jednej z trzech ścieżek.

Cel: "${raw_goal}"

Ścieżki:
- "do_it_now": zadanie do 20 minut, zero planowania, właśnie to zrób
- "tactical_sprint": umiarkowana złożoność, 1 tydz – 3 mies, wymaga planu ale nie przebudowy życia
- "life_os": wysoka stawka / trwała zmiana nawyku/tożsamości/systemu, >3 mies, wymaga pełnego procesu

Zwróć TYLKO JSON:
{
  "path_type": "tactical_sprint",
  "confidence": 82,
  "reasoning": "2-3 zdania dlaczego ta ścieżka, co to implikuje dla użytkownika",
  "cost_hint": "Jedno konkretne zdanie o koszcie tej ścieżki (czas/energia/ryzyko)"
}`;

    const raw = await callClaude("Klasyfikujesz cel do ścieżki wykonania. Odpowiadasz TYLKO JSON.", prompt, claudeKey);
    const result = parseJSON(raw);
    return jsonResponse(result, 200, req);
  }

  if (action === "calibrate") {
    const resources = body.resource_profile ?? {};
    const resourceText = Object.entries(resources)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const prompt = `Jesteś analitykiem wykonawczym. Na podstawie profilu zasobów oszacuj wektor luk dla celu.

Cel: "${raw_goal}"

Profil zasobów:
${resourceText}

Zwróć TYLKO JSON — wartości 0-10 (10 = krytyczna luka, 0 = brak luki):
{
  "knowledge": 7,
  "money": 3,
  "time": 8,
  "people": 2,
  "risk": 6,
  "execution": 5,
  "dominant_gap": "time",
  "reasoning": "2 zdania dlaczego te wartości i co to oznacza strategicznie"
}

knowledge=wiedza, money=budżet, time=czas, people=ludzie/zespół, risk=ryzyko, execution=zdolność egzekucji`;

    const raw = await callClaude("Szacujesz wektor luk strategicznych. Odpowiadasz TYLKO JSON.", prompt, claudeKey);
    const result = parseJSON(raw);
    return jsonResponse(result, 200, req);
  }

  if (action === "critique") {
    const resources = body.resource_profile ?? {};
    const gapScore = body.gap_score ?? {};
    const costDecl = body.cost_declaration ?? "";
    const assumptions = (body.assumptions ?? []).join("; ");
    const dominantGapEntry = Object.entries(gapScore).sort((a, b) => b[1] - a[1])[0];
    const dominant = dominantGapEntry ? `${dominantGapEntry[0]} (${dominantGapEntry[1]}/10)` : "nieznany";

    const prompt = `Jesteś adwokatem diabła. Przeprowadzasz stress-test planu.

Cel: "${raw_goal}"
Główny gap: ${dominant}
Koszt deklarowany: "${costDecl}"
Założenia: "${assumptions}"
Budżet: "${resources.budget ?? ""}" | Czas: "${resources.time ?? ""}" | Ograniczenia: "${resources.constraints ?? ""}"

Znajdź dwie realne słabości które mogą zabić ten plan, i fallback dla każdej.

Zwróć TYLKO JSON:
{
  "weakness_one": "Konkretna słabość 1 (1-2 zdania)",
  "fallback_one": "Realny plan B jeśli ta słabość się uaktywni (1-2 zdania)",
  "weakness_two": "Konkretna słabość 2 (inna niż 1, 1-2 zdania)",
  "fallback_two": "Realny plan B dla słabości 2",
  "critical_assumption": "Które założenie jest najbardziej kruche i dlaczego"
}`;

    const raw = await callClaude("Szukasz słabości w planie. Jesteś krytyczny i konkretny. Odpowiadasz TYLKO JSON.", prompt, claudeKey);
    const result = parseJSON(raw);
    return jsonResponse(result, 200, req);
  }

  if (action === "roadmap") {
    const resources = body.resource_profile ?? {};
    const gapScore = body.gap_score ?? {};
    const costDecl = body.cost_declaration ?? "";
    const assumptions = (body.assumptions ?? []).filter(Boolean).join("; ");
    const critique = body.critique ?? {};
    const dominantGapEntry = Object.entries(gapScore).sort((a, b) => b[1] - a[1])[0];
    const dominant = dominantGapEntry ? `${dominantGapEntry[0]} (${dominantGapEntry[1]}/10)` : "nieznany";

    const prompt = `Jesteś coachem wykonawczym. Tworzysz minimalną roadmapę, która prowadzi do pierwszego wykonalnego kroku.

Cel: "${raw_goal}"
Ścieżka: "${body.path_type ?? "nieznana"}"
Główny gap: ${dominant}
Koszt deklarowany: "${costDecl}"
Założenia: "${assumptions}"
Budżet: "${resources.budget ?? ""}"
Czas: "${resources.time ?? ""}"
Zespół/ludzie: "${resources.people ?? ""}"
Kompetencje: "${resources.skills ?? ""}"
Ograniczenia: "${resources.constraints ?? ""}"
Przewagi: "${resources.advantages ?? ""}"
Ryzyka: "${resources.risks ?? ""}"
Słabość 1: "${critique.weakness_one ?? ""}"
Fallback 1: "${critique.fallback_one ?? ""}"
Słabość 2: "${critique.weakness_two ?? ""}"
Fallback 2: "${critique.fallback_two ?? ""}"

Zasady roadmapy:
- 3 do 5 etapów, nie więcej
- każdy etap ma rezultat, bramkę akceptacji i najważniejszą zależność albo ryzyko
- roadmapa ma być minimalna, nie idealna
- musi uwzględniać główny gap, koszt, założenia i fallbacki
- ma umożliwić wygenerowanie pierwszego Śmiesznie Małego Kroku

Zwróć TYLKO JSON:
{
  "roadmap": "1. Etap — rezultat; bramka: ...; zależność/ryzyko: ...\\n2. Etap — rezultat; bramka: ...; zależność/ryzyko: ...\\n3. Etap — rezultat; bramka: ...; zależność/ryzyko: ...",
  "why_this_shape": "1-2 zdania dlaczego taka kolejność pasuje do kontekstu",
  "first_gate": "Pierwsza konkretna bramka, po której można ruszyć z micro stepem"
}`;

    const raw = await callClaude("Projektujesz minimalne roadmapy wykonawcze. Jesteś konkretny, oszczędny i odpowiadasz TYLKO JSON.", prompt, claudeKey);
    const result = parseJSON(raw);
    return jsonResponse(result, 200, req);
  }

  if (action === "microstep") {
    const roadmap = body.roadmap ?? "";
    const resources = body.resource_profile ?? {};
    const gapScore = body.gap_score ?? {};
    const dominantGapEntry = Object.entries(gapScore).sort((a, b) => b[1] - a[1])[0];
    const dominant = dominantGapEntry ? dominantGapEntry[0] : "execution";

    const prompt = `Jesteś coachem natychmiastowego działania. Generujesz Śmiesznie Mały Krok.

Cel: "${raw_goal}"
Roadmapa: "${roadmap}"
Główny gap: ${dominant}
Dostępny czas teraz: "${resources.time ?? "nieznany"}"
Ograniczenia: "${resources.constraints ?? "brak"}"

Zasady Śmiesznie Małego Kroku:
- Maksymalnie 15 minut
- Zero zależności zewnętrznych (nie "poczekaj na X", nie "gdy dostanę Y")
- Dotyczy PIERWSZEGO działania, nie planowania działania
- Konkretny i natychmiastowy — wiadomo DOKŁADNIE co otworzyć/napisać/zrobić
- Adresuje dominujący gap

Zwróć TYLKO JSON:
{
  "micro_step": "Konkretna czynność (1 zdanie, max 150 znaków)",
  "estimated_minutes": 12,
  "why_this_first": "Dlaczego ten krok jako pierwszy (1 zdanie)",
  "what_to_have_after": "Co będzie gotowe po tym kroku (1 zdanie)"
}`;

    const raw = await callClaude("Generujesz natychmiastowy pierwszy krok. Musi być wykonalny w 15 min bez żadnych zależności. Odpowiadasz TYLKO JSON.", prompt, claudeKey);
    const result = parseJSON(raw);
    return jsonResponse(result, 200, req);
  }

  if (action === "step_suggestion") {
    const resources = body.resource_profile ?? {};
    const gapScore = body.gap_score ?? {};
    const task = body.task ?? {};
    const dominantGapEntry = Object.entries(gapScore).sort((a, b) => b[1] - a[1])[0];
    const dominant = dominantGapEntry ? `${dominantGapEntry[0]} (${dominantGapEntry[1]}/10)` : "nieznany";

    const prompt = `Jesteś opiekunem wykonania Mission. Pomagasz użytkownikowi ruszyć konkretny krok bez rozbudowywania planu.

Cel: "${raw_goal}"
Ścieżka: "${body.path_type ?? "nieznana"}"
Główny gap: ${dominant}
Roadmapa / dokument:
"${body.roadmap ?? ""}"

Zasoby:
Czas: "${resources.time ?? ""}"
Ograniczenia: "${resources.constraints ?? ""}"
Przewagi: "${resources.advantages ?? ""}"
Ryzyka: "${resources.risks ?? ""}"

Krok:
Tytuł: "${task.title ?? ""}"
Status: "${task.status ?? ""}"
Termin: "${task.due_at ?? ""}"
Bramka: "${task.gate ?? ""}"
Obecna sugestia: "${task.suggestion ?? ""}"
Blokada: "${task.blocker ?? ""}"
Fallback: "${task.fallback ?? ""}"
Dowód: "${task.evidence ?? ""}"

Zasady:
- Jeśli jest blokada, zaproponuj mniejszy fallback albo obejście.
- Jeśli nie ma dowodu, wskaż najprostszy dowód wykonania.
- Nie dawaj motywacyjnych ogólników.
- Następny ruch ma być możliwy do wykonania od razu w 5-20 minut.

Zwróć TYLKO JSON:
{
  "suggestion": "Jedno konkretne zdanie nadzorcze: co zmienić, uciąć albo doprecyzować w tym kroku",
  "next_action": "Najbliższy fizyczny ruch użytkownika, max 140 znaków",
  "fallback": "Co zrobić, jeśli blokada nadal zostaje"
}`;

    const raw = await callClaude("Jesteś konkretnym nadzorcą wykonania. Odpowiadasz TYLKO JSON.", prompt, claudeKey);
    const result = parseJSON(raw);
    return jsonResponse(result, 200, req);
  }

  if (action === "transformation_contract") {
    const resources = body.resource_profile ?? {};
    const gapScore = body.gap_score ?? {};
    const tasks = body.tasks ?? [];
    const dominantGapEntry = Object.entries(gapScore).sort((a, b) => b[1] - a[1])[0];
    const dominant = dominantGapEntry ? `${dominantGapEntry[0]} (${dominantGapEntry[1]}/10)` : "nieznany";
    const taskText = tasks.map((task, index) => [
      `${index + 1}. ${task.title ?? ""}`,
      `status: ${task.status ?? ""}`,
      `bramka: ${task.gate ?? ""}`,
      `nagroda: ${task.reward ?? ""}`,
      `dowód: ${task.evidence ?? ""}`,
      `blokada: ${task.blocker ?? ""}`,
      `fallback: ${task.fallback ?? ""}`
    ].join(" | ")).join("\n");

    const prompt = `Tworzysz spokojny Kontrakt Przemiany dla użytkownika. Nie obiecujesz gwarantowanych pieniędzy ani cudownych efektów. Opisujesz realistyczną zmianę mentalną, operacyjną i życiową, jeśli użytkownik wytrwa w planie.

Cel: "${raw_goal}"
Ścieżka: "${body.path_type ?? "nieznana"}"
Główny gap: ${dominant}

Zasoby i ograniczenia:
Czas: "${resources.time ?? ""}"
Budżet: "${resources.budget ?? ""}"
Ludzie: "${resources.people ?? ""}"
Kompetencje: "${resources.skills ?? ""}"
Ograniczenia: "${resources.constraints ?? ""}"
Przewagi: "${resources.advantages ?? ""}"
Ryzyka: "${resources.risks ?? ""}"

Plan / roadmapa:
"${body.roadmap ?? ""}"

Kroki, dowody, blokady i nagrody:
${taskText}

Zasady:
- Pisz po polsku, konkretnie i dojrzale.
- Nie używaj pustych motywacyjnych haseł.
- Uwzględnij mentalność, rzeczywistość, tożsamość i koszt rezygnacji.
- Efekty finansowe/materialne przedstawiaj jako możliwy skutek większej sprawczości, nie jako gwarancję.
- Każde pole: 1-2 zdania.

Zwróć TYLKO JSON:
{
  "mental_shift": "Jak zmieni się myślenie użytkownika",
  "reality_shift": "Jak może zmienić się codzienna rzeczywistość, organizacja, relacja z pracą/pieniędzmi",
  "identity_shift": "Jaka tożsamość będzie silniejsza",
  "vision_7_days": "Co będzie realnie inne po 7 dniach wytrwania",
  "vision_30_days": "Co będzie realnie inne po 30 dniach",
  "vision_90_days": "Co będzie realnie inne po 90 dniach",
  "warning_if_quit": "Jaki stary wzorzec zostanie wzmocniony, jeśli użytkownik odpuści"
}`;

    const raw = await callClaude("Tworzysz realistyczny kontrakt przemiany. Odpowiadasz TYLKO JSON.", prompt, claudeKey);
    const result = parseJSON(raw);
    return jsonResponse(result, 200, req);
  }

  return jsonResponse({ error: `Unknown action: ${action}` }, 400, req);
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
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const json = await res.json() as { content: Array<{ text: string }> };
  return json.content[0]?.text ?? "";
}

function parseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return { error: "Invalid JSON from AI", raw };
  }
}
