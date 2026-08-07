import { FormEvent, useEffect, useMemo, useState } from "react";
import { addMonths, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarClock, CalendarPlus, CheckSquare, ChevronLeft, ChevronRight, Edit3, MapPin, NotebookText, Trash2, X } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import type { CalendarEntry, CalendarEntryKind } from "../lib/types";

type CalendarSource = "entry" | "task";
type CalendarTypeFilter = "all" | "event" | "note" | "task";
type SortMode = "upcoming" | "newest";

interface CalendarRow {
  id: string;
  source: CalendarSource;
  kind: CalendarEntryKind | "task";
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  location: string | null;
  notes: string | null;
  status: string | null;
  urgency: number;
  rawEntry?: CalendarEntry;
  rawTask?: AppContextValue["tasks"][number];
}

interface CalendarMonthDay {
  date: Date;
  iso: string;
  inCurrentMonth: boolean;
  isTodayDate: boolean;
  items: CalendarRow[];
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");

const emptyDraft = {
  kind: "event" as CalendarEntryKind,
  title: "",
  entryDate: todayIso(),
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
  location: "",
  notes: "",
  projectId: ""
};

const emptyDayNoteDraft = {
  title: "",
  notes: "",
  projectId: ""
};

export function CalendarPage({ context }: { context: AppContextValue }) {
  const [now, setNow] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [draft, setDraft] = useState(emptyDraft);
  const [dayNoteDraft, setDayNoteDraft] = useState(emptyDayNoteDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [typeFilter, setTypeFilter] = useState<CalendarTypeFilter>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [rangeDays, setRangeDays] = useState(30);
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("upcoming");
  const [message, setMessage] = useState<string | null>(null);
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const projectById = useMemo(() => new Map(context.projects.map((project) => [project.id, project])), [context.projects]);

  const allRows = useMemo(() => {
    const entryRows: CalendarRow[] = context.calendarEntries.map((entry) => {
      const project = entry.project_id ? projectById.get(entry.project_id) : undefined;
      return {
        id: entry.id,
        source: "entry",
        kind: entry.kind,
        title: entry.title,
        date: entry.entry_date,
        startTime: entry.start_time,
        endTime: entry.end_time,
        isAllDay: entry.is_all_day,
        projectId: entry.project_id,
        projectName: project?.name ?? null,
        projectColor: project?.color ?? null,
        location: entry.location,
        notes: entry.notes,
        status: null,
        urgency: entry.kind === "event" ? 2 : 1,
        rawEntry: entry
      };
    });

    const taskRows: CalendarRow[] = context.tasks
      .filter((task) => task.status !== "done")
      .map((task) => {
        const project = projectById.get(task.project_id);
        return {
          id: task.id,
          source: "task",
          kind: "task",
          title: task.name,
          date: task.due_date,
          startTime: null,
          endTime: null,
          isAllDay: true,
          projectId: task.project_id,
          projectName: project?.name ?? null,
          projectColor: project?.color ?? null,
          location: null,
          notes: task.notes,
          status: task.risk_status === "none" ? task.priority : task.risk_status,
          urgency: task.deadline_importance,
          rawTask: task
        };
      });

    return [...entryRows, ...taskRows].sort(compareCalendarRows);
  }, [context.calendarEntries, context.tasks, projectById]);

  const rows = useMemo(() => {
    const today = new Date();
    return [...allRows]
      .filter((row) => typeFilter === "all" || row.kind === typeFilter)
      .filter((row) => projectFilter === "all" || row.projectId === projectFilter)
      .filter((row) => {
        const days = daysFromToday(row.date, today);
        if (upcomingOnly && days < 0) return false;
        if (rangeDays > 0 && days > rangeDays) return false;
        return true;
      })
      .sort((a, b) => sortMode === "newest" ? compareCalendarRows(b, a) : compareCalendarRows(a, b));
  }, [allRows, projectFilter, rangeDays, sortMode, typeFilter, upcomingOnly]);

  const monthDays = useMemo<CalendarMonthDay[]>(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });

    return eachDayOfInterval({ start, end }).map((date) => {
      const iso = format(date, "yyyy-MM-dd");
      return {
        date,
        iso,
        inCurrentMonth: isSameMonth(date, viewDate),
        isTodayDate: isToday(date),
        items: allRows.filter((row) => row.date === iso)
      };
    });
  }, [allRows, viewDate]);

  const selectedRows = useMemo(() => allRows.filter((row) => row.date === selectedDate), [allRows, selectedDate]);
  const selectedDay = parseISO(selectedDate);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, CalendarRow[]>();
    for (const row of rows) {
      const group = groups.get(row.date) ?? [];
      group.push(row);
      groups.set(row.date, group);
    }
    return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
  }, [rows]);

  const nextEvents = rows.filter((row) => row.kind === "event" || row.kind === "task").slice(0, 4);
  const notesCount = rows.filter((row) => row.kind === "note").length;
  const overdueHidden = context.tasks.filter((task) => task.status !== "done" && daysFromToday(task.due_date) < 0).length;
  const monthItemsCount = monthDays.reduce((sum, day) => sum + day.items.length, 0);

  async function createEntry(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await context.createCalendarEntry(toCalendarInput(draft));
      setDraft((current) => ({
        ...emptyDraft,
        entryDate: current.entryDate,
        projectId: current.projectId
      }));
      setMessage(draft.kind === "event" ? "Wydarzenie dodane do kalendarza." : "Odnotacja zapisana w kalendarzu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać wpisu kalendarza.");
    }
  }

  async function createDayNote(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const title = dayNoteDraft.title.trim();
    const notes = dayNoteDraft.notes.trim();
    if (!title && !notes) {
      setMessage("Wpisz treść albo tytuł notatki dla wybranego dnia.");
      return;
    }

    try {
      await context.createCalendarEntry({
        kind: "note",
        title: title || `Notatka dnia: ${format(selectedDay, "d MMMM", { locale: pl })}`,
        entryDate: selectedDate,
        startTime: "",
        endTime: "",
        isAllDay: true,
        location: "",
        notes,
        projectId: dayNoteDraft.projectId || null
      });
      setDayNoteDraft(emptyDayNoteDraft);
      setMessage(`Notatka dodana do dnia ${format(selectedDay, "d MMMM", { locale: pl })}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się dodać notatki do dnia.");
    }
  }

  function startEdit(entry: CalendarEntry) {
    setEditingId(entry.id);
    setEditDraft({
      kind: entry.kind,
      title: entry.title,
      entryDate: entry.entry_date,
      startTime: entry.start_time ?? "09:00",
      endTime: entry.end_time ?? "10:00",
      isAllDay: entry.is_all_day,
      location: entry.location ?? "",
      notes: entry.notes ?? "",
      projectId: entry.project_id ?? ""
    });
  }

  async function saveEdit(entryId: string) {
    setMessage(null);
    try {
      await context.updateCalendarEntry(entryId, toCalendarInput(editDraft));
      setEditingId(null);
      setMessage("Wpis kalendarza zaktualizowany.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać zmian.");
    }
  }

  async function deleteEntry(entry: CalendarEntry) {
    if (!window.confirm(`Usunąć wpis "${entry.title}" z kalendarza?`)) return;
    setMessage(null);
    try {
      await context.deleteCalendarEntry(entry.id);
      setMessage("Wpis kalendarza usunięty.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się usunąć wpisu.");
    }
  }

  async function sendTaskToCalendar(taskId: string) {
    setMessage(null);
    setSendingTaskId(taskId);
    try {
      const result = await context.sendTaskNotification(taskId);
      setMessage(result.workflow === "google-user-api"
        ? "Zadanie dodane do Google Calendar."
        : "Zadanie wysłane przez fallback n8n.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wysłać zadania do kalendarza.");
    } finally {
      setSendingTaskId(null);
    }
  }

  return (
    <div className="page calendar-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Widok kalendarza</span>
          <h1>Kalendarz</h1>
        </div>
        <div className="header-summary">
          {rows.length} widocznych · {nextEvents.length ? `najbliższe: ${nextEvents[0].date}` : "brak nadchodzących"}
        </div>
      </header>

      <section className="calendar-summary-grid">
        <SummaryCard label="Najbliższe" value={nextEvents.length ? nextEvents[0].title : "Brak"} sub={nextEvents[0] ? formatRelativeDay(nextEvents[0].date) : "Dodaj wydarzenie albo zadanie"} />
        <SummaryCard label="W tym miesiącu" value={monthItemsCount} sub={format(viewDate, "LLLL yyyy", { locale: pl })} />
        <SummaryCard label="Odnotacje" value={notesCount} sub="kontekst bez blokowania czasu" />
        <SummaryCard label="Zaległe ukryte" value={upcomingOnly ? overdueHidden : 0} sub={upcomingOnly ? "wyłącz filtr, żeby zobaczyć" : "filtr wyłączony"} />
      </section>

      <section className="calendar-workspace">
        <div className="panel calendar-month-panel">
          <div className="calendar-clock-strip">
            <div>
              <strong>{format(now, "HH:mm:ss")}</strong>
              <span>{format(now, "EEEE, d MMMM", { locale: pl })}</span>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                const today = new Date();
                setViewDate(today);
                setSelectedDate(format(today, "yyyy-MM-dd"));
                setDraft((current) => ({ ...current, entryDate: format(today, "yyyy-MM-dd") }));
              }}
              aria-label="Przejdź do dzisiaj"
              title="Dzisiaj"
            >
              <CalendarClock size={16} />
            </button>
          </div>
          <CalendarMonthView
            viewDate={viewDate}
            selectedDate={selectedDate}
            days={monthDays}
            onPrevious={() => setViewDate((current) => addMonths(current, -1))}
            onNext={() => setViewDate((current) => addMonths(current, 1))}
            onSelectDay={(day) => {
              setSelectedDate(day.iso);
              setDraft((current) => ({ ...current, entryDate: day.iso }));
              if (!day.inCurrentMonth) setViewDate(day.date);
            }}
          />
        </div>

        <div className="panel calendar-selected-panel">
          <div className="panel-header">
            <h2>{format(selectedDay, "d MMMM", { locale: pl })}</h2>
            <span>{formatRelativeDay(selectedDate)}</span>
          </div>
          <form className="calendar-day-note-form" onSubmit={createDayNote}>
            <div className="calendar-day-note-heading">
              <NotebookText size={16} />
              <strong>Notatka do dnia</strong>
            </div>
            <input
              value={dayNoteDraft.title}
              onChange={(event) => setDayNoteDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Tytuł notatki"
              aria-label="Tytuł notatki do dnia"
            />
            <textarea
              value={dayNoteDraft.notes}
              onChange={(event) => setDayNoteDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Co chcesz zapisać dla tego dnia?"
              aria-label="Treść notatki do dnia"
            />
            <div className="calendar-day-note-actions">
              <select
                value={dayNoteDraft.projectId}
                onChange={(event) => setDayNoteDraft((current) => ({ ...current, projectId: event.target.value }))}
                aria-label="Projekt dla notatki dnia"
              >
                <option value="">Bez projektu</option>
                {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
              </select>
              <button className="primary-button" type="submit">
                <NotebookText size={16} />
                Dodaj notatkę
              </button>
            </div>
          </form>
          <div className="calendar-selected-list">
            {selectedRows.map((row) => (
              <CompactCalendarItem row={row} key={`${row.source}-${row.id}`} />
            ))}
            {!selectedRows.length && (
              <div className="empty-state">Ten dzień jest wolny. Kliknij formularz niżej, żeby dodać wpis.</div>
            )}
          </div>
        </div>
      </section>

      <section className="calendar-layout">
        <div className="panel calendar-form-panel">
          <div className="panel-header">
            <h2><CalendarPlus size={18} />Dodaj wpis</h2>
          </div>
          <CalendarEntryForm
            draft={draft}
            projects={context.projects}
            onChange={setDraft}
            onSubmit={createEntry}
            submitLabel={draft.kind === "event" ? "Dodaj wydarzenie" : "Zapisz odnotację"}
          />
          {message && <div className="warning-box">{message}</div>}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2><CalendarClock size={18} />Najbliższa agenda</h2>
            <span>{rows.length}</span>
          </div>
          <div className="calendar-filters">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as CalendarTypeFilter)} aria-label="Typ wpisu">
              <option value="all">Wszystkie typy</option>
              <option value="event">Tylko wydarzenia</option>
              <option value="task">Tylko deadline'y</option>
              <option value="note">Tylko odnotacje</option>
            </select>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="Projekt">
              <option value="all">Wszystkie projekty</option>
              {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
            <select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))} aria-label="Okno czasu">
              <option value={7}>7 dni</option>
              <option value={30}>30 dni</option>
              <option value={90}>90 dni</option>
              <option value={0}>Bez limitu</option>
            </select>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Sortowanie">
              <option value="upcoming">Najbliższe pierwsze</option>
              <option value="newest">Najnowsze pierwsze</option>
            </select>
            <button className={`secondary-button ${upcomingOnly ? "active-filter" : ""}`} type="button" onClick={() => setUpcomingOnly((current) => !current)}>
              {upcomingOnly ? "Tylko nadchodzące" : "Pokaż historię"}
            </button>
          </div>

          <div className="calendar-agenda">
            {groupedRows.map((group) => (
              <section className="calendar-day-group" key={group.date}>
                <div className="calendar-day-header">
                  <strong>{formatDateHeader(group.date)}</strong>
                  <span>{formatRelativeDay(group.date)}</span>
                </div>
                <div className="calendar-day-items">
                  {group.items.map((row) => (
                    <CalendarAgendaItem
                      key={`${row.source}-${row.id}`}
                      row={row}
                      editing={editingId === row.id}
                      editDraft={editDraft}
                      projects={context.projects}
                      sendingTaskId={sendingTaskId}
                      onEditDraft={setEditDraft}
                      onStartEdit={startEdit}
                      onCancelEdit={() => setEditingId(null)}
                      onSaveEdit={saveEdit}
                      onDeleteEntry={deleteEntry}
                      onSendTask={sendTaskToCalendar}
                      onDoneTask={(taskId) => void context.updateTaskStatus(taskId, "done")}
                    />
                  ))}
                </div>
              </section>
            ))}
            {!groupedRows.length && <div className="empty-state">Brak wpisów w wybranym zakresie.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function CalendarMonthView({
  viewDate,
  selectedDate,
  days,
  onPrevious,
  onNext,
  onSelectDay
}: {
  viewDate: Date;
  selectedDate: string;
  days: CalendarMonthDay[];
  onPrevious: () => void;
  onNext: () => void;
  onSelectDay: (day: CalendarMonthDay) => void;
}) {
  const weekdays = ["pon", "wto", "śro", "czw", "pią", "sob", "nie"];

  return (
    <div className="calendar-month-view" aria-label="Widok miesiąca">
      <div className="calendar-month-header">
        <strong>{format(viewDate, "LLLL yyyy", { locale: pl })}</strong>
        <div className="calendar-month-controls">
          <button className="icon-button" type="button" onClick={onPrevious} aria-label="Poprzedni miesiąc">
            <ChevronLeft size={16} />
          </button>
          <button className="icon-button" type="button" onClick={onNext} aria-label="Następny miesiąc">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="calendar-month-grid">
        {weekdays.map((day) => (
          <span className="calendar-weekday" key={day}>{day}</span>
        ))}
        {days.map((day) => (
          <button
            className={[
              "calendar-month-day",
              day.inCurrentMonth ? "" : "muted",
              day.isTodayDate ? "today" : "",
              day.iso === selectedDate ? "selected" : ""
            ].filter(Boolean).join(" ")}
            type="button"
            onClick={() => onSelectDay(day)}
            key={day.iso}
            aria-label={`${format(day.date, "d MMMM yyyy", { locale: pl })}, ${day.items.length} wpisów`}
          >
            <span className="calendar-day-number">{format(day.date, "d")}</span>
            <span className="calendar-day-events">
              {day.items.slice(0, 2).map((item) => (
                <span className={`calendar-day-chip ${item.kind}`} key={`${item.source}-${item.id}`}>
                  {item.title}
                </span>
              ))}
              {day.items.length > 2 && <span className="calendar-day-more">+{day.items.length - 2}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CompactCalendarItem({ row }: { row: CalendarRow }) {
  const Icon = row.kind === "note" ? NotebookText : row.kind === "task" ? CheckSquare : CalendarClock;
  return (
    <article className={`calendar-compact-item calendar-${row.kind}`}>
      <div className="calendar-compact-icon">
        <Icon size={16} />
      </div>
      <div>
        <strong>{row.title}</strong>
        <span>
          {formatTime(row)}
          {row.projectName ? ` · ${row.projectName}` : ""}
        </span>
      </div>
    </article>
  );
}

function CalendarEntryForm({
  draft,
  projects,
  onChange,
  onSubmit,
  submitLabel
}: {
  draft: typeof emptyDraft;
  projects: AppContextValue["projects"];
  onChange: (draft: typeof emptyDraft) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
}) {
  const isNote = draft.kind === "note";
  return (
    <form className="calendar-entry-form" onSubmit={onSubmit}>
      <div className="segmented-control calendar-kind-switch">
        <button type="button" className={draft.kind === "event" ? "active" : ""} onClick={() => onChange({ ...draft, kind: "event", isAllDay: false })}>
          Wydarzenie
        </button>
        <button type="button" className={draft.kind === "note" ? "active" : ""} onClick={() => onChange({ ...draft, kind: "note", isAllDay: true })}>
          Odnotacja
        </button>
      </div>
      <input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} placeholder={isNote ? "Co trzeba odnotować?" : "Nazwa wydarzenia"} required />
      <div className="calendar-form-grid">
        <label>
          <span>Data</span>
          <input type="date" value={draft.entryDate} onChange={(event) => onChange({ ...draft, entryDate: event.target.value })} required />
        </label>
        <label>
          <span>Projekt</span>
          <select value={draft.projectId} onChange={(event) => onChange({ ...draft, projectId: event.target.value })}>
            <option value="">Bez projektu</option>
            {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
          </select>
        </label>
      </div>
      {!isNote && (
        <div className="calendar-time-row">
          <label className="calendar-check-row">
            <input type="checkbox" checked={draft.isAllDay} onChange={(event) => onChange({ ...draft, isAllDay: event.target.checked })} />
            <span>Cały dzień</span>
          </label>
          <input type="time" value={draft.startTime} onChange={(event) => onChange({ ...draft, startTime: event.target.value })} disabled={draft.isAllDay} aria-label="Godzina startu" />
          <input type="time" value={draft.endTime} onChange={(event) => onChange({ ...draft, endTime: event.target.value })} disabled={draft.isAllDay} aria-label="Godzina zakończenia" />
        </div>
      )}
      {!isNote && <input value={draft.location} onChange={(event) => onChange({ ...draft, location: event.target.value })} placeholder="Miejsce / link spotkania" />}
      <textarea value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} placeholder={isNote ? "Krótki kontekst, decyzja, obserwacja..." : "Agenda, cel, przygotowanie..."} />
      <button className="primary-button" type="submit">{submitLabel}</button>
    </form>
  );
}

function CalendarAgendaItem({
  row,
  editing,
  editDraft,
  projects,
  sendingTaskId,
  onEditDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteEntry,
  onSendTask,
  onDoneTask
}: {
  row: CalendarRow;
  editing: boolean;
  editDraft: typeof emptyDraft;
  projects: AppContextValue["projects"];
  sendingTaskId: string | null;
  onEditDraft: (draft: typeof emptyDraft) => void;
  onStartEdit: (entry: CalendarEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: (entryId: string) => Promise<void>;
  onDeleteEntry: (entry: CalendarEntry) => Promise<void>;
  onSendTask: (taskId: string) => Promise<void>;
  onDoneTask: (taskId: string) => void;
}) {
  if (editing && row.rawEntry) {
    return (
      <article className="calendar-item calendar-edit-item">
        <CalendarEntryForm
          draft={editDraft}
          projects={projects}
          onChange={onEditDraft}
          onSubmit={(event) => {
            event.preventDefault();
            void onSaveEdit(row.id);
          }}
          submitLabel="Zapisz zmiany"
        />
        <button className="secondary-button" type="button" onClick={onCancelEdit}>
          <X size={16} /> Anuluj
        </button>
      </article>
    );
  }

  const Icon = row.kind === "note" ? NotebookText : row.kind === "task" ? CheckSquare : CalendarClock;
  return (
    <article className={`calendar-item calendar-${row.kind}`}>
      <div className="calendar-item-time">
        <Icon size={17} />
        <strong>{formatTime(row)}</strong>
      </div>
      <div className="calendar-item-main">
        <div className="calendar-item-title">
          <span className="color-dot" style={{ background: row.projectColor ?? "var(--accent)" }} />
          <strong>{row.title}</strong>
          <span className={`status-pill ${row.kind}`}>{row.kind === "task" ? "deadline" : row.kind === "note" ? "odnotacja" : "wydarzenie"}</span>
          {row.status && <span className={`risk-badge ${row.status}`}>{row.status}</span>}
        </div>
        <div className="calendar-item-meta">
          {row.projectName && <span>{row.projectName}</span>}
          {row.location && <span><MapPin size={13} />{row.location}</span>}
          <span>{formatRelativeDay(row.date)}</span>
        </div>
        {row.notes && <p>{row.notes}</p>}
      </div>
      <div className="calendar-item-actions">
        {row.rawEntry && (
          <>
            <button className="icon-button" type="button" onClick={() => onStartEdit(row.rawEntry!)} aria-label="Edytuj wpis">
              <Edit3 size={16} />
            </button>
            <button className="icon-button danger-action" type="button" onClick={() => void onDeleteEntry(row.rawEntry!)} aria-label="Usuń wpis">
              <Trash2 size={16} />
            </button>
          </>
        )}
        {row.rawTask && (
          <>
            <button className="icon-button" type="button" onClick={() => void onSendTask(row.rawTask!.id)} disabled={sendingTaskId === row.rawTask.id} aria-label="Wyślij do Google Calendar">
              <CalendarPlus size={16} />
            </button>
            <button className="icon-button success-action" type="button" onClick={() => onDoneTask(row.rawTask!.id)} aria-label="Oznacz zadanie jako gotowe">
              <CheckSquare size={16} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="calendar-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function toCalendarInput(draft: typeof emptyDraft) {
  return {
    ...draft,
    projectId: draft.projectId || null
  };
}

function compareCalendarRows(a: CalendarRow, b: CalendarRow) {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  const timeCompare = (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99");
  if (timeCompare !== 0) return timeCompare;
  return b.urgency - a.urgency;
}

function daysFromToday(date: string, today = new Date()) {
  const parsedDate = parseISO(date);
  return Number.isNaN(parsedDate.getTime()) ? 9999 : differenceInCalendarDays(parsedDate, today);
}

function formatDateHeader(date: string) {
  const parsedDate = parseISO(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  return format(parsedDate, "EEEE, d MMMM", { locale: pl });
}

function formatRelativeDay(date: string) {
  const days = daysFromToday(date);
  if (days < 0) return `${Math.abs(days)} dni temu`;
  if (days === 0) return "dzisiaj";
  if (days === 1) return "jutro";
  return `za ${days} dni`;
}

function formatTime(row: CalendarRow) {
  if (row.kind === "note") return "notatka";
  if (row.isAllDay || !row.startTime) return "cały dzień";
  return row.endTime ? `${row.startTime}-${row.endTime}` : row.startTime;
}
