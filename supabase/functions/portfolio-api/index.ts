// No imports — uses Deno built-in fetch + Supabase REST API directly
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SVC_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AI_READ_API_KEY    = Deno.env.get("AI_READ_API_KEY") ?? "";
const AI_READ_USER_ID    = Deno.env.get("AI_READ_USER_ID") ?? "";

const DEFAULT_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin"
  };
}

function ok(body: unknown, req?: Request) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { ...cors(req), "Content-Type": "application/json" }
  });
}
function err(msg: string, status = 400, req?: Request) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: cors(req) });
}

async function dbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_SVC_KEY,
      "Authorization": `Bearer ${SUPABASE_SVC_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    }
  });
  if (!res.ok) throw new Error(`DB error ${res.status}: ${await res.text()}`);
  return res.json();
}

const PRIO: Record<string, number> = { low: 1, medium: 3, high: 6, critical: 10 };
const IMP: Record<string, number>  = { low: 1, medium: 2, high: 4, strategic: 7 };

function daysUntil(d: string): number {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + "T00:00:00").getTime() - t.getTime()) / 86400000);
}

function urgency(t: Record<string, string>): number {
  const d = daysUntil(t.due_date);
  const base = (PRIO[t.priority] || 1) * (IMP[t.impact] || 1) *
    (d <= 0 ? 10 : d <= 3 ? 8 : d <= 7 ? 6 : d <= 14 ? 4 : d <= 30 ? 2 : 1);
  const over = d < 0 ? Math.min(12, Math.abs(d) * 2) : 0;
  const prox = d <= 0 ? 8 : d <= 3 ? 6 : d <= 7 ? 4 : d <= 14 ? 2 : 0;
  const risk = t.risk_status === "blocked" ? 8 : t.risk_status === "risk" ? 6 : t.risk_status === "watch" ? 3 : 0;
  return base + over + prox + risk;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  const urlKey = new URL(req.url).searchParams.get("apikey") ?? "";
  const hdrKey = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const auth = hdrKey || urlKey;
  if (!AI_READ_API_KEY || auth !== AI_READ_API_KEY) return err("Unauthorized", 401, req);
  if (!SUPABASE_URL || !SUPABASE_SVC_KEY || !AI_READ_USER_ID) return err("Server misconfigured", 500, req);

  const url = new URL(req.url);
  const windowDays = Math.min(90, Math.max(1, Number(url.searchParams.get("window") ?? "14")));
  const mode = url.searchParams.get("mode") ?? "full";

  const projects: Record<string, unknown>[] = await dbGet(
    `projects?user_id=eq.${AI_READ_USER_ID}&order=created_at.desc&select=*`
  );
  const ids = projects.map(p => p.id as string).join(",");
  const tasks: Record<string, unknown>[] = ids.length
    ? await dbGet(`tasks?project_id=in.(${ids})&order=due_date.asc&select=*`)
    : [];

  const pById = new Map(projects.map(p => [p.id as string, p]));
  const open = tasks.filter(t => t.status !== "done");
  const done = tasks.filter(t => t.status === "done");

  const priorities = open
    .map(t => ({ t, d: daysUntil(t.due_date as string), u: urgency(t as Record<string, string>) }))
    .filter(x => x.d <= windowDays)
    .sort((a, b) => b.u - a.u || a.d - b.d)
    .slice(0, 20)
    .map((x, i) => {
      const p = pById.get(x.t.project_id as string);
      return {
        rank: i + 1, task: x.t.name, project: p ? p.name : "?",
        due_date: x.t.due_date, days_left: x.d,
        priority: x.t.priority, impact: x.t.impact, urgency_score: x.u,
        risk_status: x.t.risk_status, assignee: x.t.assignee ?? null,
        notes: x.t.notes ?? null, recurrence: x.t.recurrence ?? null
      };
    });

  const overdue = open
    .filter(t => daysUntil(t.due_date as string) < 0)
    .map(t => ({ task: t.name, project: (pById.get(t.project_id as string) ?? {}).name ?? "?",
      due_date: t.due_date, days_overdue: Math.abs(daysUntil(t.due_date as string)),
      priority: t.priority, risk_status: t.risk_status, assignee: t.assignee ?? null }))
    .sort((a, b) => (b.days_overdue as number) - (a.days_overdue as number));

  const projectStats = projects
    .filter(p => p.status !== "done")
    .map(p => {
      const pt = tasks.filter(t => t.project_id === p.id);
      const po = pt.filter(t => t.status !== "done");
      const pd = pt.filter(t => t.status === "done");
      const pov = po.filter(t => daysUntil(t.due_date as string) < 0);
      const pcr = po.filter(t => t.priority === "critical" || t.impact === "strategic");
      const pbl = po.filter(t => t.risk_status === "blocked");
      const prog = pt.length ? Math.round(pd.length / pt.length * 100) : 0;
      const score = pbl.length * 4 + pov.length * 3 + pcr.length * 2;
      const health = score >= 12 ? "blocked" : score >= 7 ? "risk" : score >= 3 ? "watch" : "healthy";
      const next = [...po].sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))[0];
      return { name: p.name, status: p.status, health, goal: p.goal ?? null,
        progress_pct: prog, open_tasks: po.length, overdue_tasks: pov.length,
        critical_tasks: pcr.length, blocked_tasks: pbl.length,
        next_deadline: next ? next.due_date : null };
    })
    .sort((a, b) =>
      ["blocked","risk","watch","healthy"].indexOf(a.health as string) -
      ["blocked","risk","watch","healthy"].indexOf(b.health as string));

  const workload: Record<string, Record<string, number>> = {};
  for (const t of open) {
    const k = (t.assignee as string) ?? "Nieprzydzielone";
    if (!workload[k]) workload[k] = { total: 0, overdue: 0, this_week: 0, critical: 0 };
    workload[k].total++;
    const d = daysUntil(t.due_date as string);
    if (d < 0) workload[k].overdue++;
    if (d >= 0 && d <= 7) workload[k].this_week++;
    if (t.priority === "critical") workload[k].critical++;
  }

  const ts = done.filter(t => t.completed_at);
  const cutoff7 = new Date(); cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
  const onTime = ts.filter(t => new Date(t.completed_at as string) <= new Date((t.due_date as string) + "T23:59:59")).length;
  const onTimeRate = ts.length ? Math.round(onTime / ts.length * 100) : null;
  const vel7  = ts.filter(t => new Date(t.completed_at as string) >= cutoff7).length;
  const vel30 = ts.filter(t => new Date(t.completed_at as string) >= cutoff30).length;
  const added7 = tasks.filter(t => new Date(t.created_at as string) >= cutoff7).length;

  const risky = projectStats.filter(p => p.health === "blocked" || p.health === "risk").map(p => p.name);
  const top = priorities[0];
  const brief = [
    "Portfolio " + new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + ".",
    `Aktywne projekty: ${projectStats.length}. Otwarte: ${open.length}. Ukonczone: ${done.length}.`,
    overdue.length > 0 ? `UWAGA: ${overdue.length} zadan po terminie.` : "Brak zadan po terminie.",
    risky.length > 0 ? `Projekty w ryzyku: ${risky.join(", ")}.` : "Wszystkie projekty OK.",
    top ? `Priorytet #1 (${windowDays}d): ${top.task} [${top.project}] termin ${top.due_date} urgency ${top.urgency_score}.`
        : `Brak zadan w oknie ${windowDays} dni.`,
    onTimeRate !== null ? `Terminowosc: ${onTimeRate}%. Velocity 7d: ${vel7} zadan.` : `Velocity 7d: ${vel7} zadan.`,
    added7 > 0 ? `Nowe zadania (7d): ${added7}.` : ""
  ].filter(Boolean).join(" ");

  if (mode === "brief") return ok({ generated_at: new Date().toISOString(), window_days: windowDays, brief }, req);
  if (mode === "priorities") return ok({ generated_at: new Date().toISOString(), window_days: windowDays, priorities, overdue }, req);

  return ok({
    generated_at: new Date().toISOString(), window_days: windowDays, brief,
    summary: {
      active_projects: projectStats.length, total_tasks: tasks.length,
      open_tasks: open.length, done_tasks: done.length,
      completion_rate_pct: tasks.length ? Math.round(done.length / tasks.length * 100) : 0,
      currently_overdue: overdue.length, on_time_rate_pct: onTimeRate,
      velocity_7d: vel7, velocity_30d: vel30, added_last_7d: added7
    },
    priorities, overdue, projects: projectStats, workload_by_assignee: workload
  }, req);
});
