export type ProjectStatus = "on_track" | "in_progress" | "at_risk" | "paused" | "done";
export type TaskStatus = "backlog" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskImpact = "low" | "medium" | "high" | "strategic";
export type RiskStatus = "none" | "watch" | "risk" | "blocked";
export type CalendarNotificationStatus = "pending" | "sent" | "failed";
export type CalendarEntryKind = "event" | "note";
export type CRMClientStage = "lead" | "qualified" | "active" | "follow_up" | "paused" | "closed";
export type ProjectNoteCategory = "general" | "decision" | "idea" | "risk" | "meeting" | "finance" | "crm" | "task" | "research";
export type ProjectNoteSource = "written" | "voice";
export type ProjectNoteReviewStatus = "inbox" | "reviewed" | "action";
export type WellbeingGoalHorizon = "short_term" | "long_term";
export type WellbeingGoalStatus = "active" | "paused" | "done" | "archived";
export type WellbeingChallengeStatus = "active" | "paused" | "done" | "archived";
export type WellbeingAffirmationSource = "manual" | "reflection" | "assessment" | "ebook";

export type BusinessCanvasKey =
  | "customerSegments"
  | "problem"
  | "solution"
  | "uniqueValue"
  | "channels"
  | "revenue"
  | "costs"
  | "keyMetrics"
  | "advantage"
  | "experiments";

export type BusinessCanvas = Record<BusinessCanvasKey, string>;

export type BusinessMapNodeKind =
  | "business"
  | "project"
  | "area"
  | "goal"
  | "task"
  | "risk"
  | "segment"
  | "problem"
  | "solution"
  | "channel"
  | "revenue"
  | "cost"
  | "metric"
  | "experiment"
  | "note";

export interface BusinessMapNode {
  id: string;
  title: string;
  kind: BusinessMapNodeKind;
  x: number;
  y: number;
  notes: string;
}

