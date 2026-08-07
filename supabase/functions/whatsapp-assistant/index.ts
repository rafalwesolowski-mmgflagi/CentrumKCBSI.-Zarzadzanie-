import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

type AssistantIntent =
  | "portfolio_brief"
  | "priorities"
  | "list_projects"
  | "find_task"
  | "create_task"
  | "complete_task"
  | "calendar_task"
  | "help"
  | "unknown";

type AssistantPlan = {
  intent: AssistantIntent;
  confidence?: number;
  reply?: string;
  args?: Record<string, unknown>;
};

type ProjectRow = {
  id: string;
  name: string;
  color?: string | null;
  status?: string | null;
  goal?: string | null;
  created_at?: string | null;
};

type TaskRow = {
  id: string;
  project_id: string;
  phase_id?: string | null;
  name: string;
  status: string;
  due_date: string;
  priority: string;
  impact: string;
  deadline_importance?: number | null;
  risk_status: string;
  area?: string | null;
  assignee?: string | null;
  notes?: string | null;
  recurrence?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  project?: ProjectRow | ProjectRow[] | null;
};

const MAX_WHATSAPP_CHARS = 1450;
const PRIO: Record<string, number> = { low: 1, medium: 3, high: 6, critical: 10 };
const IMP: Record<string, number> = { low: 1, medium: 2, high: 4, strategic: 7 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req, "GET, POST, OPTIONS") });
  if (req.method === "GET") {
    return jsonResponse({
      name: "whatsapp-assistant",
      description: "WhatsApp control assistant for AI Project Hub",
      accepts: ["Twilio WhatsApp form payload", "JSON { message }"]
    }, 200, req);
  }
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  const apiKey = Deno.env.get("WHATSAPP_ASSISTANT_API_KEY") ?? Deno.env.get("AI_READ_API_KEY") ?? "";
  const userId = Deno.env.get("WHATSAPP_ASSISTANT_USER_ID") ?? Deno.env.get("AI_READ_USER_ID") ?? "";
  const suppliedKey = readApiKey(req);
  if (!apiKey || suppliedKey !== apiKey) return respond(req, { text: "Unauthorized", status: 401 });
  if (!userId) return respond(req, { text: "Server misconfigured: missing WHATSAPP_ASSISTANT_USER_ID", status: 500 });

  try {
    const incoming = await readIncomingMessage(req);
    if (!incoming.message) {
      return respond(req, { text: "Napisz komendę, np.: status, priorytety, projekty albo kalendarz <nazwa zadania>.", twilio: incoming.twilio });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const plan = await planFromMessage(incoming.message);
    const text = await executePlan({ supabase, userId, plan, rawMessage: incoming.message });
    return respond(req, { text, twilio: incoming.twilio });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return respond(req, { text: `Nie udało mi się tego wykonać: ${message}`, status: 500 });
  }
});

function readApiKey(req: Request) {
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("apikey") ?? "";
  const headerKey = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  return headerKey || queryKey;
}

async function readIncomingMessage(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    return {
      twilio: true,
      message: String(form.get("Body") ?? "").trim(),
      from: String(form.get("From") ?? "").trim(),
      messageId: String(form.get("MessageSid") ?? "").trim()
    };
  }

  const body = await req.json().catch(() => ({}));
  return {
    twilio: false,
    message: String(body.message ?? body.body ?? body.text ?? "").trim(),
    from: typeof body.from === "string" ? body.from : null,
    messageId: typeof body.id === "string" ? body.id : null
  };
}

