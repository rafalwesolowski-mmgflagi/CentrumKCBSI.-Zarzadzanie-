import { useMemo } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CheckSquare, Square } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";

type TaskRow = { task: AppContextValue["tasks"][number]; project: AppContextValue["projects"][number] | undefined };

export function WeeklyPage({ context }: { context: AppContextValue }) {
  const { done, planned, blocked, weekLabel, nextLabel } = useMemo(() => {
    const today = new Date();

    const withProject = (task: AppContextValue["tasks"][number]): TaskRow => ({
      task,
      project: context.projects.find((p) => p.id === task.project_id)
    });

    const done = context.tasks
      .filter((t) => {
        if (t.status !== "done") return false;
        const days = differenceInCalendarDays(parseISO(t.due_date), today);
        return days >= -7 && days <= 0;
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .map(withProject);

    const planned = context.tasks
      .filter((t) => {
        if (t.status === "done") return false;
        const days = differenceInCalendarDays(parseISO(t.due_date), today);
        return days >= 0 && days <= 14;
      })
      .sort((a, b) => b.deadline_importance - a.deadline_importance || a.due_date.localeCompare(b.due_date))
      .map(withProject);

    const blocked = context.tasks
      .filter((t) => t.status !== "done" && (t.risk_status === "blocked" || t.risk_status === "risk"))
      .sort((a, b) => b.deadline_importance - a.deadline_importance)
      .map(withProject);

    const fmt = (d: Date) => d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const nextEnd = new Date(weekEnd);
    nextEnd.setDate(weekEnd.getDate() + 14);

    return {
      done,
      planned,
      blocked,
      weekLabel: `${fmt(weekStart)} – ${fmt(weekEnd)}`,
      nextLabel: `${fmt(today)} – ${fmt(nextEnd)}`
    };
  }, [context.projects, context.tasks]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Weekly cadence</span>
          <h1>Tygodniowy przegląd</h1>
        </div>
      </header>
      <div className="weekly-grid">
        <WeeklyCol title="Zrobione" subtitle={weekLabel} items={done} tone="done" empty="Brak ukończonych zadań w tym tygodniu." context={context} />
        <WeeklyCol title="Plan" subtitle={`Kolejne 14 dni · ${nextLabel}`} items={planned} tone="plan" empty="Brak zaplanowanych zadań." context={context} />
        <WeeklyCol title="Blokery" subtitle="Wymagają natychmiastowej uwagi" items={blocked} tone="risk" empty="Brak blokad — portfolio czyste." context={context} />
      </div>
    </div>
  );
}

function WeeklyCol({
  title,
  subtitle,
  items,
  tone,
  empty,
  context
}: {
  title: string;
  subtitle: string;
  items: TaskRow[];
  tone: "done" | "plan" | "risk";
  empty: string;
  context: AppContextValue;
}) {
  return (
    <div className={`panel weekly-col weekly-${tone}`}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <span className="eyebrow">{subtitle}</span>
        </div>
        <span>{items.length}</span>
      </div>
      <div className="weekly-items">
        {items.map(({ task, project }) => {
          const daysLeft = differenceInCalendarDays(parseISO(task.due_date), new Date());
          return (
            <div className={`weekly-item ${task.risk_status}`} key={task.id}>
              <div className="weekly-item-left">
                <span className="color-dot" style={{ background: project?.color }} />
                <div>
                  <strong>{task.name}</strong>
                  <span className="muted-note">
                    {project?.name} · {daysLeft < 0 ? `${Math.abs(daysLeft)}d po` : daysLeft === 0 ? "dziś" : `za ${daysLeft}d`}
                  </span>
                  {task.assignee && <span className="assignee-pill">{task.assignee}</span>}
                  {task.recurrence && <span className="recurrence-badge">↺ {task.recurrence}</span>}
                </div>
              </div>
              <div className="weekly-item-right">
                <span className={`risk-badge ${task.priority}`}>{task.priority}</span>
                {tone !== "done" && (
                  <button
                    className="done-toggle"
                    onClick={() => void context.updateTaskStatus(task.id, task.status === "done" ? "in_progress" : "done")}
                    aria-label="Zmień status"
                  >
                    {task.status === "done" ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!items.length && <div className="empty-state">{empty}</div>}
      </div>
    </div>
  );
}
