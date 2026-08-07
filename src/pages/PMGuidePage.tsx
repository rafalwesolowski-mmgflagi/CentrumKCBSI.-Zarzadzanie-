import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, CheckSquare, ClipboardCheck, Copy, Download, ExternalLink, FileText, GitBranch, Lightbulb, Plus, ShieldCheck, Sparkles, Square, ThumbsUp } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import { buildObsidianPackFileName, buildPMDocumentFileName, downloadTextFile, generatePMDocument, generatePMObsidianPack, type PMStageWorkspaceEntry, type PMStageWorkspaceState } from "../lib/pmDocument";
import { pmGuideOverview, pmGuideProfessionalNotes, pmGuideStages, type PMGuideChecklistItem } from "../lib/pmGuide";

const STORAGE_KEY = "centrum-pm-guide-progress";
const WORKSPACE_STORAGE_KEY = "centrum-pm-guide-workspace";

type ProgressState = Record<string, Record<string, boolean>>;
type GeneratedMode = "pm" | "obsidian";

export function PMGuidePage({ context }: { context: AppContextValue }) {
  const [selectedStageId, setSelectedStageId] = useState(pmGuideStages[0]?.id ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [progress, setProgress] = useState<ProgressState>(() => readProgress());
  const [message, setMessage] = useState<string | null>(null);
  const [creatingItemId, setCreatingItemId] = useState<string | null>(null);
  const [outline, setOutline] = useState("");
  const [generatedDocument, setGeneratedDocument] = useState("");
  const [generatedMode, setGeneratedMode] = useState<GeneratedMode>("pm");
  const [workspace, setWorkspace] = useState<PMStageWorkspaceState>(() => readWorkspace());

  const selectedStage = useMemo(
    () => pmGuideStages.find((stage) => stage.id === selectedStageId) ?? pmGuideStages[0],
    [selectedStageId]
  );
  const professionalNote = pmGuideProfessionalNotes[selectedStage.id];

  useEffect(() => {
    if (!selectedProjectId && context.projects[0]?.id) {
      setSelectedProjectId(context.projects[0].id);
    }
  }, [context.projects, selectedProjectId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // The guide still works; progress just will not persist in this browser.
    }
  }, [progress]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // The guide remains usable even if browser storage is unavailable.
    }
  }, [workspace]);

  const completedTotal = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const stage of pmGuideStages) {
      total += stage.checklist.length;
      done += stage.checklist.filter((item) => progress[stage.id]?.[item.id]).length;
    }
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }, [progress]);

  const stageDone = selectedStage.checklist.filter((item) => progress[selectedStage.id]?.[item.id]).length;
  const stagePercent = selectedStage.checklist.length
    ? Math.round((stageDone / selectedStage.checklist.length) * 100)
    : 0;
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

  function updateStageWorkspace(patch: Partial<PMStageWorkspaceEntry>) {
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

  async function createTaskFromItem(item: PMGuideChecklistItem) {
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
        area: selectedStage.title,
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
      setMessage("Dodano zadanie do projektu i oznaczono punkt checklisty jako wykonany.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się utworzyć zadania.");
    } finally {
      setCreatingItemId(null);
    }
  }

  function generateDocumentFromOutline() {
    const document = generatePMDocument({
      outline,
      project: selectedProject,
      stages: pmGuideStages,
      notes: pmGuideProfessionalNotes,
      workspace
    });
    setGeneratedDocument(document);
    setGeneratedMode("pm");
    setMessage("Wygenerowano kompletny plik PM na podstawie konspektu.");
  }

  function generateObsidianPackFromOutline() {
    const document = generatePMObsidianPack({
      outline,
      project: selectedProject,
      stages: pmGuideStages,
      notes: pmGuideProfessionalNotes,
      tasks: context.tasks,
      workspace
    });
    setGeneratedDocument(document);
    setGeneratedMode("obsidian");
    setMessage("Wygenerowano Obsidian PM pack z tabelami i Mermaid grafami.");
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
    const document = generatedDocument || generatePMDocument({
      outline,
      project: selectedProject,
      stages: pmGuideStages,
      notes: pmGuideProfessionalNotes,
      workspace
    });
    setGeneratedDocument(document);
    const fileName = generatedMode === "obsidian"
      ? buildObsidianPackFileName(selectedProject?.name ?? null)
      : buildPMDocumentFileName(selectedProject?.name ?? null);
    downloadTextFile(fileName, document);
    setMessage(generatedMode === "obsidian" ? "Pobrano Obsidian PM pack." : "Pobrano plik PM w formacie Markdown.");
  }

  return (
    <div className="page pm-guide-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">PM toolkit</span>
          <h1>PM Guide</h1>
          <p className="page-subtitle">
            Przewodnik po procesie projektu: ucz się narzędzi, odhaczaj checklisty i zamieniaj kroki w zadania.
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
        {pmGuideOverview.map((item) => {
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
          <span className="eyebrow">Postęp warsztatu</span>
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
          <h2><FileText size={18} />Generator pliku PM</h2>
          <span>{generatedDocument ? (generatedMode === "obsidian" ? "obsidian pack" : "gotowy plik") : "konspekt -> dokument"}</span>
        </div>
        <div className="pm-pack-includes" aria-label="Zawartość PM packa">
          {["Project Charter", "WBS", "RACI", "Risk Matrix", "Stakeholder Map", "Gantt", "Decision Log", "Lessons Learned"].map((item) => (
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
                placeholder={"Wklej notatki, np.\nTytuł: Wdrożenie CRM\nCel: skrócić obsługę leadów\nSponsor: Michał\nTermin: 30.09.2026\nRyzyko: brak danych wejściowych\nProdukt: formularz, automatyzacja, dashboard"}
              />
            </label>
            <div className="pm-document-actions">
              <button className="primary-button" type="button" onClick={generateDocumentFromOutline}>
                <Sparkles size={16} />
                Przygotuj plik
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
            <pre>{generatedDocument || "Wygenerowany dokument pojawi się tutaj. Plik zawiera komplet sekcji PM: summary, zakres, ryzyka, plan procesu, komunikację, checklisty i Definition of Done."}</pre>
          </div>
        </div>
      </section>

      <section className="pm-guide-layout">
        <aside className="panel pm-stage-list" aria-label="Etapy procesu PM">
          <div className="panel-header">
            <h2><BookOpen size={17} />Proces</h2>
            <span>{pmGuideStages.length}</span>
          </div>
          <div className="pm-stage-buttons">
            {pmGuideStages.map((stage) => {
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
                <h2><Lightbulb size={17} />Komentarz PM</h2>
                <span>senior review</span>
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
                <span>Metodyka w praktyce</span>
                <select value={stageWorkspace.methodology} onChange={(event) => updateStageWorkspace({ methodology: event.target.value })}>
                  <option value="hybrid">Hybrydowo: PRINCE2/PMBoK + Agile</option>
                  <option value="prince2">PRINCE2: governance, role, tolerancje</option>
                  <option value="pmbok">PMBoK: domeny, praktyki, kontrola</option>
                  <option value="agile">Agile: iteracje, backlog, feedback</option>
                  <option value="ipma">IPMA: kompetencje, ludzie, kontekst</option>
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
                  placeholder="Wpisz realne informacje dla tego etapu: decyzje, założenia, zakres, ustalenia ze sponsorem, kontekst projektu."
                />
              </label>
              <label>
                <span>Dowody / artefakty</span>
                <textarea
                  value={stageWorkspace.evidence}
                  onChange={(event) => updateStageWorkspace({ evidence: event.target.value })}
                  placeholder="Linki, nazwy dokumentów, notatki, spotkania, dashboardy, potwierdzenia, wpisy z rejestrów."
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
                <Method name="PRINCE2" text={selectedStage.methods.prince2} />
                <Method name="PMBoK" text={selectedStage.methods.pmbok} />
                <Method name="Agile" text={selectedStage.methods.agile} />
                <Method name="IPMA" text={selectedStage.methods.ipma} />
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

function createEmptyWorkspaceEntry(): PMStageWorkspaceEntry {
  return {
    methodology: "hybrid",
    notes: "",
    evidence: "",
    reviewAnswers: "",
    confidence: 3
  };
}

function assessStageQuality(stagePercent: number, entry: PMStageWorkspaceEntry) {
  const filledFields = [entry.notes, entry.evidence, entry.reviewAnswers].filter((value) => value.trim().length >= 20).length;
  const score = Math.round(stagePercent * 0.45 + (filledFields / 3) * 35 + (entry.confidence / 5) * 20);

  if (score >= 80) {
    return {
      label: "Wygląda dobrze",
      tone: "good",
      message: "Masz checklistę, praktyczne uzupełnienie i wystarczające dowody. To jest materiał gotowy do przeglądu ze sponsorem."
    };
  }
  if (score >= 55) {
    return {
      label: "Do dopracowania",
      tone: "warn",
      message: "Kierunek jest dobry, ale dopisz dowody, odpowiedzi kontrolne albo domknij checklistę przed uznaniem etapu za gotowy."
    };
  }
  return {
    label: "Za mało danych",
    tone: "danger",
    message: "Ten etap jest jeszcze bardziej intencją niż artefaktem. Uzupełnij praktykę, dowody i odpowiedzi na pytania kontrolne."
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
    comment ? `\nKomentarz PM: ${comment}` : "",
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

function readWorkspace(): PMStageWorkspaceState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as PMStageWorkspaceState : {};
  } catch {
    return {};
  }
}
