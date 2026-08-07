import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, ClipboardCheck, Home, ListChecks, PackageCheck, Plus, RotateCw, Sparkles, TimerReset } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";

type DeclutterTab = "creator" | "plan" | "steps" | "rules";
type DeclutterFocus = "visible" | "duplicates" | "clothes" | "bathroom" | "kitchen" | "documents" | "digital" | "projects" | "auto";
type DecisionFriction = "low" | "medium" | "high";
type SalePolicy = "donate_first" | "sell_7_days" | "quarantine";

interface DeclutterWizard {
  homeBase: string;
  startArea: string;
  focus: DeclutterFocus;
  minutesPerDay: number;
  daysPerWeek: number;
  energy: number;
  decisionFriction: DecisionFriction;
  salePolicy: SalePolicy;
  targetWeeks: number;
  hardLimit: string;
  projectId: string;
}

interface DeclutterStep {
  id: string;
  day: number;
  title: string;
  area: string;
  minutes: number;
  action: string;
  exitCriteria: string;
  decisionPrompt: string;
}

interface DeclutterPlan {
  generatedAt: string;
  summary: string;
  steps: DeclutterStep[];
  milestones: Array<{ week: number; title: string; focus: string; result: string }>;
}

const storageKey = "centrum-decluttering-v1";

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaultWizard: DeclutterWizard = {
  homeBase: "mieszkanie/dom",
  startArea: "biurko",
  focus: "auto",
  minutesPerDay: 15,
  daysPerWeek: 5,
  energy: 3,
  decisionFriction: "medium",
  salePolicy: "sell_7_days",
  targetWeeks: 8,
  hardLimit: "jedno pudełko kwarantanny i jedna strefa darowizn",
  projectId: ""
};

const focusLabels: Record<DeclutterFocus, string> = {
  auto: "Automatycznie",
  visible: "Widoczne powierzchnie",
  duplicates: "Śmieci i duplikaty",
  clothes: "Ubrania",
  bathroom: "Łazienka",
  kitchen: "Kuchnia",
  documents: "Dokumenty",
  digital: "Cyfrowe rzeczy",
  projects: "Projekty i hobby"
};

const salePolicyLabels: Record<SalePolicy, string> = {
  donate_first: "Oddawaj szybciej",
  sell_7_days: "Sprzedaż tylko 7 dni",
  quarantine: "Kwarantanna 30 dni"
};

const frictionLabels: Record<DecisionFriction, string> = {
  low: "łatwe decyzje",
  medium: "trochę oporu",
  high: "dużo oporu"
};

const weeklyProgram = [
  {
    title: "Widoczny porządek",
    focus: "Powierzchnie, które od razu zmieniają odczucie spokoju.",
    result: "Na blatach i stolikach zostaje tylko to, co używane codziennie.",
    areas: ["blat kuchenny", "stół", "biurko", "szafka nocna", "parapet", "komoda", "wejście do domu"]
  },
  {
    title: "Śmieci, zapasy i duplikaty",
    focus: "Najłatwiejsza redukcja bez sentymentalnych decyzji.",
    result: "Przeterminowane, uszkodzone i zdublowane rzeczy wychodzą z domu.",
    areas: ["żywność", "kosmetyki", "leki", "kable", "opakowania", "uszkodzone rzeczy", "duplikaty"]
  },
  {
    title: "Ubrania",
    focus: "Małe kategorie zamiast wyciągania całej szafy.",
    result: "Zostają ubrania pasujące do obecnego życia i ciała.",
    areas: ["skarpetki i bielizna", "koszulki", "bluzy i swetry", "spodnie", "sportowe", "kurtki", "buty"]
  },
  {
    title: "Łazienka i kosmetyki",
    focus: "Codzienne produkty na widoku, zapasy w jednym miejscu.",
    result: "Nie otwierasz nowego produktu, dopóki poprzedni nie jest zużyty.",
    areas: ["produkty codzienne", "produkty okresowe", "zapasy", "nieużywane kosmetyki", "ręczniki", "apteczka", "szafka pod umywalką"]
  },
  {
    title: "Kuchnia",
    focus: "Mniej przedmiotów zamiast większej liczby szafek.",
    result: "Kuchnia odpowiada realnej liczbie domowników i gotowaniu.",
    areas: ["kubki", "talerze", "sztućce", "garnki", "pojemniki", "urządzenia", "przyprawy"]
  },
  {
    title: "Dokumenty i rzeczy ważne",
    focus: "Cztery grupy dokumentów i jedno miejsce na sprawy do załatwienia.",
    result: "Pisma, rachunki i formularze nie tworzą stosów w całym domu.",
    areas: ["prawne i urzędowe", "finansowe", "medyczne", "bieżące sprawy", "do załatwienia", "skany", "archiwum"]
  },
  {
    title: "Elektronika i przestrzeń cyfrowa",
    focus: "Jedno główne miejsce dla każdego rodzaju informacji.",
    result: "Mniej folderów do później, starych wersji i nieużywanych aplikacji.",
    areas: ["pulpit", "Pobrane", "zdjęcia", "aplikacje", "newslettery", "zakładki", "stare pliki"]
  },
  {
    title: "Projekty, hobby i rzeczy przyszłości",
    focus: "Aktywne teraz, zaplanowane, uśpione albo zakończone.",
    result: "Materiały zostają tylko przy projektach aktywnych lub z terminem.",
    areas: ["nieaktywne projekty", "kursy", "sprzęt", "plany biznesowe", "hobby na kiedyś", "materiały edukacyjne", "pamiątki"]
  }
];

