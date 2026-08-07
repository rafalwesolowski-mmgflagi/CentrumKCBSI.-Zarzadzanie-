import { FormEvent, type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Circle, Clipboard, Download, Flag, Gift, GitBranch, Loader2, Lock, Play, Plus, Save, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import { supabase } from "../lib/supabase";

type MissionPathType = "do_it_now" | "tactical_sprint" | "life_os";
type MissionMode = "guided" | "full";
type MissionStatus = "active" | "paused" | "completed" | "abandoned" | "quick_win";
type StageStatus = "locked" | "pending" | "in_progress" | "passed" | "blocked";

interface MissionProcess {
  id: string;
  name: string;
  version: number;
}

interface ProcessStage {
  id: string;
  process_id: string;
  stage_order: number;
  stage_key: string;
  name: string;
  description: string | null;
  exit_criteria: { requires?: string[] };
}

interface ProcessGate {
  id: string;
  stage_id: string;
  gate_key: string;
  name: string;
  checklist: string[];
}

interface Mission {
  id: string;
  owner_id: string;
  process_id: string;
  title: string;
  raw_goal: string;
  path_type: MissionPathType | null;
  mode: MissionMode;
  status: MissionStatus;
  current_stage_id: string | null;
  resource_profile: Record<string, unknown>;
  gap_score: Record<string, number>;
  ai_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface StageRun {
  id: string;
  mission_id: string;
  stage_id: string;
  status: StageStatus;
  items_total: number;
  items_done: number;
  error_message: string | null;
}

interface MissionTask {
  id: string;
  mission_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  is_micro_step: boolean;
  due_at?: string | null;
  created_at?: string;
}

interface MissionDecision {
  id: string;
  mission_id: string;
  gate_id: string | null;
  decision_type: "approve" | "revise" | "block" | "escalate";
  confidence: number;
  impact: "low" | "medium" | "high";
  reversible: boolean;
  rationale: string;
  created_at: string;
}

interface MissionEvidence {
  id: string;
  decision_id: string;
  content: Record<string, unknown>;
  created_at: string;
}

interface MissionAssumption {
  id: string;
  mission_id: string;
  description: string;
  confidence: number;
  status: "open" | "validated" | "invalidated";
}

interface AiTriageResult {
  path_type: MissionPathType;
  confidence: number;
  reasoning: string;
  cost_hint: string;
}
interface AiCalibrateResult {
  knowledge: number; money: number; time: number;
  people: number; risk: number; execution: number;
  dominant_gap: string;
  reasoning: string;
}
interface AiCritiqueResult {
  weakness_one: string; fallback_one: string;
  weakness_two: string; fallback_two: string;
  critical_assumption: string;
}
interface AiRoadmapResult {
  roadmap: string;
  why_this_shape: string;
  first_gate: string;
}
interface AiMicroStepResult {
  micro_step: string;
  estimated_minutes: number;
  why_this_first: string;
  what_to_have_after: string;
}
interface AiStepSuggestionResult {
  suggestion: string;
  next_action: string;
  fallback: string;
}
interface TransformationContract {
  mental_shift: string;
  reality_shift: string;
  identity_shift: string;
  vision_7_days: string;
  vision_30_days: string;
  vision_90_days: string;
  warning_if_quit: string;
}

const pathLabels: Record<MissionPathType, string> = {
  do_it_now: "DO IT NOW",
  tactical_sprint: "Tactical Sprint",
  life_os: "Life OS"
};

const statusLabels: Record<MissionStatus, string> = {
  active: "aktywna",
  paused: "pauza",
  completed: "ukończona",
  abandoned: "porzucona",
  quick_win: "quick win"
};

export function ExecutionPage() {
  const [process, setProcess] = useState<MissionProcess | null>(null);
  const [stages, setStages] = useState<ProcessStage[]>([]);
  const [gates, setGates] = useState<ProcessGate[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [stageRuns, setStageRuns] = useState<StageRun[]>([]);
  const [tasks, setTasks] = useState<MissionTask[]>([]);
  const [decisions, setDecisions] = useState<MissionDecision[]>([]);
  const [evidences, setEvidences] = useState<MissionEvidence[]>([]);
  const [assumptions, setAssumptions] = useState<MissionAssumption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triagePath, setTriagePath] = useState<MissionPathType>("tactical_sprint");
  const [resourceDraft, setResourceDraft] = useState({
    budget: "",
    time: "",
    people: "",
    skills: "",
    constraints: "",
    advantages: "",
    risks: ""
  });
  const [gapDraft, setGapDraft] = useState({
    knowledge: 5,
    money: 5,
    time: 5,
    people: 5,
    risk: 5,
    execution: 5
  });
  const [strategyDraft, setStrategyDraft] = useState({
    costDeclaration: "",
    assumptionOne: "",
    assumptionTwo: ""
  });
  const [critiqueDraft, setCritiqueDraft] = useState({
    weaknessOne: "",
    fallbackOne: "",
    weaknessTwo: "",
    fallbackTwo: ""
  });
  const [roadmapDraft, setRoadmapDraft] = useState("");
  const [microStepDraft, setMicroStepDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [taskAiLoadingId, setTaskAiLoadingId] = useState<string | null>(null);
  const [transformationLoading, setTransformationLoading] = useState(false);

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedId) ?? missions[0] ?? null,
    [missions, selectedId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const processRes = await supabase
        .from("mission_processes")
        .select("id,name,version")
        .eq("name", "goal_execution")
        .eq("version", 1)
        .single();

      if (processRes.error || !processRes.data) throw processRes.error ?? new Error("Brak definicji procesu goal_execution v1.");

      const processRow = processRes.data as MissionProcess;
      setProcess(processRow);

      const [stagesRes, gatesRes, missionsRes] = await Promise.all([
        supabase
          .from("mission_process_stages")
          .select("id,process_id,stage_order,stage_key,name,description,exit_criteria")
          .eq("process_id", processRow.id)
          .order("stage_order", { ascending: true }),
        supabase
          .from("mission_process_gates")
          .select("id,stage_id,gate_key,name,checklist"),
        supabase
          .from("missions")
          .select("id,owner_id,process_id,title,raw_goal,path_type,mode,status,current_stage_id,resource_profile,gap_score,ai_context,created_at,updated_at")
          .order("updated_at", { ascending: false })
      ]);

      if (stagesRes.error) throw stagesRes.error;
      if (gatesRes.error) throw gatesRes.error;
      if (missionsRes.error) throw missionsRes.error;

      const stageRows = (stagesRes.data ?? []) as ProcessStage[];
      const missionRows = (missionsRes.data ?? []) as Mission[];
      setStages(stageRows);
      setGates((gatesRes.data ?? []) as ProcessGate[]);
      setMissions(missionRows);
      if (!selectedId && missionRows[0]) setSelectedId(missionRows[0].id);

      const missionIds = missionRows.map((mission) => mission.id);
      if (missionIds.length === 0) {
        setStageRuns([]);
        setTasks([]);
        setDecisions([]);
        setEvidences([]);
        setAssumptions([]);
        return;
      }

      const [runsRes, tasksRes, decisionsRes, assumptionsRes] = await Promise.all([
        supabase.from("mission_stage_runs").select("*").in("mission_id", missionIds),
        supabase.from("mission_tasks").select("*").in("mission_id", missionIds).order("created_at", { ascending: true }),
        supabase.from("mission_decisions").select("*").in("mission_id", missionIds).order("created_at", { ascending: false }),
        supabase.from("mission_assumptions").select("*").in("mission_id", missionIds).order("created_at", { ascending: true })
      ]);

      if (runsRes.error) throw runsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (decisionsRes.error) throw decisionsRes.error;
      if (assumptionsRes.error) throw assumptionsRes.error;

      const decisionRows = (decisionsRes.data ?? []) as MissionDecision[];
      const decisionIds = decisionRows.map((decision) => decision.id);
      const evidencesRes = decisionIds.length
        ? await supabase.from("mission_evidence").select("*").in("decision_id", decisionIds).order("created_at", { ascending: true })
        : { data: [], error: null };

      if (evidencesRes.error) throw evidencesRes.error;

      setStageRuns((runsRes.data ?? []) as StageRun[]);
      setTasks((tasksRes.data ?? []) as MissionTask[]);
      setDecisions(decisionRows);
      setEvidences((evidencesRes.data ?? []) as MissionEvidence[]);
      setAssumptions((assumptionsRes.data ?? []) as MissionAssumption[]);
    } catch (loadError) {
      setError(errorMessage(loadError, "Nie udało się wczytać Execution OS."));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createMission(event: FormEvent) {
    event.preventDefault();
    if (!process || stages.length === 0 || !title.trim() || !goal.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Brak aktywnej sesji.");

      const firstStage = stages[0];
      const missionRes = await supabase
        .from("missions")
        .insert({
          owner_id: userId,
          process_id: process.id,
          title: title.trim(),
          raw_goal: goal.trim(),
          current_stage_id: firstStage.id,
          status: "active",
          mode: "guided"
        })
        .select("id")
        .single();

      if (missionRes.error || !missionRes.data) throw missionRes.error ?? new Error("Nie udało się utworzyć Mission.");
      const missionId = missionRes.data.id as string;

      await supabase.from("mission_stage_runs").insert(
        stages.map((stage, index) => ({
          mission_id: missionId,
          stage_id: stage.id,
          status: index === 0 ? "in_progress" : "locked",
          items_total: Array.isArray(stage.exit_criteria?.requires) ? stage.exit_criteria.requires.length : 0,
          items_done: 0,
          started_at: index === 0 ? new Date().toISOString() : null
        }))
      );

      setTitle("");
      setGoal("");
      setShowForm(false);
      setSelectedId(missionId);
      await load();
    } catch (createError) {
      setError(errorMessage(createError, "Nie udało się utworzyć Mission."));
    } finally {
      setSaving(false);
    }
  }

  async function updateMissionMode(mission: Mission, mode: MissionMode) {
    setError(null);
    const { error: updateError } = await supabase.from("missions").update({ mode }).eq("id", mission.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMissions((current) => current.map((item) => item.id === mission.id ? { ...item, mode } : item));
  }

  async function completeCurrentStage(input: {
    mission: Mission;
    stage: ProcessStage;
    evidence: Record<string, unknown>;
    updates?: Partial<Pick<Mission, "path_type" | "status" | "resource_profile" | "gap_score">> & { ai_context?: Record<string, unknown> };
    confidence?: number;
    rationale: string;
    createMicroStep?: string;
    createAssumptions?: Array<{ description: string; confidence: number }>;
  }) {
    setStageSaving(true);
    setError(null);
    try {
      const currentIndex = stages.findIndex((stage) => stage.id === input.stage.id);
      const nextStage = stages[currentIndex + 1] ?? null;
      const gate = gates.find((item) => item.stage_id === input.stage.id) ?? null;
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;

      const decisionRes = await supabase
        .from("mission_decisions")
        .insert({
          mission_id: input.mission.id,
          gate_id: gate?.id ?? null,
          decision_type: "approve",
          confidence: input.confidence ?? 78,
          impact: input.stage.stage_key === "strategy" || input.stage.stage_key === "roadmap" ? "high" : "medium",
          reversible: input.stage.stage_key !== "micro_step",
          owner_id: userId,
          rationale: input.rationale
        })
        .select("id")
        .single();

      if (decisionRes.error || !decisionRes.data) throw decisionRes.error ?? new Error("Nie udało się zapisać decyzji.");

      const evidenceRes = await supabase
        .from("mission_evidence")
        .insert({
          decision_id: decisionRes.data.id,
          content: input.evidence
        });
      if (evidenceRes.error) throw evidenceRes.error;

      const runRes = await supabase
        .from("mission_stage_runs")
        .update({
          status: "passed",
          items_done: selectedRuns.find((run) => run.stage_id === input.stage.id)?.items_total ?? 1,
          error_message: null,
          completed_at: new Date().toISOString()
        })
        .eq("mission_id", input.mission.id)
        .eq("stage_id", input.stage.id);
      if (runRes.error) throw runRes.error;

      if (input.createAssumptions?.length) {
        const assumptionsRes = await supabase.from("mission_assumptions").insert(
          input.createAssumptions.map((assumption) => ({
            mission_id: input.mission.id,
            description: assumption.description,
            confidence: assumption.confidence
          }))
        );
        if (assumptionsRes.error) throw assumptionsRes.error;
      }

      if (input.createMicroStep) {
        const taskRes = await supabase.from("mission_tasks").insert({
          mission_id: input.mission.id,
          stage_id: input.stage.id,
          title: input.createMicroStep,
          status: "todo",
          is_micro_step: true
        });
        if (taskRes.error) throw taskRes.error;
      }

      if (nextStage && input.updates?.status !== "quick_win") {
        const nextRunRes = await supabase
          .from("mission_stage_runs")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString()
          })
          .eq("mission_id", input.mission.id)
          .eq("stage_id", nextStage.id);
        if (nextRunRes.error) throw nextRunRes.error;
      }

      const missionRes = await supabase
        .from("missions")
        .update({
          ...input.updates,
          current_stage_id: input.updates?.status === "quick_win" ? input.stage.id : nextStage?.id ?? input.stage.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", input.mission.id);
      if (missionRes.error) throw missionRes.error;

      await load();
    } catch (stageError) {
      setError(errorMessage(stageError, "Nie udało się zamknąć etapu."));
    } finally {
      setStageSaving(false);
    }
  }

  async function blockCurrentStage(mission: Mission, stage: ProcessStage, errors: string[]) {
    setStageSaving(true);
    setError(null);
    try {
      const gate = gates.find((item) => item.stage_id === stage.id) ?? null;
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      const rationale = `Gate blocked: ${errors.join("; ")}`;

      const decisionRes = await supabase
        .from("mission_decisions")
        .insert({
          mission_id: mission.id,
          gate_id: gate?.id ?? null,
          decision_type: "block",
          confidence: 30,
          impact: "medium",
          reversible: true,
          owner_id: userId,
          rationale
        })
        .select("id")
        .single();

      if (decisionRes.error || !decisionRes.data) throw decisionRes.error ?? new Error("Nie udało się zapisać blokady Gate.");

      const evidenceRes = await supabase
        .from("mission_evidence")
        .insert({
          decision_id: decisionRes.data.id,
          content: {
            stage_key: stage.stage_key,
            blocked_reasons: errors
          }
        });
      if (evidenceRes.error) throw evidenceRes.error;

      const runRes = await supabase
        .from("mission_stage_runs")
        .update({
          status: "blocked",
          error_message: errors.join("\n"),
          updated_at: new Date().toISOString()
        })
        .eq("mission_id", mission.id)
        .eq("stage_id", stage.id);
      if (runRes.error) throw runRes.error;

      setError(rationale);
      await load();
    } catch (blockError) {
      setError(errorMessage(blockError, "Nie udało się zapisać blokady Gate."));
    } finally {
      setStageSaving(false);
    }
  }

  async function reopenBlockedStage(mission: Mission, stage: ProcessStage) {
    setStageSaving(true);
    setError(null);
    try {
      const runRes = await supabase
        .from("mission_stage_runs")
        .update({
          status: "in_progress",
          error_message: null,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("mission_id", mission.id)
        .eq("stage_id", stage.id);
      if (runRes.error) throw runRes.error;

      await load();
    } catch (reopenError) {
      setError(errorMessage(reopenError, "Nie udało się odblokować etapu."));
    } finally {
      setStageSaving(false);
    }
  }

  async function callExecutionAI(action: string, mission: Mission) {
    if (!selectedMission) return;
    setAiLoading(true);
    setAiHint(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("execution-os-ai", {
        body: {
          action,
          raw_goal: mission.raw_goal,
          path_type: action === "roadmap" ? mission.path_type : undefined,
          resource_profile: action !== "triage" ? (mission.resource_profile as Record<string, string>) : undefined,
          gap_score: (action === "critique" || action === "roadmap" || action === "microstep") ? (mission.gap_score as Record<string, number>) : undefined,
          cost_declaration: (action === "critique" || action === "roadmap") ? strategyDraft.costDeclaration : undefined,
          assumptions: (action === "critique" || action === "roadmap")
            ? [
                strategyDraft.assumptionOne,
                strategyDraft.assumptionTwo,
                ...selectedAssumptions.map((assumption) => assumption.description)
              ].filter(Boolean)
            : undefined,
          critique: action === "roadmap" ? {
            weakness_one: critiqueDraft.weaknessOne,
            fallback_one: critiqueDraft.fallbackOne,
            weakness_two: critiqueDraft.weaknessTwo,
            fallback_two: critiqueDraft.fallbackTwo
          } : undefined,
          roadmap: action === "microstep" ? roadmapDraft : undefined,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw new Error(await executionAiErrorMessage(error));

      if (action === "triage" && data) {
        const r = data as AiTriageResult;
        if (r.path_type) setTriagePath(r.path_type);
        setAiHint(`Pewność: ${r.confidence}% — ${r.reasoning}\n💰 ${r.cost_hint}`);
      }
      if (action === "calibrate" && data) {
        const r = data as AiCalibrateResult;
        setGapDraft({
          knowledge: r.knowledge ?? 5,
          money: r.money ?? 5,
          time: r.time ?? 5,
          people: r.people ?? 5,
          risk: r.risk ?? 5,
          execution: r.execution ?? 5,
        });
        setAiHint(r.reasoning);
      }
      if (action === "critique" && data) {
        const r = data as AiCritiqueResult;
        setCritiqueDraft({
          weaknessOne: r.weakness_one ?? "",
          fallbackOne: r.fallback_one ?? "",
          weaknessTwo: r.weakness_two ?? "",
          fallbackTwo: r.fallback_two ?? "",
        });
        setAiHint(`⚠ Najbardziej kruche założenie: ${r.critical_assumption}`);
      }
      if (action === "roadmap" && data) {
        const r = data as AiRoadmapResult;
        setRoadmapDraft(r.roadmap ?? "");
        setAiHint(`${r.why_this_shape}\nPierwsza bramka: ${r.first_gate}`);
      }
      if (action === "microstep" && data) {
        const r = data as AiMicroStepResult;
        setMicroStepDraft(r.micro_step ?? "");
        setAiHint(`⏱ ~${r.estimated_minutes} min — ${r.why_this_first} → ${r.what_to_have_after}`);
      }
    } catch (err) {
      setAiHint(`Błąd AI: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleStageSubmit(mission: Mission, stage: ProcessStage) {
    const gateErrors = validateStage(stage, mission, {
      triagePath,
      resourceDraft,
      gapDraft,
      strategyDraft,
      critiqueDraft,
      roadmapDraft,
      microStepDraft
    });

    if (gateErrors.length > 0) {
      await blockCurrentStage(mission, stage, gateErrors);
      return;
    }

    if (stage.stage_key === "triage") {
      const quickWin = triagePath === "do_it_now";
      await completeCurrentStage({
        mission,
        stage,
        updates: {
          path_type: triagePath,
          status: quickWin ? "quick_win" : "active",
          ai_context: { triage: { cost_acknowledged: true, path_type: triagePath } }
        },
        evidence: { path_type: triagePath, cost_acknowledged: true },
        confidence: quickWin ? 90 : 76,
        rationale: quickWin ? "Cel sklasyfikowany jako szybkie zadanie bez pełnego procesu." : "Cel wymaga procesu i koszt został jawnie zaakceptowany.",
        createMicroStep: quickWin ? mission.raw_goal : undefined
      });
      return;
    }

    if (stage.stage_key === "resources") {
      await completeCurrentStage({
        mission,
        stage,
        updates: { resource_profile: resourceDraft },
        evidence: { resource_profile: resourceDraft },
        confidence: 74,
        rationale: "Diagnoza zasobów zapisana jako profil Mission."
      });
      return;
    }

    if (stage.stage_key === "calibration") {
      await completeCurrentStage({
        mission,
        stage,
        updates: { gap_score: gapDraft },
        evidence: { gap_score: gapDraft, dominant_gap: dominantGap(gapDraft) },
        confidence: 72,
        rationale: `Kalibracja wskazała główny gap: ${dominantGap(gapDraft)}.`
      });
      return;
    }

    if (stage.stage_key === "strategy") {
      await completeCurrentStage({
        mission,
        stage,
        evidence: {
          cost_declaration: strategyDraft.costDeclaration,
          assumptions: [strategyDraft.assumptionOne, strategyDraft.assumptionTwo]
        },
        confidence: 68,
        rationale: "Strategia ma jawny koszt i dwa zapisane założenia.",
        createAssumptions: [strategyDraft.assumptionOne, strategyDraft.assumptionTwo]
          .filter(Boolean)
          .map((description) => ({ description, confidence: 65 }))
      });
      return;
    }

    if (stage.stage_key === "critique") {
      await completeCurrentStage({
        mission,
        stage,
        evidence: critiqueDraft,
        confidence: 70,
        rationale: "Plan przeszedł stress-test z fallbackami dla dwóch słabości."
      });
      return;
    }

    if (stage.stage_key === "roadmap") {
      await completeCurrentStage({
        mission,
        stage,
        evidence: { roadmap: roadmapDraft },
        confidence: 73,
        rationale: "Roadmapa zaakceptowana jako wystarczająca do wygenerowania pierwszego kroku."
      });
      return;
    }

    if (stage.stage_key === "micro_step") {
      await completeCurrentStage({
        mission,
        stage,
        updates: { status: "completed" },
        evidence: { micro_step: microStepDraft },
        confidence: 82,
        rationale: "Mission ma pierwszy krok wykonalny natychmiast.",
        createMicroStep: microStepDraft
      });
    }
  }

  const selectedRuns = useMemo(
    () => stageRuns.filter((run) => run.mission_id === selectedMission?.id),
    [selectedMission?.id, stageRuns]
  );
  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.mission_id === selectedMission?.id),
    [selectedMission?.id, tasks]
  );
  const selectedPlanTasks = useMemo(
    () => selectedTasks.filter((task) => !task.is_micro_step),
    [selectedTasks]
  );
  const selectedDecisions = useMemo(
    () => decisions.filter((decision) => decision.mission_id === selectedMission?.id),
    [selectedMission?.id, decisions]
  );
  const selectedAssumptions = useMemo(
    () => assumptions.filter((assumption) => assumption.mission_id === selectedMission?.id),
    [selectedMission?.id, assumptions]
  );
  const selectedEvidences = useMemo(() => {
    const decisionIds = new Set(selectedDecisions.map((decision) => decision.id));
    return evidences.filter((evidence) => decisionIds.has(evidence.decision_id));
  }, [evidences, selectedDecisions]);
  const selectedPlanDocument = useMemo(() => {
    if (!selectedMission) return "";
    return buildMissionPlanDocument({
      mission: selectedMission,
      stages,
      gates,
      decisions: selectedDecisions,
      evidences: selectedEvidences,
      assumptions: selectedAssumptions,
      tasks: selectedTasks
    });
  }, [gates, selectedAssumptions, selectedDecisions, selectedEvidences, selectedMission, selectedTasks, stages]);
  const selectedTransformationContract = useMemo(() => {
    if (!selectedMission) return null;
    return readTransformationContract(selectedMission.ai_context)
      ?? buildFallbackTransformationContract(selectedMission, selectedPlanTasks);
  }, [selectedMission, selectedPlanTasks]);

  const missionStats = useMemo(() => {
    const active = missions.filter((mission) => mission.status === "active").length;
    const withMicroStep = new Set(tasks.filter((task) => task.is_micro_step && task.status !== "done").map((task) => task.mission_id)).size;
    const blocked = stageRuns.filter((run) => run.status === "blocked").length;
    return { active, withMicroStep, blocked };
  }, [missions, stageRuns, tasks]);

  async function copyPlanDocument() {
    if (!selectedPlanDocument) return;
    setPlanMessage(null);
    try {
      await navigator.clipboard.writeText(selectedPlanDocument);
      setPlanMessage("Plan skopiowany do schowka.");
    } catch {
      setPlanMessage("Nie udało się skopiować planu.");
    }
  }

  function downloadPlanDocument() {
    if (!selectedMission || !selectedPlanDocument) return;
    const blob = new Blob([selectedPlanDocument], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(selectedMission.title)}-plan-dzialania.md`;
    link.click();
    URL.revokeObjectURL(url);
    setPlanMessage("Plan pobrany jako Markdown.");
  }

  async function createSupervisionTasks() {
    if (!selectedMission || selectedPlanTasks.length > 0) return;
    setPlanMessage(null);
    setStageSaving(true);
    try {
      const drafts = buildSupervisionTaskDrafts({
        mission: selectedMission,
        stages,
        gates,
        decisions: selectedDecisions,
        evidences: selectedEvidences
      });
      const roadmapStage = stages.find((stage) => stage.stage_key === "roadmap");
      const { error: taskError } = await supabase.from("mission_tasks").insert(
        drafts.map((draft) => ({
          mission_id: selectedMission.id,
          stage_id: roadmapStage?.id ?? selectedMission.current_stage_id,
          title: draft.title,
          description: serializePlanTaskDescription(draft),
          due_at: draft.dueAt,
          status: "todo",
          is_micro_step: false
        }))
      );
      if (taskError) throw taskError;
      setPlanMessage("Utworzono kroki nadzoru z roadmapy.");
      await load();
    } catch (taskError) {
      setPlanMessage(errorMessage(taskError, "Nie udało się utworzyć kroków nadzoru."));
    } finally {
      setStageSaving(false);
    }
  }

  async function concretizeSupervisionTasks() {
    if (!selectedMission || selectedPlanTasks.length === 0) return;
    setPlanMessage(null);
    setStageSaving(true);
    try {
      const drafts = buildSupervisionTaskDrafts({
        mission: selectedMission,
        stages,
        gates,
        decisions: selectedDecisions,
        evidences: selectedEvidences
      });

      const updates = selectedPlanTasks.map((task, index) => {
        const draft = drafts[index] ?? concreteFallbackTask(selectedMission, index);
        const current = parsePlanTaskDescription(task.description);
        return supabase
          .from("mission_tasks")
          .update({
            title: draft.title,
            due_at: task.due_at ?? draft.dueAt,
            description: serializePlanTaskDescription({
              ...draft,
              reward: current.reward || draft.reward,
              evidence: current.evidence,
              blocker: current.blocker,
              notes: current.notes || draft.notes,
              fallback: current.fallback || draft.fallback
            })
          })
          .eq("id", task.id);
      });

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      setPlanMessage("Ukonkretniono kroki: zadanie, bramka akceptacji i fallback są teraz bardziej wykonawcze.");
      await load();
    } catch (taskError) {
      setPlanMessage(errorMessage(taskError, "Nie udało się ukonkretnić kroków."));
    } finally {
      setStageSaving(false);
    }
  }

  async function addManualPlanTask() {
    if (!selectedMission) return;
    setStageSaving(true);
    setPlanMessage(null);
    try {
      const { error: taskError } = await supabase.from("mission_tasks").insert({
        mission_id: selectedMission.id,
        stage_id: selectedMission.current_stage_id,
        title: "Nowy krok planu",
        description: serializePlanTaskDescription({
          title: "Nowy krok planu",
          gate: "Jasna bramka akceptacji do dopisania.",
          suggestion: "Doprecyzuj najmniejszy następny rezultat.",
          reward: rewardOptions[0],
          dueAt: null,
          evidence: "",
          blocker: "",
          fallback: "Zmniejsz zakres do wersji, którą da się wykonać w 15 minut."
        }),
        status: "todo",
        is_micro_step: false
      });
      if (taskError) throw taskError;
      await load();
    } catch (taskError) {
      setPlanMessage(errorMessage(taskError, "Nie udało się dodać kroku."));
    } finally {
      setStageSaving(false);
    }
  }

  async function updatePlanTask(task: MissionTask, updates: Partial<Pick<MissionTask, "title" | "description" | "status" | "due_at">>) {
    setPlanMessage(null);
    try {
      if (updates.status === "done") {
        const nextDescription = updates.description ?? task.description;
        const details = parsePlanTaskDescription(nextDescription);
        if (!details.evidence.trim()) {
          setPlanMessage("Dodaj dowód wykonania, zanim oznaczysz krok jako gotowy.");
          return;
        }
      }
      const completedUpdate = updates.status === "done"
        ? { completed_at: new Date().toISOString() }
        : updates.status ? { completed_at: null } : {};
      const { error: taskError } = await supabase
        .from("mission_tasks")
        .update({ ...updates, ...completedUpdate })
        .eq("id", task.id);
      if (taskError) throw taskError;
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...updates } : item));
    } catch (taskError) {
      setPlanMessage(errorMessage(taskError, "Nie udało się zapisać kroku."));
    }
  }

  function updatePlanTaskReward(task: MissionTask, reward: string) {
    const details = parsePlanTaskDescription(task.description);
    updatePlanTaskDetails(task, { ...details, reward });
  }

  function updatePlanTaskDetails(task: MissionTask, details: PlanTaskDetails) {
    void updatePlanTask(task, {
      description: serializePlanTaskDescription({
        title: task.title,
        gate: details.gate,
        suggestion: details.suggestion,
        reward: details.reward,
        dueAt: task.due_at ?? null,
        notes: details.notes,
        evidence: details.evidence,
        blocker: details.blocker,
        fallback: details.fallback
      })
    });
  }

  async function callStepSuggestion(task: MissionTask) {
    if (!selectedMission) return;
    const details = parsePlanTaskDescription(task.description);
    setTaskAiLoadingId(task.id);
    setPlanMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("execution-os-ai", {
        body: {
          action: "step_suggestion",
          raw_goal: selectedMission.raw_goal,
          path_type: selectedMission.path_type,
          resource_profile: selectedMission.resource_profile,
          gap_score: selectedMission.gap_score,
          roadmap: selectedPlanDocument,
          task: {
            title: task.title,
            status: task.status,
            due_at: task.due_at,
            gate: details.gate,
            suggestion: details.suggestion,
            blocker: details.blocker,
            fallback: details.fallback,
            evidence: details.evidence
          }
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw new Error(await executionAiErrorMessage(error));
      const result = data as AiStepSuggestionResult;
      updatePlanTaskDetails(task, {
        ...details,
        suggestion: `${result.suggestion} Następny ruch: ${result.next_action}`,
        fallback: result.fallback || details.fallback
      });
      setPlanMessage("AI zaktualizowało sugestię dla kroku.");
    } catch (taskError) {
      setPlanMessage(errorMessage(taskError, "Nie udało się wygenerować sugestii."));
    } finally {
      setTaskAiLoadingId(null);
    }
  }

  async function generateTransformationContract() {
    if (!selectedMission) return;
    setTransformationLoading(true);
    setPlanMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const contractInputTasks = selectedPlanTasks.map((task) => {
        const details = parsePlanTaskDescription(task.description);
        return {
          title: task.title,
          status: task.status,
          due_at: task.due_at,
          gate: details.gate,
          reward: details.reward,
          evidence: details.evidence,
          blocker: details.blocker,
          fallback: details.fallback
        };
      });
      const { data, error } = await supabase.functions.invoke("execution-os-ai", {
        body: {
          action: "transformation_contract",
          raw_goal: selectedMission.raw_goal,
          path_type: selectedMission.path_type,
          resource_profile: selectedMission.resource_profile,
          gap_score: selectedMission.gap_score,
          roadmap: selectedPlanDocument,
          tasks: contractInputTasks
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw new Error(await executionAiErrorMessage(error));
      const contract = normalizeTransformationContract(data);
      const nextContext = {
        ...(selectedMission.ai_context ?? {}),
        transformation_contract: contract
      };
      const { error: updateError } = await supabase
        .from("missions")
        .update({
          ai_context: nextContext,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedMission.id);
      if (updateError) throw updateError;
      setMissions((current) => current.map((mission) => mission.id === selectedMission.id ? { ...mission, ai_context: nextContext } : mission));
      setPlanMessage("Kontrakt przemiany zapisany.");
    } catch (contractError) {
      setPlanMessage(errorMessage(contractError, "Nie udało się wygenerować kontraktu. Pokazuję wersję roboczą."));
    } finally {
      setTransformationLoading(false);
    }
  }

  return (
    <div className="execution-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Execution OS</span>
          <h1>Mission Control</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => setShowForm((current) => !current)}>
          <Plus size={16} />
          Nowa Mission
        </button>
      </header>

      {error && (
        <div className="warning-box">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <section className="metric-grid">
        <Metric icon={<Target />} label="Mission" value={missions.length} />
        <Metric icon={<Play />} label="Aktywne" value={missionStats.active} />
        <Metric icon={<Zap />} label="Micro step" value={missionStats.withMicroStep} />
        <Metric icon={<ShieldCheck />} label="Blokady Gate" value={missionStats.blocked} danger={missionStats.blocked > 0} />
      </section>

      {showForm && (
        <form className="execution-new-mission panel" onSubmit={(event) => void createMission(event)}>
          <div>
            <span className="eyebrow">Nowa Mission</span>
            <h2>Od celu do pierwszego wykonalnego kroku</h2>
          </div>
          <label>
            Nazwa
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="np. Uruchomić ofertę dla gabinetów stomatologicznych" required />
          </label>
          <label>
            Cel w surowej formie
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Napisz, co chcesz osiągnąć. System zacznie od triażu, a nie od generowania planu." required />
          </label>
          <div className="execution-form-actions">
            <button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Anuluj</button>
            <button className="primary-button" disabled={saving || !process || stages.length === 0}>
              {saving ? <Loader2 size={15} className="spin-icon" /> : <Plus size={15} />}
              Utwórz
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state"><Loader2 className="spin-icon" size={20} /> Ładowanie Mission...</div>
      ) : missions.length === 0 ? (
        <div className="execution-empty panel">
          <Target size={34} />
          <h2>Nie ma jeszcze żadnej Mission</h2>
          <p>Utwórz pierwszą, żeby przejść flow Triaż, Diagnoza, Kalibracja, Roadmapa i Micro step.</p>
          <button className="primary-button" type="button" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Start
          </button>
        </div>
      ) : selectedMission && (
        <div className="execution-layout">
          <aside className="execution-list panel">
            <div className="panel-header">
              <h2>Mission</h2>
              <span>{missions.length}</span>
            </div>
            <div className="execution-mission-list">
              {missions.map((mission) => (
                <button
                  className={`execution-mission-card ${mission.id === selectedMission.id ? "active" : ""}`}
                  key={mission.id}
                  type="button"
                  onClick={() => setSelectedId(mission.id)}
                >
                  <strong>{mission.title}</strong>
                  <span>{mission.raw_goal}</span>
                  <div>
                    <StatusPill status={mission.status} />
                    <small>{mission.path_type ? pathLabels[mission.path_type] : "Triaż"}</small>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="execution-workspace">
            <section className="execution-hero panel">
              <div>
                <span className="eyebrow">Aktualna Mission</span>
                <h2>{selectedMission.title}</h2>
                <p>{selectedMission.raw_goal}</p>
              </div>
              <div className="execution-hero-actions">
                <div className="segmented-control">
                  <button className={selectedMission.mode === "guided" ? "active" : ""} type="button" onClick={() => void updateMissionMode(selectedMission, "guided")}>
                    Prowadzony
                  </button>
                  <button className={selectedMission.mode === "full" ? "active" : ""} type="button" onClick={() => void updateMissionMode(selectedMission, "full")}>
                    Pełny
                  </button>
                </div>
                <StatusPill status={selectedMission.status} />
              </div>
            </section>

            <section className={`execution-plan panel ${selectedMission.status === "completed" ? "completed" : ""}`}>
              <div className="panel-header">
                <h2><Clipboard size={16} />Plan działania</h2>
                <span>{selectedMission.status === "completed" ? "gotowy" : "roboczy"}</span>
              </div>
              <p>
                Dokument z procesu: cel, decyzje, zasoby, gap, założenia, roadmapa, kamienie milowe, terminy i pierwszy krok.
              </p>
              <pre>{selectedPlanDocument}</pre>
              {planMessage && <small>{planMessage}</small>}
              <div className="execution-plan-actions">
                <button type="button" className="secondary-button" onClick={() => void copyPlanDocument()}>
                  <Clipboard size={15} />
                  Kopiuj plan
                </button>
                <button type="button" className="primary-button" onClick={downloadPlanDocument}>
                  <Download size={15} />
                  Pobierz Markdown
                </button>
              </div>
            </section>

            {selectedTransformationContract && (
              <TransformationContractPanel
                contract={selectedTransformationContract}
                loading={transformationLoading}
                saved={Boolean(readTransformationContract(selectedMission.ai_context))}
                onGenerate={() => void generateTransformationContract()}
              />
            )}

            <section className="execution-supervision panel">
              <div className="panel-header">
                <h2><Target size={16} />Nadzór wykonania</h2>
                <span>{selectedPlanTasks.length || "0"}</span>
              </div>
              <p>Edytowalne kroki z terminami, bramką akceptacji, sugestią i nagrodą za domknięcie etapu.</p>
              <div className="execution-plan-actions">
                <button type="button" className="secondary-button" disabled={stageSaving || selectedPlanTasks.length > 0} onClick={() => void createSupervisionTasks()}>
                  <GitBranch size={15} />
                  Utwórz kroki z roadmapy
                </button>
                <button type="button" className="secondary-button" disabled={stageSaving || selectedPlanTasks.length === 0} onClick={() => void concretizeSupervisionTasks()}>
                  <Target size={15} />
                  Ukonkretnij kroki
                </button>
                <button type="button" className="secondary-button" disabled={stageSaving} onClick={() => void addManualPlanTask()}>
                  <Plus size={15} />
                  Dodaj krok
                </button>
              </div>
              {selectedPlanTasks.length ? (
                <div className="execution-supervision-list">
                  {selectedPlanTasks.map((task, index) => (
                    <PlanTaskEditor
                      key={task.id}
                      index={index}
                      task={task}
                      onUpdate={(updates) => void updatePlanTask(task, updates)}
                      onRewardChange={(reward) => updatePlanTaskReward(task, reward)}
                      onDetailsChange={(details) => updatePlanTaskDetails(task, details)}
                      onSuggest={() => void callStepSuggestion(task)}
                      suggesting={taskAiLoadingId === task.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="execution-prompt">
                  <strong>Brak kroków nadzoru</strong>
                  <span>Utwórz je z roadmapy, żeby Mission miała dalszy rytm: co robić, do kiedy, po czym poznać gotowość i czym nagrodzić etap.</span>
                </div>
              )}
            </section>

            <div className="execution-three-column">
              <section className="execution-tree panel">
                <div className="panel-header">
                  <h2><GitBranch size={16} />Proces</h2>
                  <span>{stages.length}</span>
                </div>
                <div className="execution-stage-list">
                  {stages.map((stage) => {
                    const run = selectedRuns.find((item) => item.stage_id === stage.id);
                    const lockedByMode = selectedMission.mode === "guided" && run?.status === "locked";
                    return (
                      <div className={`execution-stage ${run?.status ?? "locked"} ${lockedByMode ? "dimmed" : ""}`} key={stage.id}>
                        <StageIcon status={run?.status ?? "locked"} />
                        <div>
                          <strong>{stage.stage_order}. {stage.name}</strong>
                          <span>{stage.description}</span>
                          {run?.error_message && <small>{run.error_message}</small>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="execution-conversation panel">
                <span className="eyebrow">Workspace</span>
                <h2>{currentStage(stages, selectedMission)?.name ?? "Proces"}</h2>
                {currentStage(stages, selectedMission) ? (
                  <StageWorkspace
                    stage={currentStage(stages, selectedMission)!}
                    mission={selectedMission}
                    run={selectedRuns.find((item) => item.stage_id === currentStage(stages, selectedMission)!.id) ?? null}
                    triagePath={triagePath}
                    setTriagePath={setTriagePath}
                    resourceDraft={resourceDraft}
                    setResourceDraft={setResourceDraft}
                    gapDraft={gapDraft}
                    setGapDraft={setGapDraft}
                    strategyDraft={strategyDraft}
                    setStrategyDraft={setStrategyDraft}
                    critiqueDraft={critiqueDraft}
                    setCritiqueDraft={setCritiqueDraft}
                    assumptions={selectedAssumptions}
                    roadmapDraft={roadmapDraft}
                    setRoadmapDraft={setRoadmapDraft}
                    microStepDraft={microStepDraft}
                    setMicroStepDraft={setMicroStepDraft}
                    saving={stageSaving}
                    aiLoading={aiLoading}
                    aiHint={aiHint}
                    onAi={(action) => { setAiHint(null); void callExecutionAI(action, selectedMission); }}
                    onSubmit={() => { setAiHint(null); void handleStageSubmit(selectedMission, currentStage(stages, selectedMission)!); }}
                    onReopen={() => void reopenBlockedStage(selectedMission, currentStage(stages, selectedMission)!)}
                  />
                ) : (
                  <p>Brak aktywnego etapu dla tej Mission.</p>
                )}
              </section>

              <aside className="execution-context panel">
                <ContextBlock title="Aktualny micro step" empty="Jeszcze nie wygenerowany.">
                  {selectedTasks.filter((task) => task.is_micro_step && task.status !== "done").map((task) => (
                    <div className="execution-context-row" key={task.id}>
                      <Zap size={14} />
                      <span>{task.title}</span>
                    </div>
                  ))}
                </ContextBlock>

                <ContextBlock title="Decision log" empty="Brak decyzji.">
                  {selectedDecisions.slice(0, 4).map((decision) => (
                    <div className="execution-context-row" key={decision.id}>
                      <ShieldCheck size={14} />
                      <span>{decision.decision_type} · {decision.confidence}% · {decision.rationale}</span>
                    </div>
                  ))}
                </ContextBlock>

                <ContextBlock title="Assumptions" empty="Brak założeń.">
                  {selectedAssumptions.slice(0, 4).map((assumption) => (
                    <div className="execution-context-row" key={assumption.id}>
                      <Flag size={14} />
                      <span>{assumption.description} · {assumption.confidence}%</span>
                    </div>
                  ))}
                </ContextBlock>
              </aside>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

function currentStage(stages: ProcessStage[], mission: Mission) {
  return stages.find((stage) => stage.id === mission.current_stage_id) ?? stages[0] ?? null;
}

function Metric({ icon, label, value, danger = false }: { icon: JSX.Element; label: string; value: string | number; danger?: boolean }) {
  return (
    <div className={`metric-card ${danger ? "danger" : ""}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: MissionStatus }) {
  return <span className={`status-pill ${status}`}>{statusLabels[status]}</span>;
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "passed") return <CheckCircle2 size={17} />;
  if (status === "in_progress") return <Play size={17} />;
  if (status === "blocked") return <AlertTriangle size={17} />;
  if (status === "locked") return <Lock size={17} />;
  return <Circle size={17} />;
}

interface StageWorkspaceProps {
  stage: ProcessStage;
  mission: Mission;
  run: StageRun | null;
  triagePath: MissionPathType;
  setTriagePath: Dispatch<SetStateAction<MissionPathType>>;
  resourceDraft: {
    budget: string;
    time: string;
    people: string;
    skills: string;
    constraints: string;
    advantages: string;
    risks: string;
  };
  setResourceDraft: Dispatch<SetStateAction<StageWorkspaceProps["resourceDraft"]>>;
  gapDraft: Record<"knowledge" | "money" | "time" | "people" | "risk" | "execution", number>;
  setGapDraft: Dispatch<SetStateAction<StageWorkspaceProps["gapDraft"]>>;
  strategyDraft: {
    costDeclaration: string;
    assumptionOne: string;
    assumptionTwo: string;
  };
  setStrategyDraft: Dispatch<SetStateAction<StageWorkspaceProps["strategyDraft"]>>;
  critiqueDraft: {
    weaknessOne: string;
    fallbackOne: string;
    weaknessTwo: string;
    fallbackTwo: string;
  };
  setCritiqueDraft: Dispatch<SetStateAction<StageWorkspaceProps["critiqueDraft"]>>;
  assumptions: MissionAssumption[];
  roadmapDraft: string;
  setRoadmapDraft: Dispatch<SetStateAction<string>>;
  microStepDraft: string;
  setMicroStepDraft: Dispatch<SetStateAction<string>>;
  saving: boolean;
  aiLoading: boolean;
  aiHint: string | null;
  onAi: (action: string) => void;
  onSubmit: () => void;
  onReopen: () => void;
}

function AiHintBox({ hint, loading }: { hint: string | null; loading: boolean }) {
  if (!loading && !hint) return null;
  return (
    <div style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)", borderRadius: 8, padding: "0.625rem 0.75rem", fontSize: "0.8125rem", lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--text)", marginBottom: "0.75rem" }}>
      {loading
        ? <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: 0.7 }}><Loader2 size={14} className="spin-icon" /> AI analizuje…</span>
        : <span><Bot size={13} style={{ opacity: 0.6, marginRight: "0.375rem", verticalAlign: "middle" }} />{hint}</span>}
    </div>
  );
}

function StageWorkspace(props: StageWorkspaceProps) {
  const { stage, mission, saving, aiLoading, aiHint, onAi, onSubmit } = props;
  const required = stage.exit_criteria?.requires ?? [];

  if (mission.status === "quick_win") {
    return (
      <div className="execution-prompt">
        <strong>Quick win zapisany</strong>
        <span>Ta Mission została zamknięta jako DO IT NOW. Micro step jest w prawej kolumnie.</span>
      </div>
    );
  }

  if (stage.stage_key === "triage") {
    return (
      <form className="execution-stage-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <GateError run={props.run} saving={saving} onReopen={props.onReopen} />
        <p>Wybierz architekturę działania. To jest pierwsza decyzja jakościowa, nie kosmetyka planu.</p>
        <AiHintBox hint={aiHint} loading={aiLoading} />
        <label>
          Wynik triażu
          <select value={props.triagePath} onChange={(event) => props.setTriagePath(event.target.value as MissionPathType)}>
            <option value="do_it_now">DO IT NOW — zadanie do 20 minut</option>
            <option value="tactical_sprint">Tactical Sprint — umiarkowana złożoność</option>
            <option value="life_os">Life OS — wysoka stawka / trwała zmiana</option>
          </select>
        </label>
        <GateChecklist items={required} />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="secondary-button" disabled={aiLoading || saving} onClick={() => onAi("triage")}>
            {aiLoading ? <Loader2 size={14} className="spin-icon" /> : <Bot size={14} />}
            AI klasyfikuj cel
          </button>
          <button className="primary-button" disabled={saving || aiLoading}>
            {saving ? <Loader2 size={15} className="spin-icon" /> : <ShieldCheck size={15} />}
            Zapisz Decision i przejdź
          </button>
        </div>
      </form>
    );
  }

  if (stage.stage_key === "resources") {
    return (
      <form className="execution-stage-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <GateError run={props.run} saving={saving} onReopen={props.onReopen} />
        <p>Diagnoza jest formularzem, bo kolejne bramki muszą mieć twarde dane do porównania.</p>
        <div className="execution-form-grid">
          {Object.entries(props.resourceDraft).map(([key, value]) => (
            <label key={key}>
              {resourceLabels[key as keyof typeof resourceLabels]}
              <textarea
                value={value}
                onChange={(event) => props.setResourceDraft((current) => ({ ...current, [key]: event.target.value }))}
                required
              />
            </label>
          ))}
        </div>
        <GateChecklist items={required} />
        <button className="primary-button" disabled={saving || Object.values(props.resourceDraft).some((value) => !value.trim())}>
          {saving ? <Loader2 size={15} className="spin-icon" /> : <Save size={15} />}
          Zapisz zasoby
        </button>
      </form>
    );
  }

  if (stage.stage_key === "calibration") {
    return (
      <form className="execution-stage-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <GateError run={props.run} saving={saving} onReopen={props.onReopen} />
        <p>Gap jest wektorem. Najwyższy wymiar pokazuje wąskie gardło strategii.</p>
        <AiHintBox hint={aiHint} loading={aiLoading} />
        <div className="execution-gap-grid">
          {Object.entries(props.gapDraft).map(([key, value]) => (
            <label key={key}>
              <span>{gapLabels[key as keyof typeof gapLabels]}: <strong>{value}/10</strong></span>
              <input
                type="range"
                min="0"
                max="10"
                value={value}
                onChange={(event) => props.setGapDraft((current) => ({ ...current, [key]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div className="execution-prompt">
          <strong>Dominujący gap: {dominantGap(props.gapDraft)}</strong>
          <span>Ten wymiar powinien determinować skrócenie, rozszerzenie albo dodanie etapu.</span>
        </div>
        <GateChecklist items={required} />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="secondary-button" disabled={aiLoading || saving} onClick={() => onAi("calibrate")}>
            {aiLoading ? <Loader2 size={14} className="spin-icon" /> : <Bot size={14} />}
            AI kalibruj gap
          </button>
          <button className="primary-button" disabled={saving || aiLoading}>
            {saving ? <Loader2 size={15} className="spin-icon" /> : <ShieldCheck size={15} />}
            Zapisz kalibrację
          </button>
        </div>
      </form>
    );
  }

  if (stage.stage_key === "strategy") {
    return (
      <form className="execution-stage-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <GateError run={props.run} saving={saving} onReopen={props.onReopen} />
        <p>Strategia musi mieć koszt i założenia. Bez tego nie wiemy, co później mogło się unieważnić.</p>
        <label>
          Deklaracja kosztu
          <textarea value={props.strategyDraft.costDeclaration} onChange={(event) => props.setStrategyDraft((current) => ({ ...current, costDeclaration: event.target.value }))} required />
        </label>
        <div className="execution-form-grid two">
          <label>
            Założenie 1
            <textarea value={props.strategyDraft.assumptionOne} onChange={(event) => props.setStrategyDraft((current) => ({ ...current, assumptionOne: event.target.value }))} required />
          </label>
          <label>
            Założenie 2
            <textarea value={props.strategyDraft.assumptionTwo} onChange={(event) => props.setStrategyDraft((current) => ({ ...current, assumptionTwo: event.target.value }))} required />
          </label>
        </div>
        <GateChecklist items={required} />
        <button className="primary-button" disabled={saving || !props.strategyDraft.costDeclaration.trim() || !props.strategyDraft.assumptionOne.trim() || !props.strategyDraft.assumptionTwo.trim()}>
          {saving ? <Loader2 size={15} className="spin-icon" /> : <ShieldCheck size={15} />}
          Zapisz strategię
        </button>
      </form>
    );
  }

  if (stage.stage_key === "critique") {
    return (
      <form className="execution-stage-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <GateError run={props.run} saving={saving} onReopen={props.onReopen} />
        <p>Moduł Krytyki wymusza minimum dwie słabości i fallback dla każdej.</p>
        <AiHintBox hint={aiHint} loading={aiLoading} />
        <div className="execution-form-grid two">
          <label>Słabość 1<textarea value={props.critiqueDraft.weaknessOne} onChange={(event) => props.setCritiqueDraft((current) => ({ ...current, weaknessOne: event.target.value }))} required /></label>
          <label>Fallback 1<textarea value={props.critiqueDraft.fallbackOne} onChange={(event) => props.setCritiqueDraft((current) => ({ ...current, fallbackOne: event.target.value }))} required /></label>
          <label>Słabość 2<textarea value={props.critiqueDraft.weaknessTwo} onChange={(event) => props.setCritiqueDraft((current) => ({ ...current, weaknessTwo: event.target.value }))} required /></label>
          <label>Fallback 2<textarea value={props.critiqueDraft.fallbackTwo} onChange={(event) => props.setCritiqueDraft((current) => ({ ...current, fallbackTwo: event.target.value }))} required /></label>
        </div>
        <GateChecklist items={required} />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="secondary-button" disabled={aiLoading || saving} onClick={() => onAi("critique")}>
            {aiLoading ? <Loader2 size={14} className="spin-icon" /> : <Bot size={14} />}
            AI krytykuj plan
          </button>
          <button className="primary-button" disabled={saving || aiLoading || Object.values(props.critiqueDraft).some((value) => !value.trim())}>
            {saving ? <Loader2 size={15} className="spin-icon" /> : <ShieldCheck size={15} />}
            Zapisz krytykę
          </button>
        </div>
      </form>
    );
  }

  if (stage.stage_key === "roadmap") {
    const roadmapSkeleton = buildRoadmapSkeleton({
      mission,
      gapDraft: props.gapDraft,
      strategyDraft: props.strategyDraft,
      critiqueDraft: props.critiqueDraft,
      assumptions: props.assumptions
    });
    return (
      <form className="execution-stage-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <GateError run={props.run} saving={saving} onReopen={props.onReopen} />
        <p>Na tym etapie system powinien już prowadzić: roadmapa ma wynikać z celu, zasobów, gapu, kosztu i krytyki.</p>
        <RoadmapGuidance
          mission={mission}
          gapDraft={props.gapDraft}
          strategyDraft={props.strategyDraft}
          critiqueDraft={props.critiqueDraft}
          assumptions={props.assumptions}
          onUseSkeleton={() => props.setRoadmapDraft(roadmapSkeleton)}
        />
        <AiHintBox hint={aiHint} loading={aiLoading} />
        <label>
          Roadmapa
          <textarea value={props.roadmapDraft} onChange={(event) => props.setRoadmapDraft(event.target.value)} required />
        </label>
        <GateChecklist items={required} />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="secondary-button" disabled={aiLoading || saving} onClick={() => onAi("roadmap")}>
            {aiLoading ? <Loader2 size={14} className="spin-icon" /> : <Bot size={14} />}
            AI ułóż roadmapę
          </button>
          <button className="primary-button" disabled={saving || aiLoading || !props.roadmapDraft.trim()}>
            {saving ? <Loader2 size={15} className="spin-icon" /> : <ShieldCheck size={15} />}
            Akceptuj roadmapę
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="execution-stage-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <GateError run={props.run} saving={saving} onReopen={props.onReopen} />
      <p>Kończymy planowanie jednym krokiem wykonalnym natychmiast, bez dodatkowych zależności.</p>
      <AiHintBox hint={aiHint} loading={aiLoading} />
      <label>
        Śmiesznie Mały Krok
        <textarea value={props.microStepDraft} onChange={(event) => props.setMicroStepDraft(event.target.value)} required />
      </label>
      <GateChecklist items={required} />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" className="secondary-button" disabled={aiLoading || saving} onClick={() => onAi("microstep")}>
          {aiLoading ? <Loader2 size={14} className="spin-icon" /> : <Bot size={14} />}
          AI wygeneruj krok
        </button>
        <button className="primary-button" disabled={saving || aiLoading || !props.microStepDraft.trim()}>
          {saving ? <Loader2 size={15} className="spin-icon" /> : <Zap size={15} />}
          Zapisz micro step
        </button>
      </div>
    </form>
  );
}

function TransformationContractPanel({
  contract,
  loading,
  saved,
  onGenerate
}: {
  contract: TransformationContract;
  loading: boolean;
  saved: boolean;
  onGenerate: () => void;
}) {
  const timeline = [
    { label: "Teraz", text: "Widzisz napięcie między wieloma możliwościami a jednym kierunkiem." },
    { label: "Pierwszy dowód", text: contract.vision_7_days },
    { label: "Stabilizacja", text: contract.vision_30_days },
    { label: "Nowa normalność", text: contract.vision_90_days }
  ];

  return (
    <section className="execution-transformation panel">
      <div className="panel-header">
        <h2><Sparkles size={16} />Kontrakt przemiany</h2>
        <span>{saved ? "zapisany" : "roboczy"}</span>
      </div>
      <p>Spokojny obraz tego, co wzmacniasz przez konsekwencję: mentalnie, operacyjnie i w codziennej rzeczywistości.</p>
      <div className="execution-transformation-timeline">
        {timeline.map((item) => (
          <div key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
      <div className="execution-transformation-grid">
        <div>
          <strong>Jak zmieni się moje myślenie</strong>
          <span>{contract.mental_shift}</span>
        </div>
        <div>
          <strong>Jak zmieni się moja rzeczywistość</strong>
          <span>{contract.reality_shift}</span>
        </div>
        <div>
          <strong>Jaka tożsamość będzie silniejsza</strong>
          <span>{contract.identity_shift}</span>
        </div>
        <div className="warning">
          <strong>Jeśli odpuszczę</strong>
          <span>{contract.warning_if_quit}</span>
        </div>
      </div>
      <button type="button" className="secondary-button" disabled={loading} onClick={onGenerate}>
        {loading ? <Loader2 size={15} className="spin-icon" /> : <Bot size={15} />}
        {saved ? "Odśwież kontrakt AI" : "Wygeneruj kontrakt AI"}
      </button>
    </section>
  );
}

function RoadmapGuidance({
  mission,
  gapDraft,
  strategyDraft,
  critiqueDraft,
  assumptions,
  onUseSkeleton
}: {
  mission: Mission;
  gapDraft: StageWorkspaceProps["gapDraft"];
  strategyDraft: StageWorkspaceProps["strategyDraft"];
  critiqueDraft: StageWorkspaceProps["critiqueDraft"];
  assumptions: MissionAssumption[];
  onUseSkeleton: () => void;
}) {
  const resourceProfile = mission.resource_profile as Record<string, string>;
  const storedGap = mission.gap_score as Record<string, number>;
  const gap = Object.keys(storedGap ?? {}).length ? storedGap : gapDraft;
  const gapKey = dominantGap(gap);
  const assumptionTexts = assumptions.length
    ? assumptions.map((assumption) => assumption.description)
    : [strategyDraft.assumptionOne, strategyDraft.assumptionTwo].filter(Boolean);
  const critiqueTexts = [
    critiqueDraft.weaknessOne ? `Słabość: ${critiqueDraft.weaknessOne}` : "",
    critiqueDraft.fallbackOne ? `Fallback: ${critiqueDraft.fallbackOne}` : "",
    critiqueDraft.weaknessTwo ? `Słabość: ${critiqueDraft.weaknessTwo}` : "",
    critiqueDraft.fallbackTwo ? `Fallback: ${critiqueDraft.fallbackTwo}` : ""
  ].filter(Boolean);

  const items = [
    `Cel: ${mission.raw_goal}`,
    `Ścieżka: ${mission.path_type ? pathLabels[mission.path_type] : "jeszcze nieustalona"}`,
    `Największy gap: ${gapLabels[gapKey as keyof typeof gapLabels] ?? gapKey}`,
    resourceProfile.time ? `Czas: ${resourceProfile.time}` : "",
    resourceProfile.constraints ? `Ograniczenia: ${resourceProfile.constraints}` : "",
    strategyDraft.costDeclaration ? `Koszt: ${strategyDraft.costDeclaration}` : "",
    assumptionTexts.length ? `Założenia: ${assumptionTexts.join("; ")}` : "",
    critiqueTexts.length ? critiqueTexts.join(" | ") : ""
  ].filter(Boolean);

  return (
    <div className="execution-roadmap-guide">
      <div>
        <strong>Podpowiedzi z poprzednich kroków</strong>
        <button type="button" className="secondary-button" onClick={onUseSkeleton}>
          <GitBranch size={14} />
          Wstaw szkielet
        </button>
      </div>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function buildRoadmapSkeleton({
  mission,
  gapDraft,
  strategyDraft,
  critiqueDraft,
  assumptions
}: {
  mission: Mission;
  gapDraft: StageWorkspaceProps["gapDraft"];
  strategyDraft: StageWorkspaceProps["strategyDraft"];
  critiqueDraft: StageWorkspaceProps["critiqueDraft"];
  assumptions: MissionAssumption[];
}) {
  const resourceProfile = mission.resource_profile as Record<string, string>;
  const storedGap = mission.gap_score as Record<string, number>;
  const gap = Object.keys(storedGap ?? {}).length ? storedGap : gapDraft;
  const gapKey = dominantGap(gap);
  const gapLabel = gapLabels[gapKey as keyof typeof gapLabels] ?? gapKey;
  const assumptionTexts = assumptions.length
    ? assumptions.map((assumption) => assumption.description)
    : [strategyDraft.assumptionOne, strategyDraft.assumptionTwo].filter(Boolean);
  const firstAssumption = assumptionTexts[0] ?? "najbardziej ryzykowne założenie z poprzednich etapów";
  const mainWeakness = critiqueDraft.weaknessOne || critiqueDraft.weaknessTwo || resourceProfile.risks || "największe ryzyko z diagnozy";
  const fallback = critiqueDraft.fallbackOne || critiqueDraft.fallbackTwo || "uprościć zakres do najmniejszego testu";

  return [
    `1. Urealnij zakres — rezultat: minimalny wariant celu "${mission.raw_goal}"; bramka: zakres da się zacząć bez nowych zależności; zależność/ryzyko: ${resourceProfile.constraints || "niejasne ograniczenia"}.`,
    `2. Domknij gap "${gapLabel}" — rezultat: konkretna decyzja lub brakujący zasób dla tego gapu; bramka: wiadomo, co blokuje wykonanie i jak to obejść; zależność/ryzyko: ${mainWeakness}.`,
    `3. Sprawdź założenie — rezultat: szybki test założenia "${firstAssumption}"; bramka: założenie jest potwierdzone albo uruchamiasz fallback; zależność/ryzyko: koszt musi pozostać zgodny z deklaracją "${strategyDraft.costDeclaration || "brak zapisanej deklaracji"}".`,
    `4. Wykonaj pierwszy dowód działania — rezultat: mały artefakt, kontakt, szkic lub decyzja; bramka: po nim da się wygenerować Śmiesznie Mały Krok; fallback: ${fallback}.`
  ].join("\n");
}

function PlanTaskEditor({
  task,
  index,
  onUpdate,
  onRewardChange,
  onDetailsChange,
  onSuggest,
  suggesting
}: {
  task: MissionTask;
  index: number;
  onUpdate: (updates: Partial<Pick<MissionTask, "title" | "description" | "status" | "due_at">>) => void;
  onRewardChange: (reward: string) => void;
  onDetailsChange: (details: PlanTaskDetails) => void;
  onSuggest: () => void;
  suggesting: boolean;
}) {
  const details = parsePlanTaskDescription(task.description);
  const currentReward = rewardOptions.includes(details.reward) ? details.reward : rewardOptions[0];
  const isBlocked = Boolean(details.blocker.trim());
  const rewardUnlocked = task.status === "done" && Boolean(details.evidence.trim());

  return (
    <article className={`execution-supervision-item ${task.status} ${isBlocked ? "blocked" : ""}`}>
      <div className="execution-supervision-top">
        <span>{index + 1}</span>
        <div className="execution-supervision-top-actions">
          <button type="button" className="secondary-button" disabled={suggesting} onClick={onSuggest}>
            {suggesting ? <Loader2 size={14} className="spin-icon" /> : <Bot size={14} />}
            Sugestia
          </button>
          <select value={task.status} onChange={(event) => onUpdate({ status: event.target.value as MissionTask["status"] })}>
            <option value="todo">Do zrobienia</option>
            <option value="in_progress">W toku</option>
            <option value="done">Gotowe</option>
          </select>
        </div>
      </div>
      <label>
        Jasne zadanie do wykonania
        <input
          defaultValue={task.title}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim();
            if (next && next !== task.title) onUpdate({ title: next });
          }}
        />
      </label>
      <label>
        Kiedy uznaję za wykonane
        <textarea
          defaultValue={details.gate}
          placeholder="Np. Gotowe, gdy mam zapisane 3 zdania decyzji i wklejam je jako dowód."
          onBlur={(event) => onDetailsChange({ ...details, gate: event.currentTarget.value.trim() })}
        />
      </label>
      <label>
        Sugestia nadzoru
        <textarea
          defaultValue={details.suggestion}
          placeholder="Najbliższy ruch albo sposób uproszczenia kroku."
          onBlur={(event) => onDetailsChange({ ...details, suggestion: event.currentTarget.value.trim() })}
        />
      </label>
      <div className="execution-form-grid two">
        <label>
          Termin
          <input
            type="date"
            defaultValue={dateInputValue(task.due_at)}
            onBlur={(event) => onUpdate({ due_at: dateInputToIso(event.currentTarget.value) })}
          />
        </label>
        <label>
          Nagroda po etapie
          <select value={currentReward} onChange={(event) => onRewardChange(event.currentTarget.value)}>
            {rewardOptions.map((reward) => <option value={reward} key={reward}>{reward}</option>)}
          </select>
        </label>
      </div>
      <div className={`execution-reward-state ${rewardUnlocked ? "unlocked" : "locked"}`}>
        <Gift size={15} />
        <strong>{rewardUnlocked ? "Odbierz nagrodę" : "Nagroda zablokowana"}</strong>
        <span>{rewardUnlocked ? currentReward : "Odblokuje się po statusie Gotowe i wpisanym dowodzie wykonania."}</span>
      </div>
      <div className="execution-form-grid two">
        <label>
          Dowód wykonania
          <textarea
            defaultValue={details.evidence}
            placeholder="Link, plik, decyzja albo jedno zdanie wyniku. Wymagane przed statusem Gotowe."
            onBlur={(event) => onDetailsChange({ ...details, evidence: event.currentTarget.value.trim() })}
          />
        </label>
        <label>
          Blokada
          <textarea
            defaultValue={details.blocker}
            placeholder="Co realnie blokuje ten krok?"
            onBlur={(event) => onDetailsChange({ ...details, blocker: event.currentTarget.value.trim() })}
          />
        </label>
      </div>
      <label>
        Fallback gdy blokada zostaje
        <textarea
          defaultValue={details.fallback}
          placeholder="Jaki mniejszy, prostszy albo alternatywny ruch uruchomić?"
          onBlur={(event) => onDetailsChange({ ...details, fallback: event.currentTarget.value.trim() })}
        />
      </label>
      <label>
        Notatki
        <textarea
          defaultValue={details.notes}
          placeholder="Opcjonalnie: linki, kontekst, doprecyzowanie."
          onBlur={(event) => onDetailsChange({ ...details, notes: event.currentTarget.value.trim() })}
        />
      </label>
      <div className="execution-supervision-meta">
        <span><strong>Bramka:</strong> {details.gate}</span>
        <span><strong>Sugestia:</strong> {details.suggestion}</span>
        {details.evidence && <span><strong>Dowód:</strong> {details.evidence}</span>}
        {details.blocker && <span><strong>Blokada:</strong> {details.blocker}</span>}
        {details.fallback && <span><strong>Fallback:</strong> {details.fallback}</span>}
      </div>
    </article>
  );
}

const rewardOptions = [
  "20 minut pełnego luzu bez nadrabiania",
  "Spacer albo kawa poza biurkiem",
  "Mała przyjemność do 50 zł",
  "Wieczór bez wyrzutów sumienia",
  "Publiczne odhaczenie postępu",
  "Własna nagroda do dopisania"
];

interface SupervisionTaskDraft {
  title: string;
  gate: string;
  suggestion: string;
  reward: string;
  dueAt: string | null;
  notes?: string;
  evidence?: string;
  blocker?: string;
  fallback?: string;
}

interface PlanTaskDetails {
  gate: string;
  suggestion: string;
  reward: string;
  notes: string;
  evidence: string;
  blocker: string;
  fallback: string;
}

function buildSupervisionTaskDrafts({
  mission,
  stages,
  gates,
  decisions,
  evidences
}: {
  mission: Mission;
  stages: ProcessStage[];
  gates: ProcessGate[];
  decisions: MissionDecision[];
  evidences: MissionEvidence[];
}) {
  const evidenceByStageKey = missionEvidenceByStageKey(stages, gates, decisions, evidences);
  const roadmap = readText(evidenceByStageKey.get("roadmap")?.roadmap);
  const roadmapItems = roadmapToItems(roadmap);
  const milestones = buildMilestones(mission, roadmapItems);

  return milestones.map((milestone, index): SupervisionTaskDraft => ({
    ...concreteTaskFromMilestone(mission, milestone.title, index),
    reward: rewardOptions[index % rewardOptions.length],
    dueAt: dateToIsoEndOfDay(milestone.date),
    notes: "Po wykonaniu dopisz krótki dowód: link, plik, decyzję albo jedno zdanie wyniku.",
    evidence: "",
    blocker: "",
    fallback: concreteTaskFromMilestone(mission, milestone.title, index).fallback
  }));
}

function concreteTaskFromMilestone(mission: Mission, milestone: string, index: number) {
  const normalized = milestone.toLowerCase();
  const isGenericScope = /doprecyzowany zakres|pierwsza bramka|urealnij zakres|domknij gap|sprawdź założenie|pierwszy dowód/i.test(milestone);
  const suggestions = supervisionSuggestionsForPath(mission.path_type);

  if (mission.path_type === "life_os" && (index === 0 || isGenericScope)) {
    return concreteFallbackTask(mission, index);
  }

  if (normalized.includes("bramka:") || normalized.includes("rezultat:")) {
    const result = extractRoadmapPart(milestone, "rezultat");
    const gate = extractRoadmapPart(milestone, "bramka");
    const risk = extractRoadmapPart(milestone, "zależność/ryzyko") || extractRoadmapPart(milestone, "ryzyko");
    return {
      title: imperativeTitle(result || milestone),
      gate: gate || `Gotowe, gdy masz konkretny dowód rezultatu: ${result || milestone}`,
      suggestion: suggestions[index] ?? suggestions[suggestions.length - 1],
      fallback: risk ? `Jeśli blokuje: ${risk}, zmniejsz zakres do testu 15-30 minut.` : "Jeśli krok jest za duży, zapisz jego wersję 15-minutową i wykonaj tylko ją."
    };
  }

  return {
    title: imperativeTitle(milestone),
    gate: gateFromRoadmapItem(milestone),
    suggestion: suggestions[index] ?? suggestions[suggestions.length - 1],
    fallback: "Jeśli krok jest zbyt mglisty, zamień go na jeden dokument, jedną decyzję albo jeden kontakt."
  };
}

function concreteFallbackTask(mission: Mission, index: number): Omit<SupervisionTaskDraft, "reward" | "dueAt"> & { dueAt?: string | null } {
  const goalShort = mission.raw_goal.length > 90 ? `${mission.raw_goal.slice(0, 87)}...` : mission.raw_goal;

  if (mission.path_type === "life_os") {
    const tasks = [
      {
        title: "Wybierz jeden kierunek na najbliższe 14 dni i zapisz, z czego rezygnujesz",
        gate: `Gotowe, gdy masz 3 zdania: wybieram jeden kierunek, pierwszy miernik postępu i 3 rzeczy odłożone na później.`,
        suggestion: `Otwórz notatkę i uzupełnij: "Przez 14 dni moim kierunkiem jest..., mierzę..., odkładam...". Cel: ${goalShort}`,
        fallback: "Jeśli nie umiesz wybrać, ustaw 24-godzinny test jednego kierunku zamiast decyzji na 14 dni.",
        notes: "Dowodem jest treść decyzji wklejona w pole Dowód wykonania."
      },
      {
        title: "Zrób listę 5 działań, które wspierają wybrany kierunek, i wybierz pierwsze",
        gate: "Gotowe, gdy masz listę 5 działań oraz jedno oznaczone jako pierwsze do wykonania.",
        suggestion: "Nie szukaj najlepszego działania. Wybierz takie, które da się zrobić bez pytania nikogo o zgodę.",
        fallback: "Jeśli lista robi się zbyt duża, zostaw tylko 3 działania i wybierz najłatwiejsze."
      },
      {
        title: "Wykonaj pierwszy 20-minutowy test wybranego kierunku",
        gate: "Gotowe, gdy przez 20 minut wykonasz działanie i zapiszesz jedno zdanie wyniku.",
        suggestion: "Ustaw timer, wykonaj najprostszy test i zapisz, czy kierunek daje energię, wynik albo jasność.",
        fallback: "Jeśli 20 minut jest za dużo, zrób 5-minutowy szkic lub notatkę decyzyjną."
      },
      {
        title: "Zrób przegląd: kontynuować, uprościć czy zmienić kierunek",
        gate: "Gotowe, gdy zapiszesz decyzję: kontynuuję, upraszczam albo zmieniam, wraz z jednym powodem.",
        suggestion: "Porównaj dowody z poprzednich kroków, nie swoje samopoczucie z całego tygodnia.",
        fallback: "Jeśli nie ma dowodów, wróć do pierwszego testu i zmniejsz go do 5 minut."
      }
    ];
    return tasks[index] ?? tasks[tasks.length - 1];
  }

  if (mission.path_type === "tactical_sprint") {
    const tasks = [
      {
        title: "Zapisz wynik sprintu w jednym zdaniu i wybierz pierwszy deliverable",
        gate: "Gotowe, gdy masz jedno zdanie wyniku oraz nazwany pierwszy deliverable.",
        suggestion: "Wynik ma być sprawdzalny: co będzie istnieć, gdzie i dla kogo.",
        fallback: "Jeśli wynik jest za duży, obetnij go do wersji demonstracyjnej."
      },
      {
        title: "Wykonaj szkic pierwszego deliverable w wersji roboczej",
        gate: "Gotowe, gdy istnieje szkic, link, plik albo notatka, którą można ocenić.",
        suggestion: "Zrób brzydką wersję roboczą zamiast projektować idealny rezultat.",
        fallback: "Jeśli szkic blokuje, napisz spis treści albo checklistę deliverable."
      }
    ];
    return tasks[index] ?? tasks[tasks.length - 1];
  }

  return {
    title: "Wykonaj najbliższy fizyczny ruch i zapisz wynik",
    gate: "Gotowe, gdy działanie jest wykonane, a wynik zapisany jednym zdaniem.",
    suggestion: "Nie planuj dalej. Otwórz właściwe miejsce, wykonaj ruch, zapisz dowód.",
    fallback: "Jeśli ruch trwa dłużej niż 15 minut, zmniejsz go do otwarcia pliku i zapisania pierwszej linijki."
  };
}

function serializePlanTaskDescription(task: SupervisionTaskDraft) {
  return [
    `Bramka: ${task.gate}`,
    `Sugestia: ${task.suggestion}`,
    `Nagroda: ${task.reward}`,
    task.evidence ? `Dowód: ${task.evidence}` : "",
    task.blocker ? `Blokada: ${task.blocker}` : "",
    task.fallback ? `Fallback: ${task.fallback}` : "",
    task.notes ? `Notatki: ${task.notes}` : ""
  ].filter(Boolean).join("\n");
}

function parsePlanTaskDescription(description: string | null) {
  const text = description ?? "";
  const readLine = (label: string) => {
    const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
    return match?.[1]?.trim() ?? "";
  };
  return {
    gate: readLine("Bramka") || "Dopisz mierzalną bramkę akceptacji.",
    suggestion: readLine("Sugestia") || "Wybierz najmniejszy rezultat, który przesuwa Mission.",
    reward: readLine("Nagroda") || rewardOptions[0],
    notes: readLine("Notatki"),
    evidence: readLine("Dowód"),
    blocker: readLine("Blokada"),
    fallback: readLine("Fallback")
  };
}

function supervisionSuggestionsForPath(path: MissionPathType | null) {
  if (path === "life_os") {
    return [
      "Zacznij od ograniczenia zakresu, bo Life OS przegrywa z równoległością.",
      "Szukaj jednego powtarzalnego rytmu, nie perfekcyjnego systemu.",
      "Zrób test tożsamości: czy ten kierunek da się utrzymać w zwykły dzień.",
      "Wybierz jeden dowód postępu, który można pokazać albo zmierzyć.",
      "Zaplanuj przegląd tygodniowy i usuń jeden zbędny priorytet."
    ];
  }
  if (path === "tactical_sprint") {
    return [
      "Zamknij zakres sprintu w jednym wyniku.",
      "Usuń zależność, która może opóźnić pierwszy tydzień.",
      "Zrób wersję testową przed dopracowywaniem.",
      "Zbierz sygnał zwrotny i zdecyduj: skalować czy ciąć.",
      "Zamknij sprint decyzją i następnym backlogiem."
    ];
  }
  return [
    "Zrób tylko najbliższy fizyczny ruch.",
    "Zapisz wynik i zamknij pętlę.",
    "Nie rozbudowuj planu, jeśli zadanie można skończyć od razu."
  ];
}

function extractRoadmapPart(item: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = item.match(new RegExp(`${escaped}:\\s*([^;\\n]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function imperativeTitle(value: string) {
  const text = value
    .replace(/^rezultat:\s*/i, "")
    .replace(/^bramka:\s*/i, "")
    .replace(/^etap\s*[-–—:]?\s*/i, "")
    .trim();
  if (!text) return "Wykonaj konkretny krok i zapisz dowód";
  if (/^(zapisz|wybierz|wykonaj|przygotuj|stwórz|sprawdź|zrób|otwórz|opublikuj|wyślij|ustal|usuń|zamknij)\b/i.test(text)) {
    return sentenceCase(text);
  }
  return `Zrób: ${sentenceCase(text)}`;
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  return trimmed ? `${trimmed[0].toUpperCase()}${trimmed.slice(1)}` : trimmed;
}

function gateFromRoadmapItem(item: string) {
  const gateMatch = item.match(/bramka:\s*([^;.\n]+)/i);
  if (gateMatch?.[1]) return gateMatch[1].trim();
  const resultMatch = item.match(/rezultat:\s*([^;.\n]+)/i);
  if (resultMatch?.[1]) return `Gotowe, gdy rezultat istnieje: ${resultMatch[1].trim()}`;
  return "Gotowe, gdy istnieje konkretny dowód wykonania tego kroku.";
}

function buildMissionPlanDocument({
  mission,
  stages,
  gates,
  decisions,
  evidences,
  assumptions,
  tasks
}: {
  mission: Mission;
  stages: ProcessStage[];
  gates: ProcessGate[];
  decisions: MissionDecision[];
  evidences: MissionEvidence[];
  assumptions: MissionAssumption[];
  tasks: MissionTask[];
}) {
  const evidenceByDecision = new Map(evidences.map((evidence) => [evidence.decision_id, evidence.content]));
  const gateById = new Map(gates.map((gate) => [gate.id, gate]));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const evidenceByStageKey = new Map<string, Record<string, unknown>>();

  for (const decision of decisions) {
    const gate = decision.gate_id ? gateById.get(decision.gate_id) : null;
    const stage = gate ? stageById.get(gate.stage_id) : null;
    const content = evidenceByDecision.get(decision.id);
    if (stage && content) evidenceByStageKey.set(stage.stage_key, content);
  }

  const resources = mission.resource_profile as Record<string, unknown>;
  const gapScore = mission.gap_score as Record<string, number>;
  const strategy = evidenceByStageKey.get("strategy") ?? {};
  const critique = evidenceByStageKey.get("critique") ?? {};
  const roadmapEvidence = evidenceByStageKey.get("roadmap") ?? {};
  const microEvidence = evidenceByStageKey.get("micro_step") ?? {};
  const roadmap = readText(roadmapEvidence.roadmap);
  const microStep = readText(microEvidence.micro_step)
    || tasks.find((task) => task.is_micro_step && task.status !== "done")?.title
    || tasks.find((task) => task.is_micro_step)?.title
    || "Do wygenerowania po akceptacji roadmapy.";
  const roadmapItems = roadmapToItems(roadmap);
  const milestones = buildMilestones(mission, roadmapItems);
  const chronologicalDecisions = [...decisions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const assumptionTexts = assumptions.length
    ? assumptions.map((assumption) => `${assumption.description} (${assumption.confidence}%, ${assumption.status})`)
    : readStringArray(strategy.assumptions);

  return [
    `# Plan działania: ${mission.title}`,
    "",
    `Status: ${statusLabels[mission.status]}`,
    `Ścieżka: ${mission.path_type ? pathLabels[mission.path_type] : "nieustalona"}`,
    `Wygenerowano: ${formatDate(new Date())}`,
    "",
    "## Cel",
    mission.raw_goal,
    "",
    "## Strategiczny wybór",
    `- Deklarowany koszt: ${readText(strategy.cost_declaration) || "nie zapisano"}`,
    `- Dominujący gap: ${dominantGapLabel(gapScore)}`,
    `- Czas / horyzont: ${readText(resources.time) || "nie zapisano"}`,
    `- Ograniczenia: ${readText(resources.constraints) || "nie zapisano"}`,
    `- Przewagi: ${readText(resources.advantages) || "nie zapisano"}`,
    "",
    "## Założenia",
    assumptionTexts.length ? assumptionTexts.map((item) => `- ${item}`).join("\n") : "- Nie zapisano założeń.",
    "",
    "## Krytyczne ryzyka i fallbacki",
    formatCritique(critique),
    "",
    "## Roadmapa",
    roadmap || "Roadmapa nie została jeszcze zapisana.",
    "",
    "## Kamienie milowe i terminy robocze",
    milestones.map((milestone) => `- ${milestone.date}: ${milestone.title}`).join("\n"),
    "",
    "## Pierwszy krok",
    `- ${microStep}`,
    "",
    "## Decyzje z bramek",
    chronologicalDecisions.length
      ? chronologicalDecisions.map((decision) => {
          const stageName = stageNameForDecision(decision, gateById, stageById);
          return `- ${formatDate(decision.created_at)} | ${stageName}: ${decision.rationale} (${decision.confidence}%, wpływ: ${decision.impact})`;
        }).join("\n")
      : "- Brak zapisanych decyzji.",
    "",
    "## Następny przegląd",
    `- ${formatDate(addDays(new Date(), mission.path_type === "life_os" ? 7 : 3))}: sprawdź, czy pierwszy krok został wykonany i czy roadmapa nadal ma sens.`,
    "",
    "_Terminy są propozycją roboczą wygenerowaną z typu ścieżki i roadmapy. Jeśli masz twarde daty, zastąp je przed wysłaniem planu dalej._"
  ].join("\n");
}

function readTransformationContract(aiContext: Record<string, unknown> | null | undefined) {
  if (!aiContext || typeof aiContext !== "object") return null;
  return normalizeTransformationContract(aiContext.transformation_contract);
}

function normalizeTransformationContract(value: unknown): TransformationContract {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    mental_shift: readText(source.mental_shift) || "Zaczynasz wybierać jeden kierunek zamiast rozpraszać energię na wiele równoległych możliwości.",
    reality_shift: readText(source.reality_shift) || "Twoja codzienność dostaje prostszy rytm: mniej otwartych pętli, więcej dowodów działania.",
    identity_shift: readText(source.identity_shift) || "Wzmacniasz tożsamość osoby, która domyka małe dowody zamiast ciągle negocjować ze sobą start.",
    vision_7_days: readText(source.vision_7_days) || "Masz pierwszy dowód, że potrafisz wybrać kierunek i wykonać konkretny krok.",
    vision_30_days: readText(source.vision_30_days) || "Masz kilka powtórzeń, mniej chaosu decyzyjnego i jaśniejsze poczucie sprawczości.",
    vision_90_days: readText(source.vision_90_days) || "Jeden kierunek staje się częścią Twojej normalności, a nie kolejnym projektem do rozważania.",
    warning_if_quit: readText(source.warning_if_quit) || "Jeśli odpuścisz, najpewniej wróci stary koszt: dużo potencjału, mało dowodów i zmęczenie od ciągłego zaczynania od nowa."
  };
}

function buildFallbackTransformationContract(mission: Mission, planTasks: MissionTask[]): TransformationContract {
  const firstTask = planTasks[0]?.title ?? "pierwszy konkretny krok";
  const doneCount = planTasks.filter((task) => task.status === "done" && parsePlanTaskDescription(task.description).evidence.trim()).length;
  const direction = mission.path_type === "life_os"
    ? "jeden prowadzony kierunek"
    : mission.path_type === "tactical_sprint"
      ? "jeden dowieziony sprint"
      : "jedno domknięte działanie";

  return {
    mental_shift: `Przesuwasz uwagę z analizowania wielu opcji na wzmacnianie prostego nawyku: wybieram ${direction} i tworzę dowody.`,
    reality_shift: `Twoja rzeczywistość zaczyna mieć mniej otwartych pętli. Najbliższy widoczny dowód to: ${firstTask}.`,
    identity_shift: `Rośnie tożsamość osoby, która nie musi mieć pełnej pewności, żeby wykonać mały, sprawdzalny ruch.`,
    vision_7_days: doneCount > 0 ? "Masz już pierwszy dowód wykonania, więc plan przestaje być deklaracją." : "Masz wybrany kierunek, pierwszy dowód albo jasną informację, co blokuje wykonanie.",
    vision_30_days: "Masz serię małych decyzji i widzisz, które działania realnie wzmacniają kierunek, a które tylko udają postęp.",
    vision_90_days: "Twoja nowa normalność to mniej rozproszenia, więcej sprawczości i spokojniejszy stosunek do ambicji, pieniędzy oraz wysiłku.",
    warning_if_quit: "Największym kosztem odpuszczenia nie jest brak jednego zadania, tylko powrót do wzorca: potencjał bez konsekwentnych dowodów."
  };
}

function roadmapToItems(roadmap: string) {
  return roadmap
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[).\s-]*/, "").trim())
    .filter(Boolean);
}

function buildMilestones(mission: Mission, roadmapItems: string[]) {
  const start = new Date();
  const offsets = mission.path_type === "life_os"
    ? [7, 30, 60, 90, 120]
    : mission.path_type === "tactical_sprint"
      ? [2, 7, 14, 30, 45]
      : [0, 1, 2, 3, 7];
  const items = roadmapItems.length ? roadmapItems : [
    "Doprecyzowany zakres i pierwsza bramka",
    "Pierwszy dowód działania",
    "Przegląd ryzyk i decyzja: kontynuować, uprościć albo zatrzymać"
  ];

  return items.slice(0, 5).map((item, index) => ({
    date: formatDate(addDays(start, offsets[index] ?? offsets[offsets.length - 1])),
    title: item
  }));
}

function formatCritique(critique: Record<string, unknown>) {
  const rows = [
    readText(critique.weaknessOne) ? `- Słabość 1: ${readText(critique.weaknessOne)}` : "",
    readText(critique.fallbackOne) ? `- Fallback 1: ${readText(critique.fallbackOne)}` : "",
    readText(critique.weaknessTwo) ? `- Słabość 2: ${readText(critique.weaknessTwo)}` : "",
    readText(critique.fallbackTwo) ? `- Fallback 2: ${readText(critique.fallbackTwo)}` : ""
  ].filter(Boolean);
  return rows.length ? rows.join("\n") : "- Brak zapisanej krytyki.";
}

function stageNameForDecision(
  decision: MissionDecision,
  gateById: Map<string, ProcessGate>,
  stageById: Map<string, ProcessStage>
) {
  const gate = decision.gate_id ? gateById.get(decision.gate_id) : null;
  const stage = gate ? stageById.get(gate.stage_id) : null;
  return stage?.name ?? "Gate";
}

function missionEvidenceByStageKey(
  stages: ProcessStage[],
  gates: ProcessGate[],
  decisions: MissionDecision[],
  evidences: MissionEvidence[]
) {
  const evidenceByDecision = new Map(evidences.map((evidence) => [evidence.decision_id, evidence.content]));
  const gateById = new Map(gates.map((gate) => [gate.id, gate]));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const evidenceByStageKey = new Map<string, Record<string, unknown>>();

  for (const decision of decisions) {
    const gate = decision.gate_id ? gateById.get(decision.gate_id) : null;
    const stage = gate ? stageById.get(gate.stage_id) : null;
    const content = evidenceByDecision.get(decision.id);
    if (stage && content) evidenceByStageKey.set(stage.stage_key, content);
  }

  return evidenceByStageKey;
}

function dominantGapLabel(gapScore: Record<string, number>) {
  const key = dominantGap(gapScore);
  const value = gapScore[key];
  const label = gapLabels[key as keyof typeof gapLabels] ?? key;
  return Number.isFinite(value) ? `${label} (${value}/10)` : "nie zapisano";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "brak daty";
  return new Intl.DateTimeFormat("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateInputToIso(value: string) {
  if (!value) return null;
  return new Date(`${value}T18:00:00`).toISOString();
}

function dateToIsoEndOfDay(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    return new Date(`${match[3]}-${match[2]}-${match[1]}T18:00:00`).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    || "mission";
}

function GateError({ run, saving, onReopen }: { run: StageRun | null; saving: boolean; onReopen: () => void }) {
  if (!run?.error_message) return null;
  return (
    <div className="execution-gate-error">
      <AlertTriangle size={15} />
      <div>
        <span>{run.error_message}</span>
        <button className="secondary-button" type="button" disabled={saving} onClick={onReopen}>
          Przywróć do poprawy
        </button>
      </div>
    </div>
  );
}

function GateChecklist({ items }: { items: string[] }) {
  return (
    <div className="execution-gate-list">
      <strong>Gate checklist</strong>
      {items.map((item) => (
        <span key={item}><CheckCircle2 size={13} />{item}</span>
      ))}
    </div>
  );
}

function ContextBlock({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const childArray = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="execution-context-block">
      <strong>{title}</strong>
      {childArray.length ? children : <span className="execution-context-empty">{empty}</span>}
    </div>
  );
}

const resourceLabels = {
  budget: "Budżet",
  time: "Czas",
  people: "Zespół / ludzie",
  skills: "Kompetencje",
  constraints: "Ograniczenia",
  advantages: "Przewagi",
  risks: "Ryzyka"
};

const gapLabels = {
  knowledge: "Wiedza",
  money: "Pieniądze",
  time: "Czas",
  people: "Ludzie",
  risk: "Ryzyko",
  execution: "Egzekucja"
};

function dominantGap(gap: Record<string, number>) {
  return Object.entries(gap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

interface GateValidationInput {
  triagePath: MissionPathType;
  resourceDraft: {
    budget: string;
    time: string;
    people: string;
    skills: string;
    constraints: string;
    advantages: string;
    risks: string;
  };
  gapDraft: Record<"knowledge" | "money" | "time" | "people" | "risk" | "execution", number>;
  strategyDraft: {
    costDeclaration: string;
    assumptionOne: string;
    assumptionTwo: string;
  };
  critiqueDraft: {
    weaknessOne: string;
    fallbackOne: string;
    weaknessTwo: string;
    fallbackTwo: string;
  };
  roadmapDraft: string;
  microStepDraft: string;
}

function validateStage(stage: ProcessStage, mission: Mission, input: GateValidationInput) {
  const errors: string[] = [];

  if (stage.stage_key === "triage") {
    if (!input.triagePath) errors.push("Brak klasyfikacji celu.");
    if (input.triagePath !== "do_it_now" && mission.raw_goal.trim().length < 12) {
      errors.push("Cel jest zbyt ogólny do uruchomienia pełnego procesu.");
    }
  }

  if (stage.stage_key === "resources") {
    for (const [key, value] of Object.entries(input.resourceDraft)) {
      if (!value.trim()) errors.push(`Brak pola: ${resourceLabels[key as keyof typeof resourceLabels]}.`);
    }
    if (input.resourceDraft.advantages.trim().length < 3) errors.push("Diagnoza musi wskazać minimum jedną przewagę.");
    if (input.resourceDraft.risks.trim().length < 3) errors.push("Diagnoza musi wskazać minimum jedno ryzyko.");
  }

  if (stage.stage_key === "calibration") {
    const dimensions = ["knowledge", "money", "time", "people", "risk", "execution"] as const;
    for (const dimension of dimensions) {
      const value = input.gapDraft[dimension];
      if (!Number.isFinite(value) || value < 0 || value > 10) {
        errors.push(`Gap ${dimension} musi być w skali 0-10.`);
      }
    }
  }

  if (stage.stage_key === "strategy") {
    if (!input.strategyDraft.costDeclaration.trim()) errors.push("Brak jawnej deklaracji kosztu.");
    if (!input.strategyDraft.assumptionOne.trim() || !input.strategyDraft.assumptionTwo.trim()) {
      errors.push("Strategia wymaga minimum dwóch założeń.");
    }
    if (mission.path_type === "life_os" && input.strategyDraft.costDeclaration.toLowerCase().includes("równolegle")) {
      errors.push("Life OS nie powinien startować z wieloma równoległymi priorytetami.");
    }
  }

  if (stage.stage_key === "critique") {
    for (const [key, value] of Object.entries(input.critiqueDraft)) {
      if (!value.trim()) errors.push(`Brak pola krytyki: ${critiqueLabels[key as keyof typeof critiqueLabels]}.`);
    }
  }

  if (stage.stage_key === "roadmap") {
    if (!input.roadmapDraft.trim()) errors.push("Roadmapa nie może być pusta.");
    if (input.roadmapDraft.trim().length < 30) errors.push("Roadmapa jest zbyt krótka, żeby była dowodem spełnienia Gate.");
    if (isRoadmapNonAnswer(input.roadmapDraft)) {
      errors.push("Roadmapa nie może być deklaracją bezradności. Użyj podpowiedzi albo AI, żeby zapisać minimalne etapy.");
    }
    if (!/(etap|krok|bramka|gate|rezultat|kamień|milestone|zależno|ryzyk)/i.test(input.roadmapDraft)) {
      errors.push("Roadmapa powinna wskazać przynajmniej etap, rezultat, bramkę albo zależność.");
    }
  }

  if (stage.stage_key === "micro_step") {
    if (!input.microStepDraft.trim()) errors.push("Micro step nie może być pusty.");
    if (input.microStepDraft.length > 180) errors.push("Micro step jest za duży; skróć do pojedynczego działania poniżej 15 minut.");
    if (/czekaj|poczekaj|po otrzymaniu|gdy będę mieć|kiedy będę mieć/i.test(input.microStepDraft)) {
      errors.push("Micro step nie może mieć zewnętrznej zależności.");
    }
  }

  return errors;
}

const critiqueLabels = {
  weaknessOne: "Słabość 1",
  fallbackOne: "Fallback 1",
  weaknessTwo: "Słabość 2",
  fallbackTwo: "Fallback 2"
};

function isRoadmapNonAnswer(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  const helplessPattern = /(nie mam pojęcia|nie wiem|brak pomysłu|do ustalenia później|uzupełnię później|todo|tbd)/i;
  return helplessPattern.test(normalized) && normalized.length < 120;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
}

async function executionAiErrorMessage(error: unknown) {
  const response = error && typeof error === "object" && "context" in error
    ? (error as { context?: unknown }).context
    : null;

  if (response instanceof Response) {
    const status = response.status ? `HTTP ${response.status}` : "Edge Function";
    try {
      const body = await response.clone().json() as { error?: string; message?: string };
      const detail = body.error ?? body.message;
      if (detail) return `${status}: ${detail}`;
    } catch {
      try {
        const text = await response.clone().text();
        if (text.trim()) return `${status}: ${text.trim()}`;
      } catch {
        // Fall through to the generic client-side error below.
      }
    }
  }

  return errorMessage(error, "Edge Function zwróciła błąd.");
}
