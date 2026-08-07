import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import type { Project, Task } from "./types";

export interface TaskWithProject {
  task: Task;
  project?: Project;
  daysLeft: number;
  urgency: number;
}

export interface ProjectHealth {
  project: Project;
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  criticalTasks: number;
  blockedTasks: number;
  progress: number;
  health: "healthy" | "watch" | "risk" | "blocked";
  score: number;
}

export function buildTaskIndex(tasks: Task[], projects: Project[], today = new Date()): TaskWithProject[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return tasks.map((task) => {
    const daysLeft = daysUntil(task.due_date, today);
    return {
      task,
      project: projectById.get(task.project_id),
      daysLeft,
      urgency: taskUrgency(task, daysLeft)
    };
  });
}

export function taskUrgency(task: Task, daysLeft: number) {
  const overdueBoost = daysLeft < 0 ? Math.min(12, Math.abs(daysLeft) * 2) : 0;
  const proximityBoost = daysLeft <= 0 ? 8 : daysLeft <= 3 ? 6 : daysLeft <= 7 ? 4 : daysLeft <= 14 ? 2 : 0;
  const riskBoost = task.risk_status === "blocked" ? 8 : task.risk_status === "risk" ? 6 : task.risk_status === "watch" ? 3 : 0;
  return task.deadline_importance + overdueBoost + proximityBoost + riskBoost;
}

export function focusQueue(tasks: Task[], projects: Project[], limit = 8) {
  return buildTaskIndex(tasks, projects)
    .filter(({ task }) => task.status !== "done")
    .sort((a, b) => b.urgency - a.urgency || a.daysLeft - b.daysLeft)
    .slice(0, limit);
}

export function projectHealth(projects: Project[], tasks: Task[], today = new Date()): ProjectHealth[] {
  return projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    const doneTasks = projectTasks.filter((task) => task.status === "done").length;
    const openTasks = projectTasks.length - doneTasks;
    const overdueTasks = projectTasks.filter((task) => task.status !== "done" && daysUntil(task.due_date, today) < 0).length;
    const criticalTasks = projectTasks.filter((task) => task.status !== "done" && (task.priority === "critical" || task.impact === "strategic")).length;
    const blockedTasks = projectTasks.filter((task) => task.status !== "done" && task.risk_status === "blocked").length;
    const progress = projectTasks.length ? Math.round((doneTasks / projectTasks.length) * 100) : 0;
    const score = blockedTasks * 4 + overdueTasks * 3 + criticalTasks * 2 + Math.max(0, openTasks - 8);
    const health: ProjectHealth["health"] = score >= 12 ? "blocked" : score >= 7 ? "risk" : score >= 3 ? "watch" : "healthy";

    return {
      project,
      totalTasks: projectTasks.length,
      openTasks,
      doneTasks,
      overdueTasks,
      criticalTasks,
      blockedTasks,
      progress,
      health,
      score
    };
  });
}

function daysUntil(value: string, today: Date) {
  const date = parseISO(value);
  return isValid(date) ? differenceInCalendarDays(date, today) : 9999;
}

export interface PortfolioStats {
  totalTasks: number;
  doneTasks: number;
  overallProgress: number;
  onTimeRate: number;
  avgDelayDays: number;
  velocityLast7: number;
  velocityLast30: number;
  addedLast7: number;
  addedLast30: number;
  currentlyOverdue: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export function portfolioStats(tasks: Task[], today = new Date()): PortfolioStats {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const overallProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const completed = tasks.filter((t) => t.status === "done" && t.completed_at);
  const onTime = completed.filter((t) => {
    const completedAt = parseISO(t.completed_at!);
    const due = parseISO(t.due_date);
    return isValid(completedAt) && isValid(due) && completedAt <= due;
  });
  const onTimeRate = completed.length ? Math.round((onTime.length / completed.length) * 100) : 0;

  const delayed = completed.filter((t) => {
    const completedAt = parseISO(t.completed_at!);
    const due = parseISO(t.due_date);
    return isValid(completedAt) && isValid(due) && completedAt > due;
  });
  const avgDelayDays = delayed.length
    ? Math.round(delayed.reduce((sum, t) => sum + differenceInCalendarDays(parseISO(t.completed_at!), parseISO(t.due_date)), 0) / delayed.length)
    : 0;

  const cutoff7 = new Date(today);
  cutoff7.setDate(today.getDate() - 7);
  const cutoff30 = new Date(today);
  cutoff30.setDate(today.getDate() - 30);

  const velocityLast7 = completed.filter((t) => {
    const d = parseISO(t.completed_at!);
    return isValid(d) && d >= cutoff7;
  }).length;
  const velocityLast30 = completed.filter((t) => {
    const d = parseISO(t.completed_at!);
    return isValid(d) && d >= cutoff30;
  }).length;

  const addedLast7 = tasks.filter((t) => {
    const d = parseISO(t.created_at);
    return isValid(d) && d >= cutoff7;
  }).length;
  const addedLast30 = tasks.filter((t) => {
    const d = parseISO(t.created_at);
    return isValid(d) && d >= cutoff30;
  }).length;

  const currentlyOverdue = tasks.filter((t) => t.status !== "done" && daysUntil(t.due_date, today) < 0).length;

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
  }

  return { totalTasks, doneTasks, overallProgress, onTimeRate, avgDelayDays, velocityLast7, velocityLast30, addedLast7, addedLast30, currentlyOverdue, byStatus, byPriority };
}

export function searchPortfolio(query: string, projects: Project[], tasks: Task[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return { projects, tasks };

  return {
    projects: projects.filter((project) =>
      [project.name, project.status].some((value) => value.toLowerCase().includes(normalized))
    ),
    tasks: tasks.filter((task) =>
      [task.name, task.status, task.priority, task.impact, task.risk_status, task.due_date]
        .some((value) => value.toLowerCase().includes(normalized))
    )
  };
}
