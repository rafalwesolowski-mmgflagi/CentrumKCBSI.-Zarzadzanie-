import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Edit3, FileText, Folder, Lightbulb, ListChecks, Mic, MicOff, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import { friendlyAiError } from "../lib/aiErrors";
import { supabase } from "../lib/supabase";
import type { ProjectNote, ProjectNoteCategory, ProjectNoteReviewStatus, ProjectNoteSource, TaskImpact, TaskPriority } from "../lib/types";

interface NoteForm {
  projectId: string;
  title: string;
  body: string;
  category: ProjectNoteCategory;
  source: ProjectNoteSource;
  reviewStatus: ProjectNoteReviewStatus;
  summary: string;
  tagsText: string;
  isUrgent: boolean;
}

interface NoteAssistResult {
  projectId: string | null;
  category: ProjectNoteCategory;
  title: string;
  summary: string;
  tags: string[];
  reviewStatus: ProjectNoteReviewStatus;
  actionItems: DocumentTaskDraft[];
  isUrgent: boolean;
  rationale: string;
}

interface DocumentTaskDraft {
  title: string;
  dueDate: string | null;
  priority: TaskPriority;
  impact: TaskImpact;
  assignee: string | null;
  area: string | null;
  notes: string | null;
}

interface TodoItem {
  title: string;
  completed: boolean;
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type MammothModule = {
  extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

const NOTE_CATEGORIES: Array<{ value: ProjectNoteCategory; label: string }> = [
  { value: "general", label: "Ogólne" },
  { value: "decision", label: "Decyzja" },
  { value: "idea", label: "Pomysł" },
  { value: "risk", label: "Ryzyko" },
  { value: "meeting", label: "Spotkanie" },
  { value: "finance", label: "Finanse" },
  { value: "crm", label: "CRM" },
  { value: "task", label: "Zadanie" },
  { value: "research", label: "Research" }
];

const NOTE_QUICK_FLAGS: Array<{
  key: string;
  label: string;
  icon: "urgent" | "idea" | "task";
  isActive: (note: NoteForm) => boolean;
  apply: (note: NoteForm) => NoteForm;
}> = [
  {
    key: "urgent",
    label: "Pilne",
    icon: "urgent",
    isActive: (note) => note.isUrgent,
    apply: (note) => ({ ...note, isUrgent: !note.isUrgent })
  },
  {
    key: "action",
    label: "Akcja",
    icon: "task",
    isActive: (note) => note.reviewStatus === "action",
    apply: (note) => ({ ...note, reviewStatus: note.reviewStatus === "action" ? "inbox" : "action", category: "task" })
  },
  {
    key: "reviewed",
    label: "Przejrzane",
    icon: "task",
    isActive: (note) => note.reviewStatus === "reviewed",
    apply: (note) => ({ ...note, reviewStatus: note.reviewStatus === "reviewed" ? "inbox" : "reviewed" })
  },
  {
    key: "decision",
    label: "Decyzja",
    icon: "task",
    isActive: (note) => note.category === "decision",
    apply: (note) => ({ ...note, category: note.category === "decision" ? "general" : "decision", reviewStatus: "action" })
  },
  {
    key: "idea",
    label: "Pomysł",
    icon: "idea",
    isActive: (note) => note.category === "idea",
    apply: (note) => ({ ...note, category: note.category === "idea" ? "general" : "idea" })
  },
  {
    key: "risk",
    label: "Ryzyko",
    icon: "urgent",
    isActive: (note) => note.category === "risk",
    apply: (note) => ({ ...note, category: note.category === "risk" ? "general" : "risk", reviewStatus: "action", isUrgent: true })
  },
  {
    key: "meeting",
    label: "Spotkanie",
    icon: "task",
    isActive: (note) => note.category === "meeting",
    apply: (note) => ({ ...note, category: note.category === "meeting" ? "general" : "meeting" })
  }
];

const emptyNote: NoteForm = {
  projectId: "",
  title: "",
  body: "",
  category: "general",
  source: "written",
  reviewStatus: "inbox",
  summary: "",
  tagsText: "",
  isUrgent: false
};

export function NotesPage({ context }: { context: AppContextValue }) {
  const [newNote, setNewNote] = useState<NoteForm>(emptyNote);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState<NoteForm>(emptyNote);
  const [projectFilter, setProjectFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "urgent" | "normal">("all");
  const [categoryFilter, setCategoryFilter] = useState<ProjectNoteCategory | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<ProjectNoteSource | "all">("all");
  const [reviewFilter, setReviewFilter] = useState<ProjectNoteReviewStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [documentTasks, setDocumentTasks] = useState<DocumentTaskDraft[]>([]);
  const [todoText, setTodoText] = useState("");
  const [createDocumentTasks, setCreateDocumentTasks] = useState(true);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => new Set());
  const [listening, setListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognitionLike | null>(null);

  const projectById = useMemo(
    () => new Map(context.projects.map((project) => [project.id, project])),
    [context.projects]
  );

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return context.notes
      .filter((note) => projectFilter === "all" || note.project_id === projectFilter)
      .filter((note) => urgencyFilter === "all" || (urgencyFilter === "urgent" ? note.is_urgent : !note.is_urgent))
      .filter((note) => categoryFilter === "all" || note.category === categoryFilter)
      .filter((note) => sourceFilter === "all" || note.source === sourceFilter)
      .filter((note) => reviewFilter === "all" || note.review_status === reviewFilter)
      .filter((note) => tagFilter === "all" || note.tags.includes(tagFilter))
      .filter((note) => {
        if (!normalizedQuery) return true;
        const projectName = projectById.get(note.project_id)?.name ?? "";
        return [note.title ?? "", note.body, note.summary ?? "", projectName, categoryLabel(note.category), sourceLabel(note.source), reviewStatusLabel(note.review_status), ...note.tags]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => Number(b.is_urgent) - Number(a.is_urgent) || b.updated_at.localeCompare(a.updated_at));
  }, [categoryFilter, context.notes, projectById, projectFilter, query, reviewFilter, sourceFilter, tagFilter, urgencyFilter]);

  const folders = useMemo(() => {
    return context.projects
      .map((project) => ({
        project,
        notes: filteredNotes.filter((note) => note.project_id === project.id)
      }))
      .filter((folder) => folder.notes.length > 0 || projectFilter === folder.project.id);
  }, [context.projects, filteredNotes, projectFilter]);

  const inboxCount = context.notes.filter((note) => note.review_status === "inbox").length;
  const actionCount = context.notes.filter((note) => note.review_status === "action").length;
  const allTags = useMemo(() => {
    return Array.from(new Set(context.notes.flatMap((note) => note.tags))).sort((a, b) => a.localeCompare(b));
  }, [context.notes]);
  const todoTasks = useMemo(() => parseTodoTasks(todoText), [todoText]);
  const plannedTasks = useMemo(() => mergeTaskDrafts(documentTasks, todoTasks), [documentTasks, todoTasks]);

  async function createNote(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    let noteDraft = newNote;
    let tasksToCreate = plannedTasks;

    if (documentName && createDocumentTasks && tasksToCreate.length === 0) {
      const analysis = await analyzeDraft();
      if (!analysis) {
        setSaving(false);
        return;
      }
      if (analysis) {
        noteDraft = applyAnalysisToNote(newNote, analysis);
        tasksToCreate = mergeTaskDrafts(analysis.actionItems ?? [], parseTodoTasks(todoText));
      }
    }

    const projectId = noteDraft.projectId || context.projects[0]?.id;
    const body = noteDraft.body.trim();

    if (!projectId) {
      setMessage("Najpierw dodaj projekt, żeby zapisać notatkę w folderze.");
      setSaving(false);
      return;
    }
    if (!body) {
      setMessage("Treść notatki nie może być pusta.");
      setSaving(false);
      return;
    }

    try {
      await context.createNote({ ...noteDraft, projectId, body: appendTodoSection(body, plannedTasks), tags: parseTags(noteDraft.tagsText) });
      if (createDocumentTasks && tasksToCreate.length > 0) {
        for (const task of tasksToCreate) {
          await context.createTask({
            projectId,
            name: task.title,
            dueDate: task.dueDate ?? new Date().toISOString().slice(0, 10),
            priority: task.priority,
            impact: task.impact,
            area: task.area ?? "",
            notes: task.notes ?? `Źródło: ${newNote.title || documentName || "dokument"}`,
            assignee: task.assignee ?? "",
            recurrence: ""
          });
        }
      }
      setNewNote(emptyNote);
      setDocumentTasks([]);
      setTodoText("");
      setDocumentName(null);
      setMessage(createDocumentTasks && tasksToCreate.length > 0
        ? `Notatka zapisana i utworzono ${tasksToCreate.length} zadań.`
        : "Notatka zapisana w folderze projektu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać notatki.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(note: ProjectNote) {
    setEditingId(note.id);
    setEditNote({
      projectId: note.project_id,
      title: note.title ?? "",
      body: note.body,
      category: note.category,
      source: note.source,
      reviewStatus: note.review_status,
      summary: note.summary ?? "",
      tagsText: note.tags.join(", "),
      isUrgent: note.is_urgent
    });
    setMessage(null);
  }

  async function saveEdit(noteId: string) {
    const body = editNote.body.trim();
    if (!body) {
      setMessage("Treść notatki nie może być pusta.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await context.updateNote(noteId, { ...editNote, body, tags: parseTags(editNote.tagsText) });
      setEditingId(null);
      setMessage("Notatka zaktualizowana.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zaktualizować notatki.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(note: ProjectNote) {
    const label = note.title || firstLine(note.body);
    if (!window.confirm(`Usunąć notatkę "${label}"?`)) return;
    setMessage(null);
    try {
      await context.deleteNote(note.id);
      setMessage("Notatka usunięta.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się usunąć notatki.");
    }
  }

  async function toggleTodoItem(note: ProjectNote, itemIndex: number) {
    const content = splitNoteTodo(note.body);
    const todoItem = content.todoItems[itemIndex];
    if (!todoItem) return;

    const nextTodoItems = content.todoItems.map((item, index) => (
      index === itemIndex ? { ...item, completed: !item.completed } : item
    ));

    setSaving(true);
    setMessage(null);
    try {
      await context.updateNote(note.id, {
        projectId: note.project_id,
        title: note.title ?? "",
        body: buildNoteBodyWithTodo(content.body, nextTodoItems),
        category: note.category,
        source: note.source,
        reviewStatus: note.review_status,
        summary: note.summary ?? "",
        tags: note.tags,
        isUrgent: note.is_urgent
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zaktualizować TODO.");
    } finally {
      setSaving(false);
    }
  }

  async function classifyDraft() {
    await analyzeDraft();
  }

  async function analyzeDraft() {
    const body = newNote.body.trim();
    if (!body) {
      setMessage("Najpierw wpisz albo podyktuj treść notatki.");
      return null;
    }

    setAiLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke<NoteAssistResult>("ai-note-assist", {
        body: {
          projectId: newNote.projectId || null,
          title: newNote.title,
          body,
          source: newNote.source,
          projects: context.projects.map((project) => ({
            id: project.id,
            name: project.name,
            tags: project.tags,
            areas: project.areas,
            goal: project.goal
          }))
        }
      });
      if (error) throw error;
      if (!data) throw new Error("AI nie zwróciło sugestii.");

      setNewNote((current) => applyAnalysisToNote(current, data));
      setDocumentTasks(data.actionItems ?? []);
      setMessage(data.actionItems?.length
        ? `AI: ${data.rationale} Wydzielono ${data.actionItems.length} zadań.`
        : `AI: ${data.rationale} Nie znaleziono konkretnych zadań do utworzenia.`);
      return data;
    } catch (error) {
      const fallback = buildLocalNoteAnalysis(newNote, body);
      if (fallback.actionItems.length > 0) {
        setNewNote((current) => applyAnalysisToNote(current, fallback));
        setDocumentTasks(fallback.actionItems);
        setMessage(`${friendlyAiError(error)} Zastosowano tryb awaryjny i wydzielono ${fallback.actionItems.length} zadań z listy.`);
        return fallback;
      }
      setMessage(friendlyAiError(error));
      return null;
    } finally {
      setAiLoading(false);
    }
  }

  async function importDocument(file: File | null) {
    if (!file) return;

    setDocumentLoading(true);
    setMessage(null);
    try {
      const text = await readDocumentText(file);
      if (text.trim().length < 20) {
        throw new Error("Dokument ma za mało tekstu do analizy.");
      }
      setDocumentName(file.name);
      setNewNote((current) => ({
        ...current,
        title: current.title || titleFromFileName(file.name),
        body: text.slice(0, 24000),
        source: "written",
        reviewStatus: "inbox"
      }));
      setMessage(`Wczytano dokument "${file.name}". Kliknij AI przypisz, żeby zrobić notatkę z wnioskami i zadaniami.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wczytać dokumentu.");
    } finally {
      setDocumentLoading(false);
    }
  }

  function toggleVoiceInput() {
    if (listening && recognition) {
      recognition.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setMessage("Dyktowanie nie jest dostępne w tej przeglądarce. Możesz wkleić transkrypcję ręcznie.");
      return;
    }

    const nextRecognition = new SpeechRecognition();
    nextRecognition.lang = "pl-PL";
    nextRecognition.interimResults = false;
    nextRecognition.continuous = true;
    nextRecognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!transcript) return;
      setNewNote((current) => ({
        ...current,
        body: `${current.body}${current.body.trim() ? "\n" : ""}${transcript}`,
        source: "voice"
      }));
    };
    nextRecognition.onerror = () => {
      setListening(false);
      setMessage("Nie udało się odczytać głosu. Spróbuj ponownie albo wpisz notatkę ręcznie.");
    };
    nextRecognition.onend = () => setListening(false);
    nextRecognition.start();
    setRecognition(nextRecognition);
    setListening(true);
    setMessage("Dyktowanie włączone. Mów notatkę, a tekst pojawi się w polu treści.");
  }

  function toggleFolder(projectId: string) {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  return (
    <div className="page notes-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Project folders</span>
          <h1>Notes</h1>
          <p className="page-subtitle">Notatki pisemne i głosowe w folderach projektów, z kategoriami i filtrowaniem</p>
        </div>
        <div className="header-summary">
          {context.notes.length} notatek · {inboxCount} do przeglądu · {actionCount} akcji
        </div>
      </header>

      <form className="notes-form" onSubmit={createNote}>
        <select value={newNote.projectId} onChange={(event) => setNewNote((current) => ({ ...current, projectId: event.target.value }))}>
          <option value="">Folder projektu</option>
          {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
        <input value={newNote.title} onChange={(event) => setNewNote((current) => ({ ...current, title: event.target.value }))} placeholder="Tytuł notatki" />
        <select value={newNote.category} onChange={(event) => setNewNote((current) => ({ ...current, category: event.target.value as ProjectNoteCategory }))}>
          {NOTE_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
        </select>
        <select value={newNote.source} onChange={(event) => setNewNote((current) => ({ ...current, source: event.target.value as ProjectNoteSource }))}>
          <option value="written">Pisemna</option>
          <option value="voice">Głosowa</option>
        </select>
        <select value={newNote.reviewStatus} onChange={(event) => setNewNote((current) => ({ ...current, reviewStatus: event.target.value as ProjectNoteReviewStatus }))}>
          <option value="inbox">Do przeglądu</option>
          <option value="reviewed">Przejrzane</option>
          <option value="action">Akcja / decyzja</option>
        </select>
        <div className="notes-quick-flags">
          {NOTE_QUICK_FLAGS.map((flag) => (
            <button
              className={`note-flag-button ${flag.isActive(newNote) ? "active" : ""}`}
              key={flag.key}
              type="button"
              aria-pressed={flag.isActive(newNote)}
              onClick={() => setNewNote((current) => flag.apply(current))}
            >
              {flag.icon === "urgent" && <AlertTriangle size={15} />}
              {flag.icon === "idea" && <Lightbulb size={15} />}
              {flag.icon === "task" && <ListChecks size={15} />}
              {flag.label}
            </button>
          ))}
        </div>
        <textarea value={newNote.body} onChange={(event) => setNewNote((current) => ({ ...current, body: event.target.value }))} placeholder="Wpisz albo podyktuj notatkę..." required />
        <div className="notes-todo-field">
          <ListChecks size={17} />
          <textarea
            value={todoText}
            onChange={(event) => setTodoText(event.target.value)}
            placeholder="Lista TODO, po jednej pozycji w linii..."
          />
        </div>
        <input value={newNote.summary} onChange={(event) => setNewNote((current) => ({ ...current, summary: event.target.value }))} placeholder="Krótki wniosek / streszczenie" />
        <input value={newNote.tagsText} onChange={(event) => setNewNote((current) => ({ ...current, tagsText: event.target.value }))} placeholder="Tagi po przecinku, np. klient, oferta, ryzyko" />
        <div className="notes-form-actions">
          <label className={`secondary-button document-upload-button ${documentLoading ? "disabled" : ""}`}>
            <Upload size={16} />
            {documentLoading ? "Wczytuję" : "Dokument"}
            <input
              type="file"
              accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={documentLoading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void importDocument(file);
              }}
            />
          </label>
          <button className={`secondary-button ${listening ? "active-filter" : ""}`} type="button" onClick={toggleVoiceInput}>
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
            {listening ? "Zatrzymaj" : "Dyktuj"}
          </button>
          <button className="secondary-button" type="button" onClick={() => void classifyDraft()} disabled={aiLoading || !newNote.body.trim()}>
            <Sparkles size={16} />
            {aiLoading ? "AI pracuje" : "AI przypisz"}
          </button>
          <button className="secondary-button" disabled={saving}>
            <Plus size={16} />
            Zapisz notatkę
          </button>
        </div>
      </form>

      {message && <div className="warning-box">{message}</div>}

      {(documentName || plannedTasks.length > 0 || todoText.trim()) && (
        <section className="document-insights-panel">
          <div className="document-insights-header">
            <div>
              <span className="eyebrow">{documentName ? "Dokument" : "Lista TODO"}</span>
              <strong>{documentName ? <FileText size={16} /> : <ListChecks size={16} />}{documentName ?? "Zadania do utworzenia"}</strong>
            </div>
            <label className={`notes-urgent-toggle ${createDocumentTasks ? "active" : ""}`}>
              <input type="checkbox" checked={createDocumentTasks} onChange={(event) => setCreateDocumentTasks(event.target.checked)} />
              Utwórz zadania przy zapisie
            </label>
          </div>
          <div className="document-task-list">
            {plannedTasks.map((task, index) => (
              <article className="document-task-card" key={`${task.title}-${index}`}>
                <strong>{task.title}</strong>
                <span>{task.dueDate ?? "bez terminu"} · {task.priority}/{task.impact}</span>
                {(task.assignee || task.area) && <span>{[task.assignee, task.area].filter(Boolean).join(" · ")}</span>}
                {task.notes && <p>{task.notes}</p>}
              </article>
            ))}
            {!plannedTasks.length && (
              <div className="empty-state">
                Wpisz pozycje TODO po jednej w linii albo kliknij AI przypisz, żeby wydzielić zadania z notatki.
              </div>
            )}
          </div>
        </section>
      )}

      <div className="filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po treści, tytule, kategorii albo projekcie..." />
        <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
          <option value="all">Wszystkie foldery</option>
          {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
        <select value={urgencyFilter} onChange={(event) => setUrgencyFilter(event.target.value as "all" | "urgent" | "normal")}>
          <option value="all">Wszystkie notatki</option>
          <option value="urgent">Tylko pilne</option>
          <option value="normal">Niepilne</option>
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ProjectNoteCategory | "all")}>
          <option value="all">Wszystkie kategorie</option>
          {NOTE_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
        </select>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as ProjectNoteSource | "all")}>
          <option value="all">Pisemne i głosowe</option>
          <option value="written">Pisemne</option>
          <option value="voice">Głosowe</option>
        </select>
        <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as ProjectNoteReviewStatus | "all")}>
          <option value="all">Każdy status</option>
          <option value="inbox">Do przeglądu</option>
          <option value="reviewed">Przejrzane</option>
          <option value="action">Akcja / decyzja</option>
        </select>
        <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
          <option value="all">Wszystkie tagi</option>
          {allTags.map((tag) => <option value={tag} key={tag}>{tag}</option>)}
        </select>
      </div>

      <div className="notes-folder-grid">
        {folders.map(({ project, notes }) => (
          <section className="notes-folder" key={project.id}>
            <div className="notes-folder-header">
              <button
                className="notes-folder-toggle"
                type="button"
                onClick={() => toggleFolder(project.id)}
                aria-expanded={!collapsedFolderIds.has(project.id)}
                aria-label={collapsedFolderIds.has(project.id) ? "Rozwiń folder" : "Zwiń folder"}
              >
                {collapsedFolderIds.has(project.id) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <span className="color-dot" style={{ background: project.color }} />
                <Folder size={17} />
                <strong>{project.name}</strong>
              </button>
              <span>{notes.length}</span>
            </div>
            {!collapsedFolderIds.has(project.id) && <div className="notes-list">
              {notes.map((note) => {
                const noteContent = splitNoteTodo(note.body);
                return (
                <article className={`note-card ${note.is_urgent ? "urgent" : ""}`} key={note.id}>
                  {editingId === note.id ? (
                    <div className="note-edit-form">
                      <select value={editNote.projectId} onChange={(event) => setEditNote((current) => ({ ...current, projectId: event.target.value }))}>
                        {context.projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                      </select>
                      <input value={editNote.title} onChange={(event) => setEditNote((current) => ({ ...current, title: event.target.value }))} placeholder="Tytuł" />
                      <select value={editNote.category} onChange={(event) => setEditNote((current) => ({ ...current, category: event.target.value as ProjectNoteCategory }))}>
                        {NOTE_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
                      </select>
                      <select value={editNote.source} onChange={(event) => setEditNote((current) => ({ ...current, source: event.target.value as ProjectNoteSource }))}>
                        <option value="written">Pisemna</option>
                        <option value="voice">Głosowa</option>
                      </select>
                      <select value={editNote.reviewStatus} onChange={(event) => setEditNote((current) => ({ ...current, reviewStatus: event.target.value as ProjectNoteReviewStatus }))}>
                        <option value="inbox">Do przeglądu</option>
                        <option value="reviewed">Przejrzane</option>
                        <option value="action">Akcja / decyzja</option>
                      </select>
                      <textarea value={editNote.body} onChange={(event) => setEditNote((current) => ({ ...current, body: event.target.value }))} />
                      <input value={editNote.summary} onChange={(event) => setEditNote((current) => ({ ...current, summary: event.target.value }))} placeholder="Krótki wniosek / streszczenie" />
                      <input value={editNote.tagsText} onChange={(event) => setEditNote((current) => ({ ...current, tagsText: event.target.value }))} placeholder="Tagi po przecinku" />
                      <label className={`notes-urgent-toggle ${editNote.isUrgent ? "active" : ""}`}>
                        <input type="checkbox" checked={editNote.isUrgent} onChange={(event) => setEditNote((current) => ({ ...current, isUrgent: event.target.checked }))} />
                        <AlertTriangle size={16} />
                        Pilne
                      </label>
                      <div className="row-actions">
                        <button className="icon-button" disabled={saving} onClick={() => void saveEdit(note.id)} aria-label="Zapisz notatkę"><Check size={16} /></button>
                        <button className="icon-button" onClick={() => setEditingId(null)} aria-label="Anuluj edycję"><X size={16} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="note-card-header">
                        <div>
                          <strong>{note.title || firstLine(note.body)}</strong>
                          <span>{formatDate(note.updated_at)}</span>
                        </div>
                        <div className="note-card-badges">
                          <span className="note-category-badge">{categoryLabel(note.category)}</span>
                          <span className="note-source-badge">{sourceLabel(note.source)}</span>
                          <span className={`note-review-badge ${note.review_status}`}>{reviewStatusLabel(note.review_status)}</span>
                          {note.is_urgent && <span className="note-urgent-badge"><AlertTriangle size={13} />Pilne</span>}
                        </div>
                      </div>
                      {note.summary && <p className="note-summary">{note.summary}</p>}
                      {noteContent.body && <p>{noteContent.body}</p>}
                      {noteContent.todoItems.length > 0 && (
                        <div className="note-todo-list">
                          <strong><ListChecks size={15} />TODO</strong>
                          {noteContent.todoItems.map((item, index) => (
                            <label className={`note-todo-item ${item.completed ? "done" : ""}`} key={`${item.title}-${index}`}>
                              <input
                                type="checkbox"
                                checked={item.completed}
                                disabled={saving}
                                onChange={() => void toggleTodoItem(note, index)}
                              />
                              <span>{item.title}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {note.tags.length > 0 && (
                        <div className="note-tags">
                          {note.tags.map((tag) => <span className="tag-pill" key={tag}>{tag}</span>)}
                        </div>
                      )}
                      <div className="note-actions">
                        <button className="icon-button" onClick={() => startEdit(note)} aria-label="Edytuj notatkę"><Edit3 size={16} /></button>
                        <button className="icon-button danger-action" onClick={() => void deleteNote(note)} aria-label="Usuń notatkę"><Trash2 size={16} /></button>
                      </div>
                    </>
                  )}
                </article>
                );
              })}
              {!notes.length && <div className="empty-state">Ten folder nie ma jeszcze notatek.</div>}
            </div>}
          </section>
        ))}
        {!folders.length && (
          <div className="empty-state">Brak notatek pasujących do filtrów. Dodaj pierwszą notatkę do folderu projektu.</div>
        )}
      </div>
    </div>
  );
}

function firstLine(value: string) {
  return value.split(/\r?\n/)[0]?.slice(0, 80) || "Notatka";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function categoryLabel(category: ProjectNoteCategory) {
  return NOTE_CATEGORIES.find((item) => item.value === category)?.label ?? "Ogólne";
}

function sourceLabel(source: ProjectNoteSource) {
  return source === "voice" ? "Głosowa" : "Pisemna";
}

function applyAnalysisToNote(note: NoteForm, analysis: NoteAssistResult): NoteForm {
  return {
    ...note,
    projectId: analysis.projectId ?? note.projectId,
    title: note.title.trim() ? note.title : analysis.title,
    category: analysis.category,
    reviewStatus: analysis.reviewStatus,
    summary: analysis.summary,
    tagsText: analysis.tags.join(", "),
    isUrgent: analysis.isUrgent
  };
}

function buildLocalNoteAnalysis(note: NoteForm, body: string): NoteAssistResult {
  const actionItems = extractChecklistItems(body);
  return {
    projectId: note.projectId || null,
    category: actionItems.length ? "task" : note.category,
    title: note.title.trim() || firstLine(body),
    summary: summarizeText(body),
    tags: parseTags(note.tagsText),
    reviewStatus: actionItems.length ? "action" : note.reviewStatus,
    actionItems,
    isUrgent: note.isUrgent,
    rationale: "AI było chwilowo niedostępne, więc zastosowano lokalne reguły analizy dokumentu."
  };
}

function extractChecklistItems(value: string): DocumentTaskDraft[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(\d+[).]|[-*])\s+/.test(line))
    .map((line) => line.replace(/^(\d+[).]|[-*])\s+/, "").trim())
    .filter((line) => line.length >= 3)
    .slice(0, 12)
    .map((title) => ({
      title: title.slice(0, 120),
      dueDate: null,
      priority: "medium",
      impact: "medium",
      assignee: null,
      area: null,
      notes: "Zadanie wydzielone z dokumentu."
    }));
}

function parseTodoTasks(value: string): DocumentTaskDraft[] {
  return parseTodoItems(value)
    .filter((item) => item.title.length >= 2)
    .slice(0, 30)
    .map((item) => ({
      title: item.title.slice(0, 120),
      dueDate: null,
      priority: "medium",
      impact: "medium",
      assignee: null,
      area: null,
      notes: "Zadanie dodane z listy TODO."
    }));
}

function mergeTaskDrafts(...groups: DocumentTaskDraft[][]) {
  const seen = new Set<string>();
  const merged: DocumentTaskDraft[] = [];

  for (const task of groups.flat()) {
    const title = task.title.trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...task, title });
  }

  return merged.slice(0, 30);
}

function appendTodoSection(body: string, tasks: DocumentTaskDraft[]) {
  if (!tasks.length) return body;
  const content = splitNoteTodo(body);
  const existingTodoTasks = content.todoItems.map((item) => ({
    title: item.title,
    dueDate: null,
    priority: "medium" as const,
    impact: "medium" as const,
    assignee: null,
    area: null,
    notes: null
  }));
  const existingCompletedByTitle = new Map(content.todoItems.map((item) => [item.title.toLowerCase(), item.completed]));
  const todoItems = mergeTaskDrafts(existingTodoTasks, tasks).map((task) => ({
    title: task.title,
    completed: existingCompletedByTitle.get(task.title.toLowerCase()) ?? false
  }));

  return buildNoteBodyWithTodo(content.body, todoItems);
}

function splitNoteTodo(value: string) {
  const match = value.match(/\n{0,2}TODO:\s*\n/i);
  if (!match || match.index === undefined) {
    return { body: value, todoItems: [] as TodoItem[] };
  }

  const body = value.slice(0, match.index).trim();
  const todoText = value.slice(match.index + match[0].length);
  return {
    body,
    todoItems: parseTodoItems(todoText)
  };
}

function parseTodoItems(value: string): TodoItem[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const checkboxMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
      if (checkboxMatch) {
        return {
          title: checkboxMatch[2].trim(),
          completed: checkboxMatch[1].toLowerCase() === "x"
        };
      }

      const title = line.replace(/^(\d+[).]|[-*])\s+/, "").trim();
      return title ? { title, completed: false } : null;
    })
    .filter((item): item is TodoItem => Boolean(item && item.title));
}

function buildNoteBodyWithTodo(body: string, todoItems: TodoItem[]) {
  const todoLines = todoItems.map((item) => `- [${item.completed ? "x" : " "}] ${item.title}`);
  return `${body.trim()}\n\nTODO:\n${todoLines.join("\n")}`.trim();
}

function summarizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240) || "Dokument wymaga przeglądu.";
}

function reviewStatusLabel(status: ProjectNoteReviewStatus) {
  if (status === "action") return "Akcja";
  if (status === "reviewed") return "Przejrzane";
  return "Do przeglądu";
}

function parseTags(value: string) {
  return Array.from(new Set(value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)))
    .slice(0, 12);
}

async function readDocumentText(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt" || extension === "md" || file.type.startsWith("text/")) {
    return file.text();
  }

  if (extension === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth") as MammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }

  throw new Error("Obsługiwane są pliki .txt, .md i .docx. Stary format .doc nie jest obsługiwany w przeglądarce.");
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 80) || "Notatka z dokumentu";
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}
