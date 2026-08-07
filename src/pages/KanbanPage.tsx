import { useState } from "react";
import { CheckSquare, Square } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import type { Task, TaskStatus } from "../lib/types";

const columns: Array<{ id: TaskStatus; label: string }> = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "W toku" },
  { id: "review", label: "Recenzja" },
  { id: "done", label: "Gotowe" }
];

export function KanbanPage({ context }: { context: AppContextValue }) {
  const [projectId, setProjectId] = useState("all");
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const visibleTasks = context.tasks.filter((task) => projectId === "all" || task.project_id === projectId);

  async function onDrop(status: TaskStatus) {
    if (!draggedTask || draggedTask.status === status) {
      setDraggedTask(null);
      return;
    }
    await context.updateTaskStatus(draggedTask.id, status);
    setDraggedTask(null);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Flow control</span>
          <h1>Kanban</h1>
        </div>
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="all">Wszystkie projekty</option>
          {context.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </header>

      <section className="kanban-board">
        {columns.map((column) => (
          <div
            className="kanban-column"
            key={column.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => void onDrop(column.id)}
          >
            <div className="kanban-header">
              <strong>{column.label}</strong>
              <span>{visibleTasks.filter((task) => task.status === column.id).length}</span>
            </div>
            {visibleTasks.filter((task) => task.status === column.id).map((task) => {
              const project = context.projects.find((item) => item.id === task.project_id);
              return (
                <article
                  draggable
                  onDragStart={() => setDraggedTask(task)}
                  className={`kanban-card ${task.risk_status}`}
                  key={task.id}
                >
                  <div className="project-title">
                    <span className="color-dot" style={{ background: project?.color }} />
                    <span>{project?.name}</span>
                  </div>
                  <strong>{task.name}</strong>
                  {task.area && <span className="area-pill task-area-pill">{task.area}</span>}
                  {task.assignee && <span className="assignee-pill task-assignee-pill">{task.assignee}</span>}
                  {task.notes && <p className="task-note-snippet">{task.notes}</p>}
                  <div className="muted-row">
                    <span>{task.due_date}</span>
                    <span>{task.priority}/{task.impact}</span>
                  </div>
                  <button
                    className={`done-toggle ${task.status === "done" ? "checked" : ""}`}
                    onClick={() => void context.updateTaskStatus(task.id, task.status === "done" ? "in_progress" : "done")}
                  >
                    {task.status === "done" ? <CheckSquare size={16} /> : <Square size={16} />}
                    {task.status === "done" ? "Wykonane" : "Oznacz wykonane"}
                  </button>
                </article>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}
