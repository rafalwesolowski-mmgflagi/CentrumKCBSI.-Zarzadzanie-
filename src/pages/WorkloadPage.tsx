import { useMemo } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { AppContextValue } from "../lib/appContext";
import type { Task } from "../lib/types";

export function WorkloadPage({ context }: { context: AppContextValue }) {
  const groups = useMemo(() => {
    const today = new Date();
    const map = new Map<string, Task[]>();

    for (const task of context.tasks.filter((t) => t.status !== "done")) {
      const key = task.assignee ?? "— Nieprzydzielone";
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }

    return Array.from(map.entries())
      .map(([assignee, tasks]) => {
        const overdue = tasks.filter((t) => {
          const d = parseISO(t.due_date);
          return !Number.isNaN(d.getTime()) && differenceInCalendarDays(d, today) < 0;
        });
        const thisWeek = tasks.filter((t) => {
          const days = differenceInCalendarDays(parseISO(t.due_date), today);
          return days >= 0 && days <= 7;
        });
        const critical = tasks.filter((t) => t.priority === "critical");
        return { assignee, tasks, overdue, thisWeek, critical };
      })
      .sort((a, b) => b.overdue.length - a.overdue.length || b.tasks.length - a.tasks.length);
  }, [context.tasks]);

  const total = groups.reduce((sum, g) => sum + g.tasks.length, 0);
  const assigneeCount = groups.filter((g) => g.assignee !== "— Nieprzydzielone").length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Team capacity</span>
          <h1>Obciążenie zespołu</h1>
        </div>
        <div className="workload-summary">
          <span>{assigneeCount} wykonawców</span>
          <span>{total} zadań otwartych</span>
        </div>
      </header>

      <div className="workload-grid">
        {groups.map(({ assignee, tasks, overdue, thisWeek, critical }) => {
          const isUnassigned = assignee === "— Nieprzydzielone";
          const sorted = [...tasks].sort((a, b) => b.deadline_importance - a.deadline_importance);
          return (
            <div className={`workload-card ${overdue.length > 0 ? "danger" : ""} ${isUnassigned ? "unassigned" : ""}`} key={assignee}>
              <div className="workload-header">
                <div className="workload-name">
                  <div className="workload-avatar">{isUnassigned ? "?" : assignee.slice(0, 2).toUpperCase()}</div>
                  <strong>{assignee}</strong>
                </div>
                <span className="workload-count">{tasks.length}</span>
              </div>
              <div className="workload-stats">
                <span className={overdue.length ? "danger-text" : "muted-note"}>{overdue.length} po terminie</span>
                <span className="muted-note">·</span>
                <span>{thisWeek.length} ten tydzień</span>
                <span className="muted-note">·</span>
                <span className={critical.length ? "warning-text" : "muted-note"}>{critical.length} critical</span>
              </div>
              <div className="workload-tasks">
                {sorted.slice(0, 6).map((task) => {
                  const project = context.projects.find((p) => p.id === task.project_id);
                  const daysLeft = differenceInCalendarDays(parseISO(task.due_date), new Date());
                  return (
                    <div className={`workload-task-row ${task.risk_status}`} key={task.id}>
                      <span className="color-dot" style={{ background: project?.color }} />
                      <div className="workload-task-info">
                        <span>{task.name}</span>
                        <span className="muted-note">{project?.name} · {daysLeft < 0 ? `${Math.abs(daysLeft)}d po` : `za ${daysLeft}d`}</span>
                      </div>
                      <span className={`risk-badge ${task.priority}`}>{task.priority}</span>
                    </div>
                  );
                })}
                {tasks.length > 6 && <span className="muted-note workload-more">+{tasks.length - 6} więcej</span>}
                {!tasks.length && <span className="muted-note">Brak otwartych zadań</span>}
              </div>
            </div>
          );
        })}
        {!groups.length && <div className="empty-state">Brak otwartych zadań z przydzielonymi wykonawcami.</div>}
      </div>
    </div>
  );
}
