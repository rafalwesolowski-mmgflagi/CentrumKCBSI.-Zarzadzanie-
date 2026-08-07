import { FormEvent, type ReactNode, useMemo, useState } from "react";
import { AlertTriangle, Archive, Bot, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronRight, Edit3, ExternalLink, FolderKanban, Plus, Target, Trash2, TrendingUp, X } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import type { AppContextValue } from "../lib/appContext";
import { buildRiskBriefing, findDateConflicts } from "../lib/risk";
import type { Project, ProjectStatus } from "../lib/types";
import { focusQueue, portfolioStats, projectHealth } from "../lib/portfolioInsights";

interface DashboardPageProps {
  context: AppContextValue;
  onOpenCopilot: () => void;
}

export function DashboardPage({ context, onOpenCopilot }: DashboardPageProps) {
  const [projectName, setProjectName] = useState("");
  const [projectColor, setProjectColor] = useState("#57c7ff");
  const [projectTags, setProjectTags] = useState("");
  const [projectAreas, setProjectAreas] = useState("");
  const [projectGoal, setProjectGoal] = useState("");
  const [projectParentId, setProjectParentId] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [deadlineWindow, setDeadlineWindow] = useState(14);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState({
    name: "",
    color: "#57c7ff",
    status: "in_progress" as ProjectStatus,
    tagsText: "",
    areasText: "",
    parentProjectId: "",
    goal: ""
  });

  const today = useMemo(() => new Date(), []);
  const risks = useMemo(() => buildRiskBriefing(context.tasks, context.projects, today), [context.projects, context.tasks, today]);
  const conflicts = useMemo(() => findDateConflicts(context.tasks), [context.tasks]);
  const health = useMemo(() => projectHealth(context.projects, context.tasks, today), [context.projects, context.tasks, today]);
  const stats = useMemo(() => portfolioStats(context.tasks, today), [context.tasks, today]);
  const focus = useMemo(() => focusQueue(context.tasks, context.projects, 4), [context.projects, context.tasks]);
  const healthByProjectId = useMemo(() => new Map(health.map((item) => [item.project.id, item])), [health]);
  const projectTreeRows = useMemo(() => buildProjectTreeRows(context.projects), [context.projects]);
  const projectsWithChildren = useMemo(() => {
    const set = new Set<string>();
    for (const { project } of projectTreeRows) {
      if (project.parent_project_id) set.add(project.parent_project_id);
    }
    return set;
  }, [projectTreeRows]);
  const visibleProjectTreeRows = useMemo(() => {
    const filtered = filterProjectTreeRows(projectTreeRows, projectQuery, showArchivedProjects);
    return projectQuery.trim() ? filtered : applyCollapseFilter(filtered, collapsedProjects);
  }, [projectQuery, projectTreeRows, showArchivedProjects, collapsedProjects]);

  const summary = useMemo(() => {
    const openTasks = context.tasks.filter((task) => task.status !== "done");
    const overdue = openTasks.filter((task) => daysLeft(task.due_date, today) < 0);
    const dueToday = openTasks.filter((task) => daysLeft(task.due_date, today) === 0);
    const activeProjects = context.projects.filter((project) => project.status !== "done");
    const troubledProjects = health.filter((item) => item.health === "risk" || item.health === "blocked");

    return {
      openTasks,
      overdue,
      dueToday,
      activeProjects,
      troubledProjects,
      topFocus: focus[0]
    };
  }, [context.projects, context.tasks, focus, health, today]);

  const actionPlan = useMemo(() => {
    const followUps = context.clients
      .filter((client) => client.next_follow_up && daysLeft(client.next_follow_up, today) <= 7)
      .sort((a, b) => (a.next_follow_up ?? "").localeCompare(b.next_follow_up ?? ""));
    const outstandingFinance = context.projects
      .map((project) => ({
        project,
        outstanding: (project.invoiced ?? 0) - (project.paid ?? 0),
        margin: (project.paid ?? 0) - (project.cost ?? 0)
      }))
      .filter((item) => item.outstanding > 0 || item.margin < 0)
      .sort((a, b) => b.outstanding - a.outstanding || a.margin - b.margin);

    const primary = summary.overdue.length
      ? {
          tone: "danger" as const,
          label: "Najpierw zaległości",
          detail: `${summary.overdue.length} otwartych zadań jest po terminie.`,
          to: "/today"
        }
      : summary.dueToday.length
      ? {
          tone: "warning" as const,
          label: "Dokończ dzisiejszy plan",
          detail: `${summary.dueToday.length} zadań ma termin dzisiaj.`,
          to: "/today"
        }
      : summary.topFocus
      ? {
          tone: "neutral" as const,
          label: "Weź następne zadanie",
          detail: `${summary.topFocus.task.name} · ${summary.topFocus.project?.name ?? "bez projektu"}`,
          to: "/tasks"
        }
      : {
          tone: "good" as const,
          label: "Portfolio spokojne",
          detail: "Zaplanuj kolejny krok tygodnia albo dodaj nowe zadanie.",
          to: "/weekly"
        };

    return { primary, followUps, outstandingFinance };
  }, [context.clients, context.projects, summary.dueToday.length, summary.overdue.length, summary.topFocus, today]);

  const attentionItems = useMemo(() => [
    ...summary.overdue.slice(0, 3).map((task) => ({
      id: `overdue-${task.id}`,
      tone: "danger" as const,
      title: task.name,
      meta: `${projectNameFor(task.project_id, context.projects)} · ${dateDistance(task.due_date, today)}`,
      to: "/today"
    })),
    ...focus.slice(0, 3).map(({ task, project, daysLeft: left }) => ({
      id: `focus-${task.id}`,
      tone: task.risk_status === "blocked" || task.risk_status === "risk" ? "warning" as const : "neutral" as const,
      title: task.name,
      meta: `${project?.name ?? "bez projektu"} · ${left < 0 ? `${Math.abs(left)} dni po terminie` : left === 0 ? "dzisiaj" : `za ${left} dni`}`,
      to: "/tasks"
    })),
    ...conflicts.slice(0, 2).map((conflict) => ({
      id: `conflict-${conflict.date}`,
      tone: "warning" as const,
      title: `Kolizja: ${conflict.taskIds.length} zadania jednego dnia`,
      meta: `${conflict.date} · warto rozsunąć terminy`,
      to: "/calendar"
    })),
    ...actionPlan.followUps.slice(0, 2).map((client) => ({
      id: `client-${client.id}`,
      tone: "neutral" as const,
      title: `Follow-up: ${client.company}`,
      meta: client.next_follow_up ? dateDistance(client.next_follow_up, today) : "CRM",
      to: "/crm"
    })),
    ...actionPlan.outstandingFinance.slice(0, 2).map(({ project, outstanding }) => ({
      id: `finance-${project.id}`,
      tone: "neutral" as const,
      title: `Finanse: ${project.name}`,
      meta: outstanding > 0 ? `${outstanding.toLocaleString("pl-PL")} ${project.currency} do domknięcia` : "sprawdź marżę",
      to: "/finance"
    }))
  ].slice(0, 7), [actionPlan.followUps, actionPlan.outstandingFinance, conflicts, context.projects, focus, summary.overdue, today]);

  const upcomingDeadlines = useMemo(() => context.tasks
    .filter((task) => task.status !== "done")
    .map((task) => ({
      task,
      project: context.projects.find((project) => project.id === task.project_id),
      daysLeft: daysLeft(task.due_date, today)
    }))
    .filter(({ daysLeft: left }) => left <= deadlineWindow)
    .sort((a, b) => a.daysLeft - b.daysLeft || b.task.deadline_importance - a.task.deadline_importance)
    .slice(0, 8), [context.projects, context.tasks, deadlineWindow, today]);

  const goals = useMemo(() => {
    const map = new Map<string, { projects: Project[]; total: number; done: number }>();
    for (const project of context.projects) {
      if (!project.goal) continue;
      const entry = map.get(project.goal) ?? { projects: [], total: 0, done: 0 };
      const projectTasks = context.tasks.filter((task) => task.project_id === project.id);
      entry.projects.push(project);
      entry.total += projectTasks.length;
      entry.done += projectTasks.filter((task) => task.status === "done").length;
      map.set(project.goal, entry);
    }
    return Array.from(map.entries())
      .map(([goal, { projects, total, done }]) => ({ goal, projects, progress: total ? Math.round((done / total) * 100) : 0, total, done }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 4);
  }, [context.projects, context.tasks]);

  function toggleCollapse(projectId: string) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setFormMessage(null);
    try {
      await context.createProject({
        name: projectName,
        color: projectColor,
        tags: parseTags(projectTags),
        areas: parseTags(projectAreas),
        parentProjectId: projectParentId || null,
        goal: projectGoal
      });
      setProjectName("");
      setProjectTags("");
      setProjectAreas("");
      setProjectGoal("");
      setProjectParentId("");
      setShowCreateProject(false);
    } catch (error) {
      setFormMessage(errorMessage(error, "Nie udało się utworzyć projektu."));
    }
  }

  function startProjectEdit(project: Project) {
    setEditingProjectId(project.id);
    setEditProject({
      name: project.name,
      color: project.color,
      status: project.status,
      tagsText: (project.tags ?? []).join(", "),
      areasText: (project.areas ?? []).join(", "),
      parentProjectId: project.parent_project_id ?? "",
      goal: project.goal ?? ""
    });
  }

  async function saveProject(projectId: string) {
    setFormMessage(null);
    try {
      await context.updateProject(projectId, {
        name: editProject.name,
        color: editProject.color,
        status: editProject.status,
        tags: parseTags(editProject.tagsText),
        areas: parseTags(editProject.areasText),
        parentProjectId: editProject.parentProjectId || null,
        goal: editProject.goal
      });
      setEditingProjectId(null);
    } catch (error) {
      setFormMessage(errorMessage(error, "Nie udało się zapisać projektu."));
    }
  }

  async function archiveProject(project: Project) {
    setFormMessage(null);
    try {
      await context.updateProject(project.id, {
        name: project.name,
        color: project.color,
        status: "done",
        tags: project.tags ?? [],
        areas: project.areas ?? [],
        parentProjectId: project.parent_project_id,
        goal: project.goal ?? ""
      });
    } catch (error) {
      setFormMessage(errorMessage(error, "Nie udało się zarchiwizować projektu."));
    }
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`Usunąć projekt "${project.name}" razem z fazami i zadaniami?`)) return;
    setFormMessage(null);
    try {
      await context.deleteProject(project.id);
    } catch (error) {
      setFormMessage(errorMessage(error, "Nie udało się usunąć projektu."));
    }
  }

  return (
    <div className="page dashboard-page">
      <header className="page-header dashboard-header">
        <div>
          <span className="eyebrow">Centrum pracy</span>
          <h1>Dashboard</h1>
          <p className="header-summary">Jedno miejsce na decyzję: co wymaga uwagi, co zrobić teraz, które projekty prowadzić dalej.</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="secondary-button" type="button" onClick={() => setShowCreateProject((value) => !value)}>
            <Plus size={16} />
            Projekt
          </button>
          <button className="primary-button" type="button" onClick={onOpenCopilot}>
            <Bot size={18} />
            Copilot
          </button>
        </div>
      </header>

      <section className="metric-grid dashboard-metrics">
        <SummaryMetric icon={<FolderKanban />} label="Aktywne projekty" value={summary.activeProjects.length} sub={`${summary.troubledProjects.length} wymaga uwagi`} tone={summary.troubledProjects.length ? "warn" : "neutral"} />
        <SummaryMetric icon={<CheckCircle2 />} label="Postęp zadań" value={`${context.metrics.progress}%`} sub={`${stats.doneTasks}/${stats.totalTasks} zamknięte`} tone="neutral" />
        <SummaryMetric icon={<AlertTriangle />} label="Po terminie" value={summary.overdue.length} sub={`${summary.dueToday.length} na dziś`} tone={summary.overdue.length ? "danger" : summary.dueToday.length ? "warn" : "good"} />
        <SummaryMetric icon={<CalendarClock />} label="Kolizje dat" value={conflicts.length} sub={conflicts.length ? "rozsuń terminy" : "brak kolizji"} tone={conflicts.length ? "warn" : "good"} />
      </section>

      <section className={`action-plan action-plan-${actionPlan.primary.tone} dashboard-action`}>
        <div className="action-plan-main">
          <span className="eyebrow">Następny ruch</span>
          <strong>{actionPlan.primary.label}</strong>
          <span>{actionPlan.primary.detail}</span>
        </div>
        <div className="action-plan-actions">
          <Link className="primary-button" to={actionPlan.primary.to}>Otwórz</Link>
          <Link className="secondary-button" to="/today">Dzisiaj</Link>
          <Link className="secondary-button" to="/tasks">Zadania</Link>
        </div>
      </section>

      {showCreateProject && (
        <section className="panel compact-create-panel">
          <div className="panel-header">
            <h2>Nowy projekt</h2>
            <button className="icon-button" type="button" onClick={() => setShowCreateProject(false)} aria-label="Zamknij formularz"><X size={16} /></button>
          </div>
          <form className="inline-form" onSubmit={createProject}>
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Nazwa projektu" required />
            <input value={projectColor} onChange={(event) => setProjectColor(event.target.value)} type="color" aria-label="Kolor projektu" />
            <input value={projectGoal} onChange={(event) => setProjectGoal(event.target.value)} placeholder="Cel strategiczny" className="project-secondary-input" />
            <input value={projectAreas} onChange={(event) => setProjectAreas(event.target.value)} placeholder="Obszary" className="project-secondary-input" />
            <input value={projectTags} onChange={(event) => setProjectTags(event.target.value)} placeholder="Tagi" className="project-secondary-input" />
            <select value={projectParentId} onChange={(event) => setProjectParentId(event.target.value)}>
              <option value="">Bez nadprojektu</option>
              {projectTreeRows.map(({ project, path }) => <option value={project.id} key={project.id}>{path}</option>)}
            </select>
            <button className="primary-button" type="submit"><Plus size={16} />Dodaj</button>
          </form>
          {formMessage && <div className="warning-box">{formMessage}</div>}
        </section>
      )}

      <section className="dashboard-grid dashboard-primary-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Wymaga uwagi</h2>
            <span>{attentionItems.length}</span>
          </div>
          <div className="attention-list">
            {attentionItems.map((item) => (
              <Link className={`attention-item ${item.tone}`} to={item.to} key={item.id}>
                <span className="attention-dot" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                </span>
              </Link>
            ))}
            {!attentionItems.length && <Empty text="Nie ma nic pilnego. To dobry moment na planowanie." />}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Focus teraz</h2>
            <span>{focus.length}</span>
          </div>
          <div className="deadline-list">
            {focus.map(({ task, project, daysLeft: left }) => (
              <Link className={`deadline-item ${task.risk_status}`} to="/tasks" key={task.id}>
                <div>
                  <strong>{task.name}</strong>
                  <span>{project?.name ?? "bez projektu"} · {task.priority}/{task.impact}</span>
                </div>
                <div className="deadline-date">
                  <strong>{dateLabel(task.due_date)}</strong>
                  <span>{left < 0 ? `${Math.abs(left)} dni po` : left === 0 ? "dziś" : `za ${left} dni`}</span>
                </div>
              </Link>
            ))}
            {!focus.length && <Empty text="Brak zadań w kolejce focus." />}
          </div>
        </div>
      </section>

      <section className="panel project-command-panel">
        <div className="panel-header">
          <h2>Projekty</h2>
          <span>{visibleProjectTreeRows.length}/{context.projects.length}</span>
        </div>
        <div className="project-toolbar">
          <input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Szukaj projektu, celu, obszaru albo tagu..." />
          <button
            className={`secondary-button ${showArchivedProjects ? "active-filter" : ""}`}
            type="button"
            onClick={() => setShowArchivedProjects((current) => !current)}
          >
            {showArchivedProjects ? "Ukryj archiwum" : "Pokaż archiwum"}
          </button>
        </div>
        {!showCreateProject && formMessage && <div className="warning-box">{formMessage}</div>}
        <div className="project-list compact-project-list">
          {visibleProjectTreeRows.map(({ project, depth, path }) => {
            const tasks = context.tasks.filter((task) => task.project_id === project.id);
            const done = tasks.filter((task) => task.status === "done").length;
            const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
            const openTasks = tasks.length - done;
            const nextTask = tasks.filter((task) => task.status !== "done").sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
            const projectHealthItem = healthByProjectId.get(project.id);

            return (
              <article className={`project-card project-tree-depth-${Math.min(depth, 3)}`} key={project.id}>
                {editingProjectId === project.id ? (
                  <div className="project-settings">
                    <input className="table-input" value={editProject.name} onChange={(event) => setEditProject((current) => ({ ...current, name: event.target.value }))} />
                    <input className="color-input" value={editProject.color} onChange={(event) => setEditProject((current) => ({ ...current, color: event.target.value }))} type="color" aria-label="Kolor projektu" />
                    <select className="table-input" value={editProject.status} onChange={(event) => setEditProject((current) => ({ ...current, status: event.target.value as ProjectStatus }))}>
                      <option value="on_track">On track</option>
                      <option value="in_progress">In progress</option>
                      <option value="at_risk">At risk</option>
                      <option value="paused">Paused</option>
                      <option value="done">Archived / done</option>
                    </select>
                    <input className="table-input project-tags-input" value={editProject.goal} onChange={(event) => setEditProject((current) => ({ ...current, goal: event.target.value }))} placeholder="Cel strategiczny" />
                    <input className="table-input project-tags-input" value={editProject.areasText} onChange={(event) => setEditProject((current) => ({ ...current, areasText: event.target.value }))} placeholder="Obszary po przecinku" />
                    <input className="table-input project-tags-input" value={editProject.tagsText} onChange={(event) => setEditProject((current) => ({ ...current, tagsText: event.target.value }))} placeholder="Tagi po przecinku" />
                    <select className="table-input" value={editProject.parentProjectId} onChange={(event) => setEditProject((current) => ({ ...current, parentProjectId: event.target.value }))}>
                      <option value="">Bez nadprojektu</option>
                      {projectTreeRows
                        .filter((item) => item.project.id !== project.id && !isDescendantProject(item.project.id, project.id, context.projects))
                        .map((item) => <option value={item.project.id} key={item.project.id}>{item.path}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="project-title-wrap">
                    <div className="project-title">
                      <div className="project-name-cell">
                        {depth > 0 && <span className="tree-branch" style={{ paddingLeft: `${depth * 12}px` }}>↳</span>}
                        {projectsWithChildren.has(project.id) ? (
                          <button
                            className="collapse-toggle"
                            type="button"
                            onClick={() => toggleCollapse(project.id)}
                            aria-label={collapsedProjects.has(project.id) ? "Rozwiń podprojekty" : "Zwiń podprojekty"}
                          >
                            {collapsedProjects.has(project.id) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                          </button>
                        ) : (
                          <span className="collapse-toggle-placeholder" />
                        )}
                        <span className="color-dot" style={{ background: project.color }} />
                        <Link to={`/project/${project.id}`} className="project-name-link">
                          <strong>{project.name}</strong>
                          <ExternalLink size={13} className="project-name-link-icon" />
                        </Link>
                      </div>
                      <span className={`status-pill ${projectHealthItem?.health ?? project.status}`}>{projectHealthItem?.health ?? project.status}</span>
                    </div>
                    <ProjectMeta project={project} projects={context.projects} path={path} />
                  </div>
                )}

                <div className="project-card-bottom">
                  <div className="project-progress-summary">
                    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                    <div className="muted-row">
                      <span>{progress}% · {openTasks} otwarte</span>
                      <span>{nextTask ? `następny termin: ${dateLabel(nextTask.due_date)}` : "brak otwartych zadań"}</span>
                    </div>
                  </div>
                  <div className="project-actions">
                    {editingProjectId === project.id ? (
                      <>
                        <button className="icon-button" type="button" onClick={() => void saveProject(project.id)} aria-label="Zapisz projekt"><Check size={16} /></button>
                        <button className="icon-button" type="button" onClick={() => setEditingProjectId(null)} aria-label="Anuluj edycję"><X size={16} /></button>
                      </>
                    ) : (
                      <>
                        <button className="icon-button" type="button" onClick={() => startProjectEdit(project)} aria-label="Edytuj projekt"><Edit3 size={16} /></button>
                        <button className="icon-button" type="button" onClick={() => void archiveProject(project)} aria-label="Archiwizuj projekt"><Archive size={16} /></button>
                        <button className="icon-button danger-action" type="button" onClick={() => void deleteProject(project)} aria-label="Usuń projekt"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {!context.projects.length && <Empty text="Dodaj pierwszy projekt przez Copilota albo przycisk Projekt." />}
          {context.projects.length > 0 && !visibleProjectTreeRows.length && <Empty text="Brak projektów pasujących do filtrów." />}
        </div>
      </section>

      <section className="dashboard-grid dashboard-secondary-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Najbliższe terminy</h2>
            <div className="segmented-control">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={deadlineWindow === days ? "active" : ""}
                  onClick={() => setDeadlineWindow(days)}
                >
                  {days} dni
                </button>
              ))}
            </div>
          </div>
          <div className="deadline-list">
            {upcomingDeadlines.map(({ task, project, daysLeft: left }) => (
              <Link className={`deadline-item ${task.risk_status}`} to="/tasks" key={task.id}>
                <div>
                  <strong>{task.name}</strong>
                  <span>{project?.name ?? "bez projektu"} · {task.priority}/{task.impact}</span>
                </div>
                <div className="deadline-date">
                  <strong>{dateLabel(task.due_date)}</strong>
                  <span>{left < 0 ? `${Math.abs(left)} dni po terminie` : left === 0 ? "dzisiaj" : `za ${left} dni`}</span>
                </div>
              </Link>
            ))}
            {!upcomingDeadlines.length && <Empty text="Brak deadline’ów w tym oknie." />}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2><Target size={18} />Cele</h2>
            <span>{goals.length}</span>
          </div>
          <div className="okr-list">
            {goals.map(({ goal, projects, progress, total, done }) => (
              <div className="okr-goal-row" key={goal}>
                <div className="okr-goal-header">
                  <strong>{goal}</strong>
                  <span className="muted-note">{done}/{total} · {progress}%</span>
                </div>
                <div className="progress-track okr-progress"><span style={{ width: `${progress}%`, background: progress >= 75 ? "#49d17d" : progress >= 40 ? "#f59e0b" : "#ef4444" }} /></div>
                <div className="okr-projects">
                  {projects.slice(0, 4).map((project) => (
                    <span key={project.id} className={`status-pill ${project.status}`} style={{ borderLeftColor: project.color, borderLeftWidth: 3 }}>{project.name}</span>
                  ))}
                </div>
              </div>
            ))}
            {!goals.length && <Empty text="Brak celów strategicznych w projektach." />}
          </div>
        </div>
      </section>

      <section className="panel dashboard-quiet-metrics">
        <div className="panel-header">
          <h2><TrendingUp size={18} />Kondycja pracy</h2>
        </div>
        <div className="stats-grid">
          <StatBox label="Terminowość" value={`${stats.onTimeRate}%`} sub="ukończonych w terminie" tone={stats.onTimeRate >= 80 ? "good" : stats.onTimeRate >= 60 ? "warn" : "danger"} />
          <StatBox label="Zamknięte 7 dni" value={stats.velocityLast7} sub={`${stats.addedLast7} dodanych`} tone="neutral" />
          <StatBox label="Zamknięte 30 dni" value={stats.velocityLast30} sub={`${stats.addedLast30} dodanych`} tone="neutral" />
          <StatBox label="Śr. opóźnienie" value={`${stats.avgDelayDays}d`} sub="dla spóźnionych zadań" tone={stats.avgDelayDays === 0 ? "good" : stats.avgDelayDays <= 3 ? "warn" : "danger"} />
          <StatBox label="Alerty" value={risks.length} sub={`${conflicts.length} kolizji dat`} tone={risks.length || conflicts.length ? "warn" : "good"} />
          <StatBox label="Ogólny postęp" value={`${stats.overallProgress}%`} sub={`${stats.doneTasks}/${stats.totalTasks} zadań`} tone="neutral" />
        </div>
      </section>
    </div>
  );
}

function SummaryMetric({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string | number; sub: string; tone: "good" | "warn" | "danger" | "neutral" }) {
  return (
    <div className={`metric-card summary-metric metric-${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function ProjectMeta({ project, projects, path }: { project: Project; projects: Project[]; path: string }) {
  const parent = project.parent_project_id ? projects.find((item) => item.id === project.parent_project_id) : null;
  const tags = project.tags ?? [];
  const areas = project.areas ?? [];

  if (!parent && !project.goal && !tags.length && !areas.length) return null;

  return (
    <div className="project-meta">
      {project.goal && <span className="subproject-pill">Cel: {project.goal}</span>}
      {parent && <span className="subproject-pill">Ścieżka: {path}</span>}
      {areas.map((area) => <span className="area-pill" key={area}>Obszar: {area}</span>)}
      {tags.map((tag) => <span className="tag-pill" key={tag}>{tag}</span>)}
    </div>
  );
}

function StatBox({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone: "good" | "warn" | "danger" | "neutral" }) {
  return (
    <div className={`stat-box stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-sub">{sub}</span>
    </div>
  );
}

function parseTags(value: string) {
  return Array.from(new Set(value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)));
}

function daysLeft(value: string, today: Date) {
  const parsedDate = parseISO(value);
  return Number.isNaN(parsedDate.getTime()) ? 9999 : differenceInCalendarDays(parsedDate, today);
}

function dateDistance(value: string, today: Date) {
  const left = daysLeft(value, today);
  if (left === 9999) return "brak poprawnej daty";
  if (left < 0) return `${Math.abs(left)} dni po terminie`;
  if (left === 0) return "dzisiaj";
  if (left === 1) return "jutro";
  return `za ${left} dni`;
}

function dateLabel(value: string) {
  const parsedDate = parseISO(value);
  return Number.isNaN(parsedDate.getTime())
    ? value
    : parsedDate.toLocaleDateString("pl-PL", { day: "2-digit", month: "short" });
}

function projectNameFor(projectId: string, projects: Project[]) {
  return projects.find((project) => project.id === projectId)?.name ?? "bez projektu";
}

function buildProjectTreeRows(projects: Project[]) {
  const childrenByParent = new Map<string, Project[]>();
  const roots: Project[] = [];

  for (const project of projects) {
    if (project.parent_project_id && projects.some((item) => item.id === project.parent_project_id)) {
      const children = childrenByParent.get(project.parent_project_id) ?? [];
      children.push(project);
      childrenByParent.set(project.parent_project_id, children);
    } else {
      roots.push(project);
    }
  }

  const sortProjects = (items: Project[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const rows: Array<{ project: Project; depth: number; path: string }> = [];
  const visit = (project: Project, depth: number, path: string, visited: Set<string>) => {
    if (visited.has(project.id)) return;
    rows.push({ project, depth, path });
    const nextVisited = new Set(visited);
    nextVisited.add(project.id);
    for (const child of sortProjects(childrenByParent.get(project.id) ?? [])) {
      visit(child, depth + 1, `${path} > ${child.name}`, nextVisited);
    }
  };

  for (const root of sortProjects(roots)) {
    visit(root, 0, root.name, new Set());
  }

  return rows;
}

function filterProjectTreeRows(
  rows: Array<{ project: Project; depth: number; path: string }>,
  query: string,
  showArchived: boolean
) {
  const normalizedQuery = query.trim().toLowerCase();
  const rowsById = new Map(rows.map((row) => [row.project.id, row]));
  const includedIds = new Set<string>();

  for (const row of rows) {
    const visibleByStatus = showArchived || row.project.status !== "done";
    const haystack = [
      row.project.name,
      row.path,
      row.project.status,
      row.project.goal,
      ...(row.project.areas ?? []),
      ...(row.project.tags ?? [])
    ].filter(Boolean).join(" ").toLowerCase();
    const visibleByQuery = !normalizedQuery || haystack.includes(normalizedQuery);

    if (visibleByStatus && visibleByQuery) {
      includedIds.add(row.project.id);
      let parentId = row.project.parent_project_id;
      while (parentId) {
        includedIds.add(parentId);
        parentId = rowsById.get(parentId)?.project.parent_project_id ?? null;
      }
    }
  }

  return rows.filter((row) => includedIds.has(row.project.id));
}

function applyCollapseFilter(
  rows: Array<{ project: Project; depth: number; path: string }>,
  collapsedIds: Set<string>
) {
  if (collapsedIds.size === 0) return rows;
  const hiddenSet = new Set<string>();
  return rows.filter(({ project }) => {
    const parentId = project.parent_project_id;
    if (parentId && (collapsedIds.has(parentId) || hiddenSet.has(parentId))) {
      hiddenSet.add(project.id);
      return false;
    }
    return true;
  });
}

function isDescendantProject(candidateId: string, ancestorId: string, projects: Project[]) {
  let current = projects.find((project) => project.id === candidateId);
  const visited = new Set<string>();

  while (current?.parent_project_id) {
    if (current.parent_project_id === ancestorId) return true;
    if (visited.has(current.parent_project_id)) return false;
    visited.add(current.parent_project_id);
    current = projects.find((project) => project.id === current?.parent_project_id);
  }

  return false;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
}