export function DeclutteringPage({ context }: { context: AppContextValue }) {
  const [activeTab, setActiveTab] = useState<DeclutterTab>("creator");
  const [wizard, setWizard] = useState<DeclutterWizard>(() => readStoredState().wizard);
  const [plan, setPlan] = useState<DeclutterPlan | null>(() => readStoredState().plan);
  const [completedIds, setCompletedIds] = useState<string[]>(() => readStoredState().completedIds);
  const [message, setMessage] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ wizard, plan, completedIds }));
    } catch {
      // Local progress is optional; the generator still works in the current session.
    }
  }, [wizard, plan, completedIds]);

  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const completedCount = plan ? plan.steps.filter((step) => completedSet.has(step.id)).length : 0;
  const nextStep = plan?.steps.find((step) => !completedSet.has(step.id)) ?? null;
  const progressPercent = plan?.steps.length ? Math.round((completedCount / plan.steps.length) * 100) : 0;
  const minutesPerWeek = wizard.minutesPerDay * wizard.daysPerWeek;

  function updateWizard<K extends keyof DeclutterWizard>(key: K, value: DeclutterWizard[K]) {
    setWizard((current) => ({ ...current, [key]: value }));
  }

  function generateInitialPlan(event?: FormEvent) {
    event?.preventDefault();
    const nextPlan = buildPlan(wizard, 0, Math.max(3, wizard.daysPerWeek));
    setPlan(nextPlan);
    setCompletedIds([]);
    setActiveTab("plan");
    setMessage("Plan oczyszczania wygenerowany. Zacznij od pierwszego kroku i zamknij go po 15 minutach.");
  }

  function generateMoreSteps() {
    const existing = plan?.steps ?? [];
    const extension = buildSteps(wizard, existing.length, Math.max(3, wizard.daysPerWeek));
    setPlan((current) => current
      ? { ...current, steps: [...current.steps, ...extension], generatedAt: new Date().toISOString() }
      : buildPlan(wizard, 0, Math.max(3, wizard.daysPerWeek)));
    setActiveTab("steps");
    setMessage("Dodałem kolejną paczkę mikro-kroków.");
  }

  function toggleStep(stepId: string) {
    setCompletedIds((current) => current.includes(stepId)
      ? current.filter((id) => id !== stepId)
      : [...current, stepId]);
  }

  function resetProgress() {
    setCompletedIds([]);
    setMessage("Postęp wyczyszczony. Ustawienia kreatora i plan zostały na miejscu.");
  }

  async function copyPlan() {
    if (!plan) return;
    const text = planToMarkdown(plan, completedSet);
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Plan skopiowany do schowka.");
    } catch {
      setMessage("Nie udało się skopiować planu do schowka.");
    }
  }

  async function createTaskFromStep(step: DeclutterStep) {
    const projectId = wizard.projectId || context.projects[0]?.id;
    if (!projectId) {
      setMessage("Najpierw utwórz albo wybierz projekt, żeby dodać krok jako zadanie.");
      return;
    }

    setSavingTaskId(step.id);
    setMessage(null);
    try {
      await context.createTask({
        projectId,
        name: `Oczyszczanie: ${step.title}`,
        dueDate: dateAfter(step.day - 1),
        priority: "medium",
        impact: "medium",
        area: "Oczyszczanie",
        notes: [
          step.action,
          "",
          `Kryterium zamknięcia: ${step.exitCriteria}`,
          `Decyzja: ${step.decisionPrompt}`
        ].join("\n"),
        assignee: "",
        recurrence: ""
      });
      setMessage("Krok dodany do zadań projektu.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się dodać zadania."));
    } finally {
      setSavingTaskId(null);
    }
  }

  return (
    <div className="page declutter-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Oczyszczanie</span>
          <h1>Minimalizm bez rewolucji</h1>
          <p className="page-subtitle">Kreator 15-minutowych kroków, plan tygodnia i reguły ograniczające ponowne gromadzenie.</p>
        </div>
        <div className="header-summary">{plan ? `${completedCount}/${plan.steps.length} kroków · ${progressPercent}%` : `${minutesPerWeek} min/tydz.`}</div>
      </header>

      <div className="wellbeing-tabs" role="tablist" aria-label="Sekcje oczyszczania">
        <TabButton id="creator" active={activeTab} onClick={setActiveTab} icon={<Sparkles size={16} />} label="Kreator" />
        <TabButton id="plan" active={activeTab} onClick={setActiveTab} icon={<CalendarCheck size={16} />} label="Plan" />
        <TabButton id="steps" active={activeTab} onClick={setActiveTab} icon={<ListChecks size={16} />} label="Kroki" />
        <TabButton id="rules" active={activeTab} onClick={setActiveTab} icon={<PackageCheck size={16} />} label="Reguły" />
      </div>

      {message && <div className="warning-box">{message}</div>}

      {activeTab === "creator" && (
        <section className="declutter-layout">
          <form className="panel wellbeing-form" onSubmit={generateInitialPlan}>
            <div className="panel-header">
              <h2><Sparkles size={18} />Ustaw kreator</h2>
              <span>{frictionLabels[wizard.decisionFriction]}</span>
            </div>
            <div className="wellbeing-form-grid">
              <label>
                <span>Przestrzeń</span>
                <input value={wizard.homeBase} onChange={(event) => updateWizard("homeBase", event.target.value)} placeholder="mieszkanie, pokój, biuro" />
              </label>
              <label>
                <span>Pierwszy bardzo mały obszar</span>
                <input value={wizard.startArea} onChange={(event) => updateWizard("startArea", event.target.value)} placeholder="jedna szuflada, blat, Pobrane" />
              </label>
              <label>
                <span>Priorytet</span>
                <select value={wizard.focus} onChange={(event) => updateWizard("focus", event.target.value as DeclutterFocus)}>
                  {Object.entries(focusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>Projekt dla zadań</span>
                <select value={wizard.projectId} onChange={(event) => updateWizard("projectId", event.target.value)}>
                  <option value="">Pierwszy dostępny projekt</option>
                  {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                </select>
              </label>
            </div>
            <div className="declutter-slider-grid">
              <label>
                <span>Minuty dziennie: {wizard.minutesPerDay}</span>
                <input type="range" min="5" max="45" step="5" value={wizard.minutesPerDay} onChange={(event) => updateWizard("minutesPerDay", Number(event.target.value))} />
              </label>
              <label>
                <span>Dni w tygodniu: {wizard.daysPerWeek}</span>
                <input type="range" min="3" max="7" value={wizard.daysPerWeek} onChange={(event) => updateWizard("daysPerWeek", Number(event.target.value))} />
              </label>
              <label>
                <span>Energia: {wizard.energy}/5</span>
                <input type="range" min="1" max="5" value={wizard.energy} onChange={(event) => updateWizard("energy", Number(event.target.value))} />
              </label>
              <label>
                <span>Horyzont: {wizard.targetWeeks} tyg.</span>
                <input type="range" min="2" max="8" value={wizard.targetWeeks} onChange={(event) => updateWizard("targetWeeks", Number(event.target.value))} />
              </label>
            </div>
            <div className="wellbeing-form-grid">
              <label>
                <span>Opór decyzyjny</span>
                <select value={wizard.decisionFriction} onChange={(event) => updateWizard("decisionFriction", event.target.value as DecisionFriction)}>
                  <option value="low">Niski</option>
                  <option value="medium">Średni</option>
                  <option value="high">Wysoki</option>
                </select>
              </label>
              <label>
                <span>Polityka rzeczy niepewnych</span>
                <select value={wizard.salePolicy} onChange={(event) => updateWizard("salePolicy", event.target.value as SalePolicy)}>
                  {Object.entries(salePolicyLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span>Limit przestrzeni</span>
              <input value={wizard.hardLimit} onChange={(event) => updateWizard("hardLimit", event.target.value)} />
            </label>
            <div className="wellbeing-actions">
              <button className="primary-button" type="submit"><Sparkles size={16} />Generuj plan</button>
              <button className="secondary-button" type="button" onClick={generateMoreSteps}><Plus size={16} />Generuj kolejne kroki</button>
            </div>
          </form>

          <aside className="panel declutter-principle-panel">
            <div className="panel-header">
              <h2><TimerReset size={18} />Zasada procesu</h2>
              <span>1% dziennie</span>
            </div>
            <p>Nie porządkuj całego życia naraz. Każda sesja ma zmniejszyć liczbę rzeczy i decyzji o mały, odczuwalny fragment.</p>
            <div className="declutter-rhythm">
              <span><strong>2 min</strong> wybór obszaru</span>
              <span><strong>10 min</strong> selekcja</span>
              <span><strong>3 min</strong> wyniesienie lub odłożenie</span>
            </div>
            <div className="declutter-rule-strip">
              <CheckCircle2 size={16} />
              <span>Kończysz po {wizard.minutesPerDay} minutach, nawet jeśli masz ochotę działać dalej.</span>
            </div>
          </aside>
        </section>
      )}

      {activeTab === "plan" && (
        <section className="declutter-layout">
          <section className="panel declutter-next-step">
            <div className="panel-header">
              <h2><Home size={18} />Najbliższy krok</h2>
              <span>{plan ? new Date(plan.generatedAt).toLocaleDateString("pl-PL") : "brak planu"}</span>
            </div>
            {nextStep ? (
              <>
                <strong>{nextStep.title}</strong>
                <p>{nextStep.action}</p>
                <div className="declutter-next-meta">
                  <span>{nextStep.area}</span>
                  <span>{nextStep.minutes} min</span>
                  <span>Dzień {nextStep.day}</span>
                </div>
                <div className="declutter-rule-strip">
                  <ClipboardCheck size={16} />
                  <span>{nextStep.exitCriteria}</span>
                </div>
                <div className="wellbeing-actions">
                  <button className="primary-button" type="button" onClick={() => toggleStep(nextStep.id)}><CheckCircle2 size={16} />{completedSet.has(nextStep.id) ? "Cofnij" : "Zrobione"}</button>
                  <button className="secondary-button" type="button" onClick={() => void createTaskFromStep(nextStep)} disabled={savingTaskId === nextStep.id}><Plus size={16} />Utwórz zadanie</button>
                </div>
              </>
            ) : plan ? (
              <>
                <strong>Ta paczka jest domknięta</strong>
                <p>Masz odhaczone wszystkie kroki z wygenerowanego zestawu. Dodaj kolejną paczkę albo zresetuj postęp, jeśli chcesz przejść proces jeszcze raz.</p>
                <div className="wellbeing-actions">
                  <button className="primary-button" type="button" onClick={generateMoreSteps}><Plus size={16} />Generuj kolejne kroki</button>
                  <button className="secondary-button" type="button" onClick={resetProgress}><RotateCw size={16} />Reset postępu</button>
                </div>
              </>
            ) : (
              <div className="empty-state">Ustaw kreator i wygeneruj plan.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Plan tygodnia</h2>
              <span>{plan ? `${plan.steps.length} kroków` : "czeka"}</span>
            </div>
            {plan && <p className="muted-note">{plan.summary}</p>}
            <div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            <div className="declutter-week-list">
              {(plan?.steps ?? []).slice(0, 7).map((step) => (
                <button className={`declutter-step-row ${completedSet.has(step.id) ? "done" : ""}`} type="button" key={step.id} onClick={() => toggleStep(step.id)}>
                  <span>{step.day}</span>
                  <strong>{step.title}</strong>
                  <small>{step.minutes} min</small>
                </button>
              ))}
              {!plan && <div className="empty-state">Plan pojawi się po ustawieniu kreatora.</div>}
            </div>
            <div className="wellbeing-actions">
              <button className="secondary-button" type="button" onClick={generateMoreSteps}><RotateCw size={16} />Dodaj następną paczkę</button>
              <button className="secondary-button" type="button" onClick={() => void copyPlan()} disabled={!plan}><ClipboardCheck size={16} />Kopiuj plan</button>
            </div>
          </section>
        </section>
      )}

      {activeTab === "steps" && (
        <section className="declutter-steps-grid">
          {(plan?.steps ?? []).map((step) => (
            <article className={`wellbeing-card declutter-step-card ${completedSet.has(step.id) ? "goal-done" : ""}`} key={step.id}>
              <div className="wellbeing-card-header">
                <strong>Dzień {step.day}: {step.title}</strong>
                <span>{step.minutes} min · {step.area}</span>
              </div>
              <p>{step.action}</p>
              <p><strong>Gotowe, gdy:</strong> {step.exitCriteria}</p>
              <p><strong>Decyzja:</strong> {step.decisionPrompt}</p>
              <div className="wellbeing-card-actions">
                <button className="secondary-button" type="button" onClick={() => toggleStep(step.id)}>
                  <CheckCircle2 size={16} />{completedSet.has(step.id) ? "Cofnij wykonanie" : "Oznacz jako zrobione"}
                </button>
                <button className="secondary-button" type="button" onClick={() => void createTaskFromStep(step)} disabled={savingTaskId === step.id}>
                  <Plus size={16} />Utwórz zadanie
                </button>
              </div>
            </article>
          ))}
          {!plan && <div className="panel empty-state">Ustaw kreator, żeby wygenerować pierwsze kroki.</div>}
        </section>
      )}

      {activeTab === "rules" && (
        <section className="declutter-rules-grid">
          {plan?.milestones.map((milestone) => (
            <article className="panel declutter-rule-card" key={milestone.week}>
              <span className="eyebrow">Tydzień {milestone.week}</span>
              <strong>{milestone.title}</strong>
              <p>{milestone.focus}</p>
              <div className="declutter-rule-strip"><CheckCircle2 size={16} /><span>{milestone.result}</span></div>
            </article>
          )) ?? weeklyProgram.slice(0, wizard.targetWeeks).map((week, index) => (
            <article className="panel declutter-rule-card" key={week.title}>
              <span className="eyebrow">Tydzień {index + 1}</span>
              <strong>{week.title}</strong>
              <p>{week.focus}</p>
              <div className="declutter-rule-strip"><CheckCircle2 size={16} /><span>{week.result}</span></div>
            </article>
          ))}
          <article className="panel declutter-rule-card">
            <span className="eyebrow">Pięć decyzji</span>
            <strong>Zostaje, oddaję, sprzedaję, wyrzucam/recykling, kwarantanna</strong>
            <p>Rzeczy do sprzedaży nie mogą tworzyć nowego magazynu. Jeśli nie wystawisz ich w ciągu 7 dni, oddajesz je.</p>
          </article>
          <article className="panel declutter-rule-card">
            <span className="eyebrow">Anty-napływ</span>
            <strong>Jedna rzecz wchodzi, jedna wychodzi</strong>
            <p>Niepilne zakupy czekają 72 godziny, a większe 30 dni. Organizer kupujesz dopiero po redukcji.</p>
          </article>
        </section>
      )}
    </div>
  );
}

function buildPlan(wizard: DeclutterWizard, offset: number, count: number): DeclutterPlan {
  return {
    generatedAt: new Date().toISOString(),
    summary: `Plan dla: ${wizard.homeBase}. Tempo: ${wizard.minutesPerDay} min dziennie, ${wizard.daysPerWeek} dni w tygodniu. Limit: ${wizard.hardLimit}.`,
    steps: buildSteps(wizard, offset, count),
    milestones: weeklyProgram.slice(0, wizard.targetWeeks).map((week, index) => ({
      week: index + 1,
      title: week.title,
      focus: week.focus,
      result: week.result
    }))
  };
}

function buildSteps(wizard: DeclutterWizard, offset: number, count: number): DeclutterStep[] {
  const areas = areaSequence(wizard);
  const batchKey = new Date().toISOString().replace(/[^0-9]/g, "");
  return Array.from({ length: count }, (_, index) => {
    const dayIndex = offset + index;
    const area = dayIndex === 0 ? wizard.startArea || areas[0] : areas[dayIndex % areas.length];
    const week = weeklyProgram[Math.min(Math.floor(dayIndex / Math.max(1, wizard.daysPerWeek)), weeklyProgram.length - 1)];
    const title = titleForStep(area, wizard.focus === "auto" ? week.title : focusLabels[wizard.focus]);
    return {
      id: `declutter-${batchKey}-${dayIndex}`,
      day: dayIndex + 1,
      title,
      area,
      minutes: wizard.minutesPerDay,
      action: actionForStep(area, wizard, dayIndex),
      exitCriteria: exitCriteriaFor(wizard),
      decisionPrompt: decisionPromptFor(wizard)
    };
  });
}

function planToMarkdown(plan: DeclutterPlan, completedSet: Set<string>) {
  return [
    "# Plan oczyszczania",
    "",
    plan.summary,
    "",
    "## Kroki",
    ...plan.steps.map((step) => {
      const checkbox = completedSet.has(step.id) ? "[x]" : "[ ]";
      return `${checkbox} Dzień ${step.day}: ${step.title} (${step.minutes} min)\n   - ${step.action}\n   - Gotowe, gdy: ${step.exitCriteria}`;
    }),
    "",
    "## Kamienie tygodniowe",
    ...plan.milestones.map((milestone) => `- Tydzień ${milestone.week}: ${milestone.title} - ${milestone.result}`)
  ].join("\n");
}

function areaSequence(wizard: DeclutterWizard) {
  if (wizard.focus === "auto") {
    return weeklyProgram.flatMap((week) => week.areas);
  }
  const map: Record<Exclude<DeclutterFocus, "auto">, string[]> = {
    visible: weeklyProgram[0].areas,
    duplicates: weeklyProgram[1].areas,
    clothes: weeklyProgram[2].areas,
    bathroom: weeklyProgram[3].areas,
    kitchen: weeklyProgram[4].areas,
    documents: weeklyProgram[5].areas,
    digital: weeklyProgram[6].areas,
    projects: weeklyProgram[7].areas
  };
  return map[wizard.focus];
}

function titleForStep(area: string, focus: string) {
  return `${area}: ${focus.toLowerCase()}`;
}

function actionForStep(area: string, wizard: DeclutterWizard, dayIndex: number) {
  const start = dayIndex === 0 ? "Ustaw minutnik i zacznij bez przestawiania całego obszaru." : "Otwórz tylko ten jeden obszar.";
  const intensity = wizard.energy <= 2
    ? "Wybierz 5 najłatwiejszych rzeczy i zamknij sesję."
    : wizard.energy >= 4
      ? "Przejdź rzecz po rzeczy, ale zatrzymaj się po czasie z kreatora."
      : "Wybierz małą partię i podejmij decyzję dla każdej rzeczy.";
  return `${start} Obszar: ${area}. ${intensity}`;
}

function exitCriteriaFor(wizard: DeclutterWizard) {
  if (wizard.decisionFriction === "high") {
    return "obszar jest zamknięty, a rzeczy niepewne trafiły do kwarantanny zamiast na nowy stos";
  }
  if (wizard.salePolicy === "donate_first") {
    return "minimum jedna rzecz wyszła z obszaru albo została odłożona na stałe miejsce";
  }
  return "śmieci wyszły, darowizny są w jednej strefie, a rzeczy do sprzedaży mają termin 7 dni";
}

function decisionPromptFor(wizard: DeclutterWizard) {
  if (wizard.salePolicy === "quarantine") {
    return "Jeśli nie wiesz, wybierz kwarantannę maksymalnie 30 dni, nie negocjuj dłużej.";
  }
  if (wizard.salePolicy === "donate_first") {
    return "Jeśli rzecz jest dobra, ale nie jest używana, domyślnie oddaj.";
  }
  return "Jeśli rzecz ma realną wartość, wystaw ją w ciągu 7 dni; po tym czasie oddaj.";
}

function dateAfter(days: number) {
  const date = new Date(`${todayIso()}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function readStoredState(): { wizard: DeclutterWizard; plan: DeclutterPlan | null; completedIds: string[] } {
  if (typeof window === "undefined") return { wizard: defaultWizard, plan: null, completedIds: [] };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { wizard: defaultWizard, plan: null, completedIds: [] };
    const parsed = JSON.parse(raw) as Partial<{ wizard: DeclutterWizard; plan: DeclutterPlan | null; completedIds: string[] }>;
    return {
      wizard: { ...defaultWizard, ...(parsed.wizard ?? {}) },
      plan: parsed.plan ?? null,
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : []
    };
  } catch {
    return { wizard: defaultWizard, plan: null, completedIds: [] };
  }
}

function TabButton({ id, active, onClick, icon, label }: { id: DeclutterTab; active: DeclutterTab; onClick: (tab: DeclutterTab) => void; icon: JSX.Element; label: string }) {
  return (
    <button className={active === id ? "active" : ""} type="button" onClick={() => onClick(id)}>
      {icon}
      {label}
    </button>
  );
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
}
