import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

const noteAssistSchema = z.object({
  projectId: z.unknown().optional(),
  category: z.unknown().optional(),
  title: z.unknown().optional(),
  summary: z.unknown().optional(),
  tags: z.unknown().optional(),
  reviewStatus: z.unknown().optional(),
  actionItems: z.unknown().optional(),
  action_items: z.unknown().optional(),
  tasks: z.unknown().optional(),
  isUrgent: z.unknown().optional(),
  urgent: z.unknown().optional(),
  rationale: z.unknown().optional()
}).passthrough();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401, req);

    const body = await req.json();
    const noteBody = String(body.body ?? "").trim();
    if (noteBody.length < 4) return jsonResponse({ error: "Note body is required" }, 400, req);

    const projects = Array.isArray(body.projects)
      ? body.projects
          .map((project) => ({
            id: typeof project?.id === "string" ? project.id : "",
            name: typeof project?.name === "string" ? project.name : "",
            tags: Array.isArray(project?.tags) ? project.tags.filter((tag: unknown) => typeof tag === "string") : [],
            areas: Array.isArray(project?.areas) ? project.areas.filter((area: unknown) => typeof area === "string") : [],
            goal: typeof project?.goal === "string" ? project.goal : null
          }))
          .filter((project) => project.id && project.name)
      : [];
    const selectedProjectId = typeof body.projectId === "string"
      && projects.some((project) => project.id === body.projectId)
      ? body.projectId
      : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const aiResult = await tryAnalyzeWithAi({
      title: typeof body.title === "string" ? body.title : "",
      body: noteBody,
      source: body.source === "voice" ? "voice" : "written",
      selectedProjectId,
      projects
    });

    const parsedResult = aiResult ? noteAssistSchema.safeParse(aiResult) : null;
    const parsed = parsedResult?.success ? parsedResult.data : {};
    const validProjectIds = new Set(projects.map((project) => project.id));
    const normalizedActionItems = normalizeActionItems(parsed.actionItems ?? parsed.action_items ?? parsed.tasks);
    const actionItems = normalizedActionItems.length ? normalizedActionItems : extractChecklistItems(noteBody);
    const safeParsed = {
      projectId: typeof parsed.projectId === "string" && validProjectIds.has(parsed.projectId) ? parsed.projectId : selectedProjectId,
      category: normalizeCategory(parsed.category),
      title: normalizeText(parsed.title, titleFromBody(noteBody)).slice(0, 80),
      summary: normalizeText(parsed.summary, summarizeFallback(noteBody)).slice(0, 280),
      tags: normalizeTags(parsed.tags),
      reviewStatus: normalizeReviewStatus(parsed.reviewStatus ?? (actionItems.length ? "action" : "inbox")),
      isUrgent: normalizeBoolean(parsed.isUrgent ?? parsed.urgent),
      rationale: normalizeText(
        parsed.rationale,
        aiResult
          ? "Przeanalizowano dokument i uporządkowano notatkę."
          : "AI było chwilowo niedostępne, więc zastosowano bezpieczne reguły analizy dokumentu."
      ).slice(0, 220),
      actionItems
    };

    await supabase.from("ai_sessions").insert({
      user_id: userData.user.id,
      prompt: noteBody,
      response_json: safeParsed,
      mode: "note-assist"
    });

    return jsonResponse(safeParsed, 200, req);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});

type NoteAssistInput = {
  title: string;
  body: string;
  source: "written" | "voice";
  selectedProjectId: string | null;
  projects: Array<{
    id: string;
    name: string;
    tags: string[];
    areas: string[];
    goal: string | null;
  }>;
};

