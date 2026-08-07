import { z } from "zod";

export const projectStatusSchema = z.enum(["on_track", "in_progress", "at_risk", "paused", "done"]);
export const taskStatusSchema = z.enum(["backlog", "in_progress", "review", "done"]);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const impactSchema = z.enum(["low", "medium", "high", "strategic"]);

export const quickAddDraftSchema = z.object({
  project: z.object({
    name: z.string().min(2),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    status: projectStatusSchema.default("in_progress")
  }),
  phases: z.array(
    z.object({
      name: z.string().min(2),
      start_date: z.string().date(),
      end_date: z.string().date(),
      tasks: z.array(
        z.object({
          name: z.string().min(2),
          due_date: z.string().date(),
          priority: prioritySchema.default("medium"),
          impact: impactSchema.default("medium")
        })
      ).min(1)
    })
  ).min(1),
  risks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      severity: z.enum(["info", "warning", "danger"]),
      projectName: z.string().optional(),
      dueDate: z.string().optional(),
      reason: z.string()
    })
  ).default([]),
  questions: z.array(z.string()).optional()
});

export const portfolioScanSchema = z.object({
  risks: quickAddDraftSchema.shape.risks,
  upcomingDeadlines: z.array(
    z.object({
      taskId: z.string(),
      taskName: z.string(),
      projectName: z.string(),
      dueDate: z.string().date(),
      priority: prioritySchema,
      impact: impactSchema,
      deadlineImportance: z.number()
    })
  ),
  conflicts: z.array(
    z.object({
      date: z.string().date(),
      taskIds: z.array(z.string()),
      reason: z.string()
    })
  ),
  proposals: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      rationale: z.string(),
      changes: z.array(
        z.object({
          entity: z.enum(["project", "phase", "task"]),
          id: z.string(),
          field: z.string(),
          from: z.union([z.string(), z.number(), z.null()]),
          to: z.union([z.string(), z.number(), z.null()])
        })
      )
    })
  ),
  advisorBriefing: z.object({
    summary: z.string(),
    nextActions: z.array(z.string()),
    decisions: z.array(z.string()),
    questions: z.array(z.string())
  }).optional()
});

export const businessAnalysisSchema = z.object({
  executiveSummary: z.string(),
  score: z.object({
    clarity: z.number(),
    viability: z.number(),
    focus: z.number(),
    nextStepReadiness: z.number()
  }),
  strengths: z.array(z.object({
    title: z.string(),
    reason: z.string()
  })),
  risks: z.array(z.object({
    title: z.string(),
    severity: z.enum(["low", "medium", "high"]),
    reason: z.string(),
    mitigation: z.string()
  })),
  suggestions: z.array(z.object({
    title: z.string(),
    impact: z.enum(["low", "medium", "high"]),
    effort: z.enum(["low", "medium", "high"]),
    rationale: z.string(),
    action: z.string()
  })),
  experiments: z.array(z.object({
    title: z.string(),
    hypothesis: z.string(),
    method: z.string(),
    successMetric: z.string(),
    timeframe: z.string()
  })),
  stepByStepPlan: z.array(z.object({
    step: z.number(),
    title: z.string(),
    objective: z.string(),
    actions: z.array(z.string()),
    deliverable: z.string()
  })),
  questions: z.array(z.string())
});
