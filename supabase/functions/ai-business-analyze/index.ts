import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

const businessAnalysisSchema = z.object({
  executiveSummary: z.string(),
  score: z.object({
    clarity: z.number().min(0).max(100),
    viability: z.number().min(0).max(100),
    focus: z.number().min(0).max(100),
    nextStepReadiness: z.number().min(0).max(100)
  }),
  strengths: z.array(z.object({
    title: z.string(),
    reason: z.string()
  })),
  risks: z.array(z.object({
    title: z.string(),
    severity: z.enum(["low", "medium", "high"]),
    reason: z.string(),
    mitigation: z.string()
  })),
  suggestions: z.array(z.object({
    title: z.string(),
    impact: z.enum(["low", "medium", "high"]),
    effort: z.enum(["low", "medium", "high"]),
    rationale: z.string(),
    action: z.string()
  })),
  experiments: z.array(z.object({
    title: z.string(),
    hypothesis: z.string(),
    method: z.string(),
    successMetric: z.string(),
    timeframe: z.string()
  })),
  stepByStepPlan: z.array(z.object({
    step: z.number().int().min(1),
    title: z.string(),
    objective: z.string(),
    actions: z.array(z.string()),
    deliverable: z.string()
  })),
  questions: z.array(z.string())
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401, req);

    const body = await req.json();
    const design = body.design ?? null;
    if (!design) return jsonResponse({ error: "Business design is required" }, 400, req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const result = await callAnthropic(
      "Jesteś doświadczonym strategiem biznesowym i operacyjnym. Analizujesz model biznesu praktycznie: klient, problem, przewaga, kanały, przychody, koszty, metryki i eksperymenty. Zwracasz TYLKO poprawny JSON bez markdown.",
      JSON.stringify({
        task: "Analyze the provided business model, suggest improvements, and create a practical step-by-step execution plan. Be concrete, skeptical, and action-oriented.",
        language: "pl",
        today: new Date().toISOString().slice(0, 10),
        design,
        portfolioContext: body.portfolioContext ?? null,
        required_schema: {
          executiveSummary: "string",
          score: { clarity: 0, viability: 0, focus: 0, nextStepReadiness: 0 },
          strengths: [{ title: "string", reason: "string" }],
          risks: [{ title: "string", severity: "low|medium|high", reason: "string", mitigation: "string" }],
          suggestions: [{ title: "string", impact: "low|medium|high", effort: "low|medium|high", rationale: "string", action: "string" }],
          experiments: [{ title: "string", hypothesis: "string", method: "string", successMetric: "string", timeframe: "string" }],
          stepByStepPlan: [{ step: 1, title: "string", objective: "string", actions: ["string"], deliverable: "string" }],
          questions: ["string"]
        }
      })
    );

    const parsed = businessAnalysisSchema.parse(result);
    await supabase.from("ai_sessions").insert({
      user_id: userData.user.id,
      prompt: `business-analysis:${String(design.title ?? "untitled")}`,
      response_json: parsed,
      mode: "business-analysis"
    });

    return jsonResponse(parsed, 200, req);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});
