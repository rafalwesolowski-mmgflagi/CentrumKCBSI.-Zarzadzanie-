// Centrum Projects — MCP Server (Streamable HTTP, no imports)
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AI_READ_API_KEY  = Deno.env.get("AI_READ_API_KEY") ?? "";
const AI_READ_USER_ID  = Deno.env.get("AI_READ_USER_ID") ?? "";

const DEFAULT_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type, mcp-session-id";

function cors(req?: Request) {
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}
const DB_HEADERS = {
  "apikey": SUPABASE_SVC_KEY,
  "Authorization": `Bearer ${SUPABASE_SVC_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

function mcpOk(id: unknown, result: unknown, req?: Request) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }),
    { headers: { ...cors(req), "Content-Type": "application/json" } });
}
function mcpErr(id: unknown, code: number, message: string, req?: Request) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
    { status: 200, headers: { ...cors(req), "Content-Type": "application/json" } });
}

// ── DB helpers ────────────────────────────────────────────────────────────
async function dbGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: DB_HEADERS });
  if (!r.ok) throw new Error(`DB GET ${r.status}: ${await r.text()}`);
  return r.json();
}
async function dbPost(path: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST", headers: DB_HEADERS, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`DB POST ${r.status}: ${await r.text()}`);
  return r.json();
}
async function dbPatch(path: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH", headers: DB_HEADERS, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`DB PATCH ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Urgency / importance ──────────────────────────────────────────────────
const PRIO: Record<string, number> = { low: 1, medium: 3, high: 6, critical: 10 };
const IMP: Record<string, number>  = { low: 1, medium: 2, high: 4, strategic: 7 };

function daysUntil(d: string) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + "T00:00:00").getTime() - t.getTime()) / 86400000);
}
function calcImportance(dueDate: string, priority: string, impact: string) {
  const d = daysUntil(dueDate);
  const prox = d <= 1 ? 5 : d <= 7 ? 4 : d <= 14 ? 3 : d <= 30 ? 2 : 1;
  return (PRIO[priority] || 1) * 2 + (IMP[impact] || 1) * 2 + prox;
}
function calcRisk(score: number) {
  return score >= 18 ? "blocked" : score >= 14 ? "risk" : score >= 10 ? "watch" : "none";
}
function calcUrgency(t: Record<string, string>) {
  const d = daysUntil(t.due_date);
  const base = (PRIO[t.priority] || 1) * (IMP[t.impact] || 1) *
    (d <= 0 ? 10 : d <= 3 ? 8 : d <= 7 ? 6 : d <= 14 ? 4 : d <= 30 ? 2 : 1);
  const over = d < 0 ? Math.min(12, Math.abs(d) * 2) : 0;
  const prox = d <= 0 ? 8 : d <= 3 ? 6 : d <= 7 ? 4 : d <= 14 ? 2 : 0;
  const risk = t.risk_status === "blocked" ? 8 : t.risk_status === "risk" ? 6 : t.risk_status === "watch" ? 3 : 0;
  return base + over + prox + risk;
}

// ── Tool handlers ─────────────────────────────────────────────────────────
async function toolListProjects() {
  const projects: Record<string, unknown>[] = await dbGet(
    `projects?user_id=eq.${AI_READ_USER_ID}&status=neq.done&order=name.asc&select=name,status,goal`
  );
  if (!projects.length) return "No active projects.";
  return projects.map(p =>
    `• ${p.name}${p.goal ? ` [goal: ${p.goal}]` : ""} — ${p.status}`
  ).join("\n");
}

