import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, CalendarClock, CalendarPlus, CheckSquare, Flame } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { GoogleIntegrationStatus } from "../components/GoogleIntegrationStatus";
import type { AppContextValue } from "../lib/appContext";
import { focusQueue } from "../lib/portfolioInsights";

export function TodayPage({ context }: { context: AppContextValue }) {
  const [projectId, setProjectId] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);
  const filteredTasks = useMemo(
    () => context.tasks.filter((task) => projectId === "all" || task.project_id === projectId),
    [context.tasks, projectId]
  );
  const items = filteredTasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const parsedDate = parseISO(task.due_date);
      return {
        task,
        project: context.projects.find((project) => project.id === task.project_id),
        daysLeft: Number.isNaN(parsedDate.getTime()) ? 9999 : differenceInCalendarDays(parsedDate, new Date())
      };
    });

  const overdue = items
    .filter((item) => item.daysLeft < 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const today = items
    .filter((item) => item.daysLeft === 0)
    .sort((a, b) => b.task.deadline_importance - a.task.deadline_importance);
  const weekBlockers = items
    .filter((item) => item.daysLeft >= 1 && item.daysLeft <= 7)
    .filter((item) => item.task.priority === "critical" || item.task.impact === "strategic" || item.task.risk_status === "blocked" || item.task.risk_status === "risk")
    .sort((a, b) => b.task.deadline_importance - a.task.deadline_importance || a.daysLeft - b.daysLeft);
  const focus = focusQueue(filteredTasks, context.projects, 6);

  async function sendNotification(taskId: string) {
    setMessage(null);
    setSendingTaskId(taskId);
    try {
      const result = await context.sendTaskNotification(taskId);
      setMessage(formatNotificationMessage(result.workflow));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wysłać powiadomienia.");
    } finally {
      setSendingTaskId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Daily control</span>
          <h1>Today</h1>
        </div>
        <div className="daily-header-actions">
          <div className="header-summary">{overdue.length} po terminie · {today.length} dziś · {weekBlockers.length} blokuje tydzień</div>
        </div>
      </header>

      <section className="project-filter-bar" aria-label="Filtr projektów">
        <div className="project-filter-control">
          <span className="eyebrow">Projekt</span>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filtruj Daily control po projekcie">
            <option value="all">Wszystkie projekty</option>
            {context.projects.map((project) => (
              <option value={project.id} key={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
        <div className="project-filter-chips">
          <button className={`project-chip ${projectId === "all" ? "active" : ""}`} type="button" onClick={() => setProjectId("all")}>
            Wszystkie
          </button>
          {context.projects.slice(0, 8).map((project) => (
            <button
              className={`project-chip ${projectId === project.id ? "active" : ""}`}
              type="button"
              onClick={() => setProjectId(project.id)}
              key={project.id}
            >
              <span className="color-dot" style={{ background: project.color }} />
              {project.name}
            </button>
          ))}
        </div>
      </section>

      {message && <div className="warning-box">{message}</div>}
      <GoogleIntegrationStatus />

      <section className="panel">
        <div className="panel-header">
          <h2><Flame size={18} /> Focus na teraz</h2>
          <span>{focus.length}</span>
        </div>
        <div className="focus-grid">
          {focus.map(({ task, project, daysLeft, urgency }) => (
            <article className={`focus-card ${task.risk_status}`} key={task.id}>
              <div>
                <strong>{task.name}</strong>
                <span>{project?.name ?? "Project"} · urgency {urgency}</span>
                {task.area && <span className="area-pill task-area-pill">{task.area}</span>}
                {task.assignee && <span className="assignee-pill task-assignee-pill">{task.assignee}</span>}
                {task.notes && <p className="task-note-snippet">{task.notes}</p>}
              </div>
              <div className="muted-row">
                <span>{task.due_date} · {daysLeft < 0 ? `${Math.abs(daysLeft)} dni po` : daysLeft === 0 ? "dziś" : `za ${daysLeft} dni`}</span>
                <div className="task-action-row">
                  <button
                    className="done-toggle"
                    onClick={() => void sendNotification(task.id)}
                    disabled={sendingTaskId === task.id}
                    title="Wyślij powiadomienie i dodaj do Google Calendar"
                  >
                    <CalendarPlus size={16} />
                    Wyślij
                  </button>
                  <button className="done-toggle" onClick={() => void context.updateTaskStatus(task.id, "done")}>
                    <CheckSquare size={16} />
                    Done
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!focus.length && <div className="empty-state">Nic pilnego nie wymaga uwagi.</div>}
        </div>
      </section>

      <section className="today-grid">
        <TodayColumn icon={<Flame size={18} />} title="Po terminie" items={overdue} empty="Nic nie jest po terminie." tone="danger" sendingTaskId={sendingTaskId} onSend={sendNotification} />
        <TodayColumn icon={<CalendarClock size={18} />} title="Dzisiaj" items={today} empty="Brak deadline’ów na dziś." tone="warning" sendingTaskId={sendingTaskId} onSend={sendNotification} />
        <TodayColumn icon={<AlertTriangle size={18} />} title="Blokuje tydzień" items={weekBlockers} empty="Brak krytycznych blokad na 7 dni." tone="risk" sendingTaskId={sendingTaskId} onSend={sendNotification} />
      </section>
    </div>
  );
}

function formatNotificationMessage(workflow: string) {
  return workflow === "google-user-api"
    ? "Dodano zadanie do Twojego Google Calendar i wysłano przypomnienie przez Gmail."
    : "Wysłano zadanie przez fallback n8n. Połącz Google, żeby zapisywać je w swoim kalendarzu.";
}

function TodayColumn({
  icon,
  title,
  items,
  empty,
  tone,
  sendingTaskId,
  onSend
}: {
  icon: ReactNode;
  title: string;
  items: Array<{
    task: AppContextValue["tasks"][number];
    project?: AppContextValue["projects"][number];
    daysLeft: number;
  }>;
  empty: string;
  tone: "danger" | "warning" | "risk";
  sendingTaskId: string | null;
  onSend: (taskId: string) => Promise<void>;
}) {
  return (
    <div className={`panel today-panel ${tone}`}>
      <div className="panel-header">
        <h2>{icon}{title}</h2>
        <span>{items.length}</span>
      </div>
      <div className="deadline-list">
        {items.map(({ task, project, daysLeft }) => (
          <div className={`deadline-item ${task.risk_status}`} key={task.id}>
            <div>
              <strong>{task.name}</strong>
              <span>{project?.name ?? "Project"} · {task.status} · {task.priority}/{task.impact}</span>
              {task.area && <span className="area-pill task-area-pill">{task.area}</span>}
              {task.assignee && <span className="assignee-pill task-assignee-pill">{task.assignee}</span>}
              {task.notes && <p className="task-note-snippet">{task.notes}</p>}
            </div>
            <div className="deadline-date">
              <strong>{task.due_date}</strong>
              <span>{daysLeft < 0 ? `${Math.abs(daysLeft)} dni po` : daysLeft === 0 ? "dziś" : `za ${daysLeft} dni`}</span>
              <button
                className="done-toggle calendar-send-button"
                onClick={() => void onSend(task.id)}
                disabled={sendingTaskId === task.id}
                title="Wyślij powiadomienie i dodaj do Google Calendar"
              >
                <CalendarPlus size={16} />
                Wyślij
              </button>
            </div>
          </div>
        ))}
        {!items.length && <div className="empty-state">{empty}</div>}
      </div>
    </div>
  );
}
