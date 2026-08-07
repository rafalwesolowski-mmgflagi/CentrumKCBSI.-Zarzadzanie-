import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

const scanSchema = z.object({
  risks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    severity: z.enum(["info", "warning", "danger"]),
    projectName: z.string().optional(),
    dueDate: z.string().optional(),
    reason: z.string()
  })),
  upcomingDeadlines: z.array(z.object({
    taskId: z.string(),
    taskName: z.string(),
    projectName: z.string(),
    dueDate: z.string().date(),
    priority: z.enum(["low", "medium", "high", "critical"]),
    impact: z.enum(["low", "medium", "high", "strategic"]),
    deadlineImportance: z.number()
  })),
  conflicts: z.array(z.object({
    date: z.string().date(),
    taskIds: z.array(z.string()),
    reason: z.string()
  })),
  proposals: z.array(z.object({
    id: z.string(),
    title: z.string(),
    rationale: z.string(),
    changes: z.array(z.object({
      entity: z.enum(["project", "phase", "task"]),
      id: z.string(),
      field: z.string(),
      from: z.union([z.string(), z.number(), z.null()]),
      to: z.union([z.string(), z.number(), z.null()])
    }))
  })),
  advisorBriefing: z.object({
    summary: z.string(),
    nextActions: z.array(z.string()),
    decisions: z.array(z.string()),
    questions: z.array(z.string())
  }).optional()
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401, req);

    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const instruction = String(body.instruction ?? "").trim();
    const advisorMode = Boolean(body.advisorMode);
    const result = await callAnthropic(
      "Jesteś portfelowym copilotem COO, koordynatorem i asystentem właściciela. Masz wgląd w cały portfel projektów. Analizujesz deadline'y, wpływ biznesowy, priorytety, kolizje i przeciążenia. Zwracasz TYLKO JSON.",
      JSON.stringify({
        task: advisorMode
          ? "Act as an executive project advisor. Answer the user's question using portfolio context, identify what needs attention, and return a concise advisor briefing plus safe proposals if useful. Do not apply changes automatically."
          : instruction
          ? "Modify existing portfolio data by returning concrete proposals only. Never create a new project draft here. Do not apply changes automatically."
          : "Scan portfolio and produce risks, upcoming deadlines, conflicts, and proposals. Do not assume permission to apply changes.",
        user_instruction: instruction || null,
        today: new Date().toISOString().slice(0, 10),
        dateRange: body.dateRange,
        context: body.contextWindow,
        change_rules: [
          "Use existing entity ids from context only.",
          "Allowed project fields: name, color, status.",
          "Allowed phase fields: name, start_date, end_date, order_index.",
          "Allowed task fields: name, status, due_date, priority, impact, assignee.",
          "Each proposal must be safe to review and apply after user confirmation."
        ],
        required_schema: {
          risks: [{ id: "string", title: "string", severity: "info|warning|danger", reason: "string" }],
          upcomingDeadlines: [{ taskId: "string", taskName: "string", projectName: "string", dueDate: "YYYY-MM-DD", priority: "low|medium|high|critical", impact: "low|medium|high|strategic", deadlineImportance: 0 }],
          conflicts: [{ date: "YYYY-MM-DD", taskIds: ["string"], reason: "string" }],
          proposals: [{ id: "string", title: "string", rationale: "string", changes: [{ entity: "project|phase|task", id: "string", field: "string", from: null, to: null }] }],
          advisorBriefing: {
            summary: "string, concise portfolio-level answer to user",
            nextActions: ["string, concrete next step"],
            decisions: ["string, decision the user should make"],
            questions: ["string, only if clarification would improve coordination"]
          }
        }
      })
    );

    const parsed = scanSchema.parse(result);
    await supabase.from("ai_sessions").insert({
      user_id: userData.user.id,
      prompt: instruction || "portfolio-scan",
      response_json: parsed,
      mode: "portfolio-scan"
    });

    return jsonResponse(parsed, 200, req);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});
