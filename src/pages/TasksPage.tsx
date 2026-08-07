import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { AlertCircle, CalendarPlus, Check, CheckCircle2, CheckSquare, Clock, Edit3, ExternalLink, ImagePlus, Plus, Square, Trash2, X } from "lucide-react";
import { GoogleIntegrationStatus } from "../components/GoogleIntegrationStatus";
import type { AppContextValue } from "../lib/appContext";
import type { TaskImage, TaskImpact, TaskPriority, TaskStatus } from "../lib/types";
import { buildTaskIndex } from "../lib/portfolioInsights";

type TaskSortKey =
  | "name"
  | "notes"
  | "images"
  | "project"
  | "area"
  | "assignee"
  | "recurrence"
  | "status"
  | "dueDate"
  | "priority"
  | "impact"
  | "risk"
  | "urgency";

type SortDirection = "asc" | "desc";

const defaultSort: { key: TaskSortKey; direction: SortDirection } = { key: "urgency", direction: "desc" };

export function TasksPage({ context }: { context: AppContextValue }) {
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<TaskPriority | "all">("all");
  const [impact, setImpact] = useState<TaskImpact | "all">("all");
  const [query, setQuery] = useState("");
  const [sortConfig, setSortConfig] = useState(defaultSort);
  const [focusOnly, setFocusOnly] = useState(false);
  const [newTask, setNewTask] = useState({
    projectId: "",
    name: "",
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "medium" as TaskPriority,
    impact: "medium" as TaskImpact,
    area: "",
    notes: "",
    assignee: "",
    recurrence: ""
  });
  const [message, setMessage] = useState<string | null>(null);
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);
  const [uploadingImageTaskId, setUploadingImageTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState({
    projectId: "",
    name: "",
    dueDate: "",
    status: "backlog" as TaskStatus,
    priority: "medium" as TaskPriority,
    impact: "medium" as TaskImpact,
    area: "",
    notes: "",
    assignee: "",
    recurrence: ""
  });
  const newTaskProject = context.projects.find((project) => project.id === (newTask.projectId || context.projects[0]?.id));
  const editTaskProject = context.projects.find((project) => project.id === editTask.projectId);
  const newTaskAreas = newTaskProject?.areas ?? [];
  const editTaskAreas = editTaskProject?.areas ?? [];
  const taskById = useMemo(() => new Map(context.tasks.map((task) => [task.id, task])), [context.tasks]);
  const taskImagesByTask = useMemo(() => {
    const imagesByTask = new Map<string, TaskImage[]>();
    for (const image of context.taskImages) {
      const images = imagesByTask.get(image.task_id) ?? [];
      images.push(image);
      imagesByTask.set(image.task_id, images);
    }
    return imagesByTask;
  }, [context.taskImages]);
  const calendarFeed = useMemo(
    () => context.calendarNotifications.slice(0, 6),
    [context.calendarNotifications]
  );
  const hasActiveFilters = projectId !== "all" || status !== "all" || priority !== "all" || impact !== "all" || Boolean(query.trim()) || focusOnly || sortConfig.key !== defaultSort.key || sortConfig.direction !== defaultSort.direction;

  const rows = useMemo(() => {
    const indexed = buildTaskIndex(context.tasks, context.projects);
    const projectByTask = new Map(indexed.map((item) => [item.task.id, item]));
    const normalizedQuery = query.trim().toLowerCase();

    return context.tasks
      .filter((task) => projectId === "all" || task.project_id === projectId)
      .filter((task) => status === "all" || task.status === status)
      .filter((task) => priority === "all" || task.priority === priority)
      .filter((task) => impact === "all" || task.impact === impact)
      .filter((task) => {
        const indexedTask = projectByTask.get(task.id);
        if (focusOnly && (!indexedTask || indexedTask.urgency < 12 || task.status === "done")) return false;
        if (!normalizedQuery) return true;
        const projectName = indexedTask?.project?.name ?? "";
        return [task.name, task.area ?? "", task.notes ?? "", task.assignee ?? "", projectName, task.status, task.priority, task.impact, task.risk_status, task.due_date]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .map((task) => {
        const indexedTask = projectByTask.get(task.id);
        return {
          task,
          project: indexedTask?.project,
          urgency: indexedTask?.urgency ?? 0,
          daysLeft: indexedTask?.daysLeft ?? 0
        };
      })
      .sort((a, b) => compareTaskRows(a, b, sortConfig, taskImagesByTask));
  }, [context.projects, context.tasks, focusOnly, impact, priority, projectId, query, sortConfig, status, taskImagesByTask]);

  function changeSort(key: TaskSortKey) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key
        ? current.direction === "asc" ? "desc" : "asc"
        : defaultDirectionFor(key)
    }));
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    const targetProject = newTask.projectId || context.projects[0]?.id;
    const taskName = newTask.name.trim();
    if (!targetProject) {
      setMessage("Najpierw utwórz projekt.");
      return;
    }
    if (!taskName) {
      setMessage("Nazwa zadania nie może być pusta.");
      return;
    }
    setMessage(null);
    try {
      await context.createTask({ ...newTask, projectId: targetProject, name: taskName });
      setNewTask((current) => ({ ...current, name: "", notes: "", assignee: "", recurrence: "" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się dodać zadania.");
    }
  }

  function startEdit(task: typeof context.tasks[number]) {
    setEditingTaskId(task.id);
    setEditTask({
      projectId: task.project_id,
      name: task.name,
      dueDate: task.due_date,
      status: task.status,
      priority: task.priority,
      impact: task.impact,
      area: task.area ?? "",
      notes: task.notes ?? "",
      assignee: task.assignee ?? "",
      recurrence: task.recurrence ?? ""
    });
  }

  async function saveEdit(taskId: string) {
    const taskName = editTask.name.trim();
    if (!taskName) {
      setMessage("Nazwa zadania nie może być pusta.");
      return;
    }
    setMessage(null);
    try {
      await context.updateTask(taskId, { ...editTask, name: taskName });
      setEditingTaskId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać zmian.");
    }
  }

  async function sendNotification(taskId: string) {
    setMessage(null);
    setSendingTaskId(taskId);
    try {
      const result = await context.sendTaskNotification(taskId);
      setMessage(formatNotificationMessage(result.workflow));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wysłać powiadomienia.");
    } finally {
      setSendingTaskId(null);
    }
  }

  async function deleteTask(taskId: string, taskName: string) {
    if (!window.confirm(`Usunąć zadanie "${taskName}"?`)) return;
    setMessage(null);
    try {
      await context.deleteTask(taskId);
      setMessage("Zadanie usunięte.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się usunąć zadania.");
    }
  }

  async function uploadTaskImage(taskId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Możesz dodać tylko plik graficzny.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Zdjęcie może mieć maksymalnie 2 MB.");
      return;
    }

    setMessage(null);
    setUploadingImageTaskId(taskId);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await context.addTaskImage(taskId, {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl
      });
      setMessage("Zdjęcie dodane do zadania.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się dodać zdjęcia.");
    } finally {
      setUploadingImageTaskId(null);
    }
  }

  async function deleteTaskImage(imageId: string) {
    setMessage(null);
    try {
      await context.deleteTaskImage(imageId);
      setMessage("Zdjęcie usunięte.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się usunąć zdjęcia.");
    }
  }

  function resetFilters() {
    setProjectId("all");
    setStatus("all");
    setPriority("all");
    setImpact("all");
    setQuery("");
    setSortConfig(defaultSort);
    setFocusOnly(false);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Execution view</span>
          <h1>Lista zadań</h1>
        </div>
        <div className="header-summary">{rows.length} widocznych · {context.tasks.length} łącznie</div>
      </header>

      <div className="filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj zadania, projektu, statusu..." />
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="all">Wszystkie projekty</option>
          {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | "all")}>
          <option value="all">Każdy status</option>
          <option value="backlog">Backlog</option>
          <option value="in_progress">W toku</option>
          <option value="review">Recenzja</option>
          <option value="done">Gotowe</option>
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority | "all")}>
          <option value="all">Każdy priorytet</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select value={impact} onChange={(event) => setImpact(event.target.value as TaskImpact | "all")}>
          <option value="all">Każdy wpływ</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="strategic">Strategic</option>
        </select>
        <select
          value={sortConfig.key}
          onChange={(event) => {
            const key = event.target.value as TaskSortKey;
            setSortConfig({ key, direction: defaultDirectionFor(key) });
          }}
        >
          <option value="urgency">Sort: urgency</option>
          <option value="dueDate">Sort: termin</option>
          <option value="project">Sort: projekt</option>
          <option value="name">Sort: zadanie</option>
          <option value="notes">Sort: notatka</option>
          <option value="images">Sort: zdjęcia</option>
          <option value="area">Sort: obszar</option>
          <option value="assignee">Sort: wykonawca</option>
          <option value="recurrence">Sort: cykl</option>
          <option value="status">Sort: status</option>
          <option value="priority">Sort: priorytet</option>
          <option value="impact">Sort: wpływ</option>
          <option value="risk">Sort: risk</option>
        </select>
        <button className={`secondary-button ${focusOnly ? "active-filter" : ""}`} type="button" onClick={() => setFocusOnly((current) => !current)}>
          Focus only
        </button>
        {hasActiveFilters && (
          <button className="secondary-button" type="button" onClick={resetFilters}>
            Wyczyść filtry
          </button>
        )}
      </div>

      <form className="task-form" onSubmit={createTask}>
        <select value={newTask.projectId} onChange={(event) => setNewTask((current) => ({ ...current, projectId: event.target.value, area: "" }))}>
          <option value="">Projekt</option>
          {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
        <input value={newTask.name} onChange={(event) => setNewTask((current) => ({ ...current, name: event.target.value }))} placeholder="Nowe zadanie bez AI" required />
        <input className="task-area-input" list="new-task-areas" value={newTask.area} onChange={(event) => setNewTask((current) => ({ ...current, area: event.target.value }))} placeholder="Obszar zadania" />
        <datalist id="new-task-areas">
          {newTaskAreas.map((area) => <option value={area} key={area} />)}
        </datalist>
        <textarea className="task-note-input" value={newTask.notes} onChange={(event) => setNewTask((current) => ({ ...current, notes: event.target.value }))} placeholder="Notatka do zadania" />
        <input className="task-assignee-input" value={newTask.assignee} onChange={(event) => setNewTask((current) => ({ ...current, assignee: event.target.value }))} placeholder="Wykonawca" />
        <select value={newTask.recurrence} onChange={(event) => setNewTask((current) => ({ ...current, recurrence: event.target.value }))}>
          <option value="">Jednorazowe</option>
          <option value="daily">Codziennie</option>
          <option value="weekly">Co tydzień</option>
          <option value="biweekly">Co 2 tygodnie</option>
          <option value="monthly">Co miesiąc</option>
        </select>
        <input value={newTask.dueDate} onChange={(event) => setNewTask((current) => ({ ...current, dueDate: event.target.value }))} type="date" required />
        <select value={newTask.priority} onChange={(event) => setNewTask((current) => ({ ...current, priority: event.target.value as TaskPriority }))}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select value={newTask.impact} onChange={(event) => setNewTask((current) => ({ ...current, impact: event.target.value as TaskImpact }))}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="strategic">Strategic</option>
        </select>
        <button className="secondary-button"><Plus size={16} />Dodaj</button>
      </form>
      {message && <div className="warning-box">{message}</div>}
      <GoogleIntegrationStatus />

      <section className="integration-panel">
        <div className="panel-header">
          <h2>Integracja Google Calendar / Gmail</h2>
          <span>{context.calendarNotifications.length}</span>
        </div>
        <div className="integration-feed">
          {calendarFeed.map((notification) => {
            const task = taskById.get(notification.task_id);
            const calendarEventLink = getCalendarEventLink(notification.response_json);
            return (
              <div className={`integration-event ${notification.status}`} key={notification.id}>
                <div className="integration-event-icon">
                  {notification.status === "sent"
                    ? <CheckCircle2 size={16} />
                    : notification.status === "failed"
                    ? <AlertCircle size={16} />
                    : <Clock size={16} />}
                </div>
                <div>
                  <strong>{task?.name ?? "Zadanie usunięte"}</strong>
                  <span>{notification.workflow} · {formatDateTime(notification.created_at)}</span>
                  {notification.error_message && <span className="integration-error">{notification.error_message}</span>}
                  {calendarEventLink && (
                    <a className="link-button" href={calendarEventLink} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} />Otwórz wydarzenie
                    </a>
                  )}
                </div>
                <span className={`status-pill ${notification.status}`}>{notification.status}</span>
              </div>
            );
          })}
          {!calendarFeed.length && (
            <div className="empty-state">
              Brak historii wysyłek. Kliknij ikonę kalendarza przy zadaniu, żeby dodać wydarzenie i przypomnienie.
            </div>
          )}
        </div>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Zadanie" sortKey="name" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Notatka" sortKey="notes" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Zdjęcia" sortKey="images" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Projekt" sortKey="project" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Obszar" sortKey="area" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Wykonawca" sortKey="assignee" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Cykl" sortKey="recurrence" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Termin" sortKey="dueDate" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Priorytet" sortKey="priority" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Wpływ" sortKey="impact" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Risk" sortKey="risk" sortConfig={sortConfig} onSort={changeSort} />
              <SortableHeader label="Urgency" sortKey="urgency" sortConfig={sortConfig} onSort={changeSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ task, project, urgency }) => {
              const images = taskImagesByTask.get(task.id) ?? [];
              return (
              <tr key={task.id}>
                <td data-label="Zadanie">
                  {editingTaskId === task.id ? (
                    <input className="table-input" value={editTask.name} onChange={(event) => setEditTask((current) => ({ ...current, name: event.target.value }))} />
                  ) : (
                    <div className="task-title-cell">
                      <strong>{task.name}</strong>
                    </div>
                  )}
                </td>
                <td data-label="Notatka">
                  {editingTaskId === task.id ? (
                    <textarea className="table-input task-note-edit" value={editTask.notes} onChange={(event) => setEditTask((current) => ({ ...current, notes: event.target.value }))} />
                  ) : task.notes ? (
                    <span className="task-note-text">{task.notes}</span>
                  ) : (
                    <span className="muted-note">Brak notatki</span>
                  )}
                </td>
                <td data-label="Zdjęcia">
                  <div className="task-image-cell">
                    {images.length > 0 && (
                      <div className="task-image-grid">
                        {images.map((image) => (
                          <div className="task-image-thumb" key={image.id}>
                            <a href={image.data_url} target="_blank" rel="noreferrer" title={image.file_name}>
                              <img src={image.data_url} alt={image.file_name} />
                            </a>
                            <button className="task-image-delete" type="button" onClick={() => void deleteTaskImage(image.id)} aria-label="Usuń zdjęcie">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className={`task-image-upload ${uploadingImageTaskId === task.id ? "disabled" : ""}`}>
                      <ImagePlus size={14} />
                      <span>{uploadingImageTaskId === task.id ? "Dodaję..." : "Dodaj"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImageTaskId === task.id}
                        onChange={(event) => void uploadTaskImage(task.id, event)}
                      />
                    </label>
                  </div>
                </td>
                <td data-label="Projekt">
                  {editingTaskId === task.id ? (
                    <select className="table-input" value={editTask.projectId} onChange={(event) => setEditTask((current) => ({ ...current, projectId: event.target.value, area: "" }))}>
                      {context.projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                    </select>
                  ) : project?.name ?? "-"}
                </td>
                <td data-label="Obszar">
                  {editingTaskId === task.id ? (
                    <>
                      <input className="table-input" list={`task-areas-${task.id}`} value={editTask.area} onChange={(event) => setEditTask((current) => ({ ...current, area: event.target.value }))} placeholder="Obszar" />
                      <datalist id={`task-areas-${task.id}`}>
                        {editTaskAreas.map((area) => <option value={area} key={area} />)}
                      </datalist>
                    </>
                  ) : task.area ? (
                    <span className="area-pill">{task.area}</span>
                  ) : (
                    <span className="muted-note">Bez obszaru</span>
                  )}
                </td>
                <td data-label="Wykonawca">
                  {editingTaskId === task.id ? (
                    <input className="table-input" value={editTask.assignee} onChange={(event) => setEditTask((current) => ({ ...current, assignee: event.target.value }))} placeholder="Wykonawca" />
                  ) : task.assignee ? (
                    <span className="assignee-pill">{task.assignee}</span>
                  ) : (
                    <span className="muted-note">—</span>
                  )}
                </td>
                <td data-label="Cykl">
                  {editingTaskId === task.id ? (
                    <select className="table-input" value={editTask.recurrence} onChange={(event) => setEditTask((current) => ({ ...current, recurrence: event.target.value }))}>
                      <option value="">Jednorazowe</option>
                      <option value="daily">Codziennie</option>
                      <option value="weekly">Co tydzień</option>
                      <option value="biweekly">Co 2 tygodnie</option>
                      <option value="monthly">Co miesiąc</option>
                    </select>
                  ) : task.recurrence ? (
                    <span className="recurrence-badge">↺ {task.recurrence}</span>
                  ) : (
                    <span className="muted-note">—</span>
                  )}
                </td>
                <td data-label="Status">
                  <div className="status-cell">
                    <button
                      className={`done-toggle ${task.status === "done" ? "checked" : ""}`}
                      onClick={() => void context.updateTaskStatus(task.id, task.status === "done" ? "in_progress" : "done")}
                      aria-label={task.status === "done" ? "Oznacz jako niewykonane" : "Oznacz jako wykonane"}
                    >
                      {task.status === "done" ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    {editingTaskId === task.id ? (
                      <select className="table-input" value={editTask.status} onChange={(event) => setEditTask((current) => ({ ...current, status: event.target.value as TaskStatus }))}>
                        <option value="backlog">Backlog</option>
                        <option value="in_progress">W toku</option>
                        <option value="review">Recenzja</option>
                        <option value="done">Gotowe</option>
                      </select>
                    ) : task.status}
                  </div>
                </td>
                <td data-label="Termin">
                  {editingTaskId === task.id ? (
                    <input className="table-input" type="date" value={editTask.dueDate} onChange={(event) => setEditTask((current) => ({ ...current, dueDate: event.target.value }))} />
                  ) : task.due_date}
                </td>
                <td data-label="Priorytet">
                  {editingTaskId === task.id ? (
                    <select className="table-input" value={editTask.priority} onChange={(event) => setEditTask((current) => ({ ...current, priority: event.target.value as TaskPriority }))}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  ) : task.priority}
                </td>
                <td data-label="Wpływ">
                  {editingTaskId === task.id ? (
                    <select className="table-input" value={editTask.impact} onChange={(event) => setEditTask((current) => ({ ...current, impact: event.target.value as TaskImpact }))}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="strategic">Strategic</option>
                    </select>
                  ) : task.impact}
                </td>
                <td data-label="Risk"><span className={`risk-badge ${task.risk_status}`}>{task.risk_status}</span></td>
                <td data-label="Urgency">{urgency}</td>
                <td data-label="Akcje">
                  <div className="row-actions">
                    {editingTaskId === task.id ? (
                      <>
                        <button className="icon-button" onClick={() => void saveEdit(task.id)} aria-label="Zapisz zadanie"><Check size={16} /></button>
                        <button className="icon-button" onClick={() => setEditingTaskId(null)} aria-label="Anuluj edycję"><X size={16} /></button>
                      </>
                    ) : (
                      <button className="icon-button" onClick={() => startEdit(task)} aria-label="Edytuj zadanie"><Edit3 size={16} /></button>
                    )}
                    <button
                      className="icon-button"
                      onClick={() => void sendNotification(task.id)}
                      aria-label="Wyślij powiadomienie i dodaj do Google Calendar"
                      title="Wyślij powiadomienie i dodaj do Google Calendar"
                      disabled={sendingTaskId === task.id}
                    >
                      <CalendarPlus size={16} />
                    </button>
                    <button className="icon-button danger-action" onClick={() => void deleteTask(task.id, task.name)} aria-label="Usuń zadanie">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {!rows.length && (
              <tr className="table-empty-row">
                <td className="table-empty-cell" colSpan={14}>
                  <div className="empty-state">
                    Brak zadań pasujących do filtrów. Zmień filtry albo dodaj nowe zadanie.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({ label, sortKey, sortConfig, onSort }: { label: string; sortKey: TaskSortKey; sortConfig: { key: TaskSortKey; direction: SortDirection }; onSort: (key: TaskSortKey) => void }) {
  const active = sortConfig.key === sortKey;
  return (
    <th aria-sort={active ? sortConfig.direction === "asc" ? "ascending" : "descending" : "none"}>
      <button className={`table-sort-button ${active ? "active" : ""}`} type="button" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <span className="table-sort-indicator">{active ? sortConfig.direction === "asc" ? "↑" : "↓" : "↕"}</span>
      </button>
    </th>
  );
}

function compareTaskRows(
  a: { task: AppContextValue["tasks"][number]; project?: AppContextValue["projects"][number]; urgency: number; daysLeft: number },
  b: { task: AppContextValue["tasks"][number]; project?: AppContextValue["projects"][number]; urgency: number; daysLeft: number },
  sortConfig: { key: TaskSortKey; direction: SortDirection },
  taskImagesByTask: Map<string, TaskImage[]>
) {
  const direction = sortConfig.direction === "asc" ? 1 : -1;
  const result = compareByKey(a, b, sortConfig.key, taskImagesByTask);
  if (result !== 0) return result * direction;
  return fallbackCompare(a, b);
}

function compareByKey(
  a: { task: AppContextValue["tasks"][number]; project?: AppContextValue["projects"][number]; urgency: number; daysLeft: number },
  b: { task: AppContextValue["tasks"][number]; project?: AppContextValue["projects"][number]; urgency: number; daysLeft: number },
  key: TaskSortKey,
  taskImagesByTask: Map<string, TaskImage[]>
) {
  switch (key) {
    case "name":
      return compareText(a.task.name, b.task.name);
    case "notes":
      return compareText(a.task.notes ?? "", b.task.notes ?? "");
    case "images":
      return compareNumber(taskImagesByTask.get(a.task.id)?.length ?? 0, taskImagesByTask.get(b.task.id)?.length ?? 0);
    case "project":
      return compareText(a.project?.name ?? "", b.project?.name ?? "");
    case "area":
      return compareText(a.task.area ?? "", b.task.area ?? "");
    case "assignee":
      return compareText(a.task.assignee ?? "", b.task.assignee ?? "");
    case "recurrence":
      return compareText(a.task.recurrence ?? "", b.task.recurrence ?? "");
    case "status":
      return compareNumber(statusRank(a.task.status), statusRank(b.task.status));
    case "dueDate":
      return compareText(a.task.due_date, b.task.due_date);
    case "priority":
      return compareNumber(priorityRank(a.task.priority), priorityRank(b.task.priority));
    case "impact":
      return compareNumber(impactRank(a.task.impact), impactRank(b.task.impact));
    case "risk":
      return compareNumber(riskRank(a.task.risk_status), riskRank(b.task.risk_status));
    case "urgency":
      return compareNumber(a.urgency, b.urgency);
  }
}

function defaultDirectionFor(key: TaskSortKey): SortDirection {
  return key === "urgency" || key === "priority" || key === "impact" || key === "risk" || key === "images" ? "desc" : "asc";
}

function fallbackCompare(
  a: { task: AppContextValue["tasks"][number]; project?: AppContextValue["projects"][number]; urgency: number; daysLeft: number },
  b: { task: AppContextValue["tasks"][number]; project?: AppContextValue["projects"][number]; urgency: number; daysLeft: number }
) {
  return b.urgency - a.urgency || a.daysLeft - b.daysLeft || compareText(a.task.name, b.task.name);
}

function compareText(a: string, b: string) {
  const emptyA = a.trim() ? 0 : 1;
  const emptyB = b.trim() ? 0 : 1;
  if (emptyA !== emptyB) return emptyA - emptyB;
  return a.localeCompare(b, "pl", { sensitivity: "base", numeric: true });
}

function compareNumber(a: number, b: number) {
  return a - b;
}

function statusRank(value: TaskStatus) {
  return { backlog: 1, in_progress: 2, review: 3, done: 4 }[value] ?? 0;
}

function priorityRank(value: TaskPriority) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[value] ?? 0;
}

function impactRank(value: TaskImpact) {
  return { low: 1, medium: 2, high: 3, strategic: 4 }[value] ?? 0;
}

function riskRank(value: AppContextValue["tasks"][number]["risk_status"]) {
  return { none: 1, watch: 2, risk: 3, blocked: 4 }[value] ?? 0;
}

function formatNotificationMessage(workflow: string) {
  return workflow === "google-user-api"
    ? "Dodano zadanie do Twojego Google Calendar i wysłano przypomnienie przez Gmail."
    : "Wysłano zadanie przez fallback n8n. Połącz Google, żeby zapisywać je w swoim kalendarzu.";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Nie udało się odczytać zdjęcia."));
    };
    reader.onerror = () => reject(new Error("Nie udało się odczytać zdjęcia."));
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getCalendarEventLink(response: Record<string, unknown> | null) {
  const htmlLink = response?.htmlLink;
  return typeof htmlLink === "string" && htmlLink.startsWith("https://www.google.com/calendar/")
    ? htmlLink
    : null;
}
