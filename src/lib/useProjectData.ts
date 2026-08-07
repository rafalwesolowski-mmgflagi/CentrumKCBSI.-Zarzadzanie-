import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { BusinessCanvas, BusinessDesign, BusinessMapLink, BusinessMapNode, BusinessMapNodeKind, BusinessVisualMap, CalendarEntry, CalendarEntryKind, CalendarNotification, CopilotProposal, CRMClient, CRMClientStage, Phase, Project, ProjectNote, ProjectNoteCategory, ProjectNoteReviewStatus, ProjectNoteSource, ProjectStatus, QuickAddDraft, RiskStatus, Task, TaskImpact, TaskImage, TaskPriority, TaskStatus, WellbeingAffirmation, WellbeingAffirmationSource, WellbeingAssessment, WellbeingChallengeStatus, WellbeingDailyCommitment, WellbeingDiaryEntry, WellbeingGoal, WellbeingGoalHorizon, WellbeingGoalStatus, WellbeingReflection, WellbeingRewirementChallenge, WellbeingRewirementLog } from "./types";
import { calculateDeadlineImportance, riskStatusFromImportance } from "./risk";

interface ProjectDataState {
  projects: Project[];
  phases: Phase[];
  tasks: Task[];
  taskImages: TaskImage[];
  businessDesigns: BusinessDesign[];
  clients: CRMClient[];
  notes: ProjectNote[];
  calendarEntries: CalendarEntry[];
  calendarNotifications: CalendarNotification[];
  wellbeingGoals: WellbeingGoal[];
  wellbeingReflections: WellbeingReflection[];
  wellbeingRewirementChallenges: WellbeingRewirementChallenge[];
  wellbeingRewirementLogs: WellbeingRewirementLog[];
  wellbeingAssessments: WellbeingAssessment[];
  wellbeingAffirmations: WellbeingAffirmation[];
  wellbeingDailyCommitments: WellbeingDailyCommitment[];
  wellbeingDiaryEntries: WellbeingDiaryEntry[];
  loading: boolean;
  error: string | null;
  lastLoadedAt: string | null;
}

