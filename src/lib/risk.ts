import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Project, RiskItem, Task } from "./types";

const priorityWeight = { low: 1, medium: 2, high: 3, critical: 5 };
const impactWeight = { low: 1, medium: 2, high: 3, strategic: 5 };

export function calculateDeadlineImportance(task: Pick<Task, "priority" | "impact" | "due_date">, today = new Date()) {
  const daysLeft = differenceInCalendarDays(parseISO(task.due_date), today);
  const proximity = daysLeft <= 1 ? 5 : daysLeft <= 7 ? 4 : daysLeft <= 14 ? 3 : daysLeft <= 30 ? 2 : 1;
  return priorityWeight[task.priority] * 2 + impactWeight[task.impact] * 2 + proximity;
}

export function riskStatusFromImportance(score: number) {
  if (score >= 18) return "blocked";
  if (score >= 14) return "risk";
  if (score >= 10) return "watch";
  return "none";
}

export function buildRiskBriefing(tasks: Task[], projects: Project[], today = new Date()): RiskItem[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return tasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const score = calculateDeadlineImportance(task, today);
      const project = projectById.get(task.project_id);
      return { task, score, project };
    })
    .filter(({ score }) => score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ task, score, project }) => ({
      id: task.id,
      title: task.name,
      severity: score >= 18 ? "danger" : score >= 14 ? "warning" : "info",
      projectName: project?.name,
      dueDate: task.due_date,
      reason: `${task.priority}/${task.impact}, importance ${score}`
    }));
}

export function findDateConflicts(tasks: Task[]) {
  const grouped = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (task.status === "done") return acc;
    acc[task.due_date] = [...(acc[task.due_date] ?? []), task];
    return acc;
  }, {});

  return Object.entries(grouped)
    .filter(([, items]) => items.length > 1)
    .map(([date, items]) => ({
      date,
      taskIds: items.map((item) => item.id),
      reason: `${items.length} open tasks share this deadline`
    }));
}