async function planFromMessage(message: string): Promise<AssistantPlan> {
  const lowered = message.toLowerCase();
  if (["help", "pomoc", "?"].includes(lowered)) return { intent: "help" };
  if (["status", "brief", "portfolio"].includes(lowered)) return { intent: "portfolio_brief", args: { window_days: 14 } };
  if (["priorytety", "priority", "najważniejsze", "najwazniejsze"].includes(lowered)) {
    return { intent: "priorities", args: { window_days: 14 } };
  }
  if (["projekty", "projects"].includes(lowered)) return { intent: "list_projects" };

  const today = new Date().toISOString().slice(0, 10);
  const result = await callAnthropic(
    "Jesteś routerem komend dla osobistego asystenta projektowego na WhatsApp. Zwracasz tylko poprawny JSON.",
    JSON.stringify({
      today,
      user_message: message,
      intents: {
        portfolio_brief: "krótki status portfela, ryzyka, co najważniejsze",
        priorities: "lista najważniejszych zadań w oknie dni",
        list_projects: "lista aktywnych projektów",
        find_task: "znajdź zadanie po fragmencie nazwy lub projekcie",
        create_task: "dodaj zadanie do projektu",
        complete_task: "oznacz zadanie jako zrobione",
        calendar_task: "wyślij zadanie do Google Calendar przez n8n",
        help: "użytkownik prosi o pomoc",
        unknown: "nie da się bezpiecznie rozpoznać"
      },
      required_json: {
        intent: "portfolio_brief|priorities|list_projects|find_task|create_task|complete_task|calendar_task|help|unknown",
        confidence: "0..1",
        args: {
          window_days: "number optional, default 14",
          project_name: "string optional",
          task_name: "string optional",
          due_date: "YYYY-MM-DD optional, required for create_task",
          priority: "low|medium|high|critical optional",
          impact: "low|medium|high|strategic optional",
          assignee: "string optional",
          notes: "string optional"
        },
        reply: "short Polish clarification only when intent is unknown or required data is missing"
      }
    })
  );

  return normalizePlan(result);
}

function normalizePlan(value: unknown): AssistantPlan {
  if (!isRecord(value)) return { intent: "unknown", reply: "Nie rozpoznałem komendy." };
  const intent = String(value.intent ?? "unknown") as AssistantIntent;
  const allowed: AssistantIntent[] = [
    "portfolio_brief",
    "priorities",
    "list_projects",
    "find_task",
    "create_task",
    "complete_task",
    "calendar_task",
    "help",
    "unknown"
  ];
  return {
    intent: allowed.includes(intent) ? intent : "unknown",
    confidence: typeof value.confidence === "number" ? value.confidence : undefined,
    reply: typeof value.reply === "string" ? value.reply : undefined,
    args: isRecord(value.args) ? value.args : {}
  };
}

async function executePlan({
  supabase,
  userId,
  plan,
  rawMessage
}: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  plan: AssistantPlan;
  rawMessage: string;
}) {
  if ((plan.confidence ?? 1) < 0.45) {
    return plan.reply || helpText();
  }

  switch (plan.intent) {
    case "portfolio_brief":
      return formatPortfolioBrief(await getPortfolioData(supabase, userId, numberArg(plan.args, "window_days", 14)));
    case "priorities":
      return formatPriorities(await getPortfolioData(supabase, userId, numberArg(plan.args, "window_days", 14)));
    case "list_projects":
      return listProjects(supabase, userId);
    case "find_task":
      return findTaskReply(supabase, userId, stringArg(plan.args, "task_name") || rawMessage, stringArg(plan.args, "project_name"));
    case "create_task":
      return createTask(supabase, userId, plan.args ?? {});
    case "complete_task":
      return completeTask(supabase, userId, stringArg(plan.args, "task_name") || rawMessage, stringArg(plan.args, "project_name"));
    case "calendar_task":
      return sendTaskToCalendar(supabase, userId, stringArg(plan.args, "task_name") || rawMessage, stringArg(plan.args, "project_name"));
    case "help":
      return helpText();
    case "unknown":
    default:
      return plan.reply || helpText();
  }
}

