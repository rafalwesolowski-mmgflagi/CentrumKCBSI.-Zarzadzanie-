import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Check, Clipboard, Download, Plus, Sparkles, Trash2, Upload } from "lucide-react";

type ContentType = {
  id: string;
  name: string;
  color: string;
};

type SequenceItem = {
  id: string;
  typeId: string;
};

type Assignment = {
  date: string;
  type: ContentType;
  index: number;
  published: boolean;
};

type NarrativeBrief = {
  contextKind: "brand" | "course" | "offer" | "expert" | "community";
  audience: string;
  promise: string;
  tone: string;
  pillars: string;
  goal: string;
  callToAction: string;
};

type ImportedBrief = {
  topic?: string;
  brief?: Partial<NarrativeBrief>;
};

type AiPlanItem = {
  date: string;
  type: string;
  title: string;
  angle: string;
  hook: string;
  postIdea: string;
  keyPoints: string[];
  cta: string;
  format: string;
};

const dayLabels = ["PON", "WT", "SR", "CZW", "PT", "SOB", "ND"];
const dayFullLabels = ["Poniedzialek", "Wtorek", "Sroda", "Czwartek", "Piatek", "Sobota", "Niedziela"];
const palette = ["#6E8BFF", "#7CFFB2", "#FF8C42", "#C77DFF", "#5EE6D0", "#FF9F1C", "#9DDC4B", "#E0607E"];

const defaultPool: Array<Omit<ContentType, "id">> = [
  { name: "Ciekawostki", color: "#B98CFF" },
  { name: "Problemy", color: "#FFD23F" },
  { name: "Oferta", color: "#FF6B4A" },
  { name: "Edukacja", color: "#4ADEDE" },
  { name: "Offtop", color: "#FF4D8D" },
  { name: "Case study", color: "#7CFFB2" },
  { name: "Q&A", color: "#6E8BFF" },
  { name: "Inspiracja", color: "#FF8C42" }
];

const presets = [
  {
    name: "Wzorzec mieszany",
    desc: "Ciekawostki i problemy przeplatane oferta oraz edukacja.",
    pattern: ["Ciekawostki", "Problemy", "Ciekawostki", "Problemy", "Oferta", "Edukacja", "Offtop", "Oferta"]
  },
  {
    name: "Zasada 4-1-1",
    desc: "Cztery tresci wartosciowe, jedna lekka wzmianka, jedna sprzedazowa.",
    pattern: ["Edukacja", "Ciekawostki", "Problemy", "Edukacja", "Ciekawostki", "Oferta"]
  },
  {
    name: "Zasada 80/20",
    desc: "80% zaufania i wartosci, 20% sprzedazy.",
    pattern: ["Edukacja", "Ciekawostki", "Problemy", "Edukacja", "Oferta"]
  },
  {
    name: "Tygodniowy rytm ekspercki",
    desc: "Staly rytm na dni robocze: edukacja, ciekawostka, problem, case, oferta.",
    pattern: ["Edukacja", "Ciekawostki", "Problemy", "Case study", "Oferta"]
  },
  {
    name: "Tydzien launchu",
    desc: "Wiecej oferty i social proof w okresie sprzedazowym.",
    pattern: ["Ciekawostki", "Edukacja", "Problemy", "Case study", "Oferta", "Oferta"]
  },
  {
    name: "4 filary CodeSpade",
    desc: "AI dla ludzi, Systemy COO, Trening mentalny i Life Ops.",
    pattern: ["AI dla ludzi", "Systemy COO", "Trening mentalny", "Life Ops"]
  }
];