async function toolCreateTask(args: Record<string, unknown>) {
  const projectName = String(args.project_name ?? "");
  const taskName    = String(args.task_name ?? "");
  const dueDate     = String(args.due_date ?? "");
  const priority    = String(args.priority ?? "medium");
  const impact      = String(args.impact ?? "medium");
  const assignee    = args.assignee ? String(args.assignee) : null;
  const notes       = args.notes ? String(args.notes) : null;

  if (!projectName || !taskName || !dueDate) throw new Error("project_name, task_name and due_date are required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("due_date must be YYYY-MM-DD format.");

  const projects: Record<string, unknown>[] = await dbGet(
    `projects?user_id=eq.${AI_READ_USER_ID}&select=id,name`
  );
  const project = projects.find(p =>
    (p.name as string).toLowerCase().includes(projectName.toLowerCase())
  );
  if (!project) {
    const available = projects.map(p => p.name).join(", ");
    throw new Error(`Project "${projectName}" not found. Available: ${available}`);
  }

  const phases: Record<string, unknown>[] = await dbGet(
    `phases?project_id=eq.${project.id}&order=order_index.asc&limit=1&select=id`
  );
  let phaseId = phases[0]?.id as string | undefined;
  if (!phaseId) {
    const created: Record<string, unknown>[] = await dbPost("phases", {
      project_id: project.id, name: "General",
      start_date: dueDate, end_date: dueDate, order_index: 0
    });
    phaseId = (created[0] as Record<string, unknown>).id as string;
  }

  const importance = calcImportance(dueDate, priority, impact);
  await dbPost("tasks", {
    project_id: project.id, phase_id: phaseId, name: taskName,
    due_date: dueDate, status: "backlog", priority, impact,
    deadline_importance: importance, risk_status: calcRisk(importance),
    assignee, notes
  });

  return `✅ Task "${taskName}" added to "${project.name}" — due ${dueDate}, ${priority}/${impact}${assignee ? `, assigned to ${assignee}` : ""}.`;
}

async function toolCompleteTask(args: Record<string, unknown>) {
  const taskName    = String(args.task_name ?? "");
  const projectName = args.project_name ? String(args.project_name) : null;
  if (!taskName) throw new Error("task_name is required.");

  const projects: Record<string, unknown>[] = await dbGet(
    `projects?user_id=eq.${AI_READ_USER_ID}&select=id,name`
  );
  const ids = projects.map(p => p.id as string).join(",");
  if (!ids) throw new Error("No projects found.");

  const tasks: Record<string, unknown>[] = await dbGet(
    `tasks?project_id=in.(${ids})&status=neq.done&select=id,name,project_id,due_date`
  );
  const pName = new Map(projects.map(p => [p.id as string, p.name as string]));

  let matches = tasks.filter(t =>
    (t.name as string).toLowerCase().includes(taskName.toLowerCase())
  );
  if (projectName) {
    matches = matches.filter(t =>
      (pName.get(t.project_id as string) ?? "").toLowerCase().includes(projectName.toLowerCase())
    );
  }

  if (!matches.length) throw new Error(`No open task matching "${taskName}".`);
  if (matches.length > 1) {
    throw new Error(`Multiple matches: ${matches.map(t => `"${t.name}" in ${pName.get(t.project_id as string)}`).join("; ")}. Be more specific.`);
  }

  const task = matches[0];
  await dbPatch(`tasks?id=eq.${task.id}`, {
    status: "done", completed_at: new Date().toISOString()
  });
  return `✅ Task "${task.name}" marked as done.`;
}

async function toolGetPortfolio(args: Record<string, unknown>) {
  const windowDays = Math.min(90, Math.max(1, Number(args.window_days ?? 14)));
  const mode = String(args.mode ?? "full");

  const projects: Record<string, unknown>[] = await dbGet(
    `projects?user_id=eq.${AI_READ_USER_ID}&order=created_at.desc&select=*`
  );
  const ids = projects.map(p => p.id as string).join(",");
  const tasks: Record<string, unknown>[] = ids.length
    ? await dbGet(`tasks?project_id=in.(${ids})&order=due_date.asc&select=*`) : [];

  const pById = new Map(projects.map(p => [p.id as string, p]));
  const open = tasks.filter(t => t.status !== "done");
  const done = tasks.filter(t => t.status === "done");

  const priorities = open
    .map(t => ({ t, d: daysUntil(t.due_date as string), u: calcUrgency(t as Record<string, string>) }))
    .filter(x => x.d <= windowDays)
    .sort((a, b) => b.u - a.u || a.d - b.d).slice(0, 20)
    .map((x, i) => {
      const p = pById.get(x.t.project_id as string);
      return { rank: i + 1, task: x.t.name, project: p ? p.name : "?",
        due_date: x.t.due_date, days_left: x.d, priority: x.t.priority,
        impact: x.t.impact, urgency_score: x.u, risk_status: x.t.risk_status,
        assignee: x.t.assignee ?? null, notes: x.t.notes ?? null };
    });

  const overdue = open.filter(t => daysUntil(t.due_date as string) < 0)
    .map(t => ({ task: t.name, project: (pById.get(t.project_id as string) ?? {}).name ?? "?",
      due_date: t.due_date, days_overdue: Math.abs(daysUntil(t.due_date as string)),
      priority: t.priority, assignee: t.assignee ?? null }))
    .sort((a, b) => (b.days_overdue as number) - (a.days_overdue as number));

  const projectStats = projects.filter(p => p.status !== "done").map(p => {
    const pt = tasks.filter(t => t.project_id === p.id);
    const po = pt.filter(t => t.status !== "done");
    const pd = pt.filter(t => t.status === "done");
    const pov = po.filter(t => daysUntil(t.due_date as string) < 0);
    const pcr = po.filter(t => t.priority === "critical" || t.impact === "strategic");
    const pbl = po.filter(t => t.risk_status === "blocked");
    const score = pbl.length * 4 + pov.length * 3 + pcr.length * 2;
    const health = score >= 12 ? "blocked" : score >= 7 ? "risk" : score >= 3 ? "watch" : "healthy";
    const next = [...po].sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))[0];
    return { name: p.name, status: p.status, health, goal: p.goal ?? null,
      progress_pct: pt.length ? Math.round(pd.length / pt.length * 100) : 0,
      open_tasks: po.length, overdue_tasks: pov.length,
      next_deadline: next ? next.due_date : null };
  }).sort((a, b) =>
    ["blocked","risk","watch","healthy"].indexOf(a.health as string) -
    ["blocked","risk","watch","healthy"].indexOf(b.health as string));

  const workload: Record<string, Record<string, number>> = {};
  for (const t of open) {
    const k = (t.assignee as string) ?? "Unassigned";
    if (!workload[k]) workload[k] = { total: 0, overdue: 0, this_week: 0, critical: 0 };
    workload[k].total++;
    const d = daysUntil(t.due_date as string);
    if (d < 0) workload[k].overdue++;
    if (d >= 0 && d <= 7) workload[k].this_week++;
    if (t.priority === "critical") workload[k].critical++;
  }

  const ts = done.filter(t => t.completed_at);
  const cutoff7 = new Date(); cutoff7.setDate(cutoff7.getDate() - 7);
  const vel7 = ts.filter(t => new Date(t.completed_at as string) >= cutoff7).length;
  const onTime = ts.filter(t => new Date(t.completed_at as string) <= new Date((t.due_date as string) + "T23:59:59")).length;
  const onTimeRate = ts.length ? Math.round(onTime / ts.length * 100) : null;

  const risky = projectStats.filter(p => p.health === "blocked" || p.health === "risk").map(p => p.name);
  const top = priorities[0];
  const brief = [
    `Portfolio ${new Date().toISOString().slice(0, 10)}.`,
    `Active: ${projectStats.length} projects. Open: ${open.length} tasks. Done: ${done.length}.`,
    overdue.length ? `WARNING: ${overdue.length} tasks overdue.` : "No overdue tasks.",
    risky.length ? `At-risk: ${risky.join(", ")}.` : "All projects healthy.",
    top ? `Top priority (${windowDays}d): "${top.task}" [${top.project}] due ${top.due_date}, urgency ${top.urgency_score}.`
        : `No tasks due in next ${windowDays} days.`,
    onTimeRate !== null ? `On-time: ${onTimeRate}%. Velocity 7d: ${vel7}.` : ""
  ].filter(Boolean).join(" ");

  if (mode === "brief") return brief;
  if (mode === "priorities") return JSON.stringify({ priorities, overdue }, null, 2);
  return JSON.stringify({ generated_at: new Date().toISOString(), window_days: windowDays,
    brief, summary: { active_projects: projectStats.length, open_tasks: open.length,
      done_tasks: done.length, currently_overdue: overdue.length,
      on_time_rate_pct: onTimeRate, velocity_7d: vel7 },
    priorities, overdue, projects: projectStats, workload_by_assignee: workload }, null, 2);
}