async function getPortfolioData(supabase: ReturnType<typeof createClient>, userId: string, windowDays: number) {
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (projectsError) throw new Error(projectsError.message);

  const projectRows = (projects ?? []) as ProjectRow[];
  const ids = projectRows.map((project) => project.id);
  const { data: tasks, error: tasksError } = ids.length
    ? await supabase.from("tasks").select("*").in("project_id", ids).order("due_date", { ascending: true })
    : { data: [], error: null };
  if (tasksError) throw new Error(tasksError.message);

  const taskRows = (tasks ?? []) as TaskRow[];
  const pById = new Map(projectRows.map((project) => [project.id, project]));
  const open = taskRows.filter((task) => task.status !== "done");
  const done = taskRows.filter((task) => task.status === "done");
  const priorities = open
    .map((task) => ({ task, days: daysUntil(task.due_date), urgency: calcUrgency(task) }))
    .filter((item) => item.days <= windowDays)
    .sort((a, b) => b.urgency - a.urgency || a.days - b.days)
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      task: item.task,
      project: pById.get(item.task.project_id) ?? null,
      days: item.days,
      urgency: item.urgency
    }));

  const overdue = open
    .filter((task) => daysUntil(task.due_date) < 0)
    .sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date));

  const riskyProjects = projectRows
    .filter((project) => project.status !== "done")
    .map((project) => {
      const projectTasks = taskRows.filter((task) => task.project_id === project.id);
      const projectOpen = projectTasks.filter((task) => task.status !== "done");
      const overdueCount = projectOpen.filter((task) => daysUntil(task.due_date) < 0).length;
      const blockedCount = projectOpen.filter((task) => task.risk_status === "blocked").length;
      const criticalCount = projectOpen.filter((task) => task.priority === "critical" || task.impact === "strategic").length;
      const score = overdueCount * 3 + blockedCount * 4 + criticalCount * 2;
      const health = score >= 12 ? "blocked" : score >= 7 ? "risk" : score >= 3 ? "watch" : "healthy";
      return { project, health, open: projectOpen.length, overdue: overdueCount };
    })
    .sort((a, b) => ["blocked", "risk", "watch", "healthy"].indexOf(a.health) - ["blocked", "risk", "watch", "healthy"].indexOf(b.health));

  return { windowDays, projects: projectRows, tasks: taskRows, open, done, priorities, overdue, riskyProjects };
}

function formatPortfolioBrief(data: Awaited<ReturnType<typeof getPortfolioData>>) {
  const top = data.priorities[0];
  const risky = data.riskyProjects.filter((item) => item.health === "blocked" || item.health === "risk");
  return trimForWhatsApp([
    `Status portfela (${data.windowDays} dni):`,
    `Aktywne projekty: ${data.riskyProjects.length}. Otwarte zadania: ${data.open.length}. Zrobione: ${data.done.length}.`,
    data.overdue.length ? `Po terminie: ${data.overdue.length}.` : "Brak zadań po terminie.",
    risky.length ? `W ryzyku: ${risky.slice(0, 4).map((item) => item.project.name).join(", ")}.` : "Projekty wyglądają stabilnie.",
    top ? `Najważniejsze teraz: ${top.task.name} [${top.project?.name ?? "?"}], termin ${top.task.due_date}.` : "Brak pilnych zadań w tym oknie."
  ].join("\n"));
}

function formatPriorities(data: Awaited<ReturnType<typeof getPortfolioData>>) {
  if (!data.priorities.length) return `Brak otwartych zadań w oknie ${data.windowDays} dni.`;
  return trimForWhatsApp([
    `Priorytety (${data.windowDays} dni):`,
    ...data.priorities.slice(0, 8).map((item) =>
      `${item.rank}. ${item.task.name} [${item.project?.name ?? "?"}] - ${item.task.due_date}, ${item.task.priority}/${item.task.impact}, U${item.urgency}`
    )
  ].join("\n"));
}

async function listProjects(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("name,status,goal")
    .eq("user_id", userId)
    .neq("status", "done")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  const projects = (data ?? []) as ProjectRow[];
  if (!projects.length) return "Nie widzę aktywnych projektów.";
  return trimForWhatsApp(["Aktywne projekty:", ...projects.map((project) =>
    `- ${project.name} (${project.status})${project.goal ? ` - ${project.goal}` : ""}`
  )].join("\n"));
}

