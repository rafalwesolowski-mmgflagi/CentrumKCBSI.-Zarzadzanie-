import { useCallback, useEffect, useMemo, useState } from "react";
import { Compass, GitBranch, Grid2x2, LayoutGrid, Layers, Loader2, Pencil, Plus, RefreshCw, Skull, Table2, Target, Trash2, Workflow, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type {
  CynefinData,
  CynefinDomain,
  DiltsData,
  EisenhowerData,
  FiveW2HData,
  IshikawaCategory,
  IshikawaData,
  OkrData,
  OkrKeyResult,
  OodaData,
  PdcaData,
  PremortemCause,
  PremortemData,
  RaciActivity,
  RaciData,
  SipocData,
  ToolboxData,
  ToolboxEntry,
  ToolboxToolType
} from "../lib/types";

interface ProjectOption {
  id: string;
  name: string;
}

interface ToolGroup {
  id: string;
  label: string;
  description: string;
  accent: string;
  tools: ToolboxToolType[];
}

interface ToolGuide {
  summary: string;
  when: string;
  steps: string[];
  examples: string[];
}

const toolGroups: ToolGroup[] = [
  {
    id: "contact",
    label: "Pierwszy kontakt",
    description: "Szybkie ramowanie sytuacji, zanim zaczniesz działać.",
    accent: "contact",
    tools: ["5w2h", "ishikawa", "raci", "eisenhower", "ooda"]
  },
  {
    id: "mapping",
    label: "Mapowanie procesów i systemów",
    description: "Fundament przed projektowaniem architektury czy spinaniem automatyzacji.",
    accent: "mapping",
    tools: ["sipoc", "pdca"]
  },
  {
    id: "risk",
    label: "Zarządzanie ryzykiem i psychologia decyzji",
    description: "Chłodna analiza ryzyka i typu sytuacji przed ważną decyzją.",
    accent: "risk",
    tools: ["premortem", "cynefin"]
  },
  {
    id: "scaling",
    label: "Skalowanie i zarządzanie zmianą",
    description: "Rozwiązywanie problemów na właściwym poziomie i dowożenie wyników.",
    accent: "scaling",
    tools: ["dilts", "okr"]
  }
];

const toolAccent = Object.fromEntries(
  toolGroups.flatMap((group) => group.tools.map((tool) => [tool, group.accent]))
) as Record<ToolboxToolType, string>;

const toolLabels: Record<ToolboxToolType, string> = {
  "5w2h": "5W2H",
  ishikawa: "Ishikawa",
  raci: "RACI",
  eisenhower: "Eisenhower",
  ooda: "OODA Loop",
  sipoc: "SIPOC",
  pdca: "PDCA",
  premortem: "Pre-mortem",
  cynefin: "Cynefin",
  dilts: "Poziomy Diltsa",
  okr: "OKR"
};

const toolDescriptions: Record<ToolboxToolType, string> = {
  "5w2h": "Szybkie ramowanie problemu: Co, Dlaczego, Kto, Gdzie, Kiedy, Jak, Ile.",
  ishikawa: "Analiza przyczyn źródłowych w kategoriach (rybia ość).",
  raci: "Macierz odpowiedzialności: Realizuje / Aprobuje / Konsultowany / Informowany.",
  eisenhower: "Priorytetyzacja pilne/ważne w czterech ćwiartkach.",
  ooda: "Pętla decyzyjna: Obserwuj, Orientuj się, Decyduj, Działaj.",
  sipoc: "Definiowanie procesu z lotu ptaka: dostawcy, wejścia, proces, wyjścia, klienci.",
  pdca: "Cykl Deminga: systematyczne wdrażanie i iterowanie ulepszeń.",
  premortem: "Wyobraź sobie porażkę projektu z wyprzedzeniem i znajdź jej przyczyny.",
  cynefin: "Rozpoznaj typ sytuacji (proste, skomplikowane, złożone, chaotyczne) i dobierz podejście.",
  dilts: "Diagnoza na właściwym poziomie: otoczenie, zachowanie, umiejętności, przekonania, tożsamość, cel.",
  okr: "Przełóż wizję na mierzalne, dowożone w czasie wyniki."
};

const toolGuides: Record<ToolboxToolType, ToolGuide> = {
  "5w2h": {
    summary: "5W2H porządkuje sytuację w siedmiu prostych pytaniach, zanim zaczniesz szukać rozwiązania.",
    when: "Użyj, gdy problem jest jeszcze mglisty, ktoś zgłasza temat bez kontekstu albo trzeba szybko ustalić zakres działania.",
    steps: ["Nazwij, co się dzieje.", "Doprecyzuj powód, osoby, miejsce i czas.", "Opisz sposób działania oraz koszt, skalę lub wpływ."],
    examples: ["Awaria płatności: co nie działa, od kiedy, kogo dotyczy, jaki jest wpływ na sprzedaż.", "Nowy pomysł: co chcemy zrobić, dlaczego teraz, kto decyduje, ile czasu i budżetu potrzeba."]
  },
  ishikawa: {
    summary: "Diagram Ishikawy pomaga znaleźć przyczyny źródłowe zamiast zatrzymywać się na pierwszym objawie.",
    when: "Użyj, gdy problem powtarza się, ma wiele możliwych źródeł albo zespół ma różne hipotezy o przyczynie.",
    steps: ["Zapisz problem jako konkretny skutek.", "Wypisz przyczyny w kategoriach, np. ludzie, proces, narzędzia, otoczenie.", "Zaznacz przyczyny do sprawdzenia dowodami."],
    examples: ["Spada liczba leadów: kanały, oferta, formularz, follow-up, sezonowość.", "Opóźnienia wdrożeń: zależności, decyzje, kompetencje, jakość wymagań, środowiska."]
  },
  raci: {
    summary: "RACI wyjaśnia odpowiedzialność: kto wykonuje, kto akceptuje, kogo konsultować i kogo informować.",
    when: "Użyj, gdy zadania rozmywają się między osobami, decyzje stoją albo zespół dubluje pracę.",
    steps: ["Wypisz aktywności lub decyzje.", "Przypisz R, A, C i I do każdej pozycji.", "Sprawdź, czy każda aktywność ma jedną osobę akceptującą."],
    examples: ["Publikacja kampanii: copywriter jako R, właściciel produktu jako A, prawnik jako C, sprzedaż jako I.", "Migracja systemu: devops jako R, CTO jako A, support jako C, klienci jako I."]
  },
  eisenhower: {
    summary: "Macierz Eisenhowera rozdziela zadania według pilności i ważności, żeby chronić uwagę.",
    when: "Użyj, gdy lista zadań jest długa, wszystko wydaje się pilne albo potrzebujesz planu dnia bez chaosu.",
    steps: ["Wpisz wszystkie zadania.", "Rozdziel je na cztery ćwiartki.", "Zacznij od pilnych i ważnych, a ważne niepilne zaplanuj w kalendarzu."],
    examples: ["Pilne i ważne: naprawić błąd produkcyjny. Ważne niepilne: przygotować ofertę strategiczną.", "Deleguj: zebranie materiałów. Usuń: raport, którego nikt nie czyta."]
  },
  ooda: {
    summary: "OODA to szybka pętla decyzyjna: obserwuj, zorientuj się, zdecyduj i działaj.",
    when: "Użyj w dynamicznej sytuacji, gdy dane zmieniają się szybko i lepiej działać iteracyjnie niż czekać na pełną pewność.",
    steps: ["Zbierz aktualne sygnały.", "Zinterpretuj je w kontekście celu i ograniczeń.", "Podejmij małą decyzję i sprawdź efekt działania."],
    examples: ["Kryzys w social media: obserwuj reakcje, oceń źródło, wybierz komunikat, monitoruj odpowiedź.", "Sprzedaż enterprise: analizuj sygnały klienta, dopasuj argument, wykonaj następny ruch."]
  },
  sipoc: {
    summary: "SIPOC pokazuje proces z lotu ptaka: dostawcy, wejścia, kroki procesu, wyjścia i klienci.",
    when: "Użyj przed automatyzacją, integracją systemów, zmianą procesu lub gdy nie wiadomo, gdzie zaczyna się i kończy przepływ.",
    steps: ["Nazwij proces i jego granice.", "Wypisz dostawców oraz wejścia.", "Opisz główne kroki, wyjścia i odbiorców."],
    examples: ["Obsługa leadu: reklama jako dostawca, formularz jako wejście, kwalifikacja jako proces, oferta jako wyjście.", "Fakturowanie: dane zamówienia, weryfikacja, faktura, księgowość i klient."]
  },
  pdca: {
    summary: "PDCA pomaga wdrażać usprawnienia w cyklu: planuj, wykonaj, sprawdź i utrwal lub popraw.",
    when: "Użyj, gdy chcesz testować zmianę małym kosztem, poprawiać proces albo uniknąć jednorazowych akcji bez nauki.",
    steps: ["Zaplanuj hipotezę i miarę sukcesu.", "Wykonaj ograniczony test.", "Sprawdź wynik i zdecyduj, co standaryzować lub zmienić."],
    examples: ["Poprawa onboarding maili: nowa sekwencja dla 20% użytkowników, pomiar aktywacji, decyzja po tygodniu.", "Usprawnienie standupu: test krótszego formatu, sprawdzenie blokad i czasu spotkania."]
  },
  premortem: {
    summary: "Pre-mortem zakłada, że projekt się nie udał, i szuka przyczyn porażki zanim one się wydarzą.",
    when: "Użyj przed ważnym projektem, dużą decyzją, wdrożeniem lub wtedy, gdy zespół jest zbyt pewny planu.",
    steps: ["Wyobraź sobie realistyczny scenariusz porażki.", "Wypisz przyczyny, które mogły do niej doprowadzić.", "Dodaj działania zapobiegawcze dla najgroźniejszych przyczyn."],
    examples: ["Launch produktu się nie udał, bo nie było jasnego segmentu, supportu i planu komunikacji.", "Migracja danych zawiodła, bo zabrakło backupu, testów i właściciela decyzji."]
  },
  cynefin: {
    summary: "Cynefin pomaga rozpoznać typ sytuacji i dobrać styl działania do poziomu przewidywalności.",
    when: "Użyj, gdy nie wiesz, czy stosować procedurę, ekspercką analizę, eksperymenty czy natychmiastową reakcję kryzysową.",
    steps: ["Opisz sytuację bez oceniania.", "Wybierz domenę: jasna, skomplikowana, złożona albo chaotyczna.", "Dopasuj podejście: praktyka, analiza ekspercka, eksperyment lub szybkie opanowanie kryzysu."],
    examples: ["Jasne: reset hasła według instrukcji. Skomplikowane: dobór architektury przez eksperta.", "Złożone: nowy rynek bez pewnych danych. Chaotyczne: awaria produkcji wymagająca natychmiastowej stabilizacji."]
  },
  dilts: {
    summary: "Poziomy Diltsa pokazują, na którym poziomie leży problem: otoczenie, zachowanie, umiejętności, przekonania, tożsamość lub cel.",
    when: "Użyj, gdy próbujesz rozwiązać problem zadaniami, a przeszkoda może leżeć głębiej, np. w przekonaniach lub roli.",
    steps: ["Opisz problem na każdym poziomie.", "Sprawdź, który poziom najmocniej blokuje zmianę.", "Dobierz interwencję do poziomu, a nie tylko do objawu."],
    examples: ["Brak sprzedaży może wynikać z otoczenia CRM, zachowania follow-up, umiejętności rozmowy albo przekonania o cenie.", "Prokrastynacja może być brakiem planu, ale też konfliktem tożsamości lub niejasnym celem."]
  },
  okr: {
    summary: "OKR łączy inspirujący cel z mierzalnymi rezultatami, które pokazują, czy cel naprawdę został dowieziony.",
    when: "Użyj dla priorytetów kwartalnych, zespołowych inicjatyw lub pracy, która wymaga mierzalnego kierunku zamiast listy zadań.",
    steps: ["Sformułuj cel jakościowy i zrozumiały.", "Dodaj 2-5 mierzalnych kluczowych rezultatów.", "Regularnie aktualizuj postęp i decyzje wynikające z danych."],
    examples: ["Cel: zwiększyć jakość leadów. KR: 30% więcej SQL, koszt SQL poniżej 400 zł, konwersja demo do oferty 45%.", "Cel: usprawnić onboarding. KR: aktywacja 70%, czas do pierwszej wartości poniżej 10 minut, churn po 14 dniach poniżej 8%."]
  }
};

const toolIcons: Record<ToolboxToolType, typeof Compass> = {
  "5w2h": Grid2x2,
  ishikawa: GitBranch,
  raci: Table2,
  eisenhower: Grid2x2,
  ooda: Compass,
  sipoc: Workflow,
  pdca: RefreshCw,
  premortem: Skull,
  cynefin: LayoutGrid,
  dilts: Layers,
  okr: Target
};

const emptyFiveW2H: FiveW2HData = { what: "", why: "", who: "", where: "", when: "", how: "", howMuch: "" };
const emptyIshikawaCategories: IshikawaCategory[] = ["Ludzie", "Proces", "Narzędzia", "Otoczenie", "Materiały", "Zarządzanie"].map((name) => ({ name, causes: [""] }));
const emptyEisenhower: EisenhowerData = { doNow: [], schedule: [], delegate: [], eliminate: [] };
const emptyOoda: OodaData = { observe: "", orient: "", decide: "", act: "" };
const emptySipoc: SipocData = { suppliers: [], inputs: [], process: [], outputs: [], customers: [] };
const emptyPdca: PdcaData = { plan: "", do: "", check: "", act: "" };
const emptyCynefin: CynefinData = { situation: "", domain: "complex", rationale: "", approach: "" };
const emptyDilts: DiltsData = { environment: "", behavior: "", capabilities: "", beliefs: "", identity: "", purpose: "" };

function emptyDataFor(tool: ToolboxToolType): ToolboxData {
  if (tool === "5w2h") return { ...emptyFiveW2H };
  if (tool === "ishikawa") return { problem: "", categories: emptyIshikawaCategories.map((category) => ({ ...category, causes: [""] })) };
  if (tool === "raci") return { activities: [{ name: "", responsible: "", accountable: "", consulted: "", informed: "" }] };
  if (tool === "eisenhower") return { ...emptyEisenhower };
  if (tool === "ooda") return { ...emptyOoda };
  if (tool === "sipoc") return { ...emptySipoc };
  if (tool === "pdca") return { ...emptyPdca };
  if (tool === "premortem") return { scenario: "", causes: [{ reason: "", mitigation: "" }] };
  if (tool === "cynefin") return { ...emptyCynefin };
  if (tool === "dilts") return { ...emptyDilts };
  return { objective: "", keyResults: [{ text: "", target: "" }] };
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
}

export function ToolboxPage() {
  const [entries, setEntries] = useState<ToolboxEntry[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolboxToolType | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [data, setData] = useState<ToolboxData | null>(null);
  const [filterTool, setFilterTool] = useState<ToolboxToolType | "all">("all");

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entriesRes, projectsRes] = await Promise.all([
        supabase.from("toolbox_entries").select("*").order("updated_at", { ascending: false }),
        supabase.from("projects").select("id,name").order("name", { ascending: true })
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      setEntries((entriesRes.data ?? []) as ToolboxEntry[]);
      setProjects((projectsRes.data ?? []) as ProjectOption[]);
    } catch (loadError) {
      setError(errorMessage(loadError, "Nie udało się wczytać Narzędziownika."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew(tool: ToolboxToolType) {
    setEditingId(null);
    setActiveTool(tool);
    setTitle("");
    setProjectId("");
    setData(emptyDataFor(tool));
    setError(null);
  }

  function startEdit(entry: ToolboxEntry) {
    setEditingId(entry.id);
    setActiveTool(entry.tool_type);
    setTitle(entry.title);
    setProjectId(entry.project_id ?? "");
    setData(entry.data);
    setError(null);
  }

  function closeForm() {
    setEditingId(null);
    setActiveTool(null);
    setData(null);
  }

  async function handleSubmit() {
    if (!activeTool || !data || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("toolbox_entries")
          .update({
            title: title.trim(),
            project_id: projectId || null,
            data
          })
          .eq("id", editingId);
        if (updateError) throw updateError;
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) throw new Error("Brak aktywnej sesji.");
        const { error: insertError } = await supabase.from("toolbox_entries").insert({
          user_id: userId,
          project_id: projectId || null,
          tool_type: activeTool,
          title: title.trim(),
          data
        });
        if (insertError) throw insertError;
      }
      closeForm();
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, "Nie udało się zapisać wpisu."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error: deleteError } = await supabase.from("toolbox_entries").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (editingId === id) closeForm();
  }

  const visibleEntries = filterTool === "all" ? entries : entries.filter((entry) => entry.tool_type === filterTool);

  return (
    <div className="toolbox-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Narzędziownik</span>
          <h1>Narzędzia pierwszego kontaktu</h1>
          <p className="muted-note">Szybkie szkielety myślowe do zapanowania nad sytuacją — bez procesu, bez bramek.</p>
        </div>
      </header>

      {error && <div className="warning-box">{error}</div>}

      <div className="panel toolbox-picker">
        <div className="panel-header"><h2>Nowy wpis</h2></div>
        {toolGroups.map((group) => (
          <section className={`toolbox-group toolbox-group-${group.accent}`} key={group.id}>
            <div className="toolbox-group-header">
              <strong>{group.label}</strong>
              <span>{group.description}</span>
            </div>
            <div className="toolbox-tool-grid">
              {group.tools.map((tool) => {
                const Icon = toolIcons[tool];
                return (
                  <button
                    type="button"
                    key={tool}
                    className={`toolbox-tool-tile ${activeTool === tool && !editingId ? "active" : ""}`}
                    onClick={() => startNew(tool)}
                  >
                    <span className="toolbox-tool-icon"><Icon size={18} /></span>
                    <span className="toolbox-tool-text">
                      <strong>{toolLabels[tool]}</strong>
                      <span>{toolDescriptions[tool]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {activeTool && data && (
        <div className="panel toolbox-form">
          <div className="panel-header">
            <h2>{editingId ? "Edytuj wpis" : `Nowy wpis: ${toolLabels[activeTool]}`}</h2>
            <button type="button" className="icon-button" onClick={closeForm} aria-label="Zamknij formularz"><X size={16} /></button>
          </div>
          <label>
            Tytuł
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Np. Awaria serwera 2026-07-02" />
          </label>
          <label>
            Projekt (opcjonalnie)
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">— brak —</option>
              {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
          </label>

          <ToolGuideDisclosure tool={activeTool} />

          {activeTool === "5w2h" && <FiveW2HForm data={data as FiveW2HData} onChange={setData} />}
          {activeTool === "ishikawa" && <IshikawaForm data={data as IshikawaData} onChange={setData} />}
          {activeTool === "raci" && <RaciForm data={data as RaciData} onChange={setData} />}
          {activeTool === "eisenhower" && <EisenhowerForm data={data as EisenhowerData} onChange={setData} />}
          {activeTool === "ooda" && <OodaForm data={data as OodaData} onChange={setData} />}
          {activeTool === "sipoc" && <SipocForm data={data as SipocData} onChange={setData} />}
          {activeTool === "pdca" && <PdcaForm data={data as PdcaData} onChange={setData} />}
          {activeTool === "premortem" && <PremortemForm data={data as PremortemData} onChange={setData} />}
          {activeTool === "cynefin" && <CynefinForm data={data as CynefinData} onChange={setData} />}
          {activeTool === "dilts" && <DiltsForm data={data as DiltsData} onChange={setData} />}
          {activeTool === "okr" && <OkrForm data={data as OkrData} onChange={setData} />}

          <div className="toolbox-form-actions">
            <button type="button" className="secondary-button" onClick={closeForm}>Anuluj</button>
            <button type="button" className="primary-button" disabled={saving || !title.trim()} onClick={() => void handleSubmit()}>
              {saving ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />} Zapisz
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Wpisy</h2>
          <select value={filterTool} onChange={(event) => setFilterTool(event.target.value as ToolboxToolType | "all")}>
            <option value="all">Wszystkie narzędzia</option>
            {toolGroups.map((group) => (
              <optgroup label={group.label} key={group.id}>
                {group.tools.map((tool) => <option value={tool} key={tool}>{toolLabels[tool]}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state"><Loader2 className="spin-icon" size={20} /> Ładowanie...</div>
        ) : visibleEntries.length === 0 ? (
          <div className="empty-state">Brak wpisów. Wybierz narzędzie powyżej, żeby zacząć.</div>
        ) : (
          <div className="toolbox-entry-list">
            {visibleEntries.map((entry) => (
              <div className={`toolbox-entry-card toolbox-accent-${toolAccent[entry.tool_type]}`} key={entry.id}>
                <div className="wellbeing-card-header">
                  <strong>{entry.title}</strong>
                  <span className="tag-pill">{toolLabels[entry.tool_type]}</span>
                </div>
                <p>
                  {entry.project_id && projectById.get(entry.project_id) ? `Projekt: ${projectById.get(entry.project_id)?.name} · ` : ""}
                  Zaktualizowano: {new Date(entry.updated_at).toLocaleString("pl-PL")}
                </p>
                <div className="wellbeing-card-actions">
                  <button type="button" className="icon-button" onClick={() => startEdit(entry)} aria-label="Edytuj wpis"><Pencil size={16} /></button>
                  <button type="button" className="icon-button danger-action" onClick={() => void handleDelete(entry.id)} aria-label="Usuń wpis"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolGuideDisclosure({ tool }: { tool: ToolboxToolType }) {
  const guide = toolGuides[tool];

  return (
    <details className={`toolbox-guide toolbox-accent-${toolAccent[tool]}`}>
      <summary>
        <span>
          <strong>Jak rozumieć metodę: {toolLabels[tool]}</strong>
          <span>{guide.summary}</span>
        </span>
      </summary>
      <div className="toolbox-guide-content">
        <section>
          <h3>Kiedy używać</h3>
          <p>{guide.when}</p>
        </section>
        <section>
          <h3>Jak pracować</h3>
          <ol>
            {guide.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>
        <section>
          <h3>Przykłady użycia</h3>
          <ul>
            {guide.examples.map((example) => <li key={example}>{example}</li>)}
          </ul>
        </section>
      </div>
    </details>
  );
}

function FiveW2HForm({ data, onChange }: { data: FiveW2HData; onChange: (data: FiveW2HData) => void }) {
  const fields: Array<[keyof FiveW2HData, string]> = [
    ["what", "Co? (What)"],
    ["why", "Dlaczego? (Why)"],
    ["who", "Kto? (Who)"],
    ["where", "Gdzie? (Where)"],
    ["when", "Kiedy? (When)"],
    ["how", "Jak? (How)"],
    ["howMuch", "Ile? (How much)"]
  ];
  return (
    <div className="toolbox-field-grid">
      {fields.map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea
            rows={2}
            value={data[key]}
            onChange={(event) => onChange({ ...data, [key]: event.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

function IshikawaForm({ data, onChange }: { data: IshikawaData; onChange: (data: IshikawaData) => void }) {
  function updateCategory(index: number, category: IshikawaCategory) {
    onChange({ ...data, categories: data.categories.map((item, itemIndex) => itemIndex === index ? category : item) });
  }
  function addCause(index: number) {
    updateCategory(index, { ...data.categories[index], causes: [...data.categories[index].causes, ""] });
  }
  function removeCause(index: number, causeIndex: number) {
    updateCategory(index, { ...data.categories[index], causes: data.categories[index].causes.filter((_, i) => i !== causeIndex) });
  }
  return (
    <div className="toolbox-ishikawa">
      <label>
        Problem
        <textarea rows={2} value={data.problem} onChange={(event) => onChange({ ...data, problem: event.target.value })} />
      </label>
      <div className="toolbox-ishikawa-categories">
        {data.categories.map((category, index) => (
          <div className="toolbox-ishikawa-category" key={index}>
            <input
              className="toolbox-category-name"
              value={category.name}
              onChange={(event) => updateCategory(index, { ...category, name: event.target.value })}
            />
            {category.causes.map((cause, causeIndex) => (
              <div className="toolbox-cause-row" key={causeIndex}>
                <input
                  value={cause}
                  placeholder="Przyczyna"
                  onChange={(event) => {
                    const causes = category.causes.map((item, i) => i === causeIndex ? event.target.value : item);
                    updateCategory(index, { ...category, causes });
                  }}
                />
                <button type="button" className="icon-button" onClick={() => removeCause(index, causeIndex)} aria-label="Usuń przyczynę"><X size={14} /></button>
              </div>
            ))}
            <button type="button" className="secondary-button toolbox-add-button" onClick={() => addCause(index)}>+ Przyczyna</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaciForm({ data, onChange }: { data: RaciData; onChange: (data: RaciData) => void }) {
  function updateActivity(index: number, activity: RaciActivity) {
    onChange({ activities: data.activities.map((item, itemIndex) => itemIndex === index ? activity : item) });
  }
  function addActivity() {
    onChange({ activities: [...data.activities, { name: "", responsible: "", accountable: "", consulted: "", informed: "" }] });
  }
  function removeActivity(index: number) {
    onChange({ activities: data.activities.filter((_, i) => i !== index) });
  }
  return (
    <div className="toolbox-raci">
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Aktywność</th>
            <th>R</th>
            <th>A</th>
            <th>C</th>
            <th>I</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.activities.map((activity, index) => (
            <tr key={index}>
              <td><input value={activity.name} onChange={(event) => updateActivity(index, { ...activity, name: event.target.value })} /></td>
              <td><input value={activity.responsible} onChange={(event) => updateActivity(index, { ...activity, responsible: event.target.value })} /></td>
              <td><input value={activity.accountable} onChange={(event) => updateActivity(index, { ...activity, accountable: event.target.value })} /></td>
              <td><input value={activity.consulted} onChange={(event) => updateActivity(index, { ...activity, consulted: event.target.value })} /></td>
              <td><input value={activity.informed} onChange={(event) => updateActivity(index, { ...activity, informed: event.target.value })} /></td>
              <td><button type="button" className="icon-button" onClick={() => removeActivity(index)} aria-label="Usuń aktywność"><X size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button type="button" className="secondary-button toolbox-add-button" onClick={addActivity}>+ Aktywność</button>
    </div>
  );
}

function EisenhowerForm({ data, onChange }: { data: EisenhowerData; onChange: (data: EisenhowerData) => void }) {
  const quadrants: Array<[keyof EisenhowerData, string]> = [
    ["doNow", "Pilne i ważne — rób teraz"],
    ["schedule", "Ważne, niepilne — zaplanuj"],
    ["delegate", "Pilne, nieważne — deleguj"],
    ["eliminate", "Ani pilne, ani ważne — usuń"]
  ];
  return (
    <div className="toolbox-eisenhower">
      {quadrants.map(([key, label]) => (
        <label key={key} className="toolbox-eisenhower-quadrant">
          {label}
          <textarea
            rows={4}
            placeholder="Jedna pozycja na linię"
            value={data[key].join("\n")}
            onChange={(event) => onChange({ ...data, [key]: event.target.value.split("\n") })}
          />
        </label>
      ))}
    </div>
  );
}

function OodaForm({ data, onChange }: { data: OodaData; onChange: (data: OodaData) => void }) {
  const fields: Array<[keyof OodaData, string]> = [
    ["observe", "Obserwuj (Observe)"],
    ["orient", "Orientuj się (Orient)"],
    ["decide", "Decyduj (Decide)"],
    ["act", "Działaj (Act)"]
  ];
  return (
    <div className="toolbox-field-grid">
      {fields.map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea rows={3} value={data[key]} onChange={(event) => onChange({ ...data, [key]: event.target.value })} />
        </label>
      ))}
    </div>
  );
}

function SipocForm({ data, onChange }: { data: SipocData; onChange: (data: SipocData) => void }) {
  const columns: Array<[keyof SipocData, string]> = [
    ["suppliers", "Dostawcy (Suppliers)"],
    ["inputs", "Wejścia (Inputs)"],
    ["process", "Proces (Process)"],
    ["outputs", "Wyjścia (Outputs)"],
    ["customers", "Klienci (Customers)"]
  ];
  return (
    <div className="toolbox-sipoc">
      {columns.map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea
            rows={5}
            placeholder="Jedna pozycja na linię"
            value={data[key].join("\n")}
            onChange={(event) => onChange({ ...data, [key]: event.target.value.split("\n") })}
          />
        </label>
      ))}
    </div>
  );
}

function PdcaForm({ data, onChange }: { data: PdcaData; onChange: (data: PdcaData) => void }) {
  const steps: Array<[keyof PdcaData, string]> = [
    ["plan", "1. Plan"],
    ["do", "2. Do"],
    ["check", "3. Check"],
    ["act", "4. Act"]
  ];
  return (
    <div className="toolbox-pdca">
      {steps.map(([key, label]) => (
        <label key={key} className="toolbox-pdca-step">
          {label}
          <textarea rows={4} value={data[key]} onChange={(event) => onChange({ ...data, [key]: event.target.value })} />
        </label>
      ))}
    </div>
  );
}

function PremortemForm({ data, onChange }: { data: PremortemData; onChange: (data: PremortemData) => void }) {
  function updateCause(index: number, cause: PremortemCause) {
    onChange({ ...data, causes: data.causes.map((item, i) => i === index ? cause : item) });
  }
  function addCause() {
    onChange({ ...data, causes: [...data.causes, { reason: "", mitigation: "" }] });
  }
  function removeCause(index: number) {
    onChange({ ...data, causes: data.causes.filter((_, i) => i !== index) });
  }
  return (
    <div className="toolbox-premortem">
      <label>
        Scenariusz porażki
        <textarea
          rows={2}
          placeholder="Wyobraź sobie, że ten projekt poniósł spektakularną porażkę. Co się stało?"
          value={data.scenario}
          onChange={(event) => onChange({ ...data, scenario: event.target.value })}
        />
      </label>
      <div className="toolbox-two-col-list">
        {data.causes.map((cause, index) => (
          <div className="toolbox-two-col-row" key={index}>
            <input value={cause.reason} placeholder="Przyczyna porażki" onChange={(event) => updateCause(index, { ...cause, reason: event.target.value })} />
            <input value={cause.mitigation} placeholder="Jak temu zapobiec" onChange={(event) => updateCause(index, { ...cause, mitigation: event.target.value })} />
            <button type="button" className="icon-button" onClick={() => removeCause(index)} aria-label="Usuń przyczynę"><X size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="secondary-button toolbox-add-button" onClick={addCause}>+ Przyczyna</button>
    </div>
  );
}

const cynefinDomains: Array<[CynefinDomain, string, string]> = [
  ["clear", "Proste / Jasne", "Znane najlepsze praktyki — Zobacz, Skategoryzuj, Zareaguj."],
  ["complicated", "Skomplikowane", "Wymaga eksperta — Zobacz, Przeanalizuj, Zareaguj."],
  ["complex", "Złożone", "Nieprzewidywalne — Sonduj, Obserwuj, Reaguj."],
  ["chaotic", "Chaotyczne", "Kryzys — Działaj, Obserwuj, Reaguj."]
];

function CynefinForm({ data, onChange }: { data: CynefinData; onChange: (data: CynefinData) => void }) {
  return (
    <div className="toolbox-cynefin">
      <div className="toolbox-cynefin-grid">
        {cynefinDomains.map(([domain, label, hint]) => (
          <button
            type="button"
            key={domain}
            className={`toolbox-cynefin-domain ${data.domain === domain ? "active" : ""}`}
            onClick={() => onChange({ ...data, domain })}
          >
            <strong>{label}</strong>
            <span>{hint}</span>
          </button>
        ))}
      </div>
      <label>
        Sytuacja
        <textarea rows={2} value={data.situation} onChange={(event) => onChange({ ...data, situation: event.target.value })} />
      </label>
      <label>
        Uzasadnienie klasyfikacji
        <textarea rows={2} value={data.rationale} onChange={(event) => onChange({ ...data, rationale: event.target.value })} />
      </label>
      <label>
        Rekomendowane podejście
        <textarea rows={2} value={data.approach} onChange={(event) => onChange({ ...data, approach: event.target.value })} />
      </label>
    </div>
  );
}

function DiltsForm({ data, onChange }: { data: DiltsData; onChange: (data: DiltsData) => void }) {
  const levels: Array<[keyof DiltsData, string]> = [
    ["purpose", "Cel / Duchowość — po co to robisz"],
    ["identity", "Tożsamość — kim jesteś w tym kontekście"],
    ["beliefs", "Przekonania i wartości — w co wierzysz"],
    ["capabilities", "Umiejętności — co potrafisz"],
    ["behavior", "Zachowanie — co robisz"],
    ["environment", "Otoczenie — gdzie i kiedy"]
  ];
  return (
    <div className="toolbox-dilts">
      {levels.map(([key, label], index) => (
        <label key={key} className={`toolbox-dilts-level toolbox-dilts-level-${index}`}>
          {label}
          <textarea rows={2} value={data[key]} onChange={(event) => onChange({ ...data, [key]: event.target.value })} />
        </label>
      ))}
    </div>
  );
}

function OkrForm({ data, onChange }: { data: OkrData; onChange: (data: OkrData) => void }) {
  function updateResult(index: number, result: OkrKeyResult) {
    onChange({ ...data, keyResults: data.keyResults.map((item, i) => i === index ? result : item) });
  }
  function addResult() {
    onChange({ ...data, keyResults: [...data.keyResults, { text: "", target: "" }] });
  }
  function removeResult(index: number) {
    onChange({ ...data, keyResults: data.keyResults.filter((_, i) => i !== index) });
  }
  return (
    <div className="toolbox-okr">
      <label>
        Cel (Objective)
        <textarea rows={2} value={data.objective} onChange={(event) => onChange({ ...data, objective: event.target.value })} />
      </label>
      <div className="toolbox-two-col-list">
        {data.keyResults.map((result, index) => (
          <div className="toolbox-two-col-row" key={index}>
            <input value={result.text} placeholder="Kluczowy rezultat" onChange={(event) => updateResult(index, { ...result, text: event.target.value })} />
            <input value={result.target} placeholder="Miernik / cel (np. 80%)" onChange={(event) => updateResult(index, { ...result, target: event.target.value })} />
            <button type="button" className="icon-button" onClick={() => removeResult(index)} aria-label="Usuń kluczowy rezultat"><X size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="secondary-button toolbox-add-button" onClick={addResult}>+ Kluczowy rezultat</button>
    </div>
  );
}
