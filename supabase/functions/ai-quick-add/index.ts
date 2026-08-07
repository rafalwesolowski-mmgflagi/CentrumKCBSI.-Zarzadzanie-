import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

const quickAddSchema = z.object({
  project: z.object({
    name: z.string().min(2),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    status: z.enum(["on_track", "in_progress", "at_risk", "paused", "done"])
  }),
  phases: z.array(z.object({
    name: z.string().min(2),
    start_date: z.string().date(),
    end_date: z.string().date(),
    tasks: z.array(z.object({
      name: z.string().min(2),
      due_date: z.string().date(),
      priority: z.enum(["low", "medium", "high", "critical"]),
      impact: z.enum(["low", "medium", "high", "strategic"])
    })).min(1)
  })).min(1),
  risks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    severity: z.enum(["info", "warning", "danger"]),
    projectName: z.string().optional(),
    dueDate: z.string().optional(),
    reason: z.string()
  })).default([]),
  questions: z.array(z.string()).optional()
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401, req);

    const body = await req.json();
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return jsonResponse({ error: "Prompt is required" }, 400, req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const result = await callAnthropic(
      "Jesteś asystentem planowania projektów. Zwracasz TYLKO poprawny JSON bez komentarzy, markdown ani tekstu poza JSON.",
      buildPrompt(prompt, body.contextWindow)
    );

    const parsed = quickAddSchema.parse(result);
    await supabase.from("ai_sessions").insert({
      user_id: userData.user.id,
      prompt,
      response_json: parsed,
      mode: "quick-add"
    });

    return jsonResponse(parsed, 200, req);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});

function buildPrompt(prompt: string, contextWindow: unknown) {
  return JSON.stringify({
    task: "Create a project plan from the user prompt.",
    user_prompt: prompt,
    today: new Date().toISOString().slice(0, 10),
    existing_context: contextWindow,
    required_schema: {
      project: { name: "string", color: "#RRGGBB", status: "in_progress" },
      phases: [{
        name: "string",
        start_date: "YYYY-MM-DD",
        end_date: "YYYY-MM-DD",
        tasks: [{ name: "string", due_date: "YYYY-MM-DD", priority: "low|medium|high|critical", impact: "low|medium|high|strategic" }]
      }],
      risks: [{ id: "string", title: "string", severity: "info|warning|danger", reason: "string" }],
      questions: ["string, only if dates or required scope are missing"]
    }
  });
}
