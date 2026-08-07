import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import { CheckSquare, RotateCcw, Square } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import type { Phase, Project, Task } from "../lib/types";

type MindNodeKind = "project" | "phase" | "task";
type ColorMode = "project" | "status" | "risk";
type Position = { x: number; y: number };
type DragState = { id: string; offsetX: number; offsetY: number } | null;

interface MindNode {
  id: string;
  kind: MindNodeKind;
  title: string;
  meta: string;
  color: string;
  status?: string;
  risk?: string;
  task?: Task;
}

interface MindLink {
  from: string;
  to: string;
}

const STORAGE_KEY = "ai-project-hub:mind-map-positions";
const NODE_WIDTH = 230;
const NODE_HEIGHT = 92;

export function MindMapPage({ context }: { context: AppContextValue }) {
  const [projectFilter, setProjectFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [colorMode, setColorMode] = useState<ColorMode>("project");
  const [visibleLevels, setVisibleLevels] = useState<Record<MindNodeKind, boolean>>({
    project: true,
    phase: true,
    task: true
  });
  const [positions, setPositions] = useState<Record<string, Position>>(() => readStoredPositions());
  const [drag, setDrag] = useState<DragState>(null);
  const [message, setMessage] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () => context.projects.filter((project) => projectFilter === "all" || project.id === projectFilter),
    [context.projects, projectFilter]
  );

  const { nodes, links, suggestedPositions } = useMemo(
    () => buildMindMap(visibleProjects, context.phases, context.tasks),
    [context.phases, context.tasks, visibleProjects]
  );
  const visibleNodes = useMemo(
    () => nodes.filter((node) => {
      if (!visibleLevels[node.kind]) return false;
      if (node.kind === "task" && taskStatusFilter !== "all" && node.task?.status !== taskStatusFilter) return false;
      return true;
    }),
    [nodes, taskStatusFilter, visibleLevels]
  );
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleLinks = useMemo(
    () => links.filter((link) => visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to)),
    [links, visibleNodeIds]
  );

  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);

  useEffect(() => {
    setPositions((current) => {
      const next: Record<string, Position> = {};
      for (const id of Object.keys(suggestedPositions)) {
        next[id] = current[id] ?? suggestedPositions[id];
      }
      return next;
    });
  }, [suggestedPositions]);

  useEffect(() => {
    const compacted = Object.fromEntries(Object.entries(positions).filter(([id]) => nodeIds.has(id)));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted));
  }, [nodeIds, positions]);

  const canvasSize = useMemo(() => {
    const values = visibleNodes.map((node) => positions[node.id] ?? suggestedPositions[node.id] ?? { x: 0, y: 0 });
    const maxX = Math.max(980, ...values.map((position) => position.x + NODE_WIDTH + 80));
    const maxY = Math.max(620, ...values.map((position) => position.y + NODE_HEIGHT + 80));
    return { width: maxX, height: maxY };
  }, [positions, suggestedPositions, visibleNodes]);

  function resetLayout() {
    setPositions(suggestedPositions);
    setMessage("Układ roboczy został zresetowany.");
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, id: string) {
    const position = positions[id] ?? suggestedPositions[id] ?? { x: 0, y: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y
    });
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setPositions((current) => ({
      ...current,
      [drag.id]: {
        x: Math.max(16, event.clientX - drag.offsetX),
        y: Math.max(16, event.clientY - drag.offsetY)
      }
    }));
  }

  function endDrag() {
    setDrag(null);
  }

  function toggleLevel(kind: MindNodeKind) {
    setVisibleLevels((current) => ({ ...current, [kind]: !current[kind] }));
  }

  async function toggleDone(task: Task) {
    setMessage(null);
    try {
      await context.updateTaskStatus(task.id, task.status === "done" ? "in_progress" : "done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zmienić statusu zadania.");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Brudnopis planu</span>
          <h1>Mind Map</h1>
        </div>
        <div className="mind-map-toolbar">
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">Wszystkie projekty</option>
            {context.projects.map((project) => (
              <option value={project.id} key={project.id}>{project.name}</option>
            ))}
          </select>
          <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)}>
            <option value="all">Wszystkie statusy</option>
            <option value="backlog">Backlog</option>
            <option value="in_progress">W toku</option>
            <option value="review">Recenzja</option>
            <option value="done">Gotowe</option>
          </select>
          <select value={colorMode} onChange={(event) => setColorMode(event.target.value as ColorMode)}>
            <option value="project">Kolor: projekt</option>
            <option value="status">Kolor: status</option>
            <option value="risk">Kolor: ryzyko</option>
          </select>
          <button className="secondary-button" type="button" onClick={resetLayout}>
            <RotateCcw size={16} />
            Reset układu
          </button>
        </div>
      </header>

      <div className="mind-map-controls">
        {(["project", "phase", "task"] as MindNodeKind[]).map((kind) => (
          <button
            className={`mind-map-toggle ${visibleLevels[kind] ? "active" : ""}`}
            key={kind}
            type="button"
            onClick={() => toggleLevel(kind)}
          >
            {kind === "project" ? "Projekty" : kind === "phase" ? "Fazy" : "Zadania"}
          </button>
        ))}
        <span>{visibleNodes.length} widocznych punktów</span>
      </div>

      <div className="mind-map-hint">
        Przesuwaj punkty, żeby poukładać plan roboczo. Układ zapisuje się lokalnie w przeglądarce, a checkboxy zadań zapisują status w Supabase.
      </div>
      {message && <div className="warning-box">{message}</div>}

      <div className="mind-map-shell">
        {visibleNodes.length ? (
          <div
            className="mind-map-canvas"
            style={{ width: canvasSize.width, height: canvasSize.height }}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <svg className="mind-map-link-layer" width={canvasSize.width} height={canvasSize.height}>
              {visibleLinks.map((link) => {
                const from = positions[link.from] ?? suggestedPositions[link.from];
                const to = positions[link.to] ?? suggestedPositions[link.to];
                if (!from || !to) return null;
                const startX = from.x + NODE_WIDTH;
                const startY = from.y + NODE_HEIGHT / 2;
                const endX = to.x;
                const endY = to.y + NODE_HEIGHT / 2;
                const midX = startX + Math.max(40, (endX - startX) / 2);
                return (
                  <path
                    className="mind-map-link"
                    key={`${link.from}-${link.to}`}
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                  />
                );
              })}
            </svg>

            {visibleNodes.map((node) => {
              const position = positions[node.id] ?? suggestedPositions[node.id] ?? { x: 0, y: 0 };
              const nodeColor = colorForNode(node, colorMode);
              const nodeStyle = {
                left: position.x,
                top: position.y,
                borderColor: nodeColor,
                "--node-accent": nodeColor
              } as CSSProperties;
              return (
                <div
                  className={`mind-map-node ${node.kind} ${node.risk ?? ""} ${node.task?.status === "done" ? "done" : ""}`}
                  key={node.id}
                  style={nodeStyle}
                  onPointerDown={(event) => startDrag(event, node.id)}
                >
                  <div className="mind-map-node-top">
                    <span className="color-dot" style={{ background: nodeColor }} />
                    <span className="status-pill">{node.kind}</span>
                  </div>
                  <strong>{node.title}</strong>
                  <span>{node.meta}</span>
                  {node.task && (
                    <button
                      className={`done-toggle ${node.task.status === "done" ? "checked" : ""}`}
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleDone(node.task as Task);
                      }}
                    >
                      {node.task.status === "done" ? <CheckSquare size={15} /> : <Square size={15} />}
                      {node.task.status === "done" ? "Gotowe" : "Do zrobienia"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            Brak widocznych punktów. Włącz poziom projektu, fazy lub zadania albo zmień filtr.
          </div>
        )}
      </div>
    </div>
  );
}

function buildMindMap(projects: Project[], phases: Phase[], tasks: Task[]) {
  const nodes: MindNode[] = [];
  const links: MindLink[] = [];
  const suggestedPositions: Record<string, Position> = {};
  const projectIds = new Set(projects.map((project) => project.id));
  const projectDepths = buildProjectDepths(projects);
  const orderedProjects = orderProjectsForMap(projects);
  let row = 0;

  for (const project of orderedProjects) {
    const projectPhases = phases
      .filter((phase) => phase.project_id === project.id)
      .sort((a, b) => a.order_index - b.order_index || a.start_date.localeCompare(b.start_date));
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    const projectNodeId = nodeId("project", project.id);
    const depth = projectDepths.get(project.id) ?? 0;
    const projectX = 32 + depth * 300;
    const projectY = 40 + row * 148;

    nodes.push({
      id: projectNodeId,
      kind: "project",
      title: project.name,
      meta: `${project.status} · ${projectTasks.length} zadań`,
      color: project.color,
      status: project.status
    });
    suggestedPositions[projectNodeId] = { x: projectX, y: projectY };

    if (project.parent_project_id && projectIds.has(project.parent_project_id)) {
      links.push({ from: nodeId("project", project.parent_project_id), to: projectNodeId });
    }

    if (!projectPhases.length && projectTasks.length) {
      for (const [taskIndex, task] of projectTasks.entries()) {
        addTaskNode(task, project.color, projectNodeId, projectX + 300, projectY + taskIndex * 116);
      }
      row += Math.max(1, projectTasks.length);
      continue;
    }

    for (const [phaseIndex, phase] of projectPhases.entries()) {
      const phaseTasks = projectTasks
        .filter((task) => task.phase_id === phase.id)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      const phaseNodeId = nodeId("phase", phase.id);
      const phaseY = projectY + phaseIndex * 148;

      nodes.push({
        id: phaseNodeId,
        kind: "phase",
        title: phase.name,
        meta: `${phase.start_date} → ${phase.end_date}`,
        color: project.color,
        status: "phase"
      });
      links.push({ from: projectNodeId, to: phaseNodeId });
      suggestedPositions[phaseNodeId] = { x: projectX + 300, y: phaseY };

      for (const [taskIndex, task] of phaseTasks.entries()) {
        addTaskNode(task, project.color, phaseNodeId, projectX + 610, phaseY + taskIndex * 112);
      }

      row += Math.max(1, phaseTasks.length);
    }

    row += 1;
  }

  function addTaskNode(task: Task, color: string, parentId: string, x: number, y: number) {
    const taskNodeId = nodeId("task", task.id);
    nodes.push({
      id: taskNodeId,
      kind: "task",
      title: task.name,
      meta: `${task.due_date} · ${task.priority} · ${task.impact}`,
      color,
      status: task.status,
      risk: task.risk_status,
      task
    });
    links.push({ from: parentId, to: taskNodeId });
    suggestedPositions[taskNodeId] = { x, y };
  }

  return { nodes, links, suggestedPositions };
}

function orderProjectsForMap(projects: Project[]) {
  const childrenByParent = new Map<string, Project[]>();
  const roots: Project[] = [];

  for (const project of projects) {
    if (project.parent_project_id && projects.some((item) => item.id === project.parent_project_id)) {
      const children = childrenByParent.get(project.parent_project_id) ?? [];
      children.push(project);
      childrenByParent.set(project.parent_project_id, children);
    } else {
      roots.push(project);
    }
  }

  const sortProjects = (items: Project[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const ordered: Project[] = [];
  const visit = (project: Project, visited: Set<string>) => {
    if (visited.has(project.id)) return;
    ordered.push(project);
    const nextVisited = new Set(visited);
    nextVisited.add(project.id);
    for (const child of sortProjects(childrenByParent.get(project.id) ?? [])) {
      visit(child, nextVisited);
    }
  };

  for (const root of sortProjects(roots)) {
    visit(root, new Set());
  }

  return ordered;
}

function buildProjectDepths(projects: Project[]) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const depths = new Map<string, number>();

  const depthFor = (project: Project, visited = new Set<string>()): number => {
    if (depths.has(project.id)) return depths.get(project.id) ?? 0;
    if (!project.parent_project_id || visited.has(project.parent_project_id)) {
      depths.set(project.id, 0);
      return 0;
    }
    const parent = projectById.get(project.parent_project_id);
    if (!parent) {
      depths.set(project.id, 0);
      return 0;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(project.id);
    const depth = Math.min(3, depthFor(parent, nextVisited) + 1);
    depths.set(project.id, depth);
    return depth;
  };

  for (const project of projects) {
    depthFor(project);
  }

  return depths;
}

function nodeId(kind: MindNodeKind, id: string) {
  return `${kind}:${id}`;
}

function readStoredPositions() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Position>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function colorForNode(node: MindNode, colorMode: ColorMode) {
  if (colorMode === "project") return node.color;
  if (colorMode === "risk") {
    if (node.risk === "blocked" || node.risk === "risk") return "#ff5c7a";
    if (node.risk === "watch") return "#f8c14a";
    if (node.task?.status === "done") return "#49d17d";
    return node.kind === "project" ? node.color : "#57c7ff";
  }

  switch (node.status) {
    case "done":
    case "on_track":
      return "#49d17d";
    case "in_progress":
      return "#57c7ff";
    case "review":
    case "at_risk":
      return "#f8c14a";
    case "paused":
    case "backlog":
      return "#9ba4b5";
    default:
      return node.kind === "phase" ? "#b59cff" : node.color;
  }
}
