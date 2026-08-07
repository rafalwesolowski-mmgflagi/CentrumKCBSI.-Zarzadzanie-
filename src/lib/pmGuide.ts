import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Columns3,
  Contact,
  DollarSign,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  NotebookText,
  ShieldAlert,
  Sparkles,
  Target,
  Users
} from "lucide-react";

export interface PMGuideChecklistItem {
  id: string;
  label: string;
  taskTitle: string;
  taskNotes: string;
}

export interface PMGuideToolAction {
  label: string;
  to: string;
  icon: ComponentType<LucideProps>;
  description: string;
}

export interface PMGuideStage {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  focus: string;
  objective: string;
  learn: string;
  nextStep: string;
  artifact: string;
  checklist: PMGuideChecklistItem[];
  mistakes: string[];
  methods: {
    prince2: string;
    pmbok: string;
    agile: string;
    ipma: string;
  };
  tools: PMGuideToolAction[];
}

export interface PMGuideProfessionalNote {
  stageId: string;
  comment: string;
  hints: string[];
  qualityGate: string[];
  reviewQuestions: string[];
}

export const pmGuideStages: PMGuideStage[] = [
  {
    id: "initiation",
    order: 1,
    title: "Inicjacja i uzasadnienie",
    shortTitle: "Inicjacja",
    focus: "Ustal, czy projekt ma sens i kto podejmuje decyzje.",
    objective: "Zamienić pomysł w decyzję projektową z jasną wartością, sponsorem i granicami.",
    learn: "Projekt zaczyna się od potrzeby zmiany, a nie od harmonogramu. Najpierw nazwij problem, korzyści, właściciela decyzji, ograniczenia i konsekwencje braku działania.",
    nextStep: "Przygotuj krótką kartę projektu: problem, cel, sponsor, oczekiwane korzyści, ograniczenia, pierwsze ryzyka i minimalny następny krok.",
    artifact: "Karta projektu / project brief / business case light",
    checklist: [
      {
        id: "decision-owner",
        label: "Nazwij sponsora, użytkowników i osobę podejmującą decyzje.",
        taskTitle: "Ustalić sponsorów i decydentów projektu",
        taskNotes: "Spisz sponsora, użytkowników, komitet/decydenta oraz próg eskalacji dla projektu."
      },
      {
        id: "value-case",
        label: "Opisz problem, wartość i koszt braku działania.",
        taskTitle: "Opisać uzasadnienie biznesowe projektu",
        taskNotes: "Przygotuj krótki business case: problem, wartość, koszty opóźnienia i kryteria sukcesu."
      },
      {
        id: "constraints",
        label: "Zbierz ograniczenia czasu, kosztu, jakości, zasobów i ryzyka.",
        taskTitle: "Zebrać ograniczenia startowe projektu",
        taskNotes: "Zapisz ograniczenia i założenia, które będą wpływać na zakres, plan i decyzje."
      }
    ],
    mistakes: ["Start bez właściciela decyzji.", "Mylenie aktywności z wartością.", "Tworzenie dokumentów, które nie wspierają decyzji."],
    methods: {
      prince2: "Ciągła zasadność biznesowa, role i mandat projektu.",
      pmbok: "Uzasadnienie, interesariusze i dopasowanie sposobu prowadzenia.",
      agile: "Hipoteza wartości i szybka walidacja założeń.",
      ipma: "Kontekst organizacji, odpowiedzialność i wpływ interesariuszy."
    },
    tools: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard, description: "Zobacz portfolio i cele strategiczne." },
      { label: "Business", to: "/business-designer", icon: Briefcase, description: "Rozpisz wartość i model działania." },
      { label: "Notes", to: "/notes", icon: NotebookText, description: "Zapisz decyzje i założenia." }
    ]
  },
  {
    id: "planning",
    order: 2,
    title: "Planowanie zakresu, etapów i odpowiedzialności",
    shortTitle: "Planowanie",
    focus: "Rozbij cel na produkty, etapy, zadania i punkty kontroli.",
    objective: "Zbudować plan, który pozwala sterować projektem, a nie tylko listować aktywności.",
    learn: "Dobry plan pokazuje produkty, zależności, odpowiedzialności, tolerancje i rytm przeglądu. Im większa niepewność, tym krótsze powinny być cykle planowania.",
    nextStep: "Zdefiniuj główne etapy, kamienie milowe, pierwsze zadania oraz sposób odbioru rezultatów.",
    artifact: "Plan etapów / WBS / roadmapa / backlog",
    checklist: [
      {
        id: "deliverables",
        label: "Zdefiniuj produkty i kryteria odbioru.",
        taskTitle: "Zdefiniować produkty i kryteria odbioru",
        taskNotes: "Opisz główne rezultaty projektu oraz po czym poznamy, że są gotowe do odbioru."
      },
      {
        id: "milestones",
        label: "Ustal etapy, milestone'y i rytm kontroli.",
        taskTitle: "Ustalić etapy i kamienie milowe projektu",
        taskNotes: "Rozbij projekt na etapy, daty kontrolne i decyzje potrzebne do przejścia dalej."
      },
      {
        id: "ownership",
        label: "Przypisz właścicieli zadań i obszarów.",
        taskTitle: "Przypisać odpowiedzialności w planie projektu",
        taskNotes: "Ustal właścicieli obszarów, zadań, decyzji i odbiorów."
      }
    ],
    mistakes: ["Plan bez kryteriów odbioru.", "Zbyt duży zakres naraz.", "Brak właścicieli i zależności."],
    methods: {
      prince2: "Planowanie etapowe, tolerancje i zarządzanie przez wyjątki.",
      pmbok: "Zakres, harmonogram, zasoby i interesariusze.",
      agile: "Backlog, priorytety i krótkie iteracje wartości.",
      ipma: "Organizacja pracy, współpraca i orientacja na rezultat."
    },
    tools: [
      { label: "Gantt", to: "/gantt", icon: BarChart3, description: "Sprawdź etapy i daty." },
      { label: "Mind Map", to: "/mind-map", icon: GitBranch, description: "Zobacz zależności projektu." },
      { label: "Tasks", to: "/tasks", icon: ListTodo, description: "Dodaj i uporządkuj zadania." }
    ]
  },
  {
    id: "execution",
    order: 3,
    title: "Realizacja i praca zespołu",
    shortTitle: "Realizacja",
    focus: "Utrzymuj przepływ pracy i zamykaj pętle komunikacyjne.",
    objective: "Zapewnić, że zespół kończy najważniejsze rzeczy i szybko usuwa blokady.",
    learn: "Zespół nie przyspiesza od większej liczby rozpoczętych zadań. Przyspiesza od jasnych priorytetów, ograniczonego WIP, decyzji i widocznych rezultatów.",
    nextStep: "Ustal rytm statusów, przegląd tablicy, reguły blokad i sposób potwierdzania decyzji po spotkaniach.",
    artifact: "Tablica pracy / status tygodniowy / lista decyzji",
    checklist: [
      {
        id: "cadence",
        label: "Ustal stały rytm spotkań, statusów i przeglądu tablicy.",
        taskTitle: "Ustalić rytm pracy zespołu",
        taskNotes: "Określ dni statusów, przegląd priorytetów, zasady eskalacji i format notatki po spotkaniu."
      },
      {
        id: "wip",
        label: "Ogranicz pracę w toku i nazwij aktualny fokus.",
        taskTitle: "Ograniczyć WIP i wskazać fokus zespołu",
        taskNotes: "Wybierz najważniejsze zadania do domknięcia i odłóż pracę, która rozprasza zespół."
      },
      {
        id: "blockers",
        label: "Zdefiniuj sposób zgłaszania blokad i decyzji.",
        taskTitle: "Zdefiniować obsługę blokad projektowych",
        taskNotes: "Ustal, jak zespół zgłasza blokady, kto je przejmuje i kiedy trafiają do eskalacji."
      }
    ],
    mistakes: ["Spotkania bez decyzji.", "Wiele zadań otwartych i mało zakończonych.", "Brak jasnej ścieżki eskalacji."],
    methods: {
      prince2: "Kontrola postępu w granicach tolerancji.",
      pmbok: "Zespół, komunikacja, realizacja pracy i monitorowanie.",
      agile: "Daily, limity WIP, review i retrospektywa.",
      ipma: "Przywództwo, współpraca, konflikty i motywacja."
    },
    tools: [
      { label: "Kanban", to: "/kanban", icon: Columns3, description: "Prowadź przepływ pracy." },
      { label: "Weekly", to: "/weekly", icon: CalendarClock, description: "Zrób przegląd tygodnia." },
      { label: "Workload", to: "/workload", icon: Users, description: "Sprawdź obciążenie ludzi." }
    ]
  },
  {
    id: "control",
    order: 4,
    title: "Kontrola, raportowanie i decyzje",
    shortTitle: "Kontrola",
    focus: "Mierz postęp według rezultatów, decyzji, ryzyk i odchyleń.",
    objective: "Zamienić status projektu w narzędzie decyzyjne dla PM-a, sponsora i zespołu.",
    learn: "Raport statusowy bez decyzji do podjęcia jest informacją pasywną. Każdy przegląd powinien pokazywać postęp, odchylenia, ryzyka, decyzje i następne kroki.",
    nextStep: "Przygotuj format statusu: co dowieziono, co jest zagrożone, jakie decyzje są potrzebne i co będzie zrobione dalej.",
    artifact: "Raport statusowy / dashboard / lista decyzji",
    checklist: [
      {
        id: "status-format",
        label: "Ustal format raportu statusowego.",
        taskTitle: "Ustalić format raportowania statusu",
        taskNotes: "Zaprojektuj status: rezultaty, odchylenia, ryzyka, decyzje, kolejne kroki."
      },
      {
        id: "tolerances",
        label: "Nazwij tolerancje czasu, kosztu, zakresu, jakości i ryzyka.",
        taskTitle: "Nazwać tolerancje projektowe",
        taskNotes: "Ustal, kiedy PM działa samodzielnie, a kiedy eskaluje przekroczenie lub prognozę przekroczenia."
      },
      {
        id: "decision-log",
        label: "Prowadź listę decyzji i otwartych pytań.",
        taskTitle: "Założyć rejestr decyzji projektu",
        taskNotes: "Zapisuj decyzje, właścicieli, daty, konsekwencje i pytania wymagające domknięcia."
      }
    ],
    mistakes: ["Raportowanie aktywności zamiast rezultatów.", "Ukrywanie odchyleń do ostatniej chwili.", "Brak decyzji po przeglądzie."],
    methods: {
      prince2: "Zarządzanie przez wyjątki i raporty punktów kontrolnych.",
      pmbok: "Monitorowanie, kontrola zmian i komunikacja statusu.",
      agile: "Review, metryki przepływu i transparentność backlogu.",
      ipma: "Wiarygodność, komunikacja i odpowiedzialność za rezultat."
    },
    tools: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard, description: "Sprawdź kondycję portfolio." },
      { label: "Today", to: "/today", icon: CheckCircle2, description: "Zobacz pilne działania." },
      { label: "Notes", to: "/notes", icon: NotebookText, description: "Zapisz decyzje i pytania." }
    ]
  },
  {
    id: "risk-change",
    order: 5,
    title: "Ryzyko i zmiana",
    shortTitle: "Ryzyko",
    focus: "Wykrywaj odchylenia wcześnie i zamieniaj niepewność w decyzje.",
    objective: "Prowadzić ryzyka, problemy i zmiany tak, by projekt nie dryfował.",
    learn: "Rejestr ryzyka bez decyzji jest archiwum niepokoju. Ryzyko musi mieć właściciela, reakcję, próg eskalacji i rytm przeglądu.",
    nextStep: "Zrób przegląd ryzyk: prawdopodobieństwo, wpływ, właściciel, reakcja, data przeglądu i decyzje do sponsora.",
    artifact: "Rejestr ryzyk / rejestr zmian / issue log",
    checklist: [
      {
        id: "risk-register",
        label: "Spisz ryzyka, problemy i założenia do walidacji.",
        taskTitle: "Zaktualizować rejestr ryzyk projektu",
        taskNotes: "Zapisz ryzyka, wpływ, właścicieli, reakcje i daty przeglądu."
      },
      {
        id: "change-rule",
        label: "Ustal regułę przyjmowania i oceny zmian.",
        taskTitle: "Ustalić proces obsługi zmian",
        taskNotes: "Opisz, jak zgłaszamy zmianę, kto ocenia wpływ i kto zatwierdza decyzję."
      },
      {
        id: "escalation",
        label: "Nazwij progi eskalacji dla ryzyk i blokad.",
        taskTitle: "Ustalić progi eskalacji ryzyk",
        taskNotes: "Określ, które ryzyka PM obsługuje sam, a które wymagają sponsora lub komitetu."
      }
    ],
    mistakes: ["Ryzyko bez właściciela.", "Zmiany akceptowane bez wpływu na czas/koszt/jakość.", "Eskalacja dopiero po fakcie."],
    methods: {
      prince2: "Rejestry ryzyk, zagadnień i sterowanie zmianą.",
      pmbok: "Planowanie reakcji na ryzyko i kontrola zmian.",
      agile: "Małe przyrosty ograniczające koszt błędu.",
      ipma: "Ocena kontekstu, negocjacje i odpowiedzialne decyzje."
    },
    tools: [
      { label: "Tasks", to: "/tasks", icon: ListTodo, description: "Oznacz ryzykowne zadania." },
      { label: "Gantt", to: "/gantt", icon: BarChart3, description: "Sprawdź wpływ na terminy." },
      { label: "Notes", to: "/notes", icon: NotebookText, description: "Prowadź rejestr decyzji." }
    ]
  },
  {
    id: "communication",
    order: 6,
    title: "Komunikacja i interesariusze",
    shortTitle: "Komunikacja",
    focus: "Dostarczaj właściwą informację właściwym osobom w rytmie decyzji.",
    objective: "Zmniejszyć chaos informacyjny i zwiększyć zaufanie do prowadzenia projektu.",
    learn: "Po spotkaniu powinno być jasne: co ustalono, kto robi, do kiedy, jakie decyzje są otwarte i kto je podejmie.",
    nextStep: "Zbuduj mapę interesariuszy i prosty plan komunikacji: kto, co, kiedy, kanał, cel decyzji.",
    artifact: "Mapa interesariuszy / plan komunikacji / notatka po spotkaniu",
    checklist: [
      {
        id: "stakeholders",
        label: "Zmapuj interesariuszy według wpływu, zainteresowania i decyzji.",
        taskTitle: "Zmapować interesariuszy projektu",
        taskNotes: "Wypisz sponsorów, użytkowników, dostawców, odbiorców i osoby blokujące decyzje."
      },
      {
        id: "communication-plan",
        label: "Ustal kanały, częstotliwość i format komunikacji.",
        taskTitle: "Przygotować plan komunikacji projektu",
        taskNotes: "Określ, kto dostaje status, kto decyzje, kto ryzyka i w jakim rytmie."
      },
      {
        id: "meeting-close",
        label: "Wprowadź zasadę domykania spotkań decyzjami i akcjami.",
        taskTitle: "Wprowadzić format notatki po spotkaniu",
        taskNotes: "Każda notatka powinna zawierać decyzje, akcje, właścicieli, terminy i otwarte pytania."
      }
    ],
    mistakes: ["Ten sam status dla wszystkich.", "Brak potwierdzania decyzji.", "Zbyt późne informowanie o ryzykach."],
    methods: {
      prince2: "Role, raporty i komunikacja w governance.",
      pmbok: "Plan komunikacji i zarządzanie interesariuszami.",
      agile: "Częsty feedback i review z użytkownikami.",
      ipma: "Relacje, wpływ, konflikt i przywództwo."
    },
    tools: [
      { label: "CRM", to: "/crm", icon: Contact, description: "Prowadź kontakty i follow-upy." },
      { label: "Notes", to: "/notes", icon: NotebookText, description: "Zapisz ustalenia." },
      { label: "Tasks", to: "/tasks", icon: ListTodo, description: "Zamień ustalenia w akcje." }
    ]
  },
  {
    id: "quality-finance",
    order: 7,
    title: "Jakość, finanse i dostawy",
    shortTitle: "Jakość/finanse",
    focus: "Kontroluj kryteria odbioru, budżet i zobowiązania dostawców.",
    objective: "Upewnić się, że projekt dowozi właściwy rezultat w akceptowalnym koszcie i jakości.",
    learn: "Jakość nie jest dodatkiem na końcu. Kryteria odbioru, koszt, odpowiedzialność dostawców i ryzyka prawne powinny być widoczne w planie od początku.",
    nextStep: "Przejrzyj budżet, koszty, faktury, kryteria jakości i zależności od dostawców.",
    artifact: "Plan jakości / budżet / rejestr dostaw / kryteria odbioru",
    checklist: [
      {
        id: "quality-criteria",
        label: "Nazwij kryteria jakości i odbioru dla kluczowych rezultatów.",
        taskTitle: "Zdefiniować kryteria jakości projektu",
        taskNotes: "Opisz, kto odbiera rezultat, jakie są kryteria i jak dokumentujemy akceptację."
      },
      {
        id: "finance-review",
        label: "Sprawdź budżet, koszty, faktury i marżę projektu.",
        taskTitle: "Zrobić przegląd finansów projektu",
        taskNotes: "Porównaj budżet, zafakturowane, zapłacone, koszty i ryzyka finansowe."
      },
      {
        id: "supplier-risk",
        label: "Zidentyfikuj zależności od dostawców i umów.",
        taskTitle: "Sprawdzić ryzyka dostaw i umów",
        taskNotes: "Wypisz zależności, terminy dostaw, zobowiązania, odbiory i ryzyka prawne."
      }
    ],
    mistakes: ["Odbiór bez kryteriów.", "Budżet aktualizowany po czasie.", "Dostawcy poza rytmem kontroli projektu."],
    methods: {
      prince2: "Jakość, produkty, tolerancje kosztowe i sterowanie dostawami.",
      pmbok: "Jakość, koszty, zamówienia i kontrola wykonania.",
      agile: "Definition of done i walidacja przyrostów.",
      ipma: "Negocjacje, odpowiedzialność i rozumienie ograniczeń organizacji."
    },
    tools: [
      { label: "Finance", to: "/finance", icon: DollarSign, description: "Sprawdź budżet i płatności." },
      { label: "Tasks", to: "/tasks", icon: ClipboardCheck, description: "Dodaj odbiory i kontrolę jakości." },
      { label: "CRM", to: "/crm", icon: Contact, description: "Pilnuj klientów i dostawców." }
    ]
  },
  {
    id: "agile-ai",
    order: 8,
    title: "Agile, narzędzia cyfrowe i AI",
    shortTitle: "Agile/AI",
    focus: "Skracaj pętle feedbacku i automatyzuj pracę bez utraty odpowiedzialności.",
    objective: "Dopasować podejście do niepewności i używać narzędzi jako wsparcia decyzji.",
    learn: "Agile nie oznacza braku planowania. Oznacza częstą walidację wartości, ograniczanie pracy w toku i uczenie się przez małe przyrosty.",
    nextStep: "Wybierz, co warto przetestować w najbliższych 7-14 dniach i gdzie AI może pomóc w analizie, notatkach lub planowaniu.",
    artifact: "Backlog eksperymentów / plan iteracji / prompt brief",
    checklist: [
      {
        id: "feedback-loop",
        label: "Ustal najkrótszą pętlę feedbacku z użytkownikiem lub sponsorem.",
        taskTitle: "Ustalić pętlę feedbacku projektu",
        taskNotes: "Zaplanuj review, demo lub rozmowę, która zweryfikuje założenia projektu."
      },
      {
        id: "experiment",
        label: "Zdefiniuj eksperyment lub przyrost wartości na 7-14 dni.",
        taskTitle: "Zaplanować najbliższy eksperyment projektowy",
        taskNotes: "Określ hipotezę, metodę testu, metrykę sukcesu i termin przeglądu."
      },
      {
        id: "ai-support",
        label: "Wskaż proces, który AI może wesprzeć bez oddania decyzji.",
        taskTitle: "Wybrać proces PM do wsparcia AI",
        taskNotes: "Wybierz obszar: analiza notatek, status, ryzyka, plan, komunikacja lub research."
      }
    ],
    mistakes: ["Mylenie Agile z chaosem.", "Automatyzacja bez właściciela decyzji.", "Brak metryki eksperymentu."],
    methods: {
      prince2: "Zwinne prowadzenie etapów z zachowaniem kontroli zarządczej.",
      pmbok: "Dopasowanie praktyk do kontekstu i niepewności.",
      agile: "Backlog, iteracje, review, retrospektywy i przyrosty wartości.",
      ipma: "Uczenie się, adaptacja i kompetencje behawioralne."
    },
    tools: [
      { label: "Business", to: "/business-designer", icon: Sparkles, description: "Analizuj model i eksperymenty." },
      { label: "Kanban", to: "/kanban", icon: Columns3, description: "Prowadź iterację." },
      { label: "Mind Map", to: "/mind-map", icon: GitBranch, description: "Zobacz zależności i hipotezy." }
    ]
  },
  {
    id: "closure",
    order: 9,
    title: "Zamknięcie i lessons learned",
    shortTitle: "Zamknięcie",
    focus: "Zamknij rezultat, decyzje, rozliczenia i naukę organizacyjną.",
    objective: "Upewnić się, że projekt kończy się odbiorem, wnioskami i rekomendacjami.",
    learn: "Zamknięcie nie jest formalnością. To moment potwierdzenia rezultatów, kosztów, korzyści, otwartych tematów i wiedzy, którą warto przenieść dalej.",
    nextStep: "Przygotuj checklistę zamknięcia: odbiory, finanse, dokumentacja, ryzyka rezydualne, lessons learned i rekomendacje.",
    artifact: "Raport końcowy / lessons learned / lista przekazania",
    checklist: [
      {
        id: "acceptance",
        label: "Potwierdź odbiór rezultatów i otwarte wyjątki.",
        taskTitle: "Potwierdzić odbiór rezultatów projektu",
        taskNotes: "Zbierz akceptacje, wyjątki, zaległe elementy i osoby odpowiedzialne za domknięcie."
      },
      {
        id: "finance-close",
        label: "Zamknij rozliczenia, płatności i koszty.",
        taskTitle: "Zamknąć rozliczenia finansowe projektu",
        taskNotes: "Sprawdź faktury, płatności, koszty, marżę i zobowiązania po projekcie."
      },
      {
        id: "lessons",
        label: "Zbierz lessons learned i rekomendacje dla kolejnych projektów.",
        taskTitle: "Przygotować lessons learned",
        taskNotes: "Spisz co działało, co nie działało, jakie decyzje były kluczowe i co zmienić następnym razem."
      }
    ],
    mistakes: ["Brak formalnego odbioru.", "Nieprzekazane ryzyka rezydualne.", "Lessons learned bez działań na przyszłość."],
    methods: {
      prince2: "Zamknięcie projektu, ocena korzyści i przekazanie produktów.",
      pmbok: "Domknięcie prac, zamówień i wiedzy organizacyjnej.",
      agile: "Retrospektywa i decyzje usprawniające kolejny cykl.",
      ipma: "Refleksja, rozwój kompetencji i odpowiedzialność za rezultat."
    },
    tools: [
      { label: "Notes", to: "/notes", icon: FileText, description: "Zapisz lessons learned." },
      { label: "Finance", to: "/finance", icon: DollarSign, description: "Domknij finanse." },
      { label: "Dashboard", to: "/", icon: Target, description: "Zobacz wpływ na cele." }
    ]
  }
];

