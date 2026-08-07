import { ArrowRight, BookOpen, Brain, Briefcase, CalendarDays, CheckCircle2, Compass, DollarSign, FolderKanban, HeartHandshake, ListTodo, NotebookText, Rocket, Search, Target, Users, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AppContextValue } from "../lib/appContext";

interface CentrumGuidePageProps {
  context: AppContextValue;
}

const coreFlow = [
  {
    title: "1. Złap sygnał",
    body: "Start, Dzisiaj i Kalendarz pokazują tylko to, co wymaga decyzji teraz: zaległości, terminy, kolizje i najbliższy focus."
  },
  {
    title: "2. Uporządkuj pracę",
    body: "Projekt trzyma kierunek, zadanie trzyma wykonanie, a obszary i tagi pomagają filtrować bez mnożenia miejsc."
  },
  {
    title: "3. Wykonaj i domknij",
    body: "Zmieniaj statusy zadań na bieżąco. Gdy coś trafia do done, dashboard robi się spokojniejszy sam z siebie."
  },
  {
    title: "4. Zrób przegląd",
    body: "Tydzień, Obciążenie, Finanse, CRM i Notatki służą do cyklicznego porządkowania, nie do codziennego gaszenia wszystkiego naraz."
  }
];

const viewGroups: Array<{
  title: string;
  icon: LucideIcon;
  rows: Array<{ view: string; to: string; when: string; useFor: string }>;
}> = [
  {
    title: "Centrum pracy",
    icon: Compass,
    rows: [
      { view: "Start", to: "/", when: "początek dnia", useFor: "jedna decyzja: co wymaga uwagi i jaki jest następny ruch" },
      { view: "Dzisiaj", to: "/today", when: "codzienna egzekucja", useFor: "zaległości, zadania na dzisiaj i blokady tygodnia" },
      { view: "Kalendarz", to: "/calendar", when: "planowanie czasu", useFor: "wydarzenia, notatki dzienne i deadline'y zadań" },
      { view: "Tydzień", to: "/weekly", when: "przegląd tygodnia", useFor: "rytm pracy, priorytety i korekta planu" },
      { view: "Obciążenie", to: "/workload", when: "za dużo na głowie", useFor: "rozkład pracy po osobach, obszarach i projektach" }
    ]
  },
  {
    title: "Planowanie",
    icon: Rocket,
    rows: [
      { view: "Mission OS", to: "/execution", when: "przed większą zmianą", useFor: "przejście od celu do sekwencji wykonania" },
      { view: "Narzędziownik", to: "/toolbox", when: "decyzja jest niejasna", useFor: "5W2H, OODA, OKR, premortem i inne ramy myślenia" },
      { view: "Gantt", to: "/gantt", when: "liczą się daty", useFor: "oś czasu, fazy i zależności terminów" },
      { view: "Mapa myśli", to: "/mind-map", when: "trzeba zobaczyć zależności", useFor: "wizualny porządek projektów, obszarów i celów" },
      { view: "PM Guide", to: "/pm-guide", when: "prowadzisz projekt formalnie", useFor: "checklisty, dokumenty i dobre praktyki PM" }
    ]
  },
  {
    title: "Realizacja",
    icon: ListTodo,
    rows: [
      { view: "Zadania", to: "/tasks", when: "operacyjna praca", useFor: "dodawanie, filtrowanie, statusy, priorytety, notatki i załączniki" },
      { view: "Kanban", to: "/kanban", when: "potrzebny przepływ", useFor: "szybki obraz statusów zadań" },
      { view: "Notatki", to: "/notes", when: "informacja nie jest jeszcze zadaniem", useFor: "decyzje, pomysły, ryzyka, TODO i materiał z dokumentów" },
      { view: "Praca", to: "/work-log", when: "chcesz pamiętać wysiłek", useFor: "rejestr czasu i dzienny raport pracy" },
      { view: "Poczta", to: "/email", when: "praca idzie przez mail", useFor: "skrzynka, wysyłka i robocze odpowiedzi" }
    ]
  },
  {
    title: "Biznes",
    icon: Briefcase,
    rows: [
      { view: "Business", to: "/business-designer", when: "model trzeba doprecyzować", useFor: "canvas, mapa wartości i analiza biznesowa" },
      { view: "CRM", to: "/crm", when: "są relacje i follow-upy", useFor: "klienci, pipeline, kontakty i terminy odezwania" },
      { view: "Finanse", to: "/finance", when: "liczą się pieniądze", useFor: "budżet, faktury, płatności, koszty i marże" },
      { view: "Social Plan", to: "/social-plan", when: "potrzebna publikacja", useFor: "plan komunikacji i kampanii" },
      { view: "AI Market", to: "/market-intel", when: "szukasz szans", useFor: "rynek, firmy i potencjalne leady" }
    ]
  },
  {
    title: "Dobrostan",
    icon: Brain,
    rows: [
      { view: "Bloki czasu", to: "/time-blocks", when: "dzień się rozlewa", useFor: "plan pracy w blokach i rytmach" },
      { view: "Dobrostan", to: "/wellbeing", when: "system ma wspierać człowieka", useFor: "cele osobiste, refleksje, praktyki, afirmacje i dziennik" },
      { view: "Oczyszczanie", to: "/oczyszczanie", when: "trzeba zmniejszyć tarcie", useFor: "praktyczny plan porządkowania życia i przestrzeni" }
    ]
  }
];