export function useProjectData(session: Session | null) {
  const [state, setState] = useState<ProjectDataState>({
    projects: [],
    phases: [],
    tasks: [],
    taskImages: [],
    businessDesigns: [],
    clients: [],
    notes: [],
    calendarEntries: [],
    calendarNotifications: [],
    wellbeingGoals: [],
    wellbeingReflections: [],
    wellbeingRewirementChallenges: [],
    wellbeingRewirementLogs: [],
    wellbeingAssessments: [],
    wellbeingAffirmations: [],
    wellbeingDailyCommitments: [],
    wellbeingDiaryEntries: [],
    loading: true,
    error: null,
    lastLoadedAt: null
  });

  const load = useCallback(async () => {
    if (!session) {
      setState({ projects: [], phases: [], tasks: [], taskImages: [], businessDesigns: [], clients: [], notes: [], calendarEntries: [], calendarNotifications: [], wellbeingGoals: [], wellbeingReflections: [], wellbeingRewirementChallenges: [], wellbeingRewirementLogs: [], wellbeingAssessments: [], wellbeingAffirmations: [], wellbeingDailyCommitments: [], wellbeingDiaryEntries: [], loading: false, error: null, lastLoadedAt: null });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [
        projectsResult, phasesResult, tasksResult, taskImagesResult,
        businessDesignsResult, clientsResult, notesResult, calendarEntriesResult, calendarNotificationsResult,
        wellbeingGoalsResult, wellbeingReflectionsResult, wellbeingChallengesResult, wellbeingChallengeLogsResult,
        wellbeingAssessmentsResult, wellbeingAffirmationsResult, wellbeingDailyCommitmentsResult, wellbeingDiaryEntriesResult
      ] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("phases").select("*").order("order_index", { ascending: true }),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("task_images").select("*").order("created_at", { ascending: false }),
        supabase.from("business_designs").select("*").order("updated_at", { ascending: false }),
        supabase.from("crm_clients").select("*").order("updated_at", { ascending: false }),
        supabase.from("project_notes").select("*").order("updated_at", { ascending: false }),
        supabase.from("calendar_entries").select("*").order("entry_date", { ascending: true }).order("start_time", { ascending: true }),
        supabase
          .from("task_calendar_notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("wellbeing_goals").select("*").order("updated_at", { ascending: false }),
        supabase.from("wellbeing_reflections").select("*").order("entry_date", { ascending: false }).limit(180),
        supabase.from("wellbeing_rewirement_challenges").select("*").order("created_at", { ascending: false }),
        supabase.from("wellbeing_rewirement_logs").select("*").order("log_date", { ascending: false }).limit(365),
        supabase.from("wellbeing_assessments").select("*").order("taken_at", { ascending: false }).limit(24),
        supabase.from("wellbeing_affirmations").select("*").order("created_at", { ascending: false }),
        supabase.from("wellbeing_daily_commitments").select("*").order("commitment_date", { ascending: false }).limit(90),
        supabase.from("wellbeing_diary_entries").select("*").order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(120)
      ]);

      if (projectsResult.error) {
        setState((current) => ({ ...current, loading: false, error: projectsResult.error.message }));
        return;
      }

      setState({
        projects: normalizeProjects(projectsResult.data),
        phases: phasesResult.error ? [] : normalizePhases(phasesResult.data),
        tasks: tasksResult.error ? [] : normalizeTasks(tasksResult.data),
        taskImages: taskImagesResult.error && isMissingRelationError(taskImagesResult.error)
          ? []
          : normalizeTaskImages(taskImagesResult.data),
        businessDesigns: businessDesignsResult.error && isMissingRelationError(businessDesignsResult.error)
          ? []
          : normalizeBusinessDesigns(businessDesignsResult.data),
        clients: clientsResult.error && isMissingRelationError(clientsResult.error)
          ? []
          : normalizeClients(clientsResult.data),
        notes: notesResult.error && isMissingRelationError(notesResult.error)
          ? []
          : normalizeProjectNotes(notesResult.data),
        calendarEntries: calendarEntriesResult.error && isMissingRelationError(calendarEntriesResult.error)
          ? []
          : normalizeCalendarEntries(calendarEntriesResult.data),
        calendarNotifications: calendarNotificationsResult.error && isMissingRelationError(calendarNotificationsResult.error)
          ? []
          : (calendarNotificationsResult.data ?? []) as CalendarNotification[],
        wellbeingGoals: wellbeingGoalsResult.error && isMissingRelationError(wellbeingGoalsResult.error)
          ? []
          : normalizeWellbeingGoals(wellbeingGoalsResult.data),
        wellbeingReflections: wellbeingReflectionsResult.error && isMissingRelationError(wellbeingReflectionsResult.error)
          ? []
          : normalizeWellbeingReflections(wellbeingReflectionsResult.data),
        wellbeingRewirementChallenges: wellbeingChallengesResult.error && isMissingRelationError(wellbeingChallengesResult.error)
          ? []
          : normalizeWellbeingRewirementChallenges(wellbeingChallengesResult.data),
        wellbeingRewirementLogs: wellbeingChallengeLogsResult.error && isMissingRelationError(wellbeingChallengeLogsResult.error)
          ? []
          : normalizeWellbeingRewirementLogs(wellbeingChallengeLogsResult.data),
        wellbeingAssessments: wellbeingAssessmentsResult.error && isMissingRelationError(wellbeingAssessmentsResult.error)
          ? []
          : normalizeWellbeingAssessments(wellbeingAssessmentsResult.data),
        wellbeingAffirmations: wellbeingAffirmationsResult.error && isMissingRelationError(wellbeingAffirmationsResult.error)
          ? []
          : normalizeWellbeingAffirmations(wellbeingAffirmationsResult.data),
        wellbeingDailyCommitments: wellbeingDailyCommitmentsResult.error && isMissingRelationError(wellbeingDailyCommitmentsResult.error)
          ? []
          : normalizeWellbeingDailyCommitments(wellbeingDailyCommitmentsResult.data),
        wellbeingDiaryEntries: wellbeingDiaryEntriesResult.error && isMissingRelationError(wellbeingDiaryEntriesResult.error)
          ? []
          : normalizeWellbeingDiaryEntries(wellbeingDiaryEntriesResult.data),
        loading: false,
        error: firstOptionalError([
          phasesResult.error,
          tasksResult.error,
          taskImagesResult.error,
          businessDesignsResult.error,
          clientsResult.error,
          notesResult.error,
          calendarEntriesResult.error,
          calendarNotificationsResult.error,
          wellbeingGoalsResult.error,
          wellbeingReflectionsResult.error,
          wellbeingChallengesResult.error,
          wellbeingChallengeLogsResult.error,
          wellbeingAssessmentsResult.error,
          wellbeingAffirmationsResult.error,
          wellbeingDailyCommitmentsResult.error,
          wellbeingDiaryEntriesResult.error
        ]),
        lastLoadedAt: new Date().toISOString()
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Nie udało się odświeżyć danych."
      }));
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session) return;

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = window.setInterval(() => void load(), 60000);

    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [load, session]);

  const createFromDraft = useCallback(async (draft: QuickAddDraft, targetProjectId?: string | null) => {
    if (!session) throw new Error("Musisz być zalogowany.");

    let projectId: string;
    let createdProjectId: string | null = null;

    if (targetProjectId) {
      if (!state.projects.some((project) => project.id === targetProjectId)) {
        throw new Error("Wybrany projekt docelowy nie istnieje albo nie jest dostępny.");
      }
      projectId = targetProjectId;
    } else {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: session.user.id,
          name: draft.project.name,
          color: draft.project.color,
          status: draft.project.status
        })
        .select("*")
        .single();
      if (projectError) throw projectError;
      projectId = project.id;
      createdProjectId = project.id;
    }

    const existingPhaseCount = state.phases.filter((p) => p.project_id === projectId).length;

    try {
      for (const [index, phase] of draft.phases.entries()) {
        const { data: insertedPhase, error: phaseError } = await supabase
          .from("phases")
          .insert({
            project_id: projectId,
            name: phase.name,
            start_date: phase.start_date,
            end_date: phase.end_date,
            order_index: existingPhaseCount + index
          })
          .select("*")
          .single();

        if (phaseError) throw phaseError;

        const taskRows = phase.tasks.map((task) => {
          const importance = calculateDeadlineImportance({
            due_date: task.due_date,
            priority: task.priority,
            impact: task.impact
          });

          return {
            phase_id: insertedPhase.id,
            project_id: projectId,
            name: task.name,
            due_date: task.due_date,
            status: "backlog",
            priority: task.priority,
            impact: task.impact,
            deadline_importance: importance,
            risk_status: riskStatusFromImportance(importance)
          };
        });

        const { error: tasksError } = await supabase.from("tasks").insert(taskRows);
        if (tasksError) {
          await supabase.from("phases").delete().eq("id", insertedPhase.id);
          throw tasksError;
        }
      }
    } catch (error) {
      if (createdProjectId) {
        await supabase.from("projects").delete().eq("id", createdProjectId);
      }
      throw error;
    }

    await load();
  }, [load, session, state.phases, state.projects]);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    const completedAt = status === "done" ? new Date().toISOString() : null;
    const { error } = await supabase.from("tasks").update({ status, completed_at: completedAt }).eq("id", taskId);
    if (error && isMissingColumnError(error, "completed_at")) {
      const { error: fallbackError } = await supabase.from("tasks").update({ status }).eq("id", taskId);
      if (fallbackError) throw fallbackError;
    } else if (error) {
      throw error;
    }

    if (status === "done") {
      const task = state.tasks.find((t) => t.id === taskId);
      if (task?.recurrence) {
        const nextDueDate = calculateNextDueDate(task.due_date, task.recurrence);
        const importance = calculateDeadlineImportance({ due_date: nextDueDate, priority: task.priority, impact: task.impact });
        const nextRow = {
          project_id: task.project_id,
          phase_id: task.phase_id,
          name: task.name,
          due_date: nextDueDate,
          status: "backlog" as const,
          priority: task.priority,
          impact: task.impact,
          deadline_importance: importance,
          risk_status: riskStatusFromImportance(importance),
          area: task.area,
          notes: task.notes,
          assignee: task.assignee,
          recurrence: task.recurrence
        };
        const { error: nextError } = await supabase.from("tasks").insert(nextRow);
        if (nextError && isMissingColumnError(nextError, "recurrence")) {
          const { recurrence: _r, ...fallbackNextRow } = nextRow;
          void _r;
          const { error: fallbackNextError } = await supabase.from("tasks").insert(fallbackNextRow);
          if (fallbackNextError) throw fallbackNextError;
        } else if (nextError) {
          throw nextError;
        }
      }
    }

    await load();
  }, [load, state.tasks]);

  const updateTask = useCallback(async (taskId: string, input: { projectId: string; name: string; dueDate: string; status: TaskStatus; priority: TaskPriority; impact: TaskImpact; area: string; notes: string; assignee: string; recurrence: string }) => {
    const currentTask = state.tasks.find((task) => task.id === taskId);
    if (!currentTask) throw new Error("Nie znaleziono zadania do edycji.");

    const importance = calculateDeadlineImportance({
      due_date: input.dueDate,
      priority: input.priority,
      impact: input.impact
    });
    const patch: Pick<Task, "name" | "due_date" | "status" | "priority" | "impact" | "deadline_importance" | "risk_status" | "area" | "notes" | "assignee" | "recurrence"> & Partial<Pick<Task, "project_id" | "phase_id">> = {
      name: input.name,
      due_date: input.dueDate,
      status: input.status,
      priority: input.priority,
      impact: input.impact,
      deadline_importance: importance,
      risk_status: riskStatusFromImportance(importance),
      area: cleanOptionalText(input.area),
      notes: cleanOptionalText(input.notes),
      assignee: cleanOptionalText(input.assignee),
      recurrence: cleanOptionalText(input.recurrence) as string | null
    };

    if (input.projectId !== currentTask.project_id) {
      const targetProject = state.projects.find((project) => project.id === input.projectId);
      if (!targetProject) throw new Error("Nie znaleziono projektu docelowego.");

      const existingPhase = state.phases.find((phase) => phase.project_id === input.projectId);
      let phaseId = existingPhase?.id;

      if (!phaseId) {
        const { data: phase, error: phaseError } = await supabase
          .from("phases")
          .insert({
            project_id: input.projectId,
            name: "General",
            start_date: input.dueDate,
            end_date: input.dueDate,
            order_index: 0
          })
          .select("*")
          .single();

        if (phaseError) throw phaseError;
        phaseId = phase.id;
      }

      patch.project_id = input.projectId;
      patch.phase_id = phaseId;
    }

    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error && isMissingColumnError(error, "recurrence")) {
      const { recurrence: _r, ...fallbackPatch } = patch;
      void _r;
      const { error: fallbackError } = await supabase.from("tasks").update(fallbackPatch).eq("id", taskId);
      if (fallbackError) throw fallbackError;
    } else if (error) {
      throw error;
    }
    await load();
  }, [load, state.phases, state.projects, state.tasks]);

  const createProject = useCallback(async (input: { name: string; color: string; tags: string[]; areas: string[]; parentProjectId: string | null; goal: string }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    ensureValidProjectParent({
      projectId: null,
      parentProjectId: input.parentProjectId,
      projects: state.projects
    });
    const projectInsert = {
      user_id: session.user.id,
      name: input.name,
      color: input.color,
      status: "in_progress",
      tags: input.tags,
      areas: input.areas,
      parent_project_id: input.parentProjectId,
      goal: cleanOptionalText(input.goal)
    };
    const { data, error } = await supabase.from("projects").insert(projectInsert).select("*").single();
    if (error && isMissingColumnError(error, "areas")) {
      const { areas: _areas, goal: _goal, ...fallbackProjectInsert } = projectInsert;
      void _areas;
      void _goal;
      const { data: fallbackData, error: fallbackError } = await supabase.from("projects").insert(fallbackProjectInsert).select("*").single();
      if (fallbackError) throw supabaseError(fallbackError);
      await load();
      return fallbackData as Project;
    } else if (error) {
      throw supabaseError(error);
    }
    await load();
    return data as Project;
  }, [load, session, state.projects]);

  const updateProject = useCallback(async (projectId: string, input: { name: string; color: string; status: ProjectStatus; tags: string[]; areas: string[]; parentProjectId: string | null; goal: string }) => {
    ensureValidProjectParent({
      projectId,
      parentProjectId: input.parentProjectId,
      projects: state.projects
    });
    const projectPatch = {
      name: input.name,
      color: input.color,
      status: input.status,
      tags: input.tags,
      areas: input.areas,
      parent_project_id: input.parentProjectId,
      goal: cleanOptionalText(input.goal)
    };
    const { error } = await supabase
      .from("projects")
      .update(projectPatch)
      .eq("id", projectId);
    if (error && isMissingColumnError(error, "areas")) {
      const { areas: _areas, goal: _goal, ...fallbackProjectPatch } = projectPatch;
      void _areas;
      void _goal;
      const { error: fallbackError } = await supabase
        .from("projects")
        .update(fallbackProjectPatch)
        .eq("id", projectId);
      if (fallbackError) throw supabaseError(fallbackError);
    } else if (error) {
      throw supabaseError(error);
    }
    await load();
  }, [load, state.projects]);

  const updateProjectFinance = useCallback(async (projectId: string, input: { budget: number | null; invoiced: number | null; paid: number | null; cost: number | null; currency: string }) => {
    const { error } = await supabase.from("projects").update({
      budget: input.budget,
      invoiced: input.invoiced,
      paid: input.paid,
      cost: input.cost,
      currency: input.currency || "PLN"
    }).eq("id", projectId);
    if (error) throw supabaseError(error);
    await load();
  }, [load]);

  const createClient = useCallback(async (input: { projectId: string | null; company: string; contactName: string; email: string; phone: string; stage: CRMClientStage; value: number | null; currency: string; projectUrl: string; repositoryUrl: string; nextFollowUp: string; advancePayment: number | null; notes: string }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const clientRow = {
      user_id: session.user.id,
      project_id: input.projectId,
      company: input.company.trim(),
      contact_name: cleanOptionalText(input.contactName),
      email: cleanOptionalText(input.email),
      phone: cleanOptionalText(input.phone),
      stage: input.stage,
      value: input.value,
      currency: input.currency || "PLN",
      project_url: cleanOptionalText(input.projectUrl),
      repository_url: cleanOptionalText(input.repositoryUrl),
      next_follow_up: cleanOptionalText(input.nextFollowUp),
      advance_payment: input.advancePayment,
      notes: cleanOptionalText(input.notes)
    };
    const { error } = await supabase.from("crm_clients").insert(clientRow);
    if (error && isMissingAnyColumnError(error, ["project_url", "repository_url", "advance_payment"])) {
      const { project_url: _projectUrl, repository_url: _repositoryUrl, advance_payment: _advancePayment, ...fallbackClientRow } = clientRow;
      void _projectUrl;
      void _repositoryUrl;
      void _advancePayment;
      const { error: fallbackError } = await supabase.from("crm_clients").insert(fallbackClientRow);
      if (fallbackError) throw supabaseError(fallbackError);
    } else if (error) {
      throw supabaseError(error);
    }
    await load();
  }, [load, session]);

  const updateClient = useCallback(async (clientId: string, input: { projectId: string | null; company: string; contactName: string; email: string; phone: string; stage: CRMClientStage; value: number | null; currency: string; projectUrl: string; repositoryUrl: string; nextFollowUp: string; advancePayment: number | null; notes: string }) => {
    const clientPatch = {
      project_id: input.projectId,
      company: input.company.trim(),
      contact_name: cleanOptionalText(input.contactName),
      email: cleanOptionalText(input.email),
      phone: cleanOptionalText(input.phone),
      stage: input.stage,
      value: input.value,
      currency: input.currency || "PLN",
      project_url: cleanOptionalText(input.projectUrl),
      repository_url: cleanOptionalText(input.repositoryUrl),
      next_follow_up: cleanOptionalText(input.nextFollowUp),
      advance_payment: input.advancePayment,
      notes: cleanOptionalText(input.notes),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from("crm_clients").update(clientPatch).eq("id", clientId);
    if (error && isMissingAnyColumnError(error, ["project_url", "repository_url", "advance_payment"])) {
      const { project_url: _projectUrl, repository_url: _repositoryUrl, advance_payment: _advancePayment, ...fallbackClientPatch } = clientPatch;
      void _projectUrl;
      void _repositoryUrl;
      void _advancePayment;
      const { error: fallbackError } = await supabase.from("crm_clients").update(fallbackClientPatch).eq("id", clientId);
      if (fallbackError) throw supabaseError(fallbackError);
    } else if (error) {
      throw supabaseError(error);
    }
    await load();
  }, [load]);

  const deleteClient = useCallback(async (clientId: string) => {
    const { error } = await supabase.from("crm_clients").delete().eq("id", clientId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      clients: current.clients.filter((client) => client.id !== clientId)
    }));
  }, []);

  const createNote = useCallback(async (input: { projectId: string; title: string; body: string; category: ProjectNoteCategory; source: ProjectNoteSource; reviewStatus: ProjectNoteReviewStatus; summary: string; tags: string[]; isUrgent: boolean }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    if (!state.projects.some((project) => project.id === input.projectId)) {
      throw new Error("Wybierz projekt dla notatki.");
    }

    const { error } = await supabase.from("project_notes").insert({
      user_id: session.user.id,
      project_id: input.projectId,
      title: cleanOptionalText(input.title),
      body: input.body.trim(),
      category: input.category,
      source: input.source,
      review_status: input.reviewStatus,
      summary: cleanOptionalText(input.summary),
      tags: input.tags,
      is_urgent: input.isUrgent
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session, state.projects]);

  const updateNote = useCallback(async (noteId: string, input: { projectId: string; title: string; body: string; category: ProjectNoteCategory; source: ProjectNoteSource; reviewStatus: ProjectNoteReviewStatus; summary: string; tags: string[]; isUrgent: boolean }) => {
    if (!state.projects.some((project) => project.id === input.projectId)) {
      throw new Error("Wybierz projekt dla notatki.");
    }

    const { error } = await supabase.from("project_notes").update({
      project_id: input.projectId,
      title: cleanOptionalText(input.title),
      body: input.body.trim(),
      category: input.category,
      source: input.source,
      review_status: input.reviewStatus,
      summary: cleanOptionalText(input.summary),
      tags: input.tags,
      is_urgent: input.isUrgent,
      updated_at: new Date().toISOString()
    }).eq("id", noteId);
    if (error) throw supabaseError(error);
    await load();
  }, [load, state.projects]);

  const deleteNote = useCallback(async (noteId: string) => {
    const { error } = await supabase.from("project_notes").delete().eq("id", noteId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== noteId)
    }));
  }, []);

  const createCalendarEntry = useCallback(async (input: { kind: CalendarEntryKind; title: string; entryDate: string; startTime: string; endTime: string; isAllDay: boolean; location: string; notes: string; projectId: string | null }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    if (input.projectId && !state.projects.some((project) => project.id === input.projectId)) {
      throw new Error("Wybrany projekt nie istnieje albo nie jest dostępny.");
    }
    const title = input.title.trim();
    if (!title) throw new Error("Wpisz tytuł wpisu kalendarza.");

    const { error } = await supabase.from("calendar_entries").insert({
      user_id: session.user.id,
      project_id: input.projectId,
      kind: input.kind,
      title,
      entry_date: input.entryDate,
      start_time: input.isAllDay || input.kind === "note" ? null : cleanOptionalText(input.startTime),
      end_time: input.isAllDay || input.kind === "note" ? null : cleanOptionalText(input.endTime),
      is_all_day: input.kind === "note" ? true : input.isAllDay,
      location: cleanOptionalText(input.location),
      notes: cleanOptionalText(input.notes)
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session, state.projects]);

  const updateCalendarEntry = useCallback(async (entryId: string, input: { kind: CalendarEntryKind; title: string; entryDate: string; startTime: string; endTime: string; isAllDay: boolean; location: string; notes: string; projectId: string | null }) => {
    if (input.projectId && !state.projects.some((project) => project.id === input.projectId)) {
      throw new Error("Wybrany projekt nie istnieje albo nie jest dostępny.");
    }
    const title = input.title.trim();
    if (!title) throw new Error("Wpisz tytuł wpisu kalendarza.");

    const { error } = await supabase.from("calendar_entries").update({
      project_id: input.projectId,
      kind: input.kind,
      title,
      entry_date: input.entryDate,
      start_time: input.isAllDay || input.kind === "note" ? null : cleanOptionalText(input.startTime),
      end_time: input.isAllDay || input.kind === "note" ? null : cleanOptionalText(input.endTime),
      is_all_day: input.kind === "note" ? true : input.isAllDay,
      location: cleanOptionalText(input.location),
      notes: cleanOptionalText(input.notes),
      updated_at: new Date().toISOString()
    }).eq("id", entryId);
    if (error) throw supabaseError(error);
    await load();
  }, [load, state.projects]);

  const deleteCalendarEntry = useCallback(async (entryId: string) => {
    const { error } = await supabase.from("calendar_entries").delete().eq("id", entryId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      calendarEntries: current.calendarEntries.filter((entry) => entry.id !== entryId)
    }));
  }, []);

  const createWellbeingGoal = useCallback(async (input: { title: string; horizon: WellbeingGoalHorizon; status: WellbeingGoalStatus; description: string; successCriteria: string; targetDate: string; tags: string[]; projectId: string | null }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const { error } = await supabase.from("wellbeing_goals").insert({
      user_id: session.user.id,
      project_id: input.projectId,
      title: input.title.trim(),
      horizon: input.horizon,
      status: input.status,
      description: cleanOptionalText(input.description),
      success_criteria: cleanOptionalText(input.successCriteria),
      target_date: cleanOptionalText(input.targetDate),
      tags: input.tags
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const updateWellbeingGoal = useCallback(async (goalId: string, input: { title: string; horizon: WellbeingGoalHorizon; status: WellbeingGoalStatus; description: string; successCriteria: string; targetDate: string; tags: string[]; projectId: string | null }) => {
    const { error } = await supabase.from("wellbeing_goals").update({
      project_id: input.projectId,
      title: input.title.trim(),
      horizon: input.horizon,
      status: input.status,
      description: cleanOptionalText(input.description),
      success_criteria: cleanOptionalText(input.successCriteria),
      target_date: cleanOptionalText(input.targetDate),
      tags: input.tags,
      updated_at: new Date().toISOString()
    }).eq("id", goalId);
    if (error) throw supabaseError(error);
    await load();
  }, [load]);

  const deleteWellbeingGoal = useCallback(async (goalId: string) => {
    const { error } = await supabase.from("wellbeing_goals").delete().eq("id", goalId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      wellbeingGoals: current.wellbeingGoals.filter((goal) => goal.id !== goalId),
      wellbeingReflections: current.wellbeingReflections.map((reflection) => reflection.goal_id === goalId ? { ...reflection, goal_id: null } : reflection)
    }));
  }, []);

  const createWellbeingReflection = useCallback(async (input: { entryDate: string; goalId: string | null; projectId: string | null; mood: number | null; energy: number | null; gratitude: string; wins: string; challenge: string; lesson: string; nextStep: string; tags: string[] }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const { error } = await supabase.from("wellbeing_reflections").insert({
      user_id: session.user.id,
      goal_id: input.goalId,
      project_id: input.projectId,
      entry_date: input.entryDate,
      mood: input.mood,
      energy: input.energy,
      gratitude: cleanOptionalText(input.gratitude),
      wins: cleanOptionalText(input.wins),
      challenge: cleanOptionalText(input.challenge),
      lesson: cleanOptionalText(input.lesson),
      next_step: cleanOptionalText(input.nextStep),
      tags: input.tags
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const updateWellbeingReflection = useCallback(async (reflectionId: string, input: { entryDate: string; goalId: string | null; projectId: string | null; mood: number | null; energy: number | null; gratitude: string; wins: string; challenge: string; lesson: string; nextStep: string; tags: string[] }) => {
    const { error } = await supabase.from("wellbeing_reflections").update({
      goal_id: input.goalId,
      project_id: input.projectId,
      entry_date: input.entryDate,
      mood: input.mood,
      energy: input.energy,
      gratitude: cleanOptionalText(input.gratitude),
      wins: cleanOptionalText(input.wins),
      challenge: cleanOptionalText(input.challenge),
      lesson: cleanOptionalText(input.lesson),
      next_step: cleanOptionalText(input.nextStep),
      tags: input.tags,
      updated_at: new Date().toISOString()
    }).eq("id", reflectionId);
    if (error) throw supabaseError(error);
    await load();
  }, [load]);

  const deleteWellbeingReflection = useCallback(async (reflectionId: string) => {
    const { error } = await supabase.from("wellbeing_reflections").delete().eq("id", reflectionId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      wellbeingReflections: current.wellbeingReflections.filter((reflection) => reflection.id !== reflectionId)
    }));
  }, []);

  const createRewirementChallenge = useCallback(async (input: { practiceKey: string; title: string; description: string; startDate: string; endDate: string | null; status: WellbeingChallengeStatus }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const { error } = await supabase.from("wellbeing_rewirement_challenges").insert({
      user_id: session.user.id,
      practice_key: input.practiceKey,
      title: input.title.trim(),
      description: cleanOptionalText(input.description),
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const updateRewirementChallenge = useCallback(async (challengeId: string, input: { practiceKey: string; title: string; description: string; startDate: string; endDate: string | null; status: WellbeingChallengeStatus }) => {
    const { error } = await supabase.from("wellbeing_rewirement_challenges").update({
      practice_key: input.practiceKey,
      title: input.title.trim(),
      description: cleanOptionalText(input.description),
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status,
      updated_at: new Date().toISOString()
    }).eq("id", challengeId);
    if (error) throw supabaseError(error);
    await load();
  }, [load]);

  const deleteRewirementChallenge = useCallback(async (challengeId: string) => {
    const { error } = await supabase.from("wellbeing_rewirement_challenges").delete().eq("id", challengeId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      wellbeingRewirementChallenges: current.wellbeingRewirementChallenges.filter((challenge) => challenge.id !== challengeId),
      wellbeingRewirementLogs: current.wellbeingRewirementLogs.filter((log) => log.challenge_id !== challengeId)
    }));
  }, []);

  const logRewirementDay = useCallback(async (input: { challengeId: string; logDate: string; completed: boolean; note: string; value: number | null }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const { error } = await supabase.from("wellbeing_rewirement_logs").upsert({
      user_id: session.user.id,
      challenge_id: input.challengeId,
      log_date: input.logDate,
      completed: input.completed,
      note: cleanOptionalText(input.note),
      value: input.value,
      updated_at: new Date().toISOString()
    }, { onConflict: "challenge_id,log_date" });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const saveWellbeingAssessment = useCallback(async (input: { answers: Record<string, number>; summary: string }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const values = Object.values(input.answers).filter((value) => Number.isFinite(value));
    const score = values.length
      ? Math.round((values.reduce((sum, value) => sum + Math.max(1, Math.min(5, value)), 0) / (values.length * 5)) * 100)
      : 0;
    const { error } = await supabase.from("wellbeing_assessments").insert({
      user_id: session.user.id,
      score,
      answers: input.answers,
      summary: cleanOptionalText(input.summary)
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const createWellbeingAffirmation = useCallback(async (input: { text: string; source: WellbeingAffirmationSource; reflectionId: string | null }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const { error } = await supabase.from("wellbeing_affirmations").insert({
      user_id: session.user.id,
      reflection_id: input.reflectionId,
      text: input.text.trim(),
      source: input.source,
      is_active: true
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const toggleWellbeingAffirmation = useCallback(async (affirmationId: string, isActive: boolean) => {
    const { error } = await supabase.from("wellbeing_affirmations").update({
      is_active: isActive,
      updated_at: new Date().toISOString()
    }).eq("id", affirmationId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      wellbeingAffirmations: current.wellbeingAffirmations.map((affirmation) => affirmation.id === affirmationId
        ? { ...affirmation, is_active: isActive, updated_at: new Date().toISOString() }
        : affirmation)
    }));
  }, []);

  const deleteWellbeingAffirmation = useCallback(async (affirmationId: string) => {
    const { error } = await supabase.from("wellbeing_affirmations").delete().eq("id", affirmationId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      wellbeingAffirmations: current.wellbeingAffirmations.filter((affirmation) => affirmation.id !== affirmationId)
    }));
  }, []);

  const saveWellbeingDailyCommitment = useCallback(async (input: { commitmentDate: string; title: string; completed: boolean; note: string }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const title = input.title.trim();
    if (!title) throw new Error("Wpisz jedną rzecz na dziś.");
    const now = new Date().toISOString();
    const { error } = await supabase.from("wellbeing_daily_commitments").upsert({
      user_id: session.user.id,
      commitment_date: input.commitmentDate,
      title,
      completed: input.completed,
      completed_at: input.completed ? now : null,
      note: cleanOptionalText(input.note),
      updated_at: now
    }, { onConflict: "user_id,commitment_date" });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const createWellbeingDiaryEntry = useCallback(async (input: { entryDate: string; body: string }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const body = input.body.trim();
    if (!body) throw new Error("Wpisz krótką informację z dnia.");
    const { error } = await supabase.from("wellbeing_diary_entries").insert({
      user_id: session.user.id,
      entry_date: input.entryDate,
      body
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const deleteWellbeingDiaryEntry = useCallback(async (entryId: string) => {
    const { error } = await supabase.from("wellbeing_diary_entries").delete().eq("id", entryId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      wellbeingDiaryEntries: current.wellbeingDiaryEntries.filter((entry) => entry.id !== entryId)
    }));
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) throw error;
    setState((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== projectId),
      phases: current.phases.filter((phase) => phase.project_id !== projectId),
      tasks: current.tasks.filter((task) => task.project_id !== projectId),
      notes: current.notes.filter((note) => note.project_id !== projectId),
      calendarEntries: current.calendarEntries.map((entry) => entry.project_id === projectId
        ? { ...entry, project_id: null }
        : entry),
      clients: current.clients.map((client) => client.project_id === projectId
        ? { ...client, project_id: null }
        : client),
      businessDesigns: current.businessDesigns.map((design) => design.project_id === projectId
        ? { ...design, project_id: null }
        : design),
      wellbeingGoals: current.wellbeingGoals.map((goal) => goal.project_id === projectId
        ? { ...goal, project_id: null }
        : goal),
      wellbeingReflections: current.wellbeingReflections.map((reflection) => reflection.project_id === projectId
        ? { ...reflection, project_id: null }
        : reflection),
      calendarNotifications: current.calendarNotifications.filter((notification) => {
        const task = current.tasks.find((item) => item.id === notification.task_id);
        return task?.project_id !== projectId;
      })
    }));
  }, []);

  const createBusinessDesign = useCallback(async (input: { title: string; projectId: string | null; canvas: BusinessCanvas; visualMap: BusinessVisualMap; notes: string }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    const row = {
      user_id: session.user.id,
      project_id: input.projectId,
      title: input.title.trim() || "Nowy model biznesowy",
      canvas: input.canvas,
      visual_map: input.visualMap,
      notes: cleanOptionalText(input.notes)
    };
    const { data, error } = await supabase
      .from("business_designs")
      .insert(row)
      .select("*")
      .single();
    if (error) throw supabaseError(error);
    await load();
    return normalizeBusinessDesign(data);
  }, [load, session]);

  const updateBusinessDesign = useCallback(async (designId: string, input: { title: string; projectId: string | null; canvas: BusinessCanvas; visualMap: BusinessVisualMap; notes: string }) => {
    const patch = {
      project_id: input.projectId,
      title: input.title.trim() || "Model biznesowy",
      canvas: input.canvas,
      visual_map: input.visualMap,
      notes: cleanOptionalText(input.notes),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase
      .from("business_designs")
      .update(patch)
      .eq("id", designId);
    if (error) throw supabaseError(error);
    await load();
  }, [load]);

  const deleteBusinessDesign = useCallback(async (designId: string) => {
    const { error } = await supabase.from("business_designs").delete().eq("id", designId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      businessDesigns: current.businessDesigns.filter((design) => design.id !== designId)
    }));
  }, []);

  const createTask = useCallback(async (input: { projectId: string; name: string; dueDate: string; priority: TaskPriority; impact: TaskImpact; area: string; notes: string; assignee: string; recurrence: string }) => {
    const existingPhase = state.phases.find((phase) => phase.project_id === input.projectId);
    let phaseId = existingPhase?.id;

    if (!phaseId) {
      const { data: phase, error: phaseError } = await supabase
        .from("phases")
        .insert({
          project_id: input.projectId,
          name: "General",
          start_date: input.dueDate,
          end_date: input.dueDate,
          order_index: 0
        })
        .select("*")
        .single();

      if (phaseError) throw phaseError;
      phaseId = phase.id;
    }

    const importance = calculateDeadlineImportance({
      due_date: input.dueDate,
      priority: input.priority,
      impact: input.impact
    });

    const taskRow = {
      project_id: input.projectId,
      phase_id: phaseId,
      name: input.name,
      due_date: input.dueDate,
      priority: input.priority,
      impact: input.impact,
      deadline_importance: importance,
      risk_status: riskStatusFromImportance(importance),
      area: cleanOptionalText(input.area),
      notes: cleanOptionalText(input.notes),
      assignee: cleanOptionalText(input.assignee),
      recurrence: cleanOptionalText(input.recurrence) as string | null,
      status: "backlog" as const
    };
    const { error } = await supabase.from("tasks").insert(taskRow);
    if (error && isMissingColumnError(error, "recurrence")) {
      const { recurrence: _r, ...fallbackRow } = taskRow;
      void _r;
      const { error: fallbackError } = await supabase.from("tasks").insert(fallbackRow);
      if (fallbackError) throw fallbackError;
    } else if (error) {
      throw error;
    }
    await load();
  }, [load, state.phases]);

  const deleteTask = useCallback(async (taskId: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
      taskImages: current.taskImages.filter((image) => image.task_id !== taskId),
      calendarNotifications: current.calendarNotifications.filter((notification) => notification.task_id !== taskId)
    }));
  }, []);

  const addTaskImage = useCallback(async (taskId: string, input: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }) => {
    if (!session) throw new Error("Musisz być zalogowany.");
    if (!input.mimeType.startsWith("image/")) throw new Error("Możesz dodać tylko plik graficzny.");
    if (input.sizeBytes > 2 * 1024 * 1024) throw new Error("Zdjęcie może mieć maksymalnie 2 MB.");

    const { error } = await supabase.from("task_images").insert({
      task_id: taskId,
      user_id: session.user.id,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      data_url: input.dataUrl
    });
    if (error) throw supabaseError(error);
    await load();
  }, [load, session]);

  const deleteTaskImage = useCallback(async (imageId: string) => {
    const { error } = await supabase.from("task_images").delete().eq("id", imageId);
    if (error) throw supabaseError(error);
    setState((current) => ({
      ...current,
      taskImages: current.taskImages.filter((image) => image.id !== imageId)
    }));
  }, []);

  const sendTaskNotification = useCallback(async (taskId: string) => {
    const { data, error } = await supabase.functions.invoke("task-calendar-notify", {
      body: {
        taskId,
        sendEmailReminder: true
      }
    });
    if (error) {
      await load();
      throw new Error(await formatFunctionError(error));
    }
    await load();
    return normalizeTaskNotificationResult(data);
  }, [load]);

  const applyProposal = useCallback(async (proposal: CopilotProposal) => {
    const allowedProjectFields = new Set(["name", "color", "status"]);
    const allowedPhaseFields = new Set(["name", "start_date", "end_date", "order_index"]);
    const allowedTaskFields = new Set(["name", "status", "due_date", "priority", "impact", "assignee", "area", "notes"]);

    for (const change of proposal.changes) {
      if (change.entity === "project" && allowedProjectFields.has(change.field)) {
        const { error } = await supabase.from("projects").update({ [change.field]: change.to }).eq("id", change.id);
        if (error) throw error;
      }

      if (change.entity === "phase" && allowedPhaseFields.has(change.field)) {
        const { error } = await supabase.from("phases").update({ [change.field]: change.to }).eq("id", change.id);
        if (error) throw error;
      }

      if (change.entity === "task" && allowedTaskFields.has(change.field)) {
        const task = state.tasks.find((item) => item.id === change.id);
        const patch: Record<string, string | number | null> = { [change.field]: change.to };

        if (task && ["due_date", "priority", "impact"].includes(change.field)) {
          const dueDate = String(change.field === "due_date" ? change.to : task.due_date);
          const priority = String(change.field === "priority" ? change.to : task.priority) as TaskPriority;
          const impact = String(change.field === "impact" ? change.to : task.impact) as TaskImpact;
          const importance = calculateDeadlineImportance({ due_date: dueDate, priority, impact });
          patch.deadline_importance = importance;
          patch.risk_status = riskStatusFromImportance(importance);
        }

        const { error } = await supabase.from("tasks").update(patch).eq("id", change.id);
        if (error) throw error;
      }
    }

    await load();
  }, [load, state.tasks]);

  const metrics = useMemo(() => {
    const activeProjects = state.projects.filter((project) => project.status !== "done").length;
    const doneTasks = state.tasks.filter((task) => task.status === "done").length;
    const progress = state.tasks.length ? Math.round((doneTasks / state.tasks.length) * 100) : 0;
    const riskyTasks = state.tasks.filter((task) => task.risk_status === "risk" || task.risk_status === "blocked").length;
    return { activeProjects, progress, riskyTasks };
  }, [state.projects, state.tasks]);

  return {
    ...state,
    metrics,
    reload: load,
    createFromDraft,
    createProject,
    updateProject,
    updateProjectFinance,
    createClient,
    updateClient,
    deleteClient,
    createNote,
    updateNote,
    deleteNote,
    createCalendarEntry,
    updateCalendarEntry,
    deleteCalendarEntry,
    createWellbeingGoal,
    updateWellbeingGoal,
    deleteWellbeingGoal,
    createWellbeingReflection,
    updateWellbeingReflection,
    deleteWellbeingReflection,
    createRewirementChallenge,
    updateRewirementChallenge,
    deleteRewirementChallenge,
    logRewirementDay,
    saveWellbeingAssessment,
    createWellbeingAffirmation,
    toggleWellbeingAffirmation,
    deleteWellbeingAffirmation,
    saveWellbeingDailyCommitment,
    createWellbeingDiaryEntry,
    deleteWellbeingDiaryEntry,
    deleteProject,
    createBusinessDesign,
    updateBusinessDesign,
    deleteBusinessDesign,
    createTask,
    updateTask,
    updateTaskStatus,
    addTaskImage,
    deleteTaskImage,
    sendTaskNotification,
    deleteTask,
    applyProposal
  };
}

function ensureValidProjectParent({
  projectId,
  parentProjectId,
  projects
}: {
  projectId: string | null;
  parentProjectId: string | null;
  projects: Project[];
}) {
  if (!parentProjectId) return;

  const parentProject = projects.find((project) => project.id === parentProjectId);
  if (!parentProject) {
    throw new Error("Wybrany nadprojekt nie istnieje albo nie jest dostępny.");
  }

  if (projectId && parentProjectId === projectId) {
    throw new Error("Projekt nie może być własnym nadprojektem.");
  }

  let current: Project | undefined = parentProject;
  const visited = new Set<string>();

  while (current?.parent_project_id) {
    if (current.parent_project_id === projectId) {
      throw new Error("Nie można ustawić podprojektu jako nadprojektu, bo utworzyłoby to pętlę w strukturze.");
    }

    if (visited.has(current.parent_project_id)) {
      throw new Error("Struktura projektów zawiera pętlę. Najpierw popraw istniejące powiązania.");
    }

    visited.add(current.parent_project_id);
    current = projects.find((project) => project.id === current?.parent_project_id);
  }
}

function calculateNextDueDate(dueDateStr: string, recurrence: string): string {
  const base = new Date(dueDateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (base <= today) {
    base.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
  }
  switch (recurrence) {
    case "daily": base.setDate(base.getDate() + 1); break;
    case "weekly": base.setDate(base.getDate() + 7); break;
    case "biweekly": base.setDate(base.getDate() + 14); break;
    case "monthly": base.setMonth(base.getMonth() + 1); break;
  }
  return base.toISOString().slice(0, 10);
}

function cleanOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function firstOptionalError(errors: Array<{ message?: string; code?: string } | null>) {
  const error = errors.find((item) => item && !isMissingRelationError(item));
  return error?.message ?? null;
}

function normalizeProjects(value: unknown): Project[] {
  return Array.isArray(value) ? value.map(normalizeProject).filter((project): project is Project => Boolean(project)) : [];
}

function normalizeProject(value: unknown): Project | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const name = textValue(row.name);
  if (!id || !name) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    name,
    color: textValue(row.color) ?? "#57c7ff",
    status: normalizeProjectStatus(row.status),
    tags: textArray(row.tags),
    areas: textArray(row.areas),
    parent_project_id: textValue(row.parent_project_id),
    goal: textValue(row.goal),
    budget: nullableNumberValue(row.budget),
    invoiced: nullableNumberValue(row.invoiced),
    paid: nullableNumberValue(row.paid),
    cost: nullableNumberValue(row.cost),
    currency: textValue(row.currency) ?? "PLN",
    created_at: textValue(row.created_at) ?? new Date().toISOString()
  };
}

function normalizeProjectStatus(value: unknown): ProjectStatus {
  return value === "on_track" ||
    value === "at_risk" ||
    value === "paused" ||
    value === "done"
    ? value
    : "in_progress";
}

function normalizePhases(value: unknown): Phase[] {
  return Array.isArray(value) ? value.map(normalizePhase).filter((phase): phase is Phase => Boolean(phase)) : [];
}

function normalizePhase(value: unknown): Phase | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const projectId = textValue(row.project_id);
  const name = textValue(row.name);
  if (!id || !projectId || !name) return null;
  return {
    id,
    project_id: projectId,
    name,
    start_date: textValue(row.start_date) ?? new Date().toISOString().slice(0, 10),
    end_date: textValue(row.end_date) ?? new Date().toISOString().slice(0, 10),
    order_index: numberValue(row.order_index, 0)
  };
}

function normalizeTasks(value: unknown): Task[] {
  return Array.isArray(value) ? value.map(normalizeTask).filter((task): task is Task => Boolean(task)) : [];
}

function normalizeTask(value: unknown): Task | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const projectId = textValue(row.project_id);
  const phaseId = textValue(row.phase_id);
  const name = textValue(row.name);
  if (!id || !projectId || !phaseId || !name) return null;
  return {
    id,
    phase_id: phaseId,
    project_id: projectId,
    name,
    status: normalizeTaskStatus(row.status),
    due_date: textValue(row.due_date) ?? new Date().toISOString().slice(0, 10),
    priority: normalizeTaskPriority(row.priority),
    impact: normalizeTaskImpact(row.impact),
    deadline_importance: numberValue(row.deadline_importance, 0),
    risk_status: normalizeRiskStatus(row.risk_status),
    area: textValue(row.area),
    assignee: textValue(row.assignee),
    notes: textValue(row.notes),
    recurrence: textValue(row.recurrence),
    completed_at: textValue(row.completed_at),
    created_at: textValue(row.created_at) ?? new Date().toISOString()
  };
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  return value === "in_progress" || value === "review" || value === "done" ? value : "backlog";
}

function normalizeTaskPriority(value: unknown): TaskPriority {
  return value === "low" || value === "high" || value === "critical" ? value : "medium";
}

function normalizeTaskImpact(value: unknown): TaskImpact {
  return value === "low" || value === "high" || value === "strategic" ? value : "medium";
}

function normalizeRiskStatus(value: unknown): RiskStatus {
  return value === "watch" || value === "risk" || value === "blocked" ? value : "none";
}

function normalizeBusinessDesigns(value: unknown) {
  return Array.isArray(value) ? value.map(normalizeBusinessDesign) : [];
}

function normalizeClients(value: unknown): CRMClient[] {
  return Array.isArray(value) ? value.map(normalizeClient).filter((client): client is CRMClient => Boolean(client)) : [];
}

function normalizeProjectNotes(value: unknown): ProjectNote[] {
  return Array.isArray(value) ? value.map(normalizeProjectNote).filter((note): note is ProjectNote => Boolean(note)) : [];
}

function normalizeProjectNote(value: unknown): ProjectNote | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const projectId = textValue(row.project_id);
  const body = textValue(row.body);
  if (!id || !projectId || !body) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    project_id: projectId,
    title: textValue(row.title),
    body,
    category: normalizeProjectNoteCategory(row.category),
    source: normalizeProjectNoteSource(row.source),
    review_status: normalizeProjectNoteReviewStatus(row.review_status),
    summary: textValue(row.summary),
    tags: textArray(row.tags),
    is_urgent: row.is_urgent === true,
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeProjectNoteCategory(value: unknown): ProjectNoteCategory {
  return value === "decision" ||
    value === "idea" ||
    value === "risk" ||
    value === "meeting" ||
    value === "finance" ||
    value === "crm" ||
    value === "task" ||
    value === "research"
    ? value
    : "general";
}

function normalizeProjectNoteSource(value: unknown): ProjectNoteSource {
  return value === "voice" ? "voice" : "written";
}

function normalizeProjectNoteReviewStatus(value: unknown): ProjectNoteReviewStatus {
  return value === "reviewed" || value === "action" ? value : "inbox";
}

function normalizeCalendarEntries(value: unknown): CalendarEntry[] {
  return Array.isArray(value) ? value.map(normalizeCalendarEntry).filter((entry): entry is CalendarEntry => Boolean(entry)) : [];
}

function normalizeCalendarEntry(value: unknown): CalendarEntry | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const title = textValue(row.title);
  const entryDate = textValue(row.entry_date);
  if (!id || !title || !entryDate) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    project_id: textValue(row.project_id),
    kind: normalizeCalendarEntryKind(row.kind),
    title,
    entry_date: entryDate,
    start_time: normalizeTimeValue(row.start_time),
    end_time: normalizeTimeValue(row.end_time),
    is_all_day: row.is_all_day === true,
    location: textValue(row.location),
    notes: textValue(row.notes),
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeCalendarEntryKind(value: unknown): CalendarEntryKind {
  return value === "note" ? "note" : "event";
}

function normalizeTimeValue(value: unknown) {
  const text = textValue(value);
  return text ? text.slice(0, 5) : null;
}

function normalizeWellbeingGoals(value: unknown): WellbeingGoal[] {
  return Array.isArray(value) ? value.map(normalizeWellbeingGoal).filter((goal): goal is WellbeingGoal => Boolean(goal)) : [];
}

function normalizeWellbeingGoal(value: unknown): WellbeingGoal | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const title = textValue(row.title);
  if (!id || !title) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    project_id: textValue(row.project_id),
    title,
    horizon: normalizeWellbeingGoalHorizon(row.horizon),
    status: normalizeWellbeingGoalStatus(row.status),
    description: textValue(row.description),
    success_criteria: textValue(row.success_criteria),
    target_date: textValue(row.target_date),
    tags: textArray(row.tags),
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeWellbeingReflections(value: unknown): WellbeingReflection[] {
  return Array.isArray(value) ? value.map(normalizeWellbeingReflection).filter((reflection): reflection is WellbeingReflection => Boolean(reflection)) : [];
}

function normalizeWellbeingReflection(value: unknown): WellbeingReflection | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  if (!id) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    goal_id: textValue(row.goal_id),
    project_id: textValue(row.project_id),
    entry_date: textValue(row.entry_date) ?? new Date().toISOString().slice(0, 10),
    mood: boundedNullableNumber(row.mood, 1, 5),
    energy: boundedNullableNumber(row.energy, 1, 5),
    gratitude: textValue(row.gratitude),
    wins: textValue(row.wins),
    challenge: textValue(row.challenge),
    lesson: textValue(row.lesson),
    next_step: textValue(row.next_step),
    tags: textArray(row.tags),
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeWellbeingRewirementChallenges(value: unknown): WellbeingRewirementChallenge[] {
  return Array.isArray(value) ? value.map(normalizeWellbeingRewirementChallenge).filter((challenge): challenge is WellbeingRewirementChallenge => Boolean(challenge)) : [];
}

function normalizeWellbeingRewirementChallenge(value: unknown): WellbeingRewirementChallenge | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const title = textValue(row.title);
  if (!id || !title) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    practice_key: textValue(row.practice_key) ?? "gratitude",
    title,
    description: textValue(row.description),
    start_date: textValue(row.start_date) ?? new Date().toISOString().slice(0, 10),
    end_date: textValue(row.end_date),
    status: normalizeWellbeingChallengeStatus(row.status),
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeWellbeingRewirementLogs(value: unknown): WellbeingRewirementLog[] {
  return Array.isArray(value) ? value.map(normalizeWellbeingRewirementLog).filter((log): log is WellbeingRewirementLog => Boolean(log)) : [];
}

function normalizeWellbeingRewirementLog(value: unknown): WellbeingRewirementLog | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const challengeId = textValue(row.challenge_id);
  if (!id || !challengeId) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    challenge_id: challengeId,
    log_date: textValue(row.log_date) ?? new Date().toISOString().slice(0, 10),
    completed: row.completed === true,
    note: textValue(row.note),
    value: boundedNullableNumber(row.value, 0, 100),
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeWellbeingGoalHorizon(value: unknown): WellbeingGoalHorizon {
  return value === "long_term" ? "long_term" : "short_term";
}

function normalizeWellbeingGoalStatus(value: unknown): WellbeingGoalStatus {
  return value === "paused" || value === "done" || value === "archived" ? value : "active";
}

function normalizeWellbeingChallengeStatus(value: unknown): WellbeingChallengeStatus {
  return value === "paused" || value === "done" || value === "archived" ? value : "active";
}

function normalizeWellbeingAssessments(value: unknown): WellbeingAssessment[] {
  return Array.isArray(value) ? value.map(normalizeWellbeingAssessment).filter((assessment): assessment is WellbeingAssessment => Boolean(assessment)) : [];
}

function normalizeWellbeingAssessment(value: unknown): WellbeingAssessment | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  if (!id) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    taken_at: textValue(row.taken_at) ?? new Date().toISOString(),
    score: numberValue(row.score, 0),
    answers: normalizeAssessmentAnswers(row.answers),
    summary: textValue(row.summary),
    created_at: textValue(row.created_at) ?? new Date().toISOString()
  };
}

function normalizeWellbeingAffirmations(value: unknown): WellbeingAffirmation[] {
  return Array.isArray(value) ? value.map(normalizeWellbeingAffirmation).filter((affirmation): affirmation is WellbeingAffirmation => Boolean(affirmation)) : [];
}

function normalizeWellbeingAffirmation(value: unknown): WellbeingAffirmation | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const text = textValue(row.text);
  if (!id || !text) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    reflection_id: textValue(row.reflection_id),
    text,
    source: normalizeWellbeingAffirmationSource(row.source),
    is_active: row.is_active !== false,
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeWellbeingAffirmationSource(value: unknown): WellbeingAffirmationSource {
  return value === "reflection" || value === "assessment" || value === "ebook" ? value : "manual";
}

function normalizeWellbeingDailyCommitments(value: unknown): WellbeingDailyCommitment[] {
  return Array.isArray(value) ? value.map(normalizeWellbeingDailyCommitment).filter((commitment): commitment is WellbeingDailyCommitment => Boolean(commitment)) : [];
}

function normalizeWellbeingDailyCommitment(value: unknown): WellbeingDailyCommitment | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const title = textValue(row.title);
  if (!id || !title) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    commitment_date: textValue(row.commitment_date) ?? new Date().toISOString().slice(0, 10),
    title,
    completed: row.completed === true,
    completed_at: textValue(row.completed_at),
    note: textValue(row.note),
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeWellbeingDiaryEntries(value: unknown): WellbeingDiaryEntry[] {
  return Array.isArray(value) ? value.map(normalizeWellbeingDiaryEntry).filter((entry): entry is WellbeingDiaryEntry => Boolean(entry)) : [];
}

function normalizeWellbeingDiaryEntry(value: unknown): WellbeingDiaryEntry | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const body = textValue(row.body);
  if (!id || !body) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    entry_date: textValue(row.entry_date) ?? new Date().toISOString().slice(0, 10),
    body,
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeAssessmentAnswers(value: unknown) {
  const row = isRecord(value) ? value : {};
  return Object.fromEntries(Object.entries(row)
    .map(([key, answer]) => [key, boundedNullableNumber(answer, 1, 5)])
    .filter((entry): entry is [string, number] => typeof entry[1] === "number"));
}

function normalizeClient(value: unknown): CRMClient | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const company = textValue(row.company);
  if (!id || !company) return null;
  return {
    id,
    user_id: textValue(row.user_id) ?? "",
    project_id: textValue(row.project_id),
    company,
    contact_name: textValue(row.contact_name),
    email: textValue(row.email),
    phone: textValue(row.phone),
    stage: normalizeClientStage(row.stage),
    value: nullableNumberValue(row.value),
    currency: textValue(row.currency) ?? "PLN",
    project_url: textValue(row.project_url),
    repository_url: textValue(row.repository_url),
    next_follow_up: textValue(row.next_follow_up),
    advance_payment: nullableNumberValue(row.advance_payment),
    notes: textValue(row.notes),
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeTaskImages(value: unknown): TaskImage[] {
  return Array.isArray(value)
    ? value.map(normalizeTaskImage).filter((image): image is TaskImage => Boolean(image))
    : [];
}

function normalizeTaskImage(value: unknown): TaskImage | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const taskId = textValue(row.task_id);
  const dataUrl = textValue(row.data_url);
  if (!id || !taskId || !dataUrl) return null;
  return {
    id,
    task_id: taskId,
    user_id: textValue(row.user_id) ?? "",
    file_name: textValue(row.file_name) ?? "zdjecie",
    mime_type: textValue(row.mime_type) ?? "image/jpeg",
    size_bytes: numberValue(row.size_bytes, 0),
    data_url: dataUrl,
    created_at: textValue(row.created_at) ?? new Date().toISOString()
  };
}

function normalizeBusinessDesign(value: unknown): BusinessDesign {
  const row = isRecord(value) ? value : {};
  return {
    id: textValue(row.id) ?? "",
    user_id: textValue(row.user_id) ?? "",
    project_id: textValue(row.project_id),
    title: textValue(row.title) ?? "Model biznesowy",
    canvas: normalizeBusinessCanvas(row.canvas),
    visual_map: normalizeBusinessVisualMap(row.visual_map),
    notes: textValue(row.notes),
    created_at: textValue(row.created_at) ?? new Date().toISOString(),
    updated_at: textValue(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeBusinessVisualMap(value: unknown): BusinessVisualMap {
  const record = isRecord(value) ? value : {};
  const nodes = Array.isArray(record.nodes)
    ? record.nodes.map(normalizeBusinessMapNode).filter((node): node is BusinessMapNode => Boolean(node))
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const links = Array.isArray(record.links)
    ? record.links
      .map(normalizeBusinessMapLink)
      .filter((link): link is BusinessMapLink => link !== null && nodeIds.has(link.from) && nodeIds.has(link.to) && link.from !== link.to)
    : [];
  return { nodes, links };
}

function normalizeBusinessMapNode(value: unknown): BusinessMapNode | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  if (!id) return null;
  return {
    id,
    title: textValue(row.title) ?? "Punkt",
    kind: normalizeBusinessMapNodeKind(row.kind),
    x: numberValue(row.x, 80),
    y: numberValue(row.y, 80),
    notes: textValue(row.notes) ?? ""
  };
}

function normalizeBusinessMapLink(value: unknown): BusinessMapLink | null {
  const row = isRecord(value) ? value : {};
  const id = textValue(row.id);
  const from = textValue(row.from);
  const to = textValue(row.to);
  if (!id || !from || !to) return null;
  return {
    id,
    from,
    to,
    label: textValue(row.label) ?? ""
  };
}

function normalizeBusinessMapNodeKind(value: unknown): BusinessMapNodeKind {
  const kind = textValue(value);
  if (
    kind === "business" ||
    kind === "project" ||
    kind === "area" ||
    kind === "goal" ||
    kind === "task" ||
    kind === "risk" ||
    kind === "segment" ||
    kind === "problem" ||
    kind === "solution" ||
    kind === "channel" ||
    kind === "revenue" ||
    kind === "cost" ||
    kind === "metric" ||
    kind === "experiment" ||
    kind === "note"
  ) {
    return kind;
  }
  return "note";
}

function normalizeClientStage(value: unknown): CRMClientStage {
  const stage = textValue(value);
  if (
    stage === "lead" ||
    stage === "qualified" ||
    stage === "active" ||
    stage === "follow_up" ||
    stage === "paused" ||
    stage === "closed"
  ) {
    return stage;
  }
  return "lead";
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function boundedNullableNumber(value: unknown, min: number, max: number) {
  const parsed = nullableNumberValue(value);
  if (parsed === null) return null;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeBusinessCanvas(value: unknown): BusinessCanvas {
  const record = isRecord(value) ? value : {};
  return {
    customerSegments: textValue(record.customerSegments) ?? "",
    problem: textValue(record.problem) ?? "",
    solution: textValue(record.solution) ?? "",
    uniqueValue: textValue(record.uniqueValue) ?? "",
    channels: textValue(record.channels) ?? "",
    revenue: textValue(record.revenue) ?? "",
    costs: textValue(record.costs) ?? "",
    keyMetrics: textValue(record.keyMetrics) ?? "",
    advantage: textValue(record.advantage) ?? "",
    experiments: textValue(record.experiments) ?? ""
  };
}

function isMissingColumnError(error: { message?: string; code?: string }, column: string) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    message.includes(`'${column}' column`) ||
    message.includes(`column "${column}"`) ||
    message.includes(`column ${column}`)
  );
}

function isMissingAnyColumnError(error: { message?: string; code?: string }, columns: string[]) {
  return columns.some((column) => isMissingColumnError(error, column));
}

function isMissingRelationError(error: { message?: string; code?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("relation") && message.includes("does not exist")
  );
}

function supabaseError(error: { message?: string; details?: string | null; hint?: string | null; code?: string }) {
  const parts = [error.message, error.details, error.hint, error.code ? `Kod: ${error.code}` : null]
    .filter(Boolean);
  return new Error(parts.join(" "));
}

async function formatFunctionError(error: unknown) {
  if (isFunctionHttpError(error)) {
    try {
      const payload = await error.context.clone().json();
      if (isRecord(payload)) {
        const parts = [
          textValue(payload.error),
          payload.status ? `HTTP ${payload.status}` : null,
          textValue(payload.details),
          textValue(payload.hint)
        ].filter(Boolean);

        if (parts.length) return parts.join(" | ");
      }
    } catch {
      // Fall back to the SDK message below.
    }
  }

  if (error instanceof Error) return error.message;
  return "Nie udało się wysłać powiadomienia do Google Calendar.";
}

function isFunctionHttpError(error: unknown): error is { context: Response } {
  return isRecord(error) && error.context instanceof Response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => textValue(item)?.toLowerCase()).filter((item): item is string => Boolean(item))))
    : [];
}

function normalizeTaskNotificationResult(value: unknown) {
  const payload = isRecord(value) ? value : {};
  return {
    ok: payload.ok === true,
    workflow: textValue(payload.workflow) ?? "n8n-google-calendar",
    notificationId: textValue(payload.notificationId),
    requestId: textValue(payload.requestId) ?? textValue(payload.notificationId),
    calendarEventId: textValue(payload.calendarEventId),
    htmlLink: textValue(payload.htmlLink),
    emailMessageId: textValue(payload.emailMessageId)
  };
}
