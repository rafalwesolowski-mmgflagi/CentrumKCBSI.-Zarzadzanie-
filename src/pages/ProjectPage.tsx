import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Circle, FolderKanban, Target } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { AppContextValue } from "../lib/appContext";
import type { Phase, Task } from "../lib/types";

interface ProjectPageProps {
  context: AppContextValue;
}

export function ProjectPage({ context }: ProjectPageProps) {
  const { id } = useParams<{ id: string }>();
  const project = context.projects.find((p) => p.id === id);

  if (!project) return <Navigate to="/" replace />;

  const parent = project.parent_project_id
    ? context.projects.find((p) => p.id === project.parent_project_id)
    : null;

  const subprojects = context.projects
    .filter((p) => p.parent_project_id === project.id)
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

  const phases = context.phases
    .filter((ph) => ph.project_id === project.id)
    .sort((a, b) => a.order_index - b.order_index);

  const projectTasks = context.tasks.filter((t) => t.project_id === project.id);
  const done = projectTasks.filter((t) => t.status === "done").length;
  const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;
  const openTasks = projectTasks.filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => {
    const d = parseISO(t.due_date);
    return !Number.isNaN(d.getTime()) && differenceInCalendarDays(d, new Date()) < 0;
  });

  function toggleTask(taskId: string) {
    const task = context.tasks.find((t) => t.id === taskId);
    if (!task) return;
    void context.updateTaskStatus(taskId, task.status === "done" ? "in_progress" : "done");
  }

  const phaseIds = new Set(phases.map((ph) => ph.id));
  const ungroupedTasks = projectTasks.filter((t) => !phaseIds.has(t.phase_id));

  return (
    <div className="page project-page">
      <nav className="project-breadcrumb" aria-label="Nawigacja projektu">
        <Link to="/" className="breadcrumb-link">
          <ArrowLeft size={15} />
          Dashboard
        </Link>
        {parent && (
          <>
            <span className="breadcrumb-sep">/</span>
            <Link to={`/project/${parent.id}`} className="breadcrumb-link">{parent.name}</Link>
          </>
        )}
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{project.name}</span>
      </nav>

      <header className="project-page-header">
        <div className="project-page-title">
          <span className="project-page-color-dot" style={{ background: project.color }} />
          <h1>{project.name}</h1>
          <span className={`status-pill ${project.status}`}>{project.status}</span>
        </div>
        {project.goal && (
          <div className="project-goal-display">
            <Target size={14} />
            <span>{project.goal}</span>
          </div>
        )}
        {((project.areas ?? []).length > 0 || (project.tags ?? []).length > 0) && (
          <div className="project-page-pills">
            {(project.areas ?? []).map((area) => <span key={area} className="area-pill">Obszar: {area}</span>)}
            {(project.tags ?? []).map((tag) => <span key={tag} className="tag-pill">{tag}</span>)}
          </div>
        )}
      </header>

      <div className="project-page-stats-bar">
        <div className="progress-track project-page-progress"><span style={{ width: `${progress}%` }} /></div>
        <div className="project-stat-row">
          <span><strong>{progress}%</strong> ukończono</span>
          <span>{done} z {projectTasks.length} zadań</span>
          {overdue.length > 0 && <span className="danger-text"><strong>{overdue.length}</strong> po terminie</span>}
          {subprojects.length > 0 && <span>{subprojects.length} podprojektów</span>}
        </div>
      </div>

      {subprojects.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <h2><FolderKanban size={16} />Podprojekty</h2>
            <span>{subprojects.length}</span>
          </div>
          <div className="subproject-grid">
            {subprojects.map((sub) => {
              const subTasks = context.tasks.filter((t) => t.project_id === sub.id);
              const subDone = subTasks.filter((t) => t.status === "done").length;
              const subProgress = subTasks.length ? Math.round((subDone / subTasks.length) * 100) : 0;
              return (
                <Link key={sub.id} to={`/project/${sub.id}`} className="subproject-card">
                  <div className="subproject-card-top">
                    <span className="color-dot" style={{ background: sub.color }} />
                    <strong>{sub.name}</strong>
                    <span className={`status-pill ${sub.status}`}>{sub.status}</span>
                  </div>
                  <div className="progress-track"><span style={{ width: `${subProgress}%` }} /></div>
                  <div className="subproject-card-meta">
                    <span>{subDone}/{subTasks.length} zadań</span>
                    <span>{subProgress}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2>Fazy i zadania</h2>
          <span>{phases.length} faz · {projectTasks.length} zadań</span>
        </div>

        {phases.length === 0 && ungroupedTasks.length === 0 && (
          <p className="empty-state">Brak faz i zadań. Dodaj zadania przez widok Zadania lub Copilota.</p>
        )}

        {phases.map((phase) => (
          <PhaseBlock
            key={phase.id}
            phase={phase}
            tasks={context.tasks.filter((t) => t.phase_id === phase.id)}
            onToggle={toggleTask}
          />
        ))}

        {ungroupedTasks.length > 0 && (
          <PhaseBlock
            key="ungrouped"
            phase={null}
            tasks={ungroupedTasks}
            onToggle={toggleTask}
          />
        )}
      </section>
    </div>
  );
}

function PhaseBlock({ phase, tasks, onToggle }: {
  phase: Phase | null;
  tasks: Task[];
  onToggle: (taskId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const done = useMemo(() => tasks.filter((t) => t.status === "done").length, [tasks]);
  const sortedTasks = useMemo(() =>
    [...tasks].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      return b.deadline_importance - a.deadline_importance;
    }),
    [tasks]
  );

  return (
    <div className={`phase-block ${collapsed ? "collapsed" : ""}`}>
      <button className="phase-block-header" onClick={() => setCollapsed((c) => !c)} type="button">
        <span className="phase-block-chevron">
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </span>
        <span className="phase-block-name">{phase?.name ?? "Zadania bez fazy"}</span>
        {phase && (
          <span className="phase-block-dates">{phase.start_date} → {phase.end_date}</span>
        )}
        <span className="phase-block-count">{done}/{tasks.length}</span>
      </button>

      {!collapsed && (
        <div className="phase-task-list">
          {sortedTasks.map((task) => {
            const daysLeft = (() => {
              const d = parseISO(task.due_date);
              return Number.isNaN(d.getTime()) ? null : differenceInCalendarDays(d, new Date());
            })();
            return (
              <div key={task.id} className={`phase-task-row ${task.status === "done" ? "task-done" : ""} ${task.risk_status !== "none" ? `risk-${task.risk_status}` : ""}`}>
                <button
                  className="done-toggle"
                  onClick={() => onToggle(task.id)}
                  aria-label={task.status === "done" ? "Oznacz jako otwarte" : "Oznacz jako ukończone"}
                  type="button"
                >
                  {task.status === "done"
                    ? <CheckCircle2 size={17} />
                    : <Circle size={17} />}
                </button>
                <div className="phase-task-body">
                  <span className="phase-task-name">{task.name}</span>
                  <span className="phase-task-meta">
                    {task.due_date}
                    {daysLeft !== null && daysLeft < 0 && <span className="danger-text"> · {Math.abs(daysLeft)}d po terminie</span>}
                    {daysLeft === 0 && <span className="warning-text"> · dziś</span>}
                    {task.assignee && ` · ${task.assignee}`}
                    {` · ${task.priority}/${task.impact}`}
                  </span>
                </div>
                {task.risk_status !== "none" && (
                  <span className={`risk-badge ${task.risk_status}`}>{task.risk_status}</span>
                )}
              </div>
            );
          })}
          {!tasks.length && <p className="empty-state">Brak zadań w tej fazie.</p>}
        </div>
      )}
    </div>
  );
}