const practices = [
  {
    title: "Jedna prawda o pracy",
    body: "Projekt opisuje kierunek, zadanie opisuje wykonanie, notatka przechowuje kontekst, a CRM i Finanse dopinają relacje oraz pieniądze."
  },
  {
    title: "Nie wszystko jest pilne",
    body: "Codziennie zaczynaj od Startu albo Dzisiaj. Do pozostałych widoków wchodź wtedy, gdy mają odpowiedzieć na konkretne pytanie."
  },
  {
    title: "Każde zadanie ma termin",
    body: "Priorytet, impact i data napędzają ryzyko, kolejkę focus, Dzisiaj, Kalendarz i dashboard. Bez daty system nie ma czego chronić."
  },
  {
    title: "Notatka zanim chaos zostanie zadaniem",
    body: "Gdy coś jest jeszcze niejasne, zapisz to w Notatkach jako pomysł, decyzję albo ryzyko. Zadanie twórz dopiero po określeniu następnego kroku."
  },
  {
    title: "Archiwizuj, nie kolekcjonuj",
    body: "Zamknięte projekty ustawiaj jako done. Dashboard wtedy pokazuje aktywne portfolio zamiast historii wszystkiego."
  },
  {
    title: "Copilot jako strukturyzator",
    body: "Używaj Copilota do rozbijania celu na projekt, fazy i zadania. Decyzję o priorytecie warto zostawić na przegląd."
  }
];

const rituals = [
  "Rano: Start -> Dzisiaj -> wybierz jedno najważniejsze zadanie.",
  "W trakcie dnia: Zadania lub Kanban -> zmieniaj statusy i dopisuj tylko ten kontekst, który pomaga wykonać pracę.",
  "Po spotkaniu: Notatki -> decyzje i ryzyka, a dopiero potem konkretne zadania.",
  "Raz w tygodniu: Tydzień -> Obciążenie -> Finanse/CRM -> archiwizacja tego, co zamknięte.",
  "Gdy robi się chaotycznie: Narzędziownik albo Mapa myśli, potem powrót do jednej listy zadań."
];