async function tryAnalyzeWithAi(input: NoteAssistInput) {
  try {
    return await callAnthropic(
      "Jesteś asystentem porządkowania notatek projektowych. Zwracasz TYLKO poprawny JSON bez markdown i bez tekstu poza JSON.",
      JSON.stringify({
        task: "Classify a project note and suggest the best project folder.",
        note: {
          title: input.title,
          body: input.body,
          source: input.source,
          selectedProjectId: input.selectedProjectId
        },
        projects: input.projects,
        categories: ["general", "decision", "idea", "risk", "meeting", "finance", "crm", "task", "research"],
        review_statuses: ["inbox", "reviewed", "action"],
        rules: [
          "Prefer selectedProjectId when it is provided by the user.",
          "Use projectId only when the note clearly belongs to one of the provided projects.",
          "Use null for projectId when no project matches and no selectedProjectId was provided.",
          "Mark isUrgent true only for deadlines, blockers, risk, customer follow-up, money due, or explicit urgency.",
          "Use reviewStatus=action when the note contains a next step, assignment, deadline, decision to execute, payment to collect, or follow-up.",
          "Use reviewStatus=reviewed when the note is already clear and archival.",
          "Use reviewStatus=inbox when the note is raw, ambiguous, or needs human sorting.",
          "Title should be short, concrete, and written in the user's language.",
          "Summary should state the usable insight, not repeat the whole note.",
          "Tags should be lowercase, concise, and useful across project folders.",
          "Extract actionItems only when there is a concrete task to do. Do not invent tasks.",
          "If the document is a numbered or bulleted list of items to process, convert each list item into an actionItem.",
          "For dueDate use YYYY-MM-DD or null when the document does not clearly state a date."
        ],
        required_schema: {
          projectId: "project id string or null",
          category: "general|decision|idea|risk|meeting|finance|crm|task|research",
          title: "short title",
          summary: "one-sentence insight",
          tags: ["short tag"],
          reviewStatus: "inbox|reviewed|action",
          actionItems: [{
            title: "task title",
            dueDate: "YYYY-MM-DD or null",
            priority: "low|medium|high|critical",
            impact: "low|medium|high|strategic",
            assignee: "person or null",
            area: "topic or null",
            notes: "context or null"
          }],
          isUrgent: "boolean",
          rationale: "short reason"
        }
      })
    );
  } catch (error) {
    console.error("note-assist AI fallback", error);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeActionItems(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : isRecord(value)
    ? Object.values(value)
    : [];

  return raw
    .filter(isRecord)
    .map((item) => ({
      title: normalizeText(item.title ?? item.name ?? item.task ?? item.action, "").slice(0, 120),
      dueDate: normalizeDate(item.dueDate ?? item.due_date ?? item.deadline),
      priority: normalizePriority(item.priority),
      impact: normalizeImpact(item.impact),
      assignee: normalizeOptionalText(item.assignee ?? item.owner ?? item.responsible),
      area: normalizeOptionalText(item.area ?? item.category ?? item.topic),
      notes: normalizeOptionalText(item.notes ?? item.description ?? item.context)
    }))
    .filter((item) => item.title.length >= 2)
    .slice(0, 12);
}

function extractChecklistItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(\d+[).]|[-*])\s+/.test(line))
    .map((line) => line.replace(/^(\d+[).]|[-*])\s+/, "").trim())
    .filter((line) => line.length >= 3)
    .slice(0, 12)
    .map((title) => ({
      title: title.slice(0, 120),
      dueDate: null,
      priority: "medium",
      impact: "medium",
      assignee: null,
      area: null,
      notes: "Zadanie wydzielone z dokumentu."
    }));
}

function normalizeOptionalText(value: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function normalizeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function normalizeCategory(value: unknown) {
  const text = normalizeText(value, "general").toLowerCase();
  return text === "decision" ||
    text === "idea" ||
    text === "risk" ||
    text === "meeting" ||
    text === "finance" ||
    text === "crm" ||
    text === "task" ||
    text === "research"
    ? text
    : "general";
}

function normalizeReviewStatus(value: unknown) {
  const text = normalizeText(value, "inbox").toLowerCase();
  return text === "reviewed" || text === "action" ? text : "inbox";
}

function normalizePriority(value: unknown) {
  const text = normalizeText(value, "medium").toLowerCase();
  if (text.includes("critical") || text.includes("kryty")) return "critical";
  if (text.includes("high") || text.includes("wysok")) return "high";
  if (text.includes("low") || text.includes("nisk")) return "low";
  return "medium";
}

function normalizeImpact(value: unknown) {
  const text = normalizeText(value, "medium").toLowerCase();
  if (text.includes("strategic") || text.includes("strateg")) return "strategic";
  if (text.includes("high") || text.includes("wysok")) return "high";
  if (text.includes("low") || text.includes("nisk")) return "low";
  return "medium";
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.toLowerCase();
    return text === "true" || text === "yes" || text === "tak" || text === "pilne";
  }
  return false;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function normalizeTags(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(/[,#;]/)
    : [];
  return Array.from(new Set(raw
    .map((tag) => typeof tag === "string" ? tag.trim().toLowerCase() : "")
    .filter(Boolean)))
    .slice(0, 6);
}

function titleFromBody(value: string) {
  return value.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 80) || "Notatka z dokumentu";
}

function summarizeFallback(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240) || "Dokument wymaga przeglądu.";
}