export const pmGuideOverview = [
  { label: "Proces", value: `${pmGuideStages.length} etapów`, icon: GitBranch },
  { label: "Checklisty", value: `${pmGuideStages.reduce((sum, stage) => sum + stage.checklist.length, 0)} działań`, icon: ClipboardCheck },
  { label: "Governance", value: "PRINCE2 / PMBoK", icon: ShieldAlert },
  { label: "Praca zespołu", value: "Agile / IPMA", icon: MessageSquare }
];

export const pmGuideProfessionalNotes: Record<string, PMGuideProfessionalNote> = {
  initiation: {
    stageId: "initiation",
    comment: "Na tym etapie profesjonalny PM nie próbuje jeszcze planować wszystkiego. Najważniejsze jest odróżnienie dobrego pomysłu od projektu, który ma właściciela, wartość i warunki powodzenia.",
    hints: [
      "Zapisz jedną wersję prawdy: problem, korzyść, sponsor, zakres decyzji.",
      "Jeśli nie ma decydenta, potraktuj to jako pierwsze ryzyko projektu.",
      "Nie zaczynaj harmonogramu przed zgodą na cel i kryteria sukcesu."
    ],
    qualityGate: [
      "Sponsor i decydent są nazwani.",
      "Business case opisuje wartość oraz koszt braku działania.",
      "Najważniejsze ograniczenia i założenia są jawne."
    ],
    reviewQuestions: [
      "Czy projekt nadal ma sens biznesowy?",
      "Kto może zatrzymać albo zmienić projekt?",
      "Jaka decyzja jest potrzebna, żeby bezpiecznie przejść do planowania?"
    ]
  },
  planning: {
    stageId: "planning",
    comment: "Dobry plan jest narzędziem sterowania, nie obietnicą niezmienności. Powinien pokazać, co kontrolujemy, gdzie mamy tolerancje i które decyzje będą potrzebne w kolejnych punktach.",
    hints: [
      "Planuj produkty i rezultaty przed aktywnościami.",
      "Każdy milestone połącz z decyzją, odbiorem lub zmianą ryzyka.",
      "Przy niepewności skróć horyzont planu i użyj backlogu."
    ],
    qualityGate: [
      "Produkty mają kryteria odbioru.",
      "Zależności i właściciele są widoczni.",
      "Plan ma rytm przeglądu oraz punkty kontroli."
    ],
    reviewQuestions: [
      "Które założenie w planie jest najbardziej ryzykowne?",
      "Czy zespół wie, co kończyć najpierw?",
      "Czy plan pokazuje decyzje, czy tylko daty?"
    ]
  },
  execution: {
    stageId: "execution",
    comment: "W realizacji PM chroni przepływ pracy. Profesjonalizm widać nie w liczbie spotkań, ale w szybkim domykaniu decyzji, blokad i rezultatów.",
    hints: [
      "Na każdym statusie pytaj o blokady, decyzje i następny zamykany rezultat.",
      "Ogranicz WIP, gdy zespół dużo zaczyna i mało kończy.",
      "Po spotkaniu zostaw krótką notatkę: decyzje, akcje, właściciele, terminy."
    ],
    qualityGate: [
      "Zespół zna aktualny priorytet.",
      "Blokady mają właścicieli i datę kolejnego ruchu.",
      "Status pracy jest widoczny w narzędziu, nie tylko w rozmowach."
    ],
    reviewQuestions: [
      "Co realnie skończymy w najbliższym cyklu?",
      "Co blokuje przepływ?",
      "Która decyzja zdejmie największą niepewność?"
    ]
  },
  control: {
    stageId: "control",
    comment: "Kontrola projektu powinna prowadzić do decyzji. Raport, który nie pokazuje odchyleń, ryzyk i rekomendacji, jest archiwum informacji, nie narzędziem zarządzania.",
    hints: [
      "Raportuj według rezultatów, odchyleń, ryzyk i decyzji.",
      "Pokazuj prognozę przekroczenia tolerancji, nie tylko fakty po czasie.",
      "Oddziel informacje dla zespołu od informacji dla sponsora."
    ],
    qualityGate: [
      "Status ma jasny kolor/ocenę i uzasadnienie.",
      "Odchylenia mają rekomendowaną decyzję.",
      "Lista decyzji i pytań jest aktualna."
    ],
    reviewQuestions: [
      "Czy raport mówi sponsorowi, co ma zdecydować?",
      "Czy odchylenia są w tolerancji?",
      "Czy mamy dane, czy tylko opinię?"
    ]
  },
  "risk-change": {
    stageId: "risk-change",
    comment: "Ryzyko jest użyteczne dopiero wtedy, gdy zmienia zachowanie zespołu. Każde większe ryzyko powinno mieć właściciela, reakcję i punkt ponownej oceny.",
    hints: [
      "Rozróżnij ryzyko, problem i zmianę zakresu.",
      "Nie akceptuj zmiany bez oceny wpływu na czas, koszt, jakość i korzyści.",
      "Ustal wcześniej, kiedy ryzyko wymaga eskalacji."
    ],
    qualityGate: [
      "Ryzyka mają właścicieli i reakcje.",
      "Zmiany mają opisaną decyzję oraz wpływ.",
      "Najważniejsze ryzyka są regularnie przeglądane."
    ],
    reviewQuestions: [
      "Które ryzyko może najbardziej zmienić plan?",
      "Czy mamy reakcję, czy tylko opis problemu?",
      "Kto musi zatwierdzić zmianę?"
    ]
  },
  communication: {
    stageId: "communication",
    comment: "Komunikacja projektowa ma redukować niepewność. Profesjonalny PM dobiera poziom szczegółowości do odbiorcy i zawsze zamyka pętle ustaleń.",
    hints: [
      "Sponsor potrzebuje decyzji i ryzyk, zespół potrzebuje priorytetów i blokad.",
      "Nie wysyłaj wszystkim wszystkiego.",
      "Po ważnych rozmowach potwierdzaj ustalenia pisemnie."
    ],
    qualityGate: [
      "Interesariusze są zmapowani.",
      "Kanały i rytm komunikacji są ustalone.",
      "Po spotkaniach zostają decyzje i akcje."
    ],
    reviewQuestions: [
      "Kto jest pomijany w komunikacji?",
      "Kto dostaje za dużo szczegółów?",
      "Które ustalenie wymaga potwierdzenia?"
    ]
  },
  "quality-finance": {
    stageId: "quality-finance",
    comment: "Jakość, budżet i dostawy powinny być kontrolowane razem, bo opóźnienie albo słaby odbiór zwykle szybko zamieniają się w koszt.",
    hints: [
      "Kryteria odbioru ustal przed wykonaniem pracy.",
      "Porównuj budżet z prognozą, nie tylko z historią kosztów.",
      "Dostawców włącz w rytm kontroli projektu."
    ],
    qualityGate: [
      "Kluczowe produkty mają kryteria jakości.",
      "Finanse projektu są aktualne.",
      "Dostawy i zależności zewnętrzne mają właścicieli."
    ],
    reviewQuestions: [
      "Czy wiemy, kto odbiera rezultat?",
      "Czy budżet nadal pasuje do zakresu?",
      "Który dostawca lub zależność może zatrzymać projekt?"
    ]
  },
  "agile-ai": {
    stageId: "agile-ai",
    comment: "Zwinność i AI są profesjonalne tylko wtedy, gdy zwiększają uczenie się i jakość decyzji. Nie zastępują odpowiedzialności PM-a ani właściciela biznesowego.",
    hints: [
      "Każdy eksperyment połącz z hipotezą i metryką sukcesu.",
      "AI używaj do syntezy, wariantów i wykrywania ryzyk, ale decyzje zostaw ludziom.",
      "Regularnie sprawdzaj, czy backlog odzwierciedla wartość, nie tylko pomysły."
    ],
    qualityGate: [
      "Eksperyment ma hipotezę, metodę i termin oceny.",
      "Feedback trafia do decyzji o backlogu.",
      "Użycie AI ma właściciela i jasny zakres."
    ],
    reviewQuestions: [
      "Czego chcemy się nauczyć w najbliższym cyklu?",
      "Jak poznamy, że eksperyment się udał?",
      "Której decyzji AI ma pomóc, ale jej nie zastępować?"
    ]
  },
  closure: {
    stageId: "closure",
    comment: "Zamknięcie jest częścią zarządzania wartością. Projekt powinien zostawić po sobie odebrany rezultat, domknięte zobowiązania i wiedzę użyteczną dla kolejnych inicjatyw.",
    hints: [
      "Oddziel formalne zamknięcie od listy działań po projekcie.",
      "Lessons learned zamień w rekomendacje, właścicieli i zmiany procesu.",
      "Upewnij się, że ryzyka rezydualne mają właściciela po projekcie."
    ],
    qualityGate: [
      "Rezultaty są odebrane albo wyjątki są jawne.",
      "Finanse i zobowiązania są domknięte.",
      "Lessons learned mają praktyczne rekomendacje."
    ],
    reviewQuestions: [
      "Czy sponsor formalnie akceptuje rezultat?",
      "Co zostaje po projekcie i kto to przejmuje?",
      "Jaką jedną praktykę poprawimy następnym razem?"
    ]
  }
};