// ── Tool definitions ─────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "get_portfolio",
    description: "Get current portfolio state: priorities, overdue tasks, project health, workload. Use when user asks about projects, tasks, risks, or what to work on.",
    inputSchema: {
      type: "object",
      properties: {
        window_days: { type: "number", description: "Days ahead for priority list (7/14/30)", default: 14 },
        mode: { type: "string", enum: ["full", "brief", "priorities"], default: "full" }
      }
    }
  },
  {
    name: "list_projects",
    description: "List all active projects with their names, status and strategic goal. Use this before create_task when you need exact project names.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "create_task",
    description: "Add a new task to a project. Always call list_projects first if you are unsure of the exact project name.",
    inputSchema: {
      type: "object",
      required: ["project_name", "task_name", "due_date"],
      properties: {
        project_name: { type: "string", description: "Project name (partial match OK)" },
        task_name:    { type: "string", description: "Task title" },
        due_date:     { type: "string", description: "Due date in YYYY-MM-DD format" },
        priority:     { type: "string", enum: ["low","medium","high","critical"], default: "medium" },
        impact:       { type: "string", enum: ["low","medium","high","strategic"], default: "medium" },
        assignee:     { type: "string", description: "Person responsible (optional)" },
        notes:        { type: "string", description: "Additional context (optional)" }
      }
    }
  },
  {
    name: "complete_task",
    description: "Mark a task as done (status → done, sets completed_at timestamp).",
    inputSchema: {
      type: "object",
      required: ["task_name"],
      properties: {
        task_name:    { type: "string", description: "Task name or part of it (case-insensitive)" },
        project_name: { type: "string", description: "Narrow search to this project (optional)" }
      }
    }
  }
];

// ── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ name: "centrum-projects", version: "2.0", protocol: "MCP", tools: TOOLS.map(t => t.name) }),
      { headers: { ...cors(req), "Content-Type": "application/json" } });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors(req) });

  const urlKey = new URL(req.url).searchParams.get("apikey") ?? "";
  const hdrKey = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!AI_READ_API_KEY || (hdrKey || urlKey) !== AI_READ_API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors(req) });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors(req) }); }

  const { id, method, params } = body as { id: unknown; method: string; params: Record<string, unknown> };
  if (id === undefined || id === null) return new Response(null, { status: 202, headers: cors(req) });

  try {
    switch (method) {
      case "initialize":
        return mcpOk(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "centrum-projects", version: "2.0" }
        }, req);
      case "ping":
        return mcpOk(id, {}, req);
      case "tools/list":
        return mcpOk(id, { tools: TOOLS }, req);
      case "tools/call": {
        const name = String((params?.name as string) ?? "");
        const args = (params?.arguments as Record<string, unknown>) ?? {};
        let text: string;
        if (name === "get_portfolio")  text = await toolGetPortfolio(args);
        else if (name === "list_projects") text = await toolListProjects();
        else if (name === "create_task")   text = await toolCreateTask(args);
        else if (name === "complete_task") text = await toolCompleteTask(args);
        else return mcpErr(id, -32602, `Unknown tool: ${name}`, req);
        return mcpOk(id, { content: [{ type: "text", text }] }, req);
      }
      default:
        return mcpErr(id, -32601, `Method not found: ${method}`, req);
    }
  } catch (e) {
    return mcpErr(id, -32603, (e as Error).message, req);
  }
});
