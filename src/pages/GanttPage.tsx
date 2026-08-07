import { useMemo } from "react";
import { addMonths, differenceInCalendarDays, format, isValid, parseISO, startOfMonth } from "date-fns";
import type { AppContextValue } from "../lib/appContext";
import { findDateConflicts } from "../lib/risk";

export function GanttPage({ context }: { context: AppContextValue }) {
  const rows = useMemo(
    () => context.projects
      .map((project) => {
        const phases = context.phases.filter((phase) => phase.project_id === project.id);
        const tasks = context.tasks.filter((task) => task.project_id === project.id);
        const startDate = minDate([
          ...phases.map((phase) => phase.start_date),
          ...phases.map((phase) => phase.end_date),
          ...tasks.map((task) => task.due_date)
        ]);
        const endDate = maxDate([
          ...phases.map((phase) => phase.start_date),
          ...phases.map((phase) => phase.end_date),
          ...tasks.map((task) => task.due_date)
        ]);
        const done = tasks.filter((task) => task.status === "done").length;
        const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        const hasRisk = tasks.some((task) => task.risk_status === "risk" || task.risk_status === "blocked");
        return { project, phases, tasks, startDate, endDate, progress, hasRisk };
      })
      .filter((row) => row.startDate && row.endDate)
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))),
    [context.phases, context.projects, context.tasks]
  );
  const conflicts = findDateConflicts(context.tasks);

  const timeline = useMemo(() => {
    if (!rows.length) return null;

    const timestamps = rows.flatMap((row) => [
      parseISO(String(row.startDate)).getTime(),
      parseISO(String(row.endDate)).getTime(),
      ...row.tasks.map((task) => parseISO(task.due_date).getTime())
    ]);
    const validTimestamps = timestamps.filter(Number.isFinite);
    if (!validTimestamps.length) return null;

    const start = startOfMonth(new Date(Math.min(...validTimestamps)));
    const end = addMonths(startOfMonth(new Date(Math.max(...validTimestamps))), 1);
    const totalDays = Math.max(1, differenceInCalendarDays(end, start));
    const months = [];

    for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addMonths(cursor, 1)) {
      months.push(cursor);
    }

    return { start, end, totalDays, months };
  }, [rows]);

  function leftFor(date: string) {
    if (!timeline) return 0;
    return (differenceInCalendarDays(parseISO(date), timeline.start) / timeline.totalDays) * 100;
  }

  function widthFor(startDate: string, endDate: string) {
    if (!timeline) return 0;
    const width = (differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1) / timeline.totalDays * 100;
    return Math.max(width, 2);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Timeline control</span>
          <h1>Gantt</h1>
        </div>
        <div className="header-summary">{conflicts.length} kolizji terminów</div>
      </header>

      {conflicts.length > 0 && (
        <div className="warning-box">
          Wykryto kolizje na: {conflicts.map((conflict) => conflict.date).join(", ")}
        </div>
      )}

      <div className="gantt-shell">
        {timeline && rows.length ? (
          <div className="gantt-board">
            <div className="gantt-header-row">
              <div className="gantt-label-spacer">Projekt</div>
              <div className="gantt-months">
                {timeline.months.map((month) => (
                  <div
                    className="gantt-month"
                    key={month.toISOString()}
                    style={{ left: `${(differenceInCalendarDays(month, timeline.start) / timeline.totalDays) * 100}%` }}
                  >
                    {format(month, "MMM yyyy")}
                  </div>
                ))}
              </div>
            </div>

            {rows.map(({ project, phases, tasks, startDate, endDate, progress, hasRisk }) => (
              <div className="gantt-row-grid" key={project.id}>
                <div className="gantt-row-label">
                  <span className="color-dot" style={{ background: project.color }} />
                  <div>
                    <strong>{project.name}</strong>
                    <span>{phases.length} faz · {tasks.length} zadań · {progress}%</span>
                  </div>
                </div>
                <div className="gantt-track">
                  <div
                    className={`gantt-phase-bar ${hasRisk ? "risk" : ""}`}
                    style={{
                      left: `${leftFor(String(startDate))}%`,
                      width: `${widthFor(String(startDate), String(endDate))}%`,
                      background: project.color
                    }}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  {phases.map((phase) => (
                    <div
                      className="gantt-phase-segment"
                      key={phase.id}
                      title={`${phase.name} · ${phase.start_date} → ${phase.end_date}`}
                      style={{
                        left: `${leftFor(phase.start_date)}%`,
                        width: `${widthFor(phase.start_date, phase.end_date)}%`
                      }}
                    />
                  ))}
                  {tasks.map((task) => (
                    <div
                      className={`gantt-task-dot ${task.risk_status}`}
                      key={task.id}
                      title={`${task.name} · ${task.due_date}`}
                      style={{ left: `${leftFor(task.due_date)}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="gantt-legend">
              <span><i className="legend-bar" /> zakres projektu</span>
              <span><i className="legend-segment" /> faza</span>
              <span><i className="legend-dot" /> deadline zadania</span>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            Brak projektów z datami do pokazania na Gancie. Dodaj zadanie z terminem albo użyj Copilota.
          </div>
        )}
      </div>
    </div>
  );
}

function minDate(values: string[]) {
  return sortedValidDates(values)[0];
}

function maxDate(values: string[]) {
  const dates = sortedValidDates(values);
  return dates[dates.length - 1];
}

function sortedValidDates(values: string[]) {
  return values
    .filter((value) => {
      const date = parseISO(value);
      return isValid(date);
    })
    .sort((a, b) => a.localeCompare(b));
}
