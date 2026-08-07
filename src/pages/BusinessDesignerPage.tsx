import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Bot, Briefcase, Check, Copy, Link2, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import type { z } from "zod";
import type { AppContextValue } from "../lib/appContext";
import type { BusinessCanvas, BusinessCanvasKey, BusinessDesign, BusinessMapNode, BusinessMapNodeKind, BusinessVisualMap } from "../lib/types";
import { businessAnalysisSchema } from "../lib/contracts";
import { friendlyAiError } from "../lib/aiErrors";
import { supabase } from "../lib/supabase";

const NEW_DESIGN_ID = "new";

const emptyCanvas: BusinessCanvas = {
  customerSegments: "",
  problem: "",
  solution: "",
  uniqueValue: "",
  channels: "",
  revenue: "",
  costs: "",
  keyMetrics: "",
  advantage: "",
  experiments: ""
};

const emptyVisualMap: BusinessVisualMap = {
  nodes: [],
  links: []
};

const nodeKinds: Array<{ value: BusinessMapNodeKind; label: string }> = [
  { value: "business", label: "Biznes" },
  { value: "project", label: "Projekt" },
  { value: "area", label: "Obszar" },
  { value: "goal", label: "Cel" },
  { value: "task", label: "Zadanie" },
  { value: "risk", label: "Ryzyko" },
  { value: "segment", label: "Klient" },
  { value: "problem", label: "Problem" },
  { value: "solution", label: "Rozwiązanie" },
  { value: "channel", label: "Kanał" },
  { value: "revenue", label: "Przychód" },
  { value: "cost", label: "Koszt" },
  { value: "metric", label: "Metryka" },
  { value: "experiment", label: "Eksperyment" },
  { value: "note", label: "Notatka" }
];

type BusinessAnalysis = z.infer<typeof businessAnalysisSchema>;

const canvasFields: Array<{ key: BusinessCanvasKey; label: string; prompt: string }> = [
  { key: "customerSegments", label: "Klienci", prompt: "Segmenty, persony, kontekst zakupu" },
  { key: "problem", label: "Problem", prompt: "Boleści, alternatywy, koszt braku zmiany" },
  { key: "solution", label: "Rozwiązanie", prompt: "Produkt, usługa, proces, zakres MVP" },
  { key: "uniqueValue", label: "Propozycja wartości", prompt: "Dlaczego ktoś wybierze właśnie to" },
  { key: "channels", label: "Kanały", prompt: "Sprzedaż, dystrybucja, partnerzy, content" },
  { key: "revenue", label: "Przychody", prompt: "Model cenowy, pakiety, upsell, płatności" },
  { key: "costs", label: "Koszty", prompt: "Stałe, zmienne, narzędzia, ludzie, ryzyka marży" },
  { key: "keyMetrics", label: "Metryki", prompt: "North star, konwersje, retencja, unit economics" },
  { key: "advantage", label: "Przewaga", prompt: "Dane, marka, relacje, technologia, know-how" },
  { key: "experiments", label: "Eksperymenty", prompt: "Testy na najbliższe 7-30 dni" }
];