export interface BusinessMapLink {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface BusinessVisualMap {
  nodes: BusinessMapNode[];
  links: BusinessMapLink[];
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  status: ProjectStatus;
  tags: string[];
  areas: string[];
  parent_project_id: string | null;
  goal: string | null;
  budget: number | null;
  invoiced: number | null;
  paid: number | null;
  cost: number | null;
  currency: string;
  created_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  order_index: number;
}

export interface Task {
  id: string;
  phase_id: string;
  project_id: string;
  name: string;
  status: TaskStatus;
  due_date: string;
  priority: TaskPriority;
  impact: TaskImpact;
  deadline_importance: number;
  risk_status: RiskStatus;
  area: string | null;
  assignee: string | null;
  notes: string | null;
  recurrence: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TaskImage {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  data_url: string;
  created_at: string;
}

export interface CalendarNotification {
  id: string;
  user_id: string;
  task_id: string;
  status: CalendarNotificationStatus;
  workflow: string;
  request_json: Record<string, unknown>;
  response_json: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CalendarEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: CalendarEntryKind;
  title: string;
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessDesign {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  canvas: BusinessCanvas;
  visual_map: BusinessVisualMap;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRMClient {
  id: string;
  user_id: string;
  project_id: string | null;
  company: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  stage: CRMClientStage;
  value: number | null;
  currency: string;
  project_url: string | null;
  repository_url: string | null;
  next_follow_up: string | null;
  advance_payment: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectNote {
  id: string;
  user_id: string;
  project_id: string;
  title: string | null;
  body: string;
  category: ProjectNoteCategory;
  source: ProjectNoteSource;
  review_status: ProjectNoteReviewStatus;
  summary: string | null;
  tags: string[];
  is_urgent: boolean;
  created_at: string;
  updated_at: string;
}

export interface WellbeingGoal {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  horizon: WellbeingGoalHorizon;
  status: WellbeingGoalStatus;
  description: string | null;
  success_criteria: string | null;
  target_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type ToolboxToolType =
  | "5w2h" | "ishikawa" | "raci" | "eisenhower" | "ooda"
  | "sipoc" | "pdca" | "premortem" | "cynefin" | "dilts" | "okr";

export interface FiveW2HData {
  what: string;
  why: string;
  who: string;
  where: string;
  when: string;
  how: string;
  howMuch: string;
}

export interface IshikawaCategory {
  name: string;
  causes: string[];
}

export interface IshikawaData {
  problem: string;
  categories: IshikawaCategory[];
}

export interface RaciActivity {
  name: string;
  responsible: string;
  accountable: string;
  consulted: string;
  informed: string;
}

export interface RaciData {
  activities: RaciActivity[];
}

export interface EisenhowerData {
  doNow: string[];
  schedule: string[];
  delegate: string[];
  eliminate: string[];
}

export interface OodaData {
  observe: string;
  orient: string;
  decide: string;
  act: string;
}

export interface SipocData {
  suppliers: string[];
  inputs: string[];
  process: string[];
  outputs: string[];
  customers: string[];
}

export interface PdcaData {
  plan: string;
  do: string;
  check: string;
  act: string;
}

export interface PremortemCause {
  reason: string;
  mitigation: string;
}

export interface PremortemData {
  scenario: string;
  causes: PremortemCause[];
}

export type CynefinDomain = "clear" | "complicated" | "complex" | "chaotic";

export interface CynefinData {
  situation: string;
  domain: CynefinDomain;
  rationale: string;
  approach: string;
}

export interface DiltsData {
  environment: string;
  behavior: string;
  capabilities: string;
  beliefs: string;
  identity: string;
  purpose: string;
}

export interface OkrKeyResult {
  text: string;
  target: string;
}

export interface OkrData {
  objective: string;
  keyResults: OkrKeyResult[];
}

export type ToolboxData = FiveW2HData | IshikawaData | RaciData | EisenhowerData | OodaData
  | SipocData | PdcaData | PremortemData | CynefinData | DiltsData | OkrData;

export interface ToolboxEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  tool_type: ToolboxToolType;
  title: string;
  data: ToolboxData;
  created_at: string;
  updated_at: string;
}

export interface WorkLogEntry {
  id: string;
  user_id: string;
  category: string;
  note: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WellbeingReflection {
  id: string;
  user_id: string;
  goal_id: string | null;
  project_id: string | null;
  entry_date: string;
  mood: number | null;
  energy: number | null;
  gratitude: string | null;
  wins: string | null;
  challenge: string | null;
  lesson: string | null;
  next_step: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface WellbeingRewirementChallenge {
  id: string;
  user_id: string;
  practice_key: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: WellbeingChallengeStatus;
  created_at: string;
  updated_at: string;
}

export interface WellbeingRewirementLog {
  id: string;
  user_id: string;
  challenge_id: string;
  log_date: string;
  completed: boolean;
  note: string | null;
  value: number | null;
  created_at: string;
  updated_at: string;
}

export interface WellbeingAssessment {
  id: string;
  user_id: string;
  taken_at: string;
  score: number;
  answers: Record<string, number>;
  summary: string | null;
  created_at: string;
}

export interface WellbeingAffirmation {
  id: string;
  user_id: string;
  reflection_id: string | null;
  text: string;
  source: WellbeingAffirmationSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WellbeingDailyCommitment {
  id: string;
  user_id: string;
  commitment_date: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WellbeingDiaryEntry {
  id: string;
  user_id: string;
  entry_date: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TaskNotificationResult {
  ok: boolean;
  workflow: "google-user-api" | "n8n-google-calendar" | string;
  notificationId: string | null;
  requestId: string | null;
  calendarEventId: string | null;
  htmlLink: string | null;
  emailMessageId: string | null;
}

export interface ProjectBundle {
  project: Project;
  phases: Phase[];
  tasks: Task[];
}

export interface RiskItem {
  id: string;
  title: string;
  severity: "info" | "warning" | "danger";
  projectName?: string;
  dueDate?: string;
  reason: string;
}

export interface CopilotProposal {
  id: string;
  title: string;
  rationale: string;
  changes: Array<{
    entity: "project" | "phase" | "task";
    id: string;
    field: string;
    from: string | number | null;
    to: string | number | null;
  }>;
}

export interface QuickAddDraft {
  project: {
    name: string;
    color: string;
    status: ProjectStatus;
  };
  phases: Array<{
    name: string;
    start_date: string;
    end_date: string;
    tasks: Array<{
      name: string;
      due_date: string;
      priority: TaskPriority;
      impact: TaskImpact;
    }>;
  }>;
  risks: RiskItem[];
  questions?: string[];
}
