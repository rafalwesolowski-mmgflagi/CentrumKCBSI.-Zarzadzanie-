import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpenCheck,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Lightbulb,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  ThumbsUp
} from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import {
  buildTrainingDocumentFileName,
  buildTrainingObsidianPackFileName,
  downloadTextFile,
  generateTrainingDocument,
  generateTrainingObsidianPack,
  type TrainingWorkspaceEntry,
  type TrainingWorkspaceState
} from "../lib/trainingDocument";
import { trainingOverview, trainingProfessionalNotes, trainingStages, type TrainingChecklistItem } from "../lib/trainingGuide";

const STORAGE_KEY = "centrum-training-studio-progress";
const WORKSPACE_STORAGE_KEY = "centrum-training-studio-workspace";

type ProgressState = Record<string, Record<string, boolean>>;
type GeneratedMode = "training" | "obsidian";

export function TrainingStudioPage({ context }: { context: AppContextValue }) {
  const [selectedStageId, setSelectedStageId] = useState(trainingStages[0]?.id ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [progress, setProgress] = useState<ProgressState>(() => readProgress());
  const [workspace, setWorkspace] = useState<TrainingWorkspaceState>(() => readWorkspace());
  const [message, setMessage] = useState<string | null>(null);
  const [creatingItemId, setCreatingItemId] = useState<string | null>(null);
  const [outline, setOutline] = useState("");
  const [generatedDocument, setGeneratedDocument] = useState("");
  const [generatedMode, setGeneratedMode] = useState<GeneratedMode>("training");

  const selectedStage = useMemo(
    () => trainingStages.find((stage) => stage.id === selectedStageId) ?? trainingStages[0],
    [selectedStageId]
  );
  const professionalNote = trainingProfessionalNotes[selectedStage.id];

  useEffect(() => {
    if (!selectedProjectId && context.projects[0]?.id) {
      setSelectedProjectId(context.projects[0].id);
    }
  }, [context.projects, selectedProjectId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Training Studio stays usable even when local storage is blocked.
    }
  }, [progress]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // Draft notes are optional browser-local data.
    }
  }, [workspace]);

  const completedTotal = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const stage of trainingStages) {
      total += stage.checklist.length;
      done += stage.checklist.filter((item) => progress[stage.id]?.[item.id]).length;
    }
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }, [progress]);

  const stageDone = selectedStage.checklist.filter((item) => progress[selectedStage.id]?.[item.id]).length;
  const stagePercent = selectedStage.checklist.length ? Math.round((stageDone / selectedStage.checklist.length) * 100) : 0;
  const selectedProject = context.projects.find((project) => project.id === selectedProjectId) ?? null;
  const stageWorkspace = workspace[selectedStage.id] ?? createEmptyWorkspaceEntry();
  const stageAssessment = assessStageQuality(stagePercent, stageWorkspace);

  function toggleItem(stageId: string, itemId: string) {
    setProgress((current) => ({
      ...current,
      [stageId]: {
        ...(current[stageId] ?? {}),
        [itemId]: !(current[stageId]?.[itemId] ?? false)
      }
    }));
  }

  function updateStageWorkspace(patch: Partial<TrainingWorkspaceEntry>) {
    setWorkspace((current) => ({
      ...current,
      [selectedStage.id]: {
        ...createEmptyWorkspaceEntry(),
        ...(current[selectedStage.id] ?? {}),
        ...patch,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  async function createTaskFromItem(item: TrainingChecklistItem) {
    if (!selectedProjectId) {
      setMessage("Najpierw wybierz projekt. Jeśli lista jest pusta, utwórz pierwszy projekt w Dashboardzie.");
      return;
    }

    setCreatingItemId(item.id);
    setMessage(null);
    try {
      await context.createTask({
        projectId: selectedProjectId,
        name: item.taskTitle,
        dueDate: new Date().toISOString().slice(0, 10),
        priority: "medium",
        impact: "medium",
        area: `Szkolenie: ${selectedStage.shortTitle}`,
        notes: buildTaskNotes({
          artifact: selectedStage.artifact,
          checklistNotes: item.taskNotes,
          comment: professionalNote?.comment,
          qualityGate: professionalNote?.qualityGate
        }),
        assignee: "",
        recurrence: ""
      });
      setProgress((current) => ({
        ...current,
        [selectedStage.id]: {
          ...(current[selectedStage.id] ?? {}),
          [item.id]: true
        }
      }));
      setMessage("Dodano zadanie szkoleniowe do projektu i oznaczono punkt checklisty jako wykonany.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się utworzyć zadania.");
    } finally {
      setCreatingItemId(null);
    }
  }

  function generateDocumentFromOutline() {
    const document = generateTrainingDocument({
      outline,
      project: selectedProject,
      stages: trainingStages,
      notes: trainingProfessionalNotes,
      workspace
    });
    setGeneratedDocument(document);
    setGeneratedMode("training");
    setMessage("Wygenerowano kompletny plan szkolenia na podstawie konspektu.");
  }

  function generateObsidianPackFromOutline() {
    const document = generateTrainingObsidianPack({
      outline,
      project: selectedProject,
      stages: trainingStages,
      notes: trainingProfessionalNotes,
      tasks: context.tasks,
      workspace
    });
    setGeneratedDocument(document);
    setGeneratedMode("obsidian");
    setMessage("Wygenerowano Obsidian Training pack z diagramami, quizem i runbookiem.");
  }

  async function copyGeneratedDocument() {
    if (!generatedDocument) return;
    try {
      await navigator.clipboard.writeText(generatedDocument);
      setMessage("Skopiowano dokument do schowka.");
    } catch {
      setMessage("Nie udało się skopiować dokumentu. Możesz zaznaczyć tekst w podglądzie ręcznie.");
    }
  }

  function downloadGeneratedDocument() {
    const document = generatedDocument || generateTrainingDocument({
      outline,
      project: selectedProject,
      stages: trainingStages,
      notes: trainingProfessionalNotes,
      workspace
    });
    setGeneratedDocument(document);
    const fileName = generatedMode === "obsidian"
      ? buildTrainingObsidianPackFileName(selectedProject?.name ?? null)
      : buildTrainingDocumentFileName(selectedProject?.name ?? null);
    downloadTextFile(fileName, document);
    setMessage(generatedMode === "obsidian" ? "Pobrano Obsidian Training pack." : "Pobrano plan szkolenia w Markdown.");
  }

  return (
    <div className="page pm-guide-page training-studio-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Learning design</span>
          <h1>Training Studio</h1>
          <p className="page-subtitle">
            Profesjonalne przygotowanie szkolenia online: od diagnozy potrzeby po scenariusz, materiały, produkcję i ewaluację.
          </p>
        </div>
        <div className="pm-guide-header-actions">
          <label className="pm-project-picker">
            <span>Projekt dla akcji</span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              {!context.projects.length && <option value="">Brak projektów</option>}
              {context.projects.map((project) => (
                <option value={project.id} key={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="pm-guide-overview">
        {trainingOverview.map((item) => {
          const Icon = item.icon;
          return (
            <div className="metric-card pm-guide-metric" key={item.label}>
              <Icon size={19} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          );
        })}
      </section>

      <section className="panel pm-guide-progress-panel">
        <div className="pm-guide-progress-main">
          <span className="eyebrow">Postęp przygotowania</span>
          <strong>{completedTotal.percent}%</strong>
          <span>{completedTotal.done}/{completedTotal.total} punktów checklisty wykonanych lokalnie w tej przeglądarce</span>
        </div>
        <div className="progress-track pm-guide-progress-track">
          <span style={{ width: `${completedTotal.percent}%` }} />
        </div>
      </section>

      {message && <div className="warning-box">{message}</div>}

      <section className="panel pm-document-generator">
        <div className="panel-header">
          <h2><FileText size={18} />Generator szkolenia</h2>
          <span>{generatedDocument ? (generatedMode === "obsidian" ? "obsidian pack" : "gotowy plan") : "konspekt -> szkolenie"}</span>
        </div>
        <div className="pm-pack-includes" aria-label="Zawartość Training packa">
          {["Training Brief", "Syllabus", "Lesson Plan", "Workbook", "Quiz", "Runbook", "Launch", "Evaluation"].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="pm-document-grid">
          <div className="pm-outline-editor">
            <label>
              <span>Konspekt wejściowy</span>
              <textarea
                value={outline}
                onChange={(event) => setOutline(event.target.value)}
                placeholder={"Wklej notatki, np.\nTytuł: Szkolenie z AI dla PM\nGrupa: project managerowie, poziom początkujący\nCel: nauczyć tworzenia statusów i ryzyk z pomocą AI\nCzas: 2 x 90 minut\nFormat: online live\nEfekt: uczestnik przygotuje status report\nModuł: Diagnoza procesu PM\nRyzyko: niski poziom praktyki uczestników"}
              />
            </label>
            <div className="pm-document-actions">
              <button className="primary-button" type="button" onClick={generateDocumentFromOutline}>
                <Sparkles size={16} />
                Przygotuj plan
              </button>
              <button className="secondary-button" type="button" onClick={generateObsidianPackFromOutline}>
                <GitBranch size={16} />
                Obsidian pack
              </button>
              <button className="secondary-button" type="button" onClick={downloadGeneratedDocument}>
                <Download size={16} />
                Pobierz .md
              </button>
              <button className="secondary-button" type="button" onClick={() => void copyGeneratedDocument()} disabled={!generatedDocument}>
                <Copy size={16} />
                Kopiuj
              </button>
            </div>
          </div>
          <div className="pm-document-preview">
            <div className="pm-document-preview-header">
              <strong>Podgląd dokumentu</strong>
              <span>{selectedProject?.name ?? "bez projektu"}</span>
            </div>
            <pre>{generatedDocument || "Wygenerowany dokument pojawi się tutaj. Plik zawiera brief szkoleniowy, efekty uczenia, syllabus, scenariusz, materiały, runbook techniczny, komunikację i ewaluację."}</pre>
          </div>
        </div>
      </section>

      <section className="pm-guide-layout">
        <aside className="panel pm-stage-list" aria-label="Etapy przygotowania szkolenia">
          <div className="panel-header">
            <h2><BookOpenCheck size={17} />Proces</h2>
            <span>{trainingStages.length}</span>
          </div>
          <div className="pm-stage-buttons">
            {trainingStages.map((stage) => {
              const done = stage.checklist.filter((item) => progress[stage.id]?.[item.id]).length;
              const isActive = stage.id === selectedStage.id;
              return (
                <button
                  className={`pm-stage-button ${isActive ? "active" : ""}`}
                  type="button"
                  key={stage.id}
                  onClick={() => {
                    setSelectedStageId(stage.id);
                    setMessage(null);
                  }}
                >
                  <span className="pm-stage-number">{stage.order}</span>
                  <span className="pm-stage-title">
                    <strong>{stage.shortTitle}</strong>
                    <span>{done}/{stage.checklist.length} gotowe</span>
                  </span>
                  {done === stage.checklist.length ? <CheckCircle2 size={16} /> : <ClipboardCheck size={16} />}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="pm-stage-content">
          <section className="panel pm-stage-hero">
            <div>
              <span className="eyebrow">Etap {selectedStage.order}</span>
              <h2>{selectedStage.title}</h2>
              <p>{selectedStage.focus}</p>
            </div>
            <div className="pm-stage-score">
              <strong>{stagePercent}%</strong>
              <span>{stageDone}/{selectedStage.checklist.length}</span>
              <div className="progress-track"><span style={{ width: `${stagePercent}%` }} /></div>
            </div>
          </section>

          <section className="pm-guide-two-col">
            <div className="panel pm-guide-next-step">
              <div className="panel-header">
                <h2>Co zrobić teraz</h2>
                <span>{selectedStage.artifact}</span>
              </div>
              <p>{selectedStage.nextStep}</p>
              <div className="pm-artifact-strip">
                <span className="eyebrow">Artefakt</span>
                <strong>{selectedStage.artifact}</strong>
              </div>
            </div>

            <div className="panel pm-guide-learn">
              <div className="panel-header">
                <h2>Ucz się</h2>
                <span>praktyka</span>
              </div>
              <p>{selectedStage.learn}</p>
              <p className="muted-note">{selectedStage.objective}</p>
            </div>
          </section>

          {professionalNote && (
            <section className="panel pm-coach-panel">
              <div className="panel-header">
                <h2><Lightbulb size={17} />Komentarz ekspercki</h2>
                <span>instructional design</span>
              </div>
              <p>{professionalNote.comment}</p>
              <div className="pm-guidance-grid">
                <GuidanceList title="Podpowiedzi" items={professionalNote.hints} />
                <GuidanceList title="Definition of Done" items={professionalNote.qualityGate} icon="check" />
                <GuidanceList title="Pytania kontrolne" items={professionalNote.reviewQuestions} />
              </div>
            </section>
          )}

          <section className="panel pm-practice-panel">
            <div className="panel-header">
              <h2><ThumbsUp size={17} />Twoja praktyka i ocena</h2>
              <span>{stageAssessment.label}</span>
            </div>
            <div className={`pm-assessment-strip pm-assessment-${stageAssessment.tone}`}>
              <strong>{stageAssessment.label}</strong>
              <span>{stageAssessment.message}</span>
            </div>
            <div className="pm-practice-grid">
              <label>
                <span>Format pracy</span>
                <select value={stageWorkspace.format} onChange={(event) => updateStageWorkspace({ format: event.target.value })}>
                  <option value="live">Online live</option>
                  <option value="async">Asynchronicznie</option>
                  <option value="blended">Blended learning</option>
                  <option value="workshop">Warsztat praktyczny</option>
                </select>
              </label>
              <label>
                <span>Pewność wykonania</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={stageWorkspace.confidence}
                  onChange={(event) => updateStageWorkspace({ confidence: Number(event.target.value) })}
                />
                <small>{stageWorkspace.confidence}/5</small>
              </label>
            </div>
            <div className="pm-practice-fields">
              <label>
                <span>Uzupełnienie etapu</span>
                <textarea
                  value={stageWorkspace.notes}
                  onChange={(event) => updateStageWorkspace({ notes: event.target.value })}
                  placeholder="Wpisz realne informacje: odbiorcy, efekty, moduły, decyzje, ograniczenia, wymagania sponsora albo założenia programu."
                />
              </label>
              <label>
                <span>Dowody / materiały</span>
                <textarea
                  value={stageWorkspace.evidence}
                  onChange={(event) => updateStageWorkspace({ evidence: event.target.value })}
                  placeholder="Linki, nazwy dokumentów, slajdy, quizy, workbooki, nagrania próbne, ankiety, wyniki testów."
                />
              </label>
              <label>
                <span>Odpowiedzi na pytania kontrolne</span>
                <textarea
                  value={stageWorkspace.reviewAnswers}
                  onChange={(event) => updateStageWorkspace({ reviewAnswers: event.target.value })}
                  placeholder={professionalNote?.reviewQuestions.map((question) => `${question}\n- `).join("\n") ?? "Odpowiedz na pytania kontrolne dla tego etapu."}
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Checklisty operacyjne</h2>
              <span>{stageDone}/{selectedStage.checklist.length}</span>
            </div>
            <div className="pm-checklist">
              {selectedStage.checklist.map((item) => {
                const checked = progress[selectedStage.id]?.[item.id] ?? false;
                return (
                  <div className={`pm-checklist-item ${checked ? "done" : ""}`} key={item.id}>
                    <button
                      className="done-toggle"
                      type="button"
                      onClick={() => toggleItem(selectedStage.id, item.id)}
                      aria-label={checked ? "Oznacz jako niewykonane" : "Oznacz jako wykonane"}
                    >
                      {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <div className="pm-checklist-copy">
                      <strong>{item.label}</strong>
                      <span>{item.taskNotes}</span>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={creatingItemId === item.id || !context.projects.length}
                      onClick={() => void createTaskFromItem(item)}
                      title={context.projects.length ? "Utwórz zadanie z tego kroku" : "Najpierw utwórz projekt"}
                    >
                      <Plus size={16} />
                      {creatingItemId === item.id ? "Tworzę" : "Zadanie"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pm-guide-two-col">
            <div className="panel">
              <div className="panel-header">
                <h2>Metodyki</h2>
                <span>mapowanie</span>
              </div>
              <div className="pm-method-grid">
                <Method name="ADDIE" text={selectedStage.methods.addie} />
                <Method name="Backward" text={selectedStage.methods.backwardDesign} />
                <Method name="Agile Learning" text={selectedStage.methods.agileLearning} />
                <Method name="Kirkpatrick" text={selectedStage.methods.kirkpatrick} />
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Typowe błędy</h2>
                <span>{selectedStage.mistakes.length}</span>
              </div>
              <div className="pm-mistake-list">
                {selectedStage.mistakes.map((mistake) => (
                  <div key={mistake}>{mistake}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Użyj narzędzia</h2>
              <span>{selectedStage.tools.length}</span>
            </div>
            <div className="pm-tool-grid">
              {selectedStage.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link className="pm-tool-card" to={tool.to} key={`${selectedStage.id}-${tool.to}`}>
                    <Icon size={18} />
                    <div>
                      <strong>{tool.label}</strong>
                      <span>{tool.description}</span>
                    </div>
                    <ExternalLink size={15} />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function Method({ name, text }: { name: string; text: string }) {
  return (
    <div className="pm-method-card">
      <strong>{name}</strong>
      <span>{text}</span>
    </div>
  );
}

function GuidanceList({ title, items, icon = "dot" }: { title: string; items: string[]; icon?: "dot" | "check" }) {
  return (
    <div className="pm-guidance-card">
      <strong>{title}</strong>
      <div className="pm-guidance-list">
        {items.map((item) => (
          <div className="pm-guidance-item" key={item}>
            {icon === "check" ? <ShieldCheck size={15} /> : <span className="pm-guidance-dot" />}
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function createEmptyWorkspaceEntry(): TrainingWorkspaceEntry {
  return {
    format: "live",
    notes: "",
    evidence: "",
    reviewAnswers: "",
    confidence: 3
  };
}

function assessStageQuality(stagePercent: number, entry: TrainingWorkspaceEntry) {
  const filledFields = [entry.notes, entry.evidence, entry.reviewAnswers].filter((value) => value.trim().length >= 20).length;
  const score = Math.round(stagePercent * 0.45 + (filledFields / 3) * 35 + (entry.confidence / 5) * 20);

  if (score >= 80) {
    return {
      label: "Gotowe do review",
      tone: "good",
      message: "Masz checklistę, praktyczne uzupełnienie i dowody. Ten etap można pokazać sponsorowi albo trenerowi do przeglądu."
    };
  }
  if (score >= 55) {
    return {
      label: "Do dopracowania",
      tone: "warn",
      message: "Kierunek jest dobry, ale dopisz materiały, odpowiedzi kontrolne albo domknij checklistę przed uznaniem etapu za gotowy."
    };
  }
  return {
    label: "Za mało danych",
    tone: "danger",
    message: "Ten etap jest jeszcze szkicem. Uzupełnij praktykę, dowody i odpowiedzi na pytania kontrolne."
  };
}

function buildTaskNotes({
  artifact,
  checklistNotes,
  comment,
  qualityGate
}: {
  artifact: string;
  checklistNotes: string;
  comment?: string;
  qualityGate?: string[];
}) {
  return [
    `Artefakt: ${artifact}`,
    "",
    `Zakres pracy: ${checklistNotes}`,
    comment ? `\nKomentarz ekspercki: ${comment}` : "",
    qualityGate?.length ? `\nKryteria jakości:\n${qualityGate.map((item) => `- ${item}`).join("\n")}` : ""
  ].filter(Boolean).join("\n");
}

function readProgress(): ProgressState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as ProgressState : {};
  } catch {
    return {};
  }
}

function readWorkspace(): TrainingWorkspaceState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as TrainingWorkspaceState : {};
  } catch {
    return {};
  }
}
