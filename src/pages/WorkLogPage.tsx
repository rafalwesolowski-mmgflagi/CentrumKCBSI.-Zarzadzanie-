import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { WorkLogEntry } from "../lib/types";

const categoryPresets = [
  "Analiza i planowanie",
  "Egzaminy",
  "Komentarze i opinie",
  "Przygotowywanie",
  "Prezentacja",
  "Zapoznanie się z materiałem",
  "Poprawki",
  "Rozmowa",
  "Inne"
];

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
}

function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function currentTimeString(offsetMinutes = 0) {
  const now = new Date(Date.now() + offsetMinutes * 60000);
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function dayBounds(dateString: string) {
  const start = new Date(`${dateString}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function localDateTimeIso(dateString: string, timeString: string) {
  return new Date(`${dateString}T${timeString}`).toISOString();
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function toDatetimeLocal(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface EditDraft {
  category: string;
  customCategory: string;
  note: string;
  startedAt: string;
  endedAt: string;
}

function draftFromEntry(entry: WorkLogEntry): EditDraft {
  const isPreset = categoryPresets.includes(entry.category);
  return {
    category: isPreset ? entry.category : "Inne",
    customCategory: isPreset ? "" : entry.category,
    note: entry.note,
    startedAt: toDatetimeLocal(entry.started_at),
    endedAt: entry.ended_at ? toDatetimeLocal(entry.ended_at) : ""
  };
}

export function WorkLogPage() {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [openEntry, setOpenEntry] = useState<WorkLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [startCategory, setStartCategory] = useState(categoryPresets[0]);
  const [startCustomCategory, setStartCustomCategory] = useState("");
  const [startNote, setStartNote] = useState("");
  const [manualCategory, setManualCategory] = useState(categoryPresets[0]);
  const [manualCustomCategory, setManualCustomCategory] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualStartTime, setManualStartTime] = useState(currentTimeString());
  const [manualEndTime, setManualEndTime] = useState(currentTimeString(60));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = dayBounds(selectedDate);
      const [entriesRes, openRes] = await Promise.all([
        supabase
          .from("work_log_entries")
          .select("*")
          .gte("started_at", start.toISOString())
          .lt("started_at", end.toISOString())
          .order("started_at", { ascending: true }),
        supabase.from("work_log_entries").select("*").is("ended_at", null).maybeSingle()
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (openRes.error) throw openRes.error;
      setEntries((entriesRes.data ?? []) as WorkLogEntry[]);
      setOpenEntry((openRes.data ?? null) as WorkLogEntry | null);
    } catch (loadError) {
      setError(errorMessage(loadError, "Nie udało się wczytać dziennika pracy."));
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openEntry) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [openEntry]);

  async function startEntry() {
    const category = startCategory === "Inne" ? startCustomCategory.trim() : startCategory;
    if (!category) return;
    setSaving(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      if (openEntry) {
        const { error: closeError } = await supabase.from("work_log_entries").update({ ended_at: nowIso }).eq("id", openEntry.id);
        if (closeError) throw closeError;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Brak aktywnej sesji.");
      const { error: insertError } = await supabase.from("work_log_entries").insert({
        user_id: userId,
        category,
        note: startNote.trim(),
        started_at: nowIso,
        ended_at: null
      });
      if (insertError) throw insertError;
      setStartNote("");
      setStartCustomCategory("");
      await load();
    } catch (startError) {
      setError(errorMessage(startError, "Nie udało się rozpocząć zadania."));
    } finally {
      setSaving(false);
    }
  }

  async function closeOpenEntry() {
    if (!openEntry) return;
    setSaving(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const { error: closeError } = await supabase.from("work_log_entries").update({ ended_at: nowIso }).eq("id", openEntry.id);
      if (closeError) throw closeError;
      await load();
    } catch (closeError) {
      setError(errorMessage(closeError, "Nie udało się zakończyć zadania."));
    } finally {
      setSaving(false);
    }
  }

  async function addManualEntry() {
    const category = manualCategory === "Inne" ? manualCustomCategory.trim() : manualCategory;
    if (!category || !manualStartTime || !manualEndTime) return;

    const startedAt = new Date(localDateTimeIso(selectedDate, manualStartTime));
    const endedAt = new Date(localDateTimeIso(selectedDate, manualEndTime));
    if (endedAt <= startedAt) {
      setError("Godzina zakończenia musi być późniejsza niż godzina rozpoczęcia.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Brak aktywnej sesji.");
      const { error: insertError } = await supabase.from("work_log_entries").insert({
        user_id: userId,
        category,
        note: manualNote.trim(),
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString()
      });
      if (insertError) throw insertError;
      setManualNote("");
      setManualCustomCategory("");
      await load();
    } catch (manualError) {
      setError(errorMessage(manualError, "Nie udało się dodać ręcznego wpisu."));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: WorkLogEntry) {
    setEditingId(entry.id);
    setEditDraft(draftFromEntry(entry));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editingId || !editDraft) return;
    const category = editDraft.category === "Inne" ? editDraft.customCategory.trim() : editDraft.category;
    if (!category || !editDraft.startedAt) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("work_log_entries")
        .update({
          category,
          note: editDraft.note.trim(),
          started_at: new Date(editDraft.startedAt).toISOString(),
          ended_at: editDraft.endedAt ? new Date(editDraft.endedAt).toISOString() : null
        })
        .eq("id", editingId);
      if (updateError) throw updateError;
      cancelEdit();
      await load();
    } catch (updateError) {
      setError(errorMessage(updateError, "Nie udało się zapisać zmian."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    setError(null);
    const { error: deleteError } = await supabase.from("work_log_entries").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingId === id) cancelEdit();
    await load();
  }

  const report = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of entries) {
      const start = new Date(entry.started_at).getTime();
      const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now;
      totals.set(entry.category, (totals.get(entry.category) ?? 0) + Math.max(0, end - start));
    }
    const rows = Array.from(totals.entries()).map(([category, ms]) => ({ category, ms })).sort((a, b) => b.ms - a.ms);
    const totalMs = rows.reduce((sum, row) => sum + row.ms, 0);
    return { rows, totalMs };
  }, [entries, now]);

  const openDurationMs = openEntry ? now - new Date(openEntry.started_at).getTime() : 0;

  return (
    <div className="work-log-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Praca</span>
          <h1>Dziennik pracy</h1>
          <p className="muted-note">Loguj dokładnie co robisz, żeby później przeanalizować nawyki.</p>
        </div>
        <label className="work-log-date-control">
          Dzień
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
      </header>

      {error && <div className="warning-box">{error}</div>}

      <section className="work-log-summary-grid" aria-label="Podsumowanie dnia">
        <div className="work-log-summary-item">
          <span>Łącznie</span>
          <strong>{formatDuration(report.totalMs)}</strong>
        </div>
        <div className="work-log-summary-item">
          <span>Wpisy</span>
          <strong>{entries.length}</strong>
        </div>
        <div className="work-log-summary-item">
          <span>Aktywne</span>
          <strong>{openEntry ? formatDuration(openDurationMs) : "0min"}</strong>
        </div>
      </section>

      {openEntry && (
        <div className="panel work-log-open-banner">
          <div>
            <span className="eyebrow">Trwa</span>
            <strong>{openEntry.category}</strong>
            {openEntry.note && <p>{openEntry.note}</p>}
            <span className="header-summary">{formatDuration(openDurationMs)} · od {formatTime(openEntry.started_at)}</span>
          </div>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => void closeOpenEntry()}>
            <Square size={16} /> Zakończ
          </button>
        </div>
      )}

      <div className="panel work-log-start-form">
        <div className="work-log-form-grid">
          <section className="work-log-form-section">
            <div className="panel-header"><h2>{openEntry ? "Przełącz na nowe zadanie" : "Rozpocznij zadanie"}</h2></div>
            <div className="work-log-start-row">
              <label>
                Kategoria
                <select value={startCategory} onChange={(event) => setStartCategory(event.target.value)}>
                  {categoryPresets.map((category) => <option value={category} key={category}>{category}</option>)}
                </select>
              </label>
              {startCategory === "Inne" && (
                <label>
                  Własna kategoria
                  <input value={startCustomCategory} onChange={(event) => setStartCustomCategory(event.target.value)} placeholder="Np. Administracja" />
                </label>
              )}
              <label className="work-log-wide-field">
                Opis
                <input value={startNote} onChange={(event) => setStartNote(event.target.value)} placeholder="Co dokładnie robisz?" />
              </label>
              <button type="button" className="primary-button" disabled={saving} onClick={() => void startEntry()}>
                {saving ? <Loader2 className="spin-icon" size={16} /> : <Play size={16} />} Start
              </button>
            </div>
          </section>
          <section className="work-log-form-section">
            <div className="panel-header"><h2>Dodaj ręcznie</h2></div>
          <div className="work-log-manual-row">
            <label>
              Kategoria
              <select value={manualCategory} onChange={(event) => setManualCategory(event.target.value)}>
                {categoryPresets.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </label>
            {manualCategory === "Inne" && (
              <label>
                Własna kategoria
                <input value={manualCustomCategory} onChange={(event) => setManualCustomCategory(event.target.value)} placeholder="Np. Administracja" />
              </label>
            )}
            <label className="work-log-wide-field">
              Opis
              <input value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="Co było robione?" />
            </label>
            <label>
              Od
              <input type="time" value={manualStartTime} onChange={(event) => setManualStartTime(event.target.value)} />
            </label>
            <label>
              Do
              <input type="time" value={manualEndTime} onChange={(event) => setManualEndTime(event.target.value)} />
            </label>
            <button type="button" className="secondary-button" disabled={saving} onClick={() => void addManualEntry()}>
              {saving ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />} Dodaj
            </button>
          </div>
          </section>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2><ClipboardList size={18} /> Wpisy dnia</h2>
          <span>{entries.length}</span>
        </div>
        {loading ? (
          <div className="empty-state"><Loader2 className="spin-icon" size={20} /> Ładowanie...</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">Brak wpisów tego dnia.</div>
        ) : (
          <div className="work-log-entry-list">
            {entries.map((entry) => (
              <div className="work-log-entry-card" key={entry.id}>
                {editingId === entry.id && editDraft ? (
                  <div className="work-log-edit-form">
                    <label>
                      Kategoria
                      <select value={editDraft.category} onChange={(event) => setEditDraft({ ...editDraft, category: event.target.value })}>
                        {categoryPresets.map((category) => <option value={category} key={category}>{category}</option>)}
                      </select>
                    </label>
                    {editDraft.category === "Inne" && (
                      <label>
                        Własna kategoria
                        <input value={editDraft.customCategory} onChange={(event) => setEditDraft({ ...editDraft, customCategory: event.target.value })} placeholder="Własna kategoria" />
                      </label>
                    )}
                    <label>
                      Opis
                      <input value={editDraft.note} onChange={(event) => setEditDraft({ ...editDraft, note: event.target.value })} placeholder="Opis" />
                    </label>
                    <label>
                      Start
                      <input type="datetime-local" value={editDraft.startedAt} onChange={(event) => setEditDraft({ ...editDraft, startedAt: event.target.value })} />
                    </label>
                    <label>
                      Koniec
                      <input type="datetime-local" value={editDraft.endedAt} onChange={(event) => setEditDraft({ ...editDraft, endedAt: event.target.value })} />
                    </label>
                    <div className="work-log-edit-actions">
                      <button type="button" className="secondary-button" onClick={cancelEdit}>Anuluj</button>
                      <button type="button" className="primary-button" disabled={saving} onClick={() => void saveEdit()}>Zapisz</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="work-log-entry-header">
                      <div>
                        <strong>{entry.category}</strong>
                        <span>{formatTime(entry.started_at)}-{entry.ended_at ? formatTime(entry.ended_at) : "trwa"}</span>
                      </div>
                      <span className="work-log-duration-pill">
                        {formatDuration((entry.ended_at ? new Date(entry.ended_at).getTime() : now) - new Date(entry.started_at).getTime())}
                      </span>
                    </div>
                    {entry.note && <p>{entry.note}</p>}
                    <div className="work-log-entry-actions">
                      <button type="button" className="icon-button" onClick={() => startEdit(entry)} aria-label="Edytuj wpis"><Pencil size={16} /></button>
                      <button type="button" className="icon-button danger-action" onClick={() => void deleteEntry(entry.id)} aria-label="Usuń wpis"><Trash2 size={16} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Raport dnia</h2><span>{formatDuration(report.totalMs)}</span></div>
        {report.rows.length === 0 ? (
          <div className="empty-state">Brak danych do podsumowania.</div>
        ) : (
          <div className="work-log-report">
            {report.rows.map((row) => (
              <div className="work-log-report-row" key={row.category}>
                <div className="work-log-report-label">
                  <span>{row.category}</span>
                  <span>{formatDuration(row.ms)}</span>
                </div>
                <div className="work-log-report-track">
                  <div className="work-log-report-bar" style={{ width: `${report.totalMs > 0 ? (row.ms / report.totalMs) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