export function CentrumGuidePage({ context }: CentrumGuidePageProps) {
  const activeProjects = context.projects.filter((project) => project.status !== "done").length;
  const openTasks = context.tasks.filter((task) => task.status !== "done").length;
  const notesToReview = context.notes.filter((note) => note.review_status !== "reviewed").length;
  const followUps = context.clients.filter((client) => client.next_follow_up && client.stage !== "closed").length;

  return (
    <div className="page centrum-guide-page">
      <header className="page-header centrum-guide-header">
        <div>
          <span className="eyebrow">Pomoc operacyjna</span>
          <h1>Jak używać Centrum</h1>
          <p className="header-summary">Krótki przewodnik po logice aplikacji: gdzie wejść, co zapisać i jak korzystać z systemu bez dokładania sobie presji.</p>
        </div>
        <Link className="primary-button" to="/">
          <Compass size={18} />
          Wróć do Startu
        </Link>
      </header>

      <section className="guide-snapshot" aria-label="Stan systemu">
        <Snapshot icon={FolderKanban} label="Aktywne projekty" value={activeProjects} />
        <Snapshot icon={ListTodo} label="Otwarte zadania" value={openTasks} />
        <Snapshot icon={NotebookText} label="Notatki do przeglądu" value={notesToReview} />
        <Snapshot icon={Users} label="Otwarte follow-upy" value={followUps} />
      </section>

      <section className="panel guide-flow-panel">
        <div className="panel-header">
          <h2><Target size={18} />Logika Centrum w 4 krokach</h2>
        </div>
        <div className="guide-flow">
          {coreFlow.map((item) => (
            <article className="guide-flow-step" key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-layout">
        <div className="panel">
          <div className="panel-header">
            <h2><BookOpen size={18} />Gdzie co jest</h2>
          </div>
          <div className="guide-view-groups">
            {viewGroups.map((group) => {
              const Icon = group.icon;
              return (
                <section className="guide-view-group" key={group.title}>
                  <h3><Icon size={17} />{group.title}</h3>
                  <div className="guide-view-list">
                    {group.rows.map((row) => (
                      <Link className="guide-view-row" to={row.to} key={row.view}>
                        <strong>{row.view}</strong>
                        <span>{row.when}</span>
                        <small>{row.useFor}</small>
                        <ArrowRight size={15} />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="guide-side-stack">
          <section className="panel">
            <div className="panel-header">
              <h2><CheckCircle2 size={18} />Dobre praktyki</h2>
            </div>
            <div className="guide-practice-list">
              {practices.map((practice) => (
                <article className="guide-practice" key={practice.title}>
                  <strong>{practice.title}</strong>
                  <p>{practice.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2><CalendarDays size={18} />Rytm używania</h2>
            </div>
            <ol className="guide-ritual-list">
              {rituals.map((ritual) => <li key={ritual}>{ritual}</li>)}
            </ol>
          </section>
        </aside>
      </section>

      <section className="panel guide-decision-panel">
        <div className="panel-header">
          <h2><Search size={18} />Szybka decyzja: gdzie to zapisać?</h2>
        </div>
        <div className="guide-decision-grid">
          <Decision icon={FolderKanban} title="To ma cel i wynik" to="/"><span>Utwórz lub wybierz projekt.</span></Decision>
          <Decision icon={ListTodo} title="To trzeba wykonać" to="/tasks"><span>Dodaj zadanie z terminem, priorytetem i impactem.</span></Decision>
          <Decision icon={NotebookText} title="To jest kontekst" to="/notes"><span>Zapisz notatkę, decyzję, ryzyko albo pomysł.</span></Decision>
          <Decision icon={CalendarDays} title="To jest czas" to="/calendar"><span>Dodaj wydarzenie, odnotację albo sprawdź deadline.</span></Decision>
          <Decision icon={Users} title="To dotyczy klienta" to="/crm"><span>Dodaj CRM, stage, wartość i następny follow-up.</span></Decision>
          <Decision icon={DollarSign} title="To dotyczy pieniędzy" to="/finance"><span>Uzupełnij budżet, faktury, płatności i koszty.</span></Decision>
          <Decision icon={Wrench} title="To jest niejasne" to="/toolbox"><span>Użyj ramy myślenia, potem wróć do jednego następnego kroku.</span></Decision>
          <Decision icon={HeartHandshake} title="To dotyczy energii" to="/wellbeing"><span>Zapisz refleksję, cel osobisty albo dzienny commitment.</span></Decision>
        </div>
      </section>
    </div>
  );
}

function Snapshot({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="metric-card guide-snapshot-card">
      <Icon />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Decision({ icon: Icon, title, to, children }: { icon: LucideIcon; title: string; to: string; children: ReactNode }) {
  return (
    <Link className="guide-decision" to={to}>
      <Icon size={18} />
      <strong>{title}</strong>
      {children}
    </Link>
  );
}