export function BusinessDesignerPage({ context }: { context: AppContextValue }) {
  const [mode, setMode] = useState<"canvas" | "visual" | "analysis">("canvas");
  const [selectedId, setSelectedId] = useState(context.businessDesigns[0]?.id ?? NEW_DESIGN_ID);
  const [title, setTitle] = useState("Nowy model biznesowy");
  const [projectId, setProjectId] = useState("");
  const [canvas, setCanvas] = useState<BusinessCanvas>(emptyCanvas);
  const [visualMap, setVisualMap] = useState<BusinessVisualMap>(emptyVisualMap);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeKind, setNewNodeKind] = useState<BusinessMapNodeKind>("note");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState("");
  const [connectToId, setConnectToId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [dragState, setDragState] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [analysis, setAnalysis] = useState<BusinessAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const dragMovedRef = useRef(false);

  const selectedDesign = useMemo(
    () => selectedId === NEW_DESIGN_ID
      ? null
      : context.businessDesigns.find((design) => design.id === selectedId) ?? null,
    [context.businessDesigns, selectedId]
  );
  const linkedProject = useMemo(
    () => context.projects.find((project) => project.id === projectId),
    [context.projects, projectId]
  );
  const filledFields = useMemo(
    () => canvasFields.filter((field) => canvas[field.key].trim()).length,
    [canvas]
  );
  const completion = Math.round((filledFields / canvasFields.length) * 100);
  const selectedNode = useMemo(
    () => visualMap.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [selectedNodeId, visualMap.nodes]
  );
  const canvasSize = useMemo(() => {
    const maxX = Math.max(860, ...visualMap.nodes.map((node) => node.x + 240));
    const maxY = Math.max(560, ...visualMap.nodes.map((node) => node.y + 150));
    return { width: maxX, height: maxY };
  }, [visualMap.nodes]);

  useEffect(() => {
    if (selectedId !== NEW_DESIGN_ID && !selectedDesign) {
      setSelectedId(context.businessDesigns[0]?.id ?? NEW_DESIGN_ID);
    }
  }, [context.businessDesigns, selectedDesign, selectedId]);

  useEffect(() => {
    if (!selectedDesign) return;
    setTitle(selectedDesign.title);
    setProjectId(selectedDesign.project_id ?? "");
    setCanvas({ ...emptyCanvas, ...selectedDesign.canvas });
    setVisualMap(selectedDesign.visual_map ?? emptyVisualMap);
    setSelectedNodeId(null);
    setNotes(selectedDesign.notes ?? "");
    setAnalysis(null);
  }, [selectedDesign]);

  function startNewDesign() {
    setSelectedId(NEW_DESIGN_ID);
    setTitle("Nowy model biznesowy");
    setProjectId(context.projects[0]?.id ?? "");
    setCanvas(emptyCanvas);
    setVisualMap(emptyVisualMap);
    setSelectedNodeId(null);
    setNotes("");
    setAnalysis(null);
    setMessage(null);
  }

  function duplicateDesign() {
    setSelectedId(NEW_DESIGN_ID);
    setTitle(`${title.trim() || "Model biznesowy"} - kopia`);
    setMessage("Utworzono kopię roboczą. Kliknij Zapisz, żeby dodać ją do bazy.");
  }

  async function saveDesign(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const input = {
        title,
        projectId: projectId || null,
        canvas,
        visualMap,
        notes
      };

      if (selectedId !== NEW_DESIGN_ID) {
        await context.updateBusinessDesign(selectedId, input);
        setMessage("Model biznesowy zapisany.");
      } else {
        const created = await context.createBusinessDesign(input);
        setSelectedId(created.id);
        setMessage("Nowy model biznesowy zapisany.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać modelu biznesowego.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDesign(design: BusinessDesign) {
    if (!window.confirm(`Usunąć model "${design.title}"?`)) return;
    setMessage(null);
    const next = context.businessDesigns.find((item) => item.id !== design.id);
    try {
      await context.deleteBusinessDesign(design.id);
      setSelectedId(next?.id ?? NEW_DESIGN_ID);
      if (!next) startNewDesign();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się usunąć modelu biznesowego.");
    }
  }

  function addNode() {
    const nextNode: BusinessMapNode = {
      id: createId("node"),
      title: newNodeTitle.trim() || nodeKinds.find((kind) => kind.value === newNodeKind)?.label || "Punkt",
      kind: newNodeKind,
      x: 80 + (visualMap.nodes.length % 4) * 190,
      y: 80 + Math.floor(visualMap.nodes.length / 4) * 132,
      notes: ""
    };
    setVisualMap((current) => ({ ...current, nodes: [...current.nodes, nextNode] }));
    setSelectedNodeId(nextNode.id);
    setNewNodeTitle("");
    setMode("visual");
  }

  function updateNode(nodeId: string, patch: Partial<BusinessMapNode>) {
    setVisualMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node)
    }));
  }

  function deleteNode(nodeId: string) {
    setVisualMap((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      links: current.links.filter((link) => link.from !== nodeId && link.to !== nodeId)
    }));
    setSelectedNodeId((current) => current === nodeId ? null : current);
    setConnectFromId((current) => current === nodeId ? "" : current);
    setConnectToId((current) => current === nodeId ? "" : current);
  }

  function createLink(fromId: string, toId: string, label: string) {
    const nodeIds = new Set(visualMap.nodes.map((node) => node.id));
    if (!fromId || !toId || fromId === toId || !nodeIds.has(fromId) || !nodeIds.has(toId)) {
      setMessage("Wybierz dwa różne punkty do połączenia.");
      return false;
    }
    const exists = visualMap.links.some((link) =>
      (link.from === fromId && link.to === toId) ||
      (link.from === toId && link.to === fromId)
    );
    if (exists) {
      setMessage("Te punkty są już połączone.");
      return false;
    }
    setVisualMap((current) => ({
      ...current,
      links: [...current.links, { id: createId("link"), from: fromId, to: toId, label: label.trim() }]
    }));
    setMessage(null);
    return true;
  }

  function addLink() {
    if (createLink(connectFromId, connectToId, linkLabel)) {
      setLinkLabel("");
    }
  }

  function beginLinkFrom(nodeId: string) {
    setConnectFromId(nodeId);
    setConnectToId("");
    setMessage(null);
  }

  function finishLinkOnNode(nodeId: string) {
    if (dragMovedRef.current || !connectFromId) return;
    if (connectFromId === nodeId) {
      setSelectedNodeId(nodeId);
      return;
    }
    if (createLink(connectFromId, nodeId, linkLabel)) {
      setConnectFromId("");
      setConnectToId("");
      setLinkLabel("");
    }
  }

  function deleteLink(linkId: string) {
    setVisualMap((current) => ({
      ...current,
      links: current.links.filter((link) => link.id !== linkId)
    }));
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, node: BusinessMapNode) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragMovedRef.current = false;
    setSelectedNodeId(node.id);
    setDragState({
      id: node.id,
      offsetX: event.clientX - node.x,
      offsetY: event.clientY - node.y
    });
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    dragMovedRef.current = true;
    updateNode(dragState.id, {
      x: Math.max(16, event.clientX - dragState.offsetX),
      y: Math.max(16, event.clientY - dragState.offsetY)
    });
  }

  function endDrag() {
    setDragState(null);
  }

  async function analyzeBusinessModel() {
    setAnalysisLoading(true);
    setMessage(null);
    setAnalysis(null);
    const designPayload = {
      title,
      project: linkedProject ? { name: linkedProject.name, goal: linkedProject.goal, status: linkedProject.status } : null,
      canvas,
      visualMap,
      notes
    };
    const { data, error } = await supabase.functions.invoke("ai-business-analyze", {
      body: {
        design: designPayload,
        portfolioContext: {
          projects: context.projects.map((project) => ({ id: project.id, name: project.name, status: project.status, goal: project.goal })),
          tasks: context.tasks
            .filter((task) => !projectId || task.project_id === projectId)
            .slice(0, 40)
            .map((task) => ({ name: task.name, status: task.status, dueDate: task.due_date, priority: task.priority, impact: task.impact }))
        }
      }
    });
    setAnalysisLoading(false);

    if (error) {
      setMessage(friendlyAiError(error));
      return;
    }

    const parsed = businessAnalysisSchema.safeParse(data);
    if (!parsed.success) {
      setMessage("Problem z AI: analiza modelu biznesowego ma niepoprawny format. Spróbuj ponownie.");
      return;
    }

    setMode("analysis");
    setAnalysis(parsed.data);
  }

  return (
    <div className="page business-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Strategy workspace</span>
          <h1>Projektowanie biznesu</h1>
        </div>
        <div className="business-header-actions">
          <button className="secondary-button" type="button" onClick={startNewDesign}>
            <Plus size={16} />
            Nowy
          </button>
          <button className="primary-button" type="button" onClick={() => void saveDesign()} disabled={saving}>
            {saving ? <Check size={16} /> : <Save size={16} />}
            {saving ? "Zapisuję" : "Zapisz"}
          </button>
        </div>
      </header>

      {context.error && <div className="warning-box">{context.error}</div>}
      {message && <div className="warning-box">{message}</div>}

      <section className="business-layout">
        <aside className="business-sidebar panel">
          <div className="panel-header">
            <h2><Briefcase size={17} />Modele</h2>
            <span>{context.businessDesigns.length}</span>
          </div>
          <div className="business-design-list">
            {context.businessDesigns.map((design) => {
              const project = context.projects.find((item) => item.id === design.project_id);
              return (
                <button
                  className={`business-design-item ${design.id === selectedId ? "active" : ""}`}
                  type="button"
                  key={design.id}
                  onClick={() => {
                    setSelectedId(design.id);
                    setMessage(null);
                  }}
                >
                  <strong>{design.title}</strong>
                  <span>{project?.name ?? "Bez projektu"} · {formatDate(design.updated_at)}</span>
                </button>
              );
            })}
            {!context.businessDesigns.length && (
              <div className="empty-state">Brak zapisanych modeli. Wypełnij canvas i zapisz pierwszy szkic.</div>
            )}
          </div>
        </aside>

        <form className="business-editor" onSubmit={(event) => void saveDesign(event)}>
          <section className="panel business-control-panel">
            <div className="business-title-grid">
              <label>
                <span>Nazwa modelu</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              <label>
                <span>Projekt</span>
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                  <option value="">Bez powiązania</option>
                  {context.projects.map((project) => (
                    <option value={project.id} key={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
              <div className="business-score">
                <span className="eyebrow">Wypełnienie</span>
                <strong>{completion}%</strong>
                <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
              </div>
            </div>
            {linkedProject && (
              <div className="business-project-link">
                <span className="color-dot" style={{ background: linkedProject.color }} />
                <strong>{linkedProject.name}</strong>
                <span>{linkedProject.goal ?? "Brak celu strategicznego"}</span>
              </div>
            )}
            <div className="business-mode-switch segmented-control">
              <button className={mode === "canvas" ? "active" : ""} type="button" onClick={() => setMode("canvas")}>
                Canvas
              </button>
              <button className={mode === "visual" ? "active" : ""} type="button" onClick={() => setMode("visual")}>
                Wizualny
              </button>
              <button className={mode === "analysis" ? "active" : ""} type="button" onClick={() => setMode("analysis")}>
                AI analiza
              </button>
            </div>
          </section>

          {mode === "canvas" ? (
            <section className="business-canvas-grid">
              {canvasFields.map((field) => (
                <label className={`business-canvas-cell business-cell-${field.key}`} key={field.key}>
                  <span>{field.label}</span>
                  <textarea
                    value={canvas[field.key]}
                    onChange={(event) => setCanvas((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.prompt}
                  />
                </label>
              ))}
            </section>
          ) : mode === "visual" ? (
            <section className="business-visual-panel">
              <div className="business-visual-toolbar panel">
                <input value={newNodeTitle} onChange={(event) => setNewNodeTitle(event.target.value)} placeholder="Nowy punkt" />
                <select value={newNodeKind} onChange={(event) => setNewNodeKind(event.target.value as BusinessMapNodeKind)}>
                  {nodeKinds.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}
                </select>
                <button className="secondary-button" type="button" onClick={addNode}>
                  <Plus size={16} />
                  Dodaj punkt
                </button>
                <select value={connectFromId} onChange={(event) => setConnectFromId(event.target.value)}>
                  <option value="">Od punktu</option>
                  {visualMap.nodes.map((node) => <option value={node.id} key={node.id}>{node.title}</option>)}
                </select>
                <select value={connectToId} onChange={(event) => setConnectToId(event.target.value)}>
                  <option value="">Do punktu</option>
                  {visualMap.nodes.map((node) => <option value={node.id} key={node.id}>{node.title}</option>)}
                </select>
                <input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Opis połączenia" />
                <button className="secondary-button" type="button" onClick={addLink}>
                  <Link2 size={16} />
                  Połącz
                </button>
                <button className="secondary-button" type="button" disabled={!selectedNodeId} onClick={() => selectedNodeId && beginLinkFrom(selectedNodeId)}>
                  <Link2 size={16} />
                  Start z punktu
                </button>
              </div>

              <div className="business-map-layout">
                <div className="business-map-shell">
                  <div
                    className="business-map-canvas"
                    style={{ width: canvasSize.width, height: canvasSize.height }}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <svg className="business-map-links" width={canvasSize.width} height={canvasSize.height}>
                      {visualMap.links.map((link) => {
                        const from = visualMap.nodes.find((node) => node.id === link.from);
                        const to = visualMap.nodes.find((node) => node.id === link.to);
                        if (!from || !to) return null;
                        const startX = from.x + 82;
                        const startY = from.y + 48;
                        const endX = to.x + 82;
                        const endY = to.y + 48;
                        const midX = (startX + endX) / 2;
                        const midY = (startY + endY) / 2;
                        return (
                          <g key={link.id}>
                            <line className="business-map-link" x1={startX} y1={startY} x2={endX} y2={endY} />
                            {link.label && (
                              <text className="business-map-link-label" x={midX} y={midY - 6}>
                                {link.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                    {visualMap.nodes.map((node) => (
                      <div
                        className={`business-map-node node-${node.kind} ${node.id === selectedNodeId ? "active" : ""} ${node.id === connectFromId ? "connecting" : ""}`}
                        key={node.id}
                        style={{ left: node.x, top: node.y, "--node-color": colorForNodeKind(node.kind) } as CSSProperties}
                        onPointerDown={(event) => startDrag(event, node)}
                        onClick={() => finishLinkOnNode(node.id)}
                      >
                        <span>{nodeKinds.find((kind) => kind.value === node.kind)?.label ?? "Punkt"}</span>
                        <strong>{node.title}</strong>
                        {node.notes && <p>{node.notes}</p>}
                      </div>
                    ))}
                    {!visualMap.nodes.length && (
                      <div className="business-map-empty">Dodaj pierwszy punkt i zbuduj mapę zależności biznesu.</div>
                    )}
                  </div>
                </div>

                <aside className="business-node-panel panel">
                  <div className="panel-header">
                    <h2>Punkt</h2>
                    <span>{visualMap.nodes.length}</span>
                  </div>
                  {selectedNode ? (
                    <div className="business-node-editor">
                      <label>
                        <span>Nazwa</span>
                        <input value={selectedNode.title} onChange={(event) => updateNode(selectedNode.id, { title: event.target.value })} />
                      </label>
                      <label>
                        <span>Typ</span>
                        <select value={selectedNode.kind} onChange={(event) => updateNode(selectedNode.id, { kind: event.target.value as BusinessMapNodeKind })}>
                          {nodeKinds.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Notatka</span>
                        <textarea value={selectedNode.notes} onChange={(event) => updateNode(selectedNode.id, { notes: event.target.value })} />
                      </label>
                      <button className="secondary-button" type="button" onClick={() => beginLinkFrom(selectedNode.id)}>
                        <Link2 size={16} />
                        Start połączenia
                      </button>
                      <button className="secondary-button danger-action" type="button" onClick={() => deleteNode(selectedNode.id)}>
                        <Trash2 size={16} />
                        Usuń punkt
                      </button>
                    </div>
                  ) : (
                    <div className="empty-state">Kliknij punkt na mapie, żeby go edytować.</div>
                  )}

                  <div className="business-link-list">
                    {visualMap.links.map((link) => {
                      const from = visualMap.nodes.find((node) => node.id === link.from);
                      const to = visualMap.nodes.find((node) => node.id === link.to);
                      return (
                        <div className="business-link-row" key={link.id}>
                          <span>{from?.title ?? "?"} → {to?.title ?? "?"}</span>
                          <button className="icon-button" type="button" onClick={() => deleteLink(link.id)} aria-label="Usuń połączenie">
                            <X size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </section>
          ) : (
            <section className="business-analysis-panel">
              <div className="panel business-analysis-hero">
                <div>
                  <span className="eyebrow">AI strategist</span>
                  <h2>Analiza modelu biznesu</h2>
                  <p>AI przejrzy canvas, mapę punktów, notatki i kontekst projektu, a potem zwróci usprawnienia oraz plan wykonania.</p>
                </div>
                <button className="primary-button" type="button" onClick={() => void analyzeBusinessModel()} disabled={analysisLoading}>
                  {analysisLoading ? <Check size={16} /> : <Sparkles size={16} />}
                  {analysisLoading ? "Analizuję" : "Analizuj AI"}
                </button>
              </div>

              {analysis ? (
                <>
                  <section className="panel business-analysis-summary">
                    <div>
                      <Bot size={18} />
                      <p>{analysis.executiveSummary}</p>
                    </div>
                    <div className="business-score-grid">
                      <Score label="Jasność" value={analysis.score.clarity} />
                      <Score label="Viability" value={analysis.score.viability} />
                      <Score label="Focus" value={analysis.score.focus} />
                      <Score label="Gotowość" value={analysis.score.nextStepReadiness} />
                    </div>
                  </section>

                  <section className="business-analysis-grid">
                    <AnalysisList title="Mocne strony" items={analysis.strengths.map((item) => ({ title: item.title, body: item.reason }))} />
                    <AnalysisList title="Ryzyka" items={analysis.risks.map((item) => ({ title: `${item.title} · ${item.severity}`, body: `${item.reason} Mitigacja: ${item.mitigation}` }))} />
                  </section>

                  <section className="panel">
                    <div className="panel-header">
                      <h2>Sugestie usprawniające</h2>
                      <span>{analysis.suggestions.length}</span>
                    </div>
                    <div className="business-suggestion-list">
                      {analysis.suggestions.map((suggestion) => (
                        <div className="business-suggestion" key={suggestion.title}>
                          <div>
                            <strong>{suggestion.title}</strong>
                            <span>Wpływ: {suggestion.impact} · Wysiłek: {suggestion.effort}</span>
                          </div>
                          <p>{suggestion.rationale}</p>
                          <p><strong>Akcja:</strong> {suggestion.action}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="business-analysis-grid">
                    <section className="panel">
                      <div className="panel-header">
                        <h2>Eksperymenty</h2>
                        <span>{analysis.experiments.length}</span>
                      </div>
                      <div className="business-suggestion-list">
                        {analysis.experiments.map((experiment) => (
                          <div className="business-suggestion" key={experiment.title}>
                            <strong>{experiment.title}</strong>
                            <span>{experiment.timeframe}</span>
                            <p>{experiment.hypothesis}</p>
                            <p><strong>Test:</strong> {experiment.method}</p>
                            <p><strong>Metryka:</strong> {experiment.successMetric}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="panel">
                      <div className="panel-header">
                        <h2>Pytania</h2>
                        <span>{analysis.questions.length}</span>
                      </div>
                      <div className="business-question-list">
                        {analysis.questions.map((question) => <div key={question}>{question}</div>)}
                        {!analysis.questions.length && <div className="empty-state">Brak dodatkowych pytań.</div>}
                      </div>
                    </section>
                  </section>

                  <section className="panel">
                    <div className="panel-header">
                      <h2>Plan krok po kroku</h2>
                      <span>{analysis.stepByStepPlan.length}</span>
                    </div>
                    <div className="business-plan-list">
                      {analysis.stepByStepPlan.map((step) => (
                        <div className="business-plan-step" key={`${step.step}-${step.title}`}>
                          <strong>{step.step}. {step.title}</strong>
                          <p>{step.objective}</p>
                          <ul>{step.actions.map((action) => <li key={action}>{action}</li>)}</ul>
                          <span>Rezultat: {step.deliverable}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <div className="empty-state">Uruchom analizę, żeby dostać diagnozę, sugestie i plan działania.</div>
              )}
            </section>
          )}

          <section className="panel business-notes-panel">
            <label>
              <span>Notatki decyzyjne</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Założenia, decyzje, pytania do klienta, następne kroki"
              />
            </label>
            <div className="business-form-actions">
              <button className="secondary-button" type="button" onClick={duplicateDesign}>
                <Copy size={16} />
                Duplikuj
              </button>
              {selectedDesign && (
                <button className="secondary-button danger-action" type="button" onClick={() => void deleteDesign(selectedDesign)}>
                  <Trash2 size={16} />
                  Usuń
                </button>
              )}
              <button className="primary-button" type="submit" disabled={saving}>
                <Save size={16} />
                Zapisz model
              </button>
            </div>
          </section>
        </form>
      </section>
    </div>
  );
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function colorForNodeKind(kind: BusinessMapNodeKind) {
  switch (kind) {
    case "business": return "#57c7ff";
    case "project": return "#8b5cf6";
    case "area": return "#22c55e";
    case "goal": return "#f59e0b";
    case "task": return "#14b8a6";
    case "risk": return "#ef4444";
    case "segment": return "#5ac8fa";
    case "problem": return "#f0526d";
    case "solution": return "#42c77b";
    case "channel": return "#a78bfa";
    case "revenue": return "#f3b83f";
    case "cost": return "#fb7185";
    case "metric": return "#38bdf8";
    case "experiment": return "#34d399";
    default: return "#9aa4b5";
  }
}

function Score({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="business-ai-score">
      <span>{label}</span>
      <strong>{normalized}%</strong>
      <div className="progress-track"><span style={{ width: `${normalized}%` }} /></div>
    </div>
  );
}

function AnalysisList({ title, items }: { title: string; items: Array<{ title: string; body: string }> }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      <div className="business-question-list">
        {items.map((item) => (
          <div key={item.title}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