async function findTaskReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  taskName: string,
  projectName: string | null
) {
  const matches = await findOpenTasks(supabase, userId, taskName, projectName);
  if (!matches.length) return `Nie znalazłem otwartego zadania pasującego do: ${taskName}.`;
  return trimForWhatsApp([
    matches.length === 1 ? "Znalazłem zadanie:" : `Znalazłem ${matches.length} zadań:`,
    ...matches.slice(0, 8).map((task) => {
      const project = getProject(task);
      return `- ${task.name} [${project?.name ?? "?"}] - ${task.due_date}, ${task.priority}/${task.impact}, status ${task.status}`;
    })
  ].join("\n"));
}

async function createTask(supabase: ReturnType<typeof createClient>, userId: string, args: Record<string, unknown>) {
  const projectName = stringArg(args, "project_name");
  const taskName = stringArg(args, "task_name");
  const dueDate = stringArg(args, "due_date");
  const priority = enumArg(args, "priority", ["low", "medium", "high", "critical"], "medium");
  const impact = enumArg(args, "impact", ["low", "medium", "high", "strategic"], "medium");
  const assignee = stringArg(args, "assignee");
  const notes = stringArg(args, "notes");

  if (!projectName || !taskName || !dueDate) {
    return "Do dodania zadania potrzebuję: projekt, nazwa zadania i data YYYY-MM-DD.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return "Data zadania musi być w formacie YYYY-MM-DD.";

  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id,name")
    .eq("user_id", userId);
  if (projectError) throw new Error(projectError.message);

  const project = ((projects ?? []) as ProjectRow[]).find((item) => item.name.toLowerCase().includes(projectName.toLowerCase()));
  if (!project) return `Nie znalazłem projektu "${projectName}". Napisz "projekty", żeby zobaczyć listę.`;

  const { data: phases, error: phaseError } = await supabase
    .from("phases")
    .select("id")
    .eq("project_id", project.id)
    .order("order_index", { ascending: true })
    .limit(1);
  if (phaseError) throw new Error(phaseError.message);

  let phaseId = (phases?.[0] as { id?: string } | undefined)?.id;
  if (!phaseId) {
    const { data: createdPhase, error: createPhaseError } = await supabase
      .from("phases")
      .insert({ project_id: project.id, name: "General", start_date: dueDate, end_date: dueDate, order_index: 0 })
      .select("id")
      .single();
    if (createPhaseError) throw new Error(createPhaseError.message);
    phaseId = createdPhase.id;
  }

  const importance = calcImportance(dueDate, priority, impact);
  const { error: taskError } = await supabase.from("tasks").insert({
    project_id: project.id,
    phase_id: phaseId,
    name: taskName,
    due_date: dueDate,
    status: "backlog",
    priority,
    impact,
    deadline_importance: importance,
    risk_status: calcRisk(importance),
    assignee,
    notes
  });
  if (taskError) throw new Error(taskError.message);

  return `Dodane: "${taskName}" do "${project.name}" na ${dueDate} (${priority}/${impact}).`;
}

async function completeTask(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  taskName: string,
  projectName: string | null
) {
  const matches = await findOpenTasks(supabase, userId, taskName, projectName);
  if (!matches.length) return `Nie znalazłem otwartego zadania pasującego do: ${taskName}.`;
  if (matches.length > 1) return disambiguate(matches, "Które zadanie oznaczyć jako zrobione?");

  const task = matches[0];
  const { error } = await supabase
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", task.id);
  if (error) throw new Error(error.message);
  return `Gotowe. Oznaczyłem jako zrobione: "${task.name}".`;
}

async function sendTaskToCalendar(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  taskName: string,
  projectName: string | null
) {
  const webhookUrl = (Deno.env.get("N8N_TASK_CALENDAR_WEBHOOK_URL") ?? "").trim();
  if (!webhookUrl || !isHttpUrl(webhookUrl)) return "Nie mam ustawionego N8N_TASK_CALENDAR_WEBHOOK_URL, więc nie wyślę zadania do kalendarza.";

  const matches = await findOpenTasks(supabase, userId, taskName, projectName);
  if (!matches.length) return `Nie znalazłem otwartego zadania pasującego do: ${taskName}.`;
  if (matches.length > 1) return disambiguate(matches, "Które zadanie wysłać do kalendarza?");

  const task = matches[0];
  const project = getProject(task);
  const { data: notification, error: notificationError } = await supabase
    .from("task_calendar_notifications")
    .insert({
      user_id: userId,
      task_id: task.id,
      status: "pending",
      workflow: "whatsapp-n8n-google-calendar",
      request_json: { taskId: task.id, requestedAt: new Date().toISOString(), source: "whatsapp-assistant" }
    })
    .select("id")
    .single();
  if (notificationError) throw new Error(notificationError.message);

  const payload = {
    eventType: "task.calendar_request",
    requestId: notification.id,
    sentAt: new Date().toISOString(),
    source: "whatsapp-assistant",
    user: { id: userId },
    task: {
      id: task.id,
      name: task.name,
      status: task.status,
      dueDate: task.due_date,
      priority: task.priority,
      impact: task.impact,
      deadlineImportance: task.deadline_importance,
      riskStatus: task.risk_status,
      area: task.area,
      assignee: task.assignee,
      notes: task.notes,
      recurrence: task.recurrence
    },
    project: project ? { id: project.id, name: project.name, color: project.color } : null,
    calendar: {
      title: task.name,
      date: task.due_date,
      endDate: addOneDay(task.due_date),
      allDay: true,
      timezone: "Europe/Oslo",
      description: buildCalendarDescription(task, project)
    }
  };

  await supabase.from("task_calendar_notifications").update({ request_json: payload }).eq("id", notification.id);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await readWebhookResponse(response);

  if (!response.ok) {
    await supabase
      .from("task_calendar_notifications")
      .update({ status: "failed", response_json: result, error_message: `n8n HTTP ${response.status}`, completed_at: new Date().toISOString() })
      .eq("id", notification.id);
    return `n8n odrzucił zapis do kalendarza (${response.status}).`;
  }

  await supabase
    .from("task_calendar_notifications")
    .update({ status: "sent", response_json: result, completed_at: new Date().toISOString() })
    .eq("id", notification.id);

  const link = typeof result.htmlLink === "string" ? `\n${result.htmlLink}` : "";
  return `Wysłane do kalendarza: "${task.name}" na ${task.due_date}.${link}`;
}

async function findOpenTasks(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  taskName: string,
  projectName: string | null
) {
  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id,name,color")
    .eq("user_id", userId);
  if (projectError) throw new Error(projectError.message);
  const projectRows = (projects ?? []) as ProjectRow[];
  const allowedProjects = projectName
    ? projectRows.filter((project) => project.name.toLowerCase().includes(projectName.toLowerCase()))
    : projectRows;
  const ids = allowedProjects.map((project) => project.id);
  if (!ids.length) return [];

  const normalizedNeedle = cleanTaskNeedle(taskName);
  const { data, error } = await supabase
    .from("tasks")
    .select("*, project:projects(id,name,color)")
    .in("project_id", ids)
    .neq("status", "done")
    .ilike("name", `%${escapeLike(normalizedNeedle)}%`)
    .order("due_date", { ascending: true })
    .limit(12);
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

function cleanTaskNeedle(value: string) {
  return value
    .replace(/^(znajdź|znajdz|szukaj|kalendarz|wrzuć|wrzuc|dodaj do kalendarza|zrobione|ukończ|ukoncz|complete)\s+/i, "")
    .trim();
}

function disambiguate(tasks: TaskRow[], header: string) {
  return trimForWhatsApp([
    header,
    ...tasks.slice(0, 8).map((task) => {
      const project = getProject(task);
      return `- ${task.name} [${project?.name ?? "?"}] - ${task.due_date}`;
    })
  ].join("\n"));
}

function getProject(task: TaskRow) {
  if (Array.isArray(task.project)) return task.project[0] ?? null;
  return task.project ?? null;
}

function helpText() {
  return [
    "Mogę sterować AI Project Hub z WhatsApp.",
    "Przykłady:",
    "- status",
    "- priorytety na 7 dni",
    "- projekty",
    "- znajdź zadanie faktura",
    "- dodaj zadanie do AI Project Hub: test integracji na 2026-07-05",
    "- oznacz faktura jako zrobione",
    "- wrzuć faktura do kalendarza"
  ].join("\n");
}

function respond(req: Request, { text, status = 200, twilio }: { text: string; status?: number; twilio?: boolean }) {
  const contentType = req.headers.get("content-type") ?? "";
  const shouldUseTwiml = twilio ?? contentType.includes("application/x-www-form-urlencoded");
  const trimmed = trimForWhatsApp(text);
  if (shouldUseTwiml) {
    return new Response(`<Response><Message>${escapeXml(trimmed)}</Message></Response>`, {
      status,
      headers: { "Content-Type": "text/xml; charset=utf-8" }
    });
  }
  return jsonResponse({ ok: status >= 200 && status < 300, message: trimmed }, status, req);
}

function trimForWhatsApp(value: string) {
  const trimmed = value.trim();
  return trimmed.length <= MAX_WHATSAPP_CHARS ? trimmed : `${trimmed.slice(0, MAX_WHATSAPP_CHARS - 20)}\n...`;
}

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function calcImportance(dueDate: string, priority: string, impact: string) {
  const days = daysUntil(dueDate);
  const proximity = days <= 1 ? 5 : days <= 7 ? 4 : days <= 14 ? 3 : days <= 30 ? 2 : 1;
  return (PRIO[priority] || 1) * 2 + (IMP[impact] || 1) * 2 + proximity;
}

function calcRisk(score: number) {
  return score >= 18 ? "blocked" : score >= 14 ? "risk" : score >= 10 ? "watch" : "none";
}

function calcUrgency(task: TaskRow) {
  const days = daysUntil(task.due_date);
  const base = (PRIO[task.priority] || 1) * (IMP[task.impact] || 1) *
    (days <= 0 ? 10 : days <= 3 ? 8 : days <= 7 ? 6 : days <= 14 ? 4 : days <= 30 ? 2 : 1);
  const overdue = days < 0 ? Math.min(12, Math.abs(days) * 2) : 0;
  const proximity = days <= 0 ? 8 : days <= 3 ? 6 : days <= 7 ? 4 : days <= 14 ? 2 : 0;
  const risk = task.risk_status === "blocked" ? 8 : task.risk_status === "risk" ? 6 : task.risk_status === "watch" ? 3 : 0;
  return base + overdue + proximity + risk;
}

function addOneDay(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function buildCalendarDescription(task: TaskRow, project: ProjectRow | null) {
  return [
    project ? `Projekt: ${project.name}` : null,
    task.area ? `Obszar: ${task.area}` : null,
    task.assignee ? `Wykonawca: ${task.assignee}` : null,
    `Priorytet: ${task.priority}`,
    `Wpływ: ${task.impact}`,
    `Ryzyko: ${task.risk_status}`,
    task.notes ? `Notatka: ${task.notes}` : null
  ].filter(Boolean).join("\n");
}

async function readWebhookResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const value = await response.json().catch(() => ({ parseError: "Could not parse JSON response" }));
    return isRecord(value) ? value : { value };
  }
  return { text: (await response.text()).slice(0, 1000) };
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stringArg(args: Record<string, unknown> | undefined, key: string) {
  const value = args?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberArg(args: Record<string, unknown> | undefined, key: string, fallback: number) {
  const value = Number(args?.[key] ?? fallback);
  return Number.isFinite(value) ? Math.min(90, Math.max(1, value)) : fallback;
}

function enumArg<T extends string>(args: Record<string, unknown>, key: string, allowed: T[], fallback: T) {
  const value = String(args[key] ?? fallback);
  return allowed.includes(value as T) ? value as T : fallback;
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
