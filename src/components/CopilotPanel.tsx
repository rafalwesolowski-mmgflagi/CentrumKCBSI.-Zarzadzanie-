import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, RefreshCw, Send, X } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import { quickAddDraftSchema, portfolioScanSchema } from "../lib/contracts";
import type { QuickAddDraft, RiskItem, CopilotProposal } from "../lib/types";
import { supabase } from "../lib/supabase";
import { friendlyAiError } from "../lib/aiErrors";
import { useAutoFade } from "../lib/useAutoFade";

interface CopilotPanelProps {
  open: boolean;
  context: AppContextValue;
  onClose: () => void;
}

export function CopilotPanel({ open, context, onClose }: CopilotPanelProps) {
  const [mode, setMode] = useState<"create" | "modify" | "advisor">("create");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [proposals, setProposals] = useState<CopilotProposal[]>([]);
  const [advisorBriefing, setAdvisorBriefing] = useState<{
    summary: string;
    nextActions: string[];
    decisions: string[];
    questions: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

  const panelRef = useRef<HTMLElement>(null);
  const clearMessage = useCallback(() => setMessage(null), []);
  useAutoFade(message, clearMessage);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "advisor") {
      void requestAdvisor();
      return;
    }
    if (mode === "modify") {
      void requestModification();
      return;
    }

    void submitQuickAdd();
  }

  async function submitQuickAdd() {
    setLoading(true);
    setMessage(null);
    setDraft(null);
    setAdvisorBriefing(null);

    const { data, error } = await supabase.functions.invoke("ai-quick-add", {
      body: { prompt, contextWindow: buildContextWindow(context) }
    });

    setLoading(false);
    if (error) {
      setMessage(friendlyAiError(error));
      return;
    }

    const parsed = quickAddDraftSchema.safeParse(data);
    if (!parsed.success) {
      setMessage("Problem z AI: odpowiedź nie pasuje do wymaganego formatu projektu. Spróbuj doprecyzować opis.");
      return;
    }
    setTargetProjectId(null);
    setDraft(parsed.data);
  }

  async function runScan() {
    setLoading(true);
    setMessage(null);
    setAdvisorBriefing(null);
    const { data, error } = await supabase.functions.invoke("ai-portfolio-scan", {
      body: {
        userId: context.session?.user.id,
        dateRange: { from: new Date().toISOString().slice(0, 10), days: 45 },
        contextWindow: buildContextWindow(context)
      }
    });
    setLoading(false);

    if (error || data?.error) {
      setMessage(resolveInvokeError(error, data));
      return;
    }

    const parsed = portfolioScanSchema.safeParse(data);
    if (!parsed.success) {
      setMessage("Problem z AI: skan portfela zwrócił niepoprawny format. Spróbuj ponownie.");
      return;
    }
    setRisks(parsed.data.risks);
    setProposals(parsed.data.proposals);
    setAdvisorBriefing(parsed.data.advisorBriefing ?? null);
  }

  async function requestModification() {
    if (!prompt.trim()) {
      setMessage("Napisz, co mam zmienić w istniejących projektach.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setDraft(null);
    setAdvisorBriefing(null);
    const { data, error } = await supabase.functions.invoke("ai-portfolio-scan", {
      body: {
        userId: context.session?.user.id,
        instruction: prompt,
        dateRange: { from: new Date().toISOString().slice(0, 10), days: 90 },
        contextWindow: buildContextWindow(context)
      }
    });
    setLoading(false);

    if (error || data?.error) {
      setMessage(resolveInvokeError(error, data));
      return;
    }

    const parsed = portfolioScanSchema.safeParse(data);
    if (!parsed.success) {
      setMessage("Problem z AI: modyfikacja zwróciła niepoprawny format. Spróbuj opisać zmianę prościej.");
      return;
    }

    setRisks(parsed.data.risks);
    setProposals(parsed.data.proposals);
    setAdvisorBriefing(parsed.data.advisorBriefing ?? null);
    if (!parsed.data.proposals.length) {
      setMessage("AI nie znalazło bezpiecznej zmiany do zastosowania. Doprecyzuj projekt, zadanie albo termin.");
    }
  }

  async function requestAdvisor() {
    if (!prompt.trim()) {
      setMessage("Napisz pytanie dla doradcy, np. Co powinienem zrobić dziś jako pierwsze?");
      return;
    }

    setLoading(true);
    setMessage(null);
    setDraft(null);
    setAdvisorBriefing(null);
    const { data, error } = await supabase.functions.invoke("ai-portfolio-scan", {
      body: {
        userId: context.session?.user.id,
        instruction: prompt,
        advisorMode: true,
        dateRange: { from: new Date().toISOString().slice(0, 10), days: 90 },
        contextWindow: buildContextWindow(context)
      }
    });
    setLoading(false);

    if (error || data?.error) {
      setMessage(resolveInvokeError(error, data));
      return;
    }

    const parsed = portfolioScanSchema.safeParse(data);
    if (!parsed.success) {
      setMessage("Problem z AI: doradca zwrócił niepoprawny format. Spróbuj zadać krótsze pytanie.");
      return;
    }

    setRisks(parsed.data.risks);
    setProposals(parsed.data.proposals);
    setAdvisorBriefing(parsed.data.advisorBriefing ?? {
      summary: "Doradca przeanalizował portfel, ale nie zwrócił osobnego briefingu. Sprawdź ryzyka i propozycje poniżej.",
      nextActions: [],
      decisions: [],
      questions: []
    });
  }

  async function acceptDraft() {
    if (!draft) return;
    setLoading(true);
    setMessage(null);
    try {
      await context.createFromDraft(draft, targetProjectId);
      setDraft(null);
      setPrompt("");
      setTargetProjectId(null);
      setMessage(targetProjectId
        ? "Fazy i zadania dodane do wybranego projektu."
        : "Projekt zapisany i dodany do widoków."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać projektu.");
    } finally {
      setLoading(false);
    }
  }

  async function applyProposal(proposal: CopilotProposal) {
    setLoading(true);
    setMessage(null);
    try {
      await context.applyProposal(proposal);
      setProposals((current) => current.filter((item) => item.id !== proposal.id));
      setMessage("Propozycja zastosowana po zatwierdzeniu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zastosować propozycji.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="copilot-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="copilot-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="AI Copilot" tabIndex={-1}>
        <div className="copilot-header">
          <div>
            <Bot size={20} />
            <strong>AI Copilot</strong>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Zamknij Copilota"><X size={18} /></button>
        </div>

        <div className="copilot-mode-switch" role="tablist" aria-label="Tryb pracy copilota">
          <button
            className={mode === "create" ? "active" : ""}
            onClick={() => setMode("create")}
            type="button"
          >
            Nowy plan
          </button>
          <button
            className={mode === "modify" ? "active" : ""}
            onClick={() => setMode("modify")}
            type="button"
          >
            Popraw istniejące
          </button>
          <button
            className={mode === "advisor" ? "active" : ""}
            onClick={() => setMode("advisor")}
            type="button"
          >
            Doradca
          </button>
        </div>

        <form onSubmit={onSubmit} className="copilot-form">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={mode === "create"
              ? "Opisz nowy projekt: zakres, start, deadline, ważność..."
              : mode === "modify"
                ? "Opisz poprawkę, np. Przesuń zadania CEO o tydzień i oznacz projekt COO jako at risk..."
                : "Zapytaj doradcę, np. Co jest teraz najważniejsze? Gdzie mam ryzyko? Jak ułożyć tydzień?"
            }
            required
          />
          <div className="copilot-actions">
            <button className="secondary-button" type="button" onClick={() => void runScan()}>
              Skanuj portfel
            </button>
            <button className="primary-button" disabled={loading || !prompt.trim()}>
              {mode === "create" ? <Send size={16} /> : <RefreshCw size={16} />}
              {mode === "create" ? "Rozpisz" : mode === "modify" ? "Zaproponuj poprawki" : "Zapytaj doradcę"}
            </button>
          </div>
        </form>

        {message && <div className="warning-box">{message}</div>}

        {advisorBriefing && (
          <section className="preview-box advisor-briefing">
            <h3>Briefing doradcy</h3>
            <p>{advisorBriefing.summary}</p>
            {advisorBriefing.nextActions.length > 0 && (
              <>
                <strong>Następne kroki</strong>
                <ul>{advisorBriefing.nextActions.map((item) => <li key={item}>{item}</li>)}</ul>
              </>
            )}
            {advisorBriefing.decisions.length > 0 && (
              <>
                <strong>Decyzje do podjęcia</strong>
                <ul>{advisorBriefing.decisions.map((item) => <li key={item}>{item}</li>)}</ul>
              </>
            )}
            {advisorBriefing.questions.length > 0 && (
              <>
                <strong>Pytania kontrolne</strong>
                <ul>{advisorBriefing.questions.map((item) => <li key={item}>{item}</li>)}</ul>
              </>
            )}
          </section>
        )}

        {draft && (
          <section className="preview-box">
            <h3>{draft.project.name}</h3>
            {draft.phases.map((phase) => (
              <div className="preview-phase" key={phase.name}>
                <strong>{phase.name}</strong>
                <span>{phase.start_date} → {phase.end_date}</span>
                <ul>
                  {phase.tasks.map((task) => <li key={task.name}>{task.name} · {task.due_date} · {task.priority}/{task.impact}</li>)}
                </ul>
              </div>
            ))}
            <div className="copilot-target-project">
              <label htmlFor="copilot-target-select">Dodaj do projektu</label>
              <select
                id="copilot-target-select"
                value={targetProjectId ?? ""}
                onChange={(e) => setTargetProjectId(e.target.value || null)}
              >
                <option value="">— Nowy projekt —</option>
                {context.projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <button className="primary-button" onClick={() => void acceptDraft()} disabled={loading}>
              <Check size={16} />
              {targetProjectId ? "Dodaj do projektu" : "Zatwierdź i zapisz"}
            </button>
          </section>
        )}

        {(risks.length > 0 || proposals.length > 0) && (
          <section className="preview-box">
            <h3>Propozycje copilota</h3>
            {risks.map((risk) => <p key={risk.id} className={`risk-line ${risk.severity}`}>{risk.title}: {risk.reason}</p>)}
            {proposals.map((proposal) => (
              <div className="proposal" key={proposal.id}>
                <strong>{proposal.title}</strong>
                <span>{proposal.rationale}</span>
                <ul>
                  {proposal.changes.map((change) => (
                    <li key={`${proposal.id}-${change.entity}-${change.id}-${change.field}`}>
                      {change.entity}.{change.field}: {String(change.from ?? "-")} → {String(change.to ?? "-")}
                    </li>
                  ))}
                </ul>
                <button className="secondary-button" onClick={() => void applyProposal(proposal)} disabled={loading}>
                  <Check size={16} />
                  Zastosuj propozycję
                </button>
              </div>
            ))}
          </section>
        )}
      </aside>
    </div>
  );
}

function buildContextWindow(context: AppContextValue) {
  return {
    projects: context.projects,
    phases: context.phases,
    tasks: context.tasks.filter((t) => t.status !== "done")
  };
}

function resolveInvokeError(error: unknown, data: unknown): string {
  const dataMsg = typeof data === "object" && data !== null && "error" in data
    ? String((data as { error: unknown }).error)
    : null;
  return friendlyAiError(dataMsg ?? error);
}