export function SocialPlannerPage() {
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState<NarrativeBrief>({
    contextKind: "brand",
    audience: "",
    promise: "",
    tone: "Ekspercko, konkretnie, bez przesadnej sprzedazy",
    pillars: "",
    goal: "Budowanie zaufania i regularnej widocznosci",
    callToAction: ""
  });
  const [pool, setPool] = useState<ContentType[]>(() => defaultPool.map((item, index) => ({ ...item, id: `type-${index}` })));
  const [sequence, setSequence] = useState<SequenceItem[]>(() => buildSequence(defaultPool.map((item, index) => ({ ...item, id: `type-${index}` })), presets[0].pattern));
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState("#6E8BFF");
  const [startDate, setStartDate] = useState(toDateInput(new Date()));
  const [weeks, setWeeks] = useState(4);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [published, setPublished] = useState<Record<string, boolean>>({});
  const [aiItems, setAiItems] = useState<Record<string, AiPlanItem>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const assignments = useMemo(() => {
    if (!startDate || !sequence.length || !selectedDays.length) return [];
    return generateAssignments({ pool, sequence, startDate, weeks, selectedDays, published });
  }, [pool, published, selectedDays, sequence, startDate, weeks]);

  const weeksGrid = useMemo(() => buildWeeks(startDate, weeks), [startDate, weeks]);
  const typeById = useMemo(() => new Map(pool.map((item) => [item.id, item])), [pool]);

  function addType(event: FormEvent) {
    event.preventDefault();
    const name = newTypeName.trim();
    if (!name) return;
    setPool((current) => [...current, { id: `type-${Date.now()}`, name, color: newTypeColor }]);
    setNewTypeName("");
    setNewTypeColor(palette[pool.length % palette.length]);
  }

  function loadPreset(pattern: string[]) {
    const nextPool = ensureTypes(pool, pattern);
    setPool(nextPool);
    setSequence(buildSequence(nextPool, pattern));
    setMessage("Wczytano wzorzec publikacji.");
  }

  function addToSequence(typeId: string) {
    setSequence((current) => [...current, { id: `seq-${Date.now()}-${current.length}`, typeId }]);
  }

  function moveItem(id: string, direction: -1 | 1) {
    setSequence((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function copyText() {
    const text = formatPlanText(assignments, topic, brief, aiItems);
    if (!text) {
      setMessage("Najpierw ustaw sekwencje i harmonogram.");
      return;
    }
    void navigator.clipboard.writeText(text).then(() => setMessage("Skopiowano plan do schowka."));
  }

  function exportExcel() {
    if (!assignments.length) {
      setMessage("Najpierw ustaw sekwencje i harmonogram.");
      return;
    }

    const rows = assignments.map((item) => {
      const date = new Date(`${item.date}T00:00:00`);
      const ai = aiItems[item.date];
      return {
        date: formatDateForSheet(item.date),
        day: dayFullLabels[(date.getDay() + 6) % 7],
        topic: topic || "Bez tematu",
        type: item.type.name,
        color: item.type.color,
        title: ai?.title || "",
        hook: ai?.hook || "",
        idea: ai?.postIdea || buildNarrativeCue(item, topic, brief),
        points: ai?.keyPoints?.length ? ai.keyPoints.join("\n") : "",
        cta: ai?.cta || "",
        format: ai?.format || "",
        number: item.index + 1,
        status: item.published ? "Opublikowane" : "Do publikacji"
      };
    });
    const workbook = buildExcelWorkbook(rows, topic || "Plan social media");
    const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plan-social-media.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage("Wyeksportowano estetyczny arkusz Excel.");
  }

  async function importBriefFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parseImportedBrief(text);
      const importedBrief = imported.brief || {};
      const changedFields = [
        imported.topic,
        importedBrief.contextKind,
        importedBrief.audience,
        importedBrief.promise,
        importedBrief.tone,
        importedBrief.pillars,
        importedBrief.goal,
        importedBrief.callToAction
      ].filter(Boolean).length;

      if (!changedFields) {
        setMessage("Nie znaleziono pasujacych pol w pliku. Uzyj etykiet: Temat kampanii, Typ kontekstu, Odbiorca, Obietnica, Ton, Filary, Cel, CTA.");
        return;
      }

      if (imported.topic) setTopic(imported.topic);
      setBrief((current) => ({ ...current, ...importedBrief }));
      setAiItems({});
      setMessage(`Zaimportowano ${changedFields} pol z pliku "${file.name}".`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udalo sie odczytac pliku.");
    }
  }

  async function generateWithAi() {
    if (!assignments.length) {
      setMessage("Najpierw ustaw sekwencje i harmonogram.");
      return;
    }

    setAiLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/social-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic,
          brief,
          assignments: assignments.map((item) => ({
            date: item.date,
            index: item.index,
            type: { name: item.type.name }
          }))
        })
      });
      const data = await response.json() as { items?: AiPlanItem[]; error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.error || "Nie udalo sie wygenerowac planu.");
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setAiItems(Object.fromEntries(items.map((item) => [item.date, item])));
      setMessage(`AI przygotowalo ${items.length} publikacji.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udalo sie wygenerowac planu.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="page social-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Content ops</span>
          <h1>Social Plan</h1>
          <p className="page-subtitle">Plan publikacji social media pod temat kampanii, z sekwencja typow tresci i kalendarzem.</p>
        </div>
        <div className="header-summary">{assignments.length} publikacji</div>
      </header>

      <section className="social-panel">
        <div className="social-section-heading">
          <div>
            <span className="eyebrow">1. Temat</span>
            <h2>Temat kampanii</h2>
            <p className="hint">Wpisz temat, pod ktory planujesz komunikacje. Pojawi sie w eksporcie i kopii tekstowej.</p>
          </div>
          <label className="secondary-button social-import-button">
            <Upload size={16} />Import briefu
            <input accept=".json,.txt,.md,.csv,text/plain,application/json,text/markdown,text/csv" type="file" onChange={importBriefFile} />
          </label>
        </div>
        <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Np. AI w edukacji, oferta strony WWW, launch konsultacji..." />
      </section>

      <section className="social-panel">
        <div>
          <span className="eyebrow">2. Brief narracyjny</span>
          <h2>Kontekst marki, kursu albo oferty</h2>
          <p className="hint">Te wytyczne nadaja planowi kierunek: dla kogo mowisz, co obiecujesz, jakim tonem i do czego prowadzisz odbiorce.</p>
        </div>
        <div className="social-brief-grid">
          <label>Typ kontekstu
            <select value={brief.contextKind} onChange={(event) => setBrief((current) => ({ ...current, contextKind: event.target.value as NarrativeBrief["contextKind"] }))}>
              <option value="brand">Struktura marki</option>
              <option value="course">Kurs / program</option>
              <option value="offer">Oferta / usluga</option>
              <option value="expert">Marka ekspercka</option>
              <option value="community">Spolecznosc</option>
            </select>
          </label>
          <label>Odbiorca
            <input value={brief.audience} onChange={(event) => setBrief((current) => ({ ...current, audience: event.target.value }))} placeholder="Np. wlasciciele malych firm, edukatorzy, soloprzedsiebiorcy" />
          </label>
          <label>Obietnica / transformacja
            <input value={brief.promise} onChange={(event) => setBrief((current) => ({ ...current, promise: event.target.value }))} placeholder="Np. mniej chaosu, wiecej decyzji, lepszy system pracy" />
          </label>
          <label>Ton komunikacji
            <input value={brief.tone} onChange={(event) => setBrief((current) => ({ ...current, tone: event.target.value }))} />
          </label>
          <label>Filary narracji
            <textarea value={brief.pillars} onChange={(event) => setBrief((current) => ({ ...current, pillars: event.target.value }))} placeholder="Np. edukacja, kulisy, case studies, przekonania, obiekcje, oferta" />
          </label>
          <label>Cel kampanii
            <textarea value={brief.goal} onChange={(event) => setBrief((current) => ({ ...current, goal: event.target.value }))} />
          </label>
          <label>Domyslne CTA
            <input value={brief.callToAction} onChange={(event) => setBrief((current) => ({ ...current, callToAction: event.target.value }))} placeholder="Np. napisz DM, zapisz sie, sprawdz oferte, pobierz material" />
          </label>
        </div>
      </section>

      <section className="social-panel">
        <div>
          <span className="eyebrow">3. Sekwencja</span>
          <h2>Typy tresci i wzorzec publikacji</h2>
          <p className="hint">Kliknij typ, aby dodac go do sekwencji. Sekwencja powtarza sie cyklicznie w kalendarzu.</p>
        </div>

        <div className="social-chip-pool">
          {pool.map((type) => (
            <button className="social-chip" type="button" key={type.id} onClick={() => addToSequence(type.id)}>
              <span style={{ background: type.color }} />
              {type.name}
            </button>
          ))}
        </div>

        <form className="social-add-type" onSubmit={addType}>
          <input value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)} placeholder="Wlasny typ, np. Demo" maxLength={28} />
          <input value={newTypeColor} onChange={(event) => setNewTypeColor(event.target.value)} type="color" aria-label="Kolor typu tresci" />
          <button className="secondary-button" type="submit"><Plus size={16} />Dodaj typ</button>
        </form>

        <div className="social-presets-grid">
          {presets.map((preset) => (
            <button className="social-preset-card" type="button" key={preset.name} onClick={() => loadPreset(preset.pattern)}>
              <strong>{preset.name}</strong>
              <span>{preset.desc}</span>
            </button>
          ))}
        </div>

        <div className="social-sequence">
          {sequence.map((item, index) => {
            const type = typeById.get(item.typeId);
            if (!type) return null;
            return (
              <div className="social-sequence-item" key={item.id}>
                <span className="seq-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="type-dot" style={{ background: type.color }} />
                <strong>{type.name}</strong>
                <button type="button" onClick={() => moveItem(item.id, -1)}>↑</button>
                <button type="button" onClick={() => moveItem(item.id, 1)}>↓</button>
                <button type="button" onClick={() => setSequence((current) => current.filter((seq) => seq.id !== item.id))}><Trash2 size={13} /></button>
              </div>
            );
          })}
          {!sequence.length && <div className="empty-state">Sekwencja jest pusta. Dodaj typ tresci z listy powyzej.</div>}
        </div>
      </section>

      <section className="social-panel">
        <div>
          <span className="eyebrow">4. Harmonogram</span>
          <h2>Dni publikacji</h2>
        </div>
        <div className="social-schedule-grid">
          <label>Data startu<input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" /></label>
          <label>Liczba tygodni<input value={weeks} onChange={(event) => setWeeks(clampNumber(event.target.value, 1, 12))} type="number" min="1" max="12" /></label>
          <div className="social-days-picker">
            {dayLabels.map((label, index) => (
              <button
                className={selectedDays.includes(index) ? "active" : ""}
                key={label}
                type="button"
                onClick={() => setSelectedDays((current) => toggleNumber(current, index))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="social-panel">
        <div className="social-calendar-header">
          <div>
            <span className="eyebrow">5. Kalendarz</span>
            <h2>Plan publikacji</h2>
          </div>
          <div className="row-actions">
            <button className="secondary-button" type="button" onClick={generateWithAi} disabled={aiLoading}>
              <Sparkles size={16} />{aiLoading ? "Generuje..." : "Generuj AI"}
            </button>
            <button className="secondary-button" type="button" onClick={exportExcel}><Download size={16} />Excel</button>
            <button className="secondary-button" type="button" onClick={copyText}><Clipboard size={16} />Kopiuj</button>
          </div>
        </div>

        <div className="social-calendar">
          {dayLabels.map((label) => <strong key={label}>{label}</strong>)}
          {weeksGrid.flat().map((day) => {
            const date = toDateInput(day);
            const assignment = assignments.find((item) => item.date === date);
            const dayIndex = (day.getDay() + 6) % 7;
            const muted = !selectedDays.includes(dayIndex) || day < new Date(`${startDate}T00:00:00`);
            return (
              <div className={`social-calendar-cell ${muted ? "muted" : ""}`} key={date}>
                <span>{day.getDate().toString().padStart(2, "0")}.{(day.getMonth() + 1).toString().padStart(2, "0")}</span>
                {assignment && (() => {
                  const ai = aiItems[assignment.date];
                  return (
                  <>
                    <button
                      className={`social-calendar-block ${assignment.published ? "done" : ""}`}
                      type="button"
                      style={{ background: assignment.type.color }}
                      onClick={() => setPublished((current) => ({ ...current, [assignment.date]: !current[assignment.date] }))}
                      title="Kliknij, aby oznaczyc publikacje"
                    >
                      <small>#{String(assignment.index + 1).padStart(2, "0")}</small>
                      {assignment.published && <Check size={13} />}
                      <span>{assignment.type.name}</span>
                      <em>{ai?.title || "Kliknij Generuj AI, aby przygotowac publikacje"}</em>
                    </button>
                    {ai && (
                      <div className="social-ai-card">
                        <strong>{ai.hook}</strong>
                        <span>{ai.angle}</span>
                        <p>{ai.postIdea}</p>
                        {ai.keyPoints.length > 0 && (
                          <ul>
                            {ai.keyPoints.map((point) => <li key={point}>{point}</li>)}
                          </ul>
                        )}
                        <small>{ai.format} · {ai.cta}</small>
                      </div>
                    )}
                  </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </section>

      {message && <div className="warning-box">{message}</div>}
    </div>
  );
}

function ensureTypes(pool: ContentType[], pattern: string[]) {
  const next = [...pool];
  for (const name of pattern) {
    if (!next.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      next.push({ id: `type-${Date.now()}-${next.length}`, name, color: palette[next.length % palette.length] });
    }
  }
  return next;
}

function buildSequence(pool: ContentType[], pattern: string[]) {
  return pattern.map((name, index) => ({
    id: `seq-${index}-${name}`,
    typeId: pool.find((item) => item.name.toLowerCase() === name.toLowerCase())?.id ?? pool[0]?.id ?? ""
  })).filter((item) => item.typeId);
}

function generateAssignments({
  pool,
  sequence,
  startDate,
  weeks,
  selectedDays,
  published
}: {
  pool: ContentType[];
  sequence: SequenceItem[];
  startDate: string;
  weeks: number;
  selectedDays: number[];
  published: Record<string, boolean>;
}): Assignment[] {
  const typeById = new Map(pool.map((item) => [item.id, item]));
  const start = new Date(`${startDate}T00:00:00`);
  const days = buildWeeks(startDate, weeks).flat().filter((day) => {
    const dayIndex = (day.getDay() + 6) % 7;
    return day >= start && selectedDays.includes(dayIndex);
  });
  return days.map((day, index) => {
    const seqItem = sequence[index % sequence.length];
    const type = typeById.get(seqItem.typeId) ?? pool[0];
    return {
      date: toDateInput(day),
      type,
      index,
      published: published[toDateInput(day)] === true
    };
  }).filter((item) => Boolean(item.type));
}

function buildWeeks(startDate: string, weeks: number) {
  const start = mondayOf(new Date(`${startDate}T00:00:00`));
  return Array.from({ length: weeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const day = new Date(start);
      day.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      return day;
    })
  );
}

function mondayOf(date: Date) {
  const next = new Date(date);
  const dayIndex = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - dayIndex);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toggleNumber(values: number[], value: number) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort((a, b) => a - b);
}

function clampNumber(value: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function buildNarrativeCue(item: Assignment, topic: string, brief: NarrativeBrief) {
  const subject = topic.trim() || "wybrany temat";
  const audience = brief.audience.trim() ? `dla: ${brief.audience.trim()}` : "dla wybranej grupy odbiorcow";
  const promise = brief.promise.trim() ? `Obietnica: ${brief.promise.trim()}.` : "";
  const goal = brief.goal.trim() ? `Cel: ${brief.goal.trim()}.` : "";
  const cta = brief.callToAction.trim() ? `CTA: ${brief.callToAction.trim()}.` : "";

  switch (item.type.name.toLowerCase()) {
    case "problemy":
      return `Pokaz konkretny problem wokol "${subject}" ${audience}. ${promise} ${cta}`.trim();
    case "oferta":
      return `Polacz "${subject}" z oferta i wyjasnij, dlaczego teraz warto zrobic kolejny krok. ${cta}`.trim();
    case "edukacja":
      return `Naucz jednej praktycznej rzeczy zwiazanej z "${subject}". ${promise} ${goal}`.trim();
    case "case study":
      return `Pokaz przyklad, rezultat albo sytuacje klienta zwiazana z "${subject}". ${promise}`.trim();
    case "q&a":
      return `Odpowiedz na obiekcje lub pytanie odbiorcy ${audience} w kontekscie "${subject}". ${cta}`.trim();
    case "offtop":
      return `Dodaj ludzki, lekki kontekst marki bez odchodzenia daleko od "${subject}".`;
    default:
      return `Zbuduj narracje typu "${item.type.name}" wokol "${subject}" ${audience}. ${promise} ${cta}`.trim();
  }
}

function formatBriefText(brief: NarrativeBrief) {
  return [
    `Kontekst: ${brief.contextKind}`,
    brief.audience.trim() ? `Odbiorca: ${brief.audience.trim()}` : null,
    brief.promise.trim() ? `Obietnica: ${brief.promise.trim()}` : null,
    brief.tone.trim() ? `Ton: ${brief.tone.trim()}` : null,
    brief.pillars.trim() ? `Filary: ${brief.pillars.trim()}` : null,
    brief.goal.trim() ? `Cel: ${brief.goal.trim()}` : null,
    brief.callToAction.trim() ? `CTA: ${brief.callToAction.trim()}` : null
  ].filter(Boolean).join("\n");
}

function formatPlanText(assignments: Assignment[], topic: string, brief: NarrativeBrief, aiItems: Record<string, AiPlanItem>) {
  if (!assignments.length) return "";
  const header = [
    `Temat: ${topic.trim() || "Bez tematu"}`,
    formatBriefText(brief),
    "Plan publikacji:"
  ].filter(Boolean).join("\n\n");
  const rows = assignments.map((item) => {
    const date = new Date(`${item.date}T00:00:00`);
    const dayName = dayFullLabels[(date.getDay() + 6) % 7];
    const label = topic.trim() ? ` — ${topic.trim()}` : "";
    const ai = aiItems[item.date];
    if (ai) {
      const points = ai.keyPoints.length ? `\n  Punkty:\n${ai.keyPoints.map((point) => `  - ${point}`).join("\n")}` : "";
      return `${dayName} ${item.date}: ${item.type.name}${label}${item.published ? " [opublikowane]" : ""}\n  Tytul: ${ai.title}\n  Hook: ${ai.hook}\n  Kat: ${ai.angle}\n  Pomysl: ${ai.postIdea}${points}\n  CTA: ${ai.cta}\n  Format: ${ai.format}`;
    }
    return `${dayName} ${item.date}: ${item.type.name}${label}${item.published ? " [opublikowane]" : ""}\n  ${buildNarrativeCue(item, topic, brief)}`;
  }).join("\n");
  return `${header}\n\n${rows}`;
}

function parseImportedBrief(text: string): ImportedBrief {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const jsonBrief = parseImportedJson(trimmed);
  if (jsonBrief) return jsonBrief;

  const csvBrief = parseImportedCsv(trimmed);
  if (csvBrief) return csvBrief;

  return parseImportedText(trimmed);
}

function parseImportedJson(text: string): ImportedBrief | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const source = parsed.brief && typeof parsed.brief === "object"
      ? { ...parsed, ...(parsed.brief as Record<string, unknown>) }
      : parsed;
    return buildImportedBriefFromRecord(source);
  } catch {
    return null;
  }
}

function parseImportedText(text: string): ImportedBrief {
  const labels = {
    topic: ["temat kampanii", "temat", "topic", "campaign topic"],
    contextKind: ["typ kontekstu", "kontekst marki", "kontekst marki kursu albo oferty", "kontekst", "context kind", "context"],
    audience: ["odbiorca", "grupa docelowa", "dla kogo", "audience"],
    promise: ["obietnica / transformacja", "obietnica", "transformacja", "promise"],
    tone: ["ton komunikacji", "ton", "tone"],
    pillars: ["filary narracji", "filary", "filary komunikacji", "pillars"],
    goal: ["cel kampanii", "cel", "goal"],
    callToAction: ["domyslne cta", "domyślne cta", "cta", "call to action"]
  };
  const normalizedLabels = Object.fromEntries(
    Object.entries(labels).map(([field, aliases]) => [field, aliases.map(normalizeImportKey)])
  ) as Record<keyof typeof labels, string[]>;
  const allLabels = Object.values(normalizedLabels).flat();
  const record: Record<string, unknown> = {};

  for (const [field, aliases] of Object.entries(normalizedLabels)) {
    const value = extractLabeledValue(text, aliases, allLabels);
    if (value) record[field] = value;
  }

  return buildImportedBriefFromRecord(record);
}

function extractLabeledValue(text: string, normalizedAliases: string[], allNormalizedLabels: string[]) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const startIndex = lines.findIndex((line) => {
    const parsed = parseLabelLine(line);
    return parsed && normalizedAliases.includes(parsed.label);
  });
  if (startIndex < 0) return "";

  const first = parseLabelLine(lines[startIndex]);
  const values = [first?.value || ""];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const parsed = parseLabelLine(lines[index]);
    if (parsed && allNormalizedLabels.includes(parsed.label)) break;
    values.push(lines[index]);
  }

  return values.join("\n").trim();
}

function parseLabelLine(line: string) {
  const cleaned = line.replace(/^[-*#\s]+/, "").trim();
  const match = cleaned.match(/^([^:=]{2,80})\s*[:=]\s*(.*)$/);
  if (!match) {
    const heading = cleaned.match(/^([^:=]{2,80})$/);
    if (!heading) return null;
    return {
      label: normalizeImportKey(heading[1]),
      value: ""
    };
  }
  return {
    label: normalizeImportKey(match[1]),
    value: match[2].trim()
  };
}

function parseImportedCsv(text: string): ImportedBrief | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || !lines[0].includes(";")) return null;
  const headers = splitCsvLine(lines[0]).map(normalizeImportKey);
  const firstRow = splitCsvLine(lines[1]);
  const record = Object.fromEntries(headers.map((header, index) => [header, firstRow[index] || ""]));
  const topic = readImportText(record, ["temat", "topic", "tematKampanii"]);
  if (!topic) return null;
  return buildImportedBriefFromRecord({ topic });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ";" && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function buildImportedBriefFromRecord(record: Record<string, unknown>): ImportedBrief {
  const topic = readImportText(record, ["topic", "temat", "tematKampanii", "campaignTopic"]);
  const contextKind = normalizeContextKind(readImportText(record, ["contextKind", "typKontekstu", "kontekst", "context"]));
  const brief: Partial<NarrativeBrief> = {
    ...(contextKind ? { contextKind } : {}),
    ...fieldIfText("audience", readImportText(record, ["audience", "odbiorca", "grupaDocelowa"])),
    ...fieldIfText("promise", readImportText(record, ["promise", "obietnica", "transformacja"])),
    ...fieldIfText("tone", readImportText(record, ["tone", "ton", "tonKomunikacji"])),
    ...fieldIfText("pillars", readImportText(record, ["pillars", "filary", "filaryNarracji"])),
    ...fieldIfText("goal", readImportText(record, ["goal", "cel", "celKampanii"])),
    ...fieldIfText("callToAction", readImportText(record, ["callToAction", "cta", "domyslneCTA"]))
  };

  return {
    ...(topic ? { topic } : {}),
    ...(Object.keys(brief).length ? { brief } : {})
  };
}

function fieldIfText<T extends keyof NarrativeBrief>(field: T, value: string) {
  return value ? { [field]: value } as Pick<NarrativeBrief, T> : {};
}

function readImportText(record: Record<string, unknown>, aliases: string[]) {
  const normalized = new Map(Object.entries(record).map(([key, value]) => [normalizeImportKey(key), value]));
  for (const alias of aliases) {
    const value = normalized.get(normalizeImportKey(alias));
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  }
  return "";
}

function normalizeImportKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function normalizeContextKind(value: string): NarrativeBrief["contextKind"] | "" {
  const text = normalizeImportKey(value);
  if (!text) return "";
  if (text.includes("kurs") || text.includes("program") || text.includes("course")) return "course";
  if (text.includes("ofert") || text.includes("uslug") || text.includes("offer")) return "offer";
  if (text.includes("ekspert") || text.includes("expert")) return "expert";
  if (text.includes("spolecz") || text.includes("community")) return "community";
  if (text.includes("mark") || text.includes("brand") || text.includes("struktur")) return "brand";
  return "";
}

type ExcelRow = {
  date: string;
  day: string;
  topic: string;
  type: string;
  color: string;
  title: string;
  hook: string;
  idea: string;
  points: string;
  cta: string;
  format: string;
  number: number;
  status: string;
};

function buildExcelWorkbook(rows: ExcelRow[], title: string) {
  const headers = ["Data", "Dzien", "Temat", "Typ tresci", "Tytul", "Hook", "Pomysl", "Punkty", "CTA", "Format", "Numer", "Status"];
  const body = rows.map((row) => `
    <tr>
      <td class="date">${escapeHtml(row.date)}</td>
      <td class="day">${escapeHtml(row.day)}</td>
      <td class="topic">${escapeHtml(row.topic)}</td>
      <td class="type"><span style="background:${escapeHtml(row.color)}"></span>${escapeHtml(row.type)}</td>
      <td class="title">${escapeHtml(row.title)}</td>
      <td class="wrap">${escapeHtml(row.hook)}</td>
      <td class="wrap">${escapeHtml(row.idea)}</td>
      <td class="wrap">${escapeHtml(row.points)}</td>
      <td class="wrap">${escapeHtml(row.cta)}</td>
      <td class="format">${escapeHtml(row.format)}</td>
      <td class="number">${row.number}</td>
      <td class="${row.status === "Opublikowane" ? "done" : "todo"}">${escapeHtml(row.status)}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Aptos, Calibri, Arial, sans-serif; color: #101828; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    caption { caption-side: top; padding: 14px 0 18px; text-align: left; font-size: 20px; font-weight: 700; color: #0f172a; }
    th { background: #0f172a; color: #ffffff; border: 1px solid #243149; padding: 10px; font-weight: 700; text-align: left; vertical-align: middle; }
    td { border: 1px solid #d9e2ef; padding: 9px 10px; vertical-align: top; white-space: normal; mso-number-format:"\\@"; }
    tr:nth-child(even) td { background: #f8fafc; }
    .date { width: 90px; font-weight: 700; color: #0f4c81; }
    .day { width: 100px; }
    .topic { width: 240px; }
    .type { width: 130px; font-weight: 700; }
    .type span { display: inline-block; width: 10px; height: 10px; border-radius: 10px; margin-right: 6px; }
    .title { width: 240px; font-weight: 700; color: #0f172a; }
    .wrap { width: 320px; line-height: 1.35; }
    .format { width: 130px; }
    .number { width: 64px; text-align: center; font-weight: 700; }
    .todo { width: 120px; color: #92400e; background: #fffbeb; font-weight: 700; }
    .done { width: 120px; color: #166534; background: #ecfdf3; font-weight: 700; }
  </style>
</head>
<body>
  <table>
    <caption>${escapeHtml(title)}</caption>
    <colgroup>
      <col style="width: 95px" />
      <col style="width: 105px" />
      <col style="width: 250px" />
      <col style="width: 135px" />
      <col style="width: 250px" />
      <col style="width: 330px" />
      <col style="width: 360px" />
      <col style="width: 280px" />
      <col style="width: 250px" />
      <col style="width: 140px" />
      <col style="width: 70px" />
      <col style="width: 130px" />
    </colgroup>
    <thead>
      <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
}

function formatDateForSheet(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br />");
}
