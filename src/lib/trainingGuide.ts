import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  Columns3,
  FileQuestion,
  FileText,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Megaphone,
  MessageSquare,
  NotebookText,
  Presentation,
  Sparkles,
  Target,
  Users,
  Video
} from "lucide-react";

export interface TrainingChecklistItem {
  id: string;
  label: string;
  taskTitle: string;
  taskNotes: string;
}

export interface TrainingToolAction {
  label: string;
  to: string;
  icon: ComponentType<LucideProps>;
  description: string;
}

export interface TrainingStage {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  focus: string;
  objective: string;
  learn: string;
  nextStep: string;
  artifact: string;
  checklist: TrainingChecklistItem[];
  mistakes: string[];
  methods: {
    addie: string;
    backwardDesign: string;
    agileLearning: string;
    kirkpatrick: string;
  };
  tools: TrainingToolAction[];
}

export interface TrainingProfessionalNote {
  stageId: string;
  comment: string;
  hints: string[];
  qualityGate: string[];
  reviewQuestions: string[];
}

export const trainingStages: TrainingStage[] = [
  {
    id: "needs",
    order: 1,
    title: "Diagnoza potrzeby szkoleniowej",
    shortTitle: "Diagnoza",
    focus: "Ustal, jaki problem szkolenie ma rozwiązać i dla kogo.",
    objective: "Oddzielić realną potrzebę rozwojową od ogólnego pomysłu na kurs.",
    learn: "Profesjonalne szkolenie zaczyna się od zmiany zachowania albo wyniku, nie od listy slajdów. Najpierw nazwij odbiorców, lukę kompetencyjną, kontekst pracy i miernik sukcesu.",
    nextStep: "Opisz grupę docelową, aktualny poziom, problem biznesowy, oczekiwany rezultat i ograniczenia logistyczne.",
    artifact: "Training brief / diagnoza potrzeby",
    checklist: [
      {
        id: "audience",
        label: "Opisz grupę docelową, poziom wejściowy i kontekst pracy.",
        taskTitle: "Opisać grupę docelową szkolenia",
        taskNotes: "Zbierz role, poziom wiedzy, motywacje, ograniczenia i sytuacje, w których uczestnicy użyją nowych umiejętności."
      },
      {
        id: "business-need",
        label: "Nazwij problem, który szkolenie ma rozwiązać.",
        taskTitle: "Zdefiniować problem szkoleniowy",
        taskNotes: "Opisz, co dziś nie działa, jaki jest koszt tej luki i jak zmieni się praca po szkoleniu."
      },
      {
        id: "success-metric",
        label: "Ustal mierniki sukcesu i źródła danych.",
        taskTitle: "Ustalić mierniki sukcesu szkolenia",
        taskNotes: "Wybierz wskaźniki: frekwencja, ukończenie, wynik quizu, zadanie praktyczne, feedback albo zmiana zachowania w pracy."
      }
    ],
    mistakes: ["Projektowanie programu bez znajomości odbiorcy.", "Mylenie tematu z potrzebą.", "Brak miernika sukcesu poza ankietą satysfakcji."],
    methods: {
      addie: "Analysis: potrzeba, odbiorca, kontekst i ograniczenia.",
      backwardDesign: "Start od pożądanego rezultatu i dowodów uczenia się.",
      agileLearning: "Hipoteza wartości i szybki test z reprezentantem odbiorców.",
      kirkpatrick: "Poziom 3-4: zachowanie i wynik jako źródło sensu szkolenia."
    },
    tools: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard, description: "Połącz szkolenie z celem projektu." },
      { label: "Notes", to: "/notes", icon: NotebookText, description: "Zapisz brief i wywiady." },
      { label: "CRM", to: "/crm", icon: Users, description: "Ustal sponsorów i uczestników." }
    ]
  },
  {
    id: "outcomes",
    order: 2,
    title: "Efekty uczenia i kryteria zaliczenia",
    shortTitle: "Efekty",
    focus: "Zamień temat szkolenia w mierzalne umiejętności.",
    objective: "Określić, co uczestnik będzie potrafił zrobić po szkoleniu i jak to sprawdzisz.",
    learn: "Efekt uczenia powinien opisywać działanie uczestnika, nie intencję trenera. Dobre efekty używają czasowników: analizuje, projektuje, rozwiązuje, prezentuje, wdraża.",
    nextStep: "Wypisz 3-6 efektów uczenia i dopisz do każdego dowód: quiz, case, zadanie, demonstracja albo projekt końcowy.",
    artifact: "Learning outcomes / rubryka oceny",
    checklist: [
      {
        id: "outcome-list",
        label: "Zapisz mierzalne efekty uczenia.",
        taskTitle: "Zdefiniować efekty uczenia",
        taskNotes: "Przygotuj listę efektów w formacie: po szkoleniu uczestnik potrafi..."
      },
      {
        id: "assessment-map",
        label: "Dopasuj sposób sprawdzenia do każdego efektu.",
        taskTitle: "Dopasować ocenę do efektów uczenia",
        taskNotes: "Określ, czy efekt sprawdzisz quizem, ćwiczeniem, zadaniem praktycznym, projektem lub obserwacją."
      },
      {
        id: "completion-rule",
        label: "Ustal kryteria ukończenia i minimalny poziom jakości.",
        taskTitle: "Ustalić kryteria ukończenia szkolenia",
        taskNotes: "Zapisz próg zaliczenia, wymagane aktywności, zasady poprawy i ewentualny certyfikat."
      }
    ],
    mistakes: ["Cele typu 'uczestnik pozna'.", "Quiz sprawdzający pamięć zamiast umiejętności.", "Brak kryteriów dla zadania praktycznego."],
    methods: {
      addie: "Design: efekty, ocena i struktura doświadczenia.",
      backwardDesign: "Najpierw rezultat, potem dowody, dopiero później treść.",
      agileLearning: "Efekty jako backlog kompetencji do walidacji.",
      kirkpatrick: "Poziom 2: wiedza i umiejętności mierzone zadaniem."
    },
    tools: [
      { label: "Tasks", to: "/tasks", icon: ListTodo, description: "Zamień efekty w zadania projektowe." },
      { label: "Notes", to: "/notes", icon: FileText, description: "Rozpisz rubrykę i kryteria." },
      { label: "Mind Map", to: "/mind-map", icon: ListChecks, description: "Połącz efekty z modułami." }
    ]
  },
  {
    id: "curriculum",
    order: 3,
    title: "Program, moduły i ścieżka uczestnika",
    shortTitle: "Program",
    focus: "Ułóż treści w ścieżkę, która prowadzi od problemu do praktyki.",
    objective: "Zbudować logiczny program z modułami, czasem, aktywnościami i przerwami.",
    learn: "Program online musi pilnować energii uczestnika. Krótkie moduły, częste ćwiczenia i jasne przejścia działają lepiej niż długie bloki wykładowe.",
    nextStep: "Rozbij szkolenie na moduły: cel modułu, czas, kluczowa treść, aktywność, materiał i sprawdzenie.",
    artifact: "Syllabus / mapa modułów / agenda",
    checklist: [
      {
        id: "module-map",
        label: "Rozbij szkolenie na moduły i lekcje.",
        taskTitle: "Przygotować mapę modułów szkolenia",
        taskNotes: "Ustal kolejność modułów, czas trwania, cel każdego modułu i zależności między tematami."
      },
      {
        id: "participant-journey",
        label: "Zaprojektuj ścieżkę uczestnika od startu do wdrożenia.",
        taskTitle: "Opisać ścieżkę uczestnika",
        taskNotes: "Uwzględnij onboarding, prework, sesje, ćwiczenia, follow-up i transfer do pracy."
      },
      {
        id: "timebox",
        label: "Sprawdź proporcję teorii, praktyki, dyskusji i przerw.",
        taskTitle: "Zweryfikować rytm szkolenia online",
        taskNotes: "Oceń, czy program nie przeciąża uczestników i czy co kilkanaście minut pojawia się aktywność."
      }
    ],
    mistakes: ["Agenda jako spis tematów bez aktywności.", "Za długie bloki bez interakcji.", "Brak czasu na pytania i refleksję."],
    methods: {
      addie: "Design i Development: struktura, materiały i aktywności.",
      backwardDesign: "Każdy moduł prowadzi do efektu i dowodu uczenia się.",
      agileLearning: "Najpierw minimalny program, potem iteracja po feedbacku.",
      kirkpatrick: "Poziom 1-2: doświadczenie i opanowanie efektów."
    },
    tools: [
      { label: "Gantt", to: "/gantt", icon: BarChart3, description: "Zaplanuj produkcję modułów." },
      { label: "Kanban", to: "/kanban", icon: Columns3, description: "Prowadź prace nad materiałami." },
      { label: "Weekly", to: "/weekly", icon: CalendarClock, description: "Ułóż rytm przygotowań." }
    ]
  },
  {
    id: "lesson-design",
    order: 4,
    title: "Scenariusz lekcji i aktywności",
    shortTitle: "Scenariusz",
    focus: "Przygotuj przebieg zajęć minuta po minucie.",
    objective: "Zamienić program w scenariusz prowadzącego z instrukcjami, pytaniami i ćwiczeniami.",
    learn: "Dobry scenariusz mówi nie tylko co pokazać, ale co uczestnik robi. Każda aktywność powinna mieć instrukcję, czas, oczekiwany rezultat i sposób omówienia.",
    nextStep: "Dla jednej lekcji rozpisz segmenty: hook, demo, ćwiczenie, feedback, podsumowanie i zadanie wdrożeniowe.",
    artifact: "Facilitator guide / lesson plan",
    checklist: [
      {
        id: "session-flow",
        label: "Rozpisz flow lekcji: start, bloki, ćwiczenia, podsumowanie.",
        taskTitle: "Przygotować scenariusz lekcji",
        taskNotes: "Opisz przebieg zajęć, czas segmentów, instrukcje dla trenera i przejścia między aktywnościami."
      },
      {
        id: "exercises",
        label: "Dodaj ćwiczenia, case studies i pytania do dyskusji.",
        taskTitle: "Zaprojektować ćwiczenia szkoleniowe",
        taskNotes: "Przygotuj instrukcje, materiały, oczekiwany output i sposób omówienia wyników."
      },
      {
        id: "backup-plan",
        label: "Przygotuj wariant skrócony i plan awaryjny.",
        taskTitle: "Przygotować plan awaryjny lekcji",
        taskNotes: "Zapisz, co skrócić, co pominąć, co zrobić przy problemach technicznych albo niskiej aktywności."
      }
    ],
    mistakes: ["Slajdy zamiast scenariusza prowadzenia.", "Ćwiczenia bez instrukcji i kryteriów.", "Brak planu na opóźnienie albo ciszę grupy."],
    methods: {
      addie: "Development: scenariusz, aktywności i materiały trenera.",
      backwardDesign: "Aktywności zbierają dowody dla efektów uczenia.",
      agileLearning: "Prototyp lekcji testowany na małej grupie.",
      kirkpatrick: "Poziom 1-2: zaangażowanie i praktyczne opanowanie."
    },
    tools: [
      { label: "Notes", to: "/notes", icon: NotebookText, description: "Pisz scenariusz prowadzącego." },
      { label: "Tasks", to: "/tasks", icon: ClipboardCheck, description: "Dodaj materiały i próby." },
      { label: "Mind Map", to: "/mind-map", icon: MessageSquare, description: "Zobacz przepływ aktywności." }
    ]
  },
  {
    id: "materials",
    order: 5,
    title: "Materiały, quizy i zadania",
    shortTitle: "Materiały",
    focus: "Przygotuj materiały, które pomagają działać po szkoleniu.",
    objective: "Dostarczyć slajdy, checklisty, workbooki, quizy i zadania praktyczne.",
    learn: "Materiały online powinny być lekkie, użyteczne i gotowe do powrotu po szkoleniu. Najcenniejsze są checklisty, szablony i przykłady, które uczestnik może zastosować w pracy.",
    nextStep: "Zrób listę materiałów: slajdy, workbook, template, quiz, zadanie, certyfikat, mail follow-up.",
    artifact: "Material pack / quiz / workbook",
    checklist: [
      {
        id: "slide-outline",
        label: "Przygotuj strukturę slajdów z jasnymi punktami decyzyjnymi.",
        taskTitle: "Przygotować strukturę slajdów",
        taskNotes: "Ustal cel każdego slajdu: wyjaśnienie, przykład, instrukcja, ćwiczenie albo podsumowanie."
      },
      {
        id: "workbook",
        label: "Dodaj worksheet albo checklistę do praktycznego użycia.",
        taskTitle: "Przygotować workbook szkoleniowy",
        taskNotes: "Zaprojektuj pola do uzupełniania, checklisty, przykłady i miejsce na decyzje uczestnika."
      },
      {
        id: "quiz",
        label: "Zaprojektuj quiz lub zadanie praktyczne z feedbackiem.",
        taskTitle: "Przygotować quiz lub zadanie praktyczne",
        taskNotes: "Wybierz pytania, odpowiedzi, wyjaśnienia i kryteria zaliczenia."
      }
    ],
    mistakes: ["Za dużo tekstu na slajdach.", "Materiały bez zastosowania po szkoleniu.", "Quiz bez informacji zwrotnej."],
    methods: {
      addie: "Development: tworzenie zasobów i narzędzi oceny.",
      backwardDesign: "Materiały wspierają dowody uczenia, nie ozdabiają kursu.",
      agileLearning: "Najpierw materiał minimalny, potem poprawki po pilotażu.",
      kirkpatrick: "Poziom 2: sprawdzenie wiedzy i umiejętności."
    },
    tools: [
      { label: "Notes", to: "/notes", icon: FileText, description: "Trzymaj treść materiałów." },
      { label: "Tasks", to: "/tasks", icon: ListTodo, description: "Rozbij produkcję materiałów." },
      { label: "Business", to: "/business-designer", icon: Sparkles, description: "Dopasuj wartość szkolenia." }
    ]
  },
  {
    id: "production",
    order: 6,
    title: "Produkcja online i technologia",
    shortTitle: "Produkcja",
    focus: "Upewnij się, że technologia nie przeszkodzi w uczeniu.",
    objective: "Przygotować platformę, nagranie, audio, światło, dostępność i próby techniczne.",
    learn: "Online wybacza mniej chaosu niż sala. Audio, instrukcje, linki, uprawnienia i backup muszą być przetestowane przed startem.",
    nextStep: "Zrób checklistę techniczną: platforma, linki, role, nagranie, mikrofon, kamera, materiały, backup.",
    artifact: "Production checklist / runbook techniczny",
    checklist: [
      {
        id: "platform",
        label: "Wybierz platformę i ustaw dostęp, nagrywanie oraz pokoje.",
        taskTitle: "Skonfigurować platformę szkoleniową",
        taskNotes: "Sprawdź linki, uprawnienia, nagranie, breakout rooms, ankiety, czat i dostęp dla uczestników."
      },
      {
        id: "av-check",
        label: "Przetestuj audio, kamerę, światło i udostępnianie ekranu.",
        taskTitle: "Wykonać próbę audio-wideo",
        taskNotes: "Zrób próbę techniczną, zapisz ustawienia i przygotuj zapasowy mikrofon lub alternatywny plan."
      },
      {
        id: "accessibility",
        label: "Sprawdź dostępność materiałów i instrukcji.",
        taskTitle: "Sprawdzić dostępność szkolenia online",
        taskNotes: "Zweryfikuj kontrast, czytelność, napisy lub transkrypcję, format plików i instrukcje dla uczestników."
      }
    ],
    mistakes: ["Test techniczny dopiero w dniu szkolenia.", "Brak backupu linków i materiałów.", "Materiały nieczytelne na małym ekranie."],
    methods: {
      addie: "Implementation: uruchomienie środowiska i dostarczenie szkolenia.",
      backwardDesign: "Technologia służy efektom uczenia, nie odwrotnie.",
      agileLearning: "Próba techniczna jako szybki test ryzyka.",
      kirkpatrick: "Poziom 1: doświadczenie uczestnika bez tarcia technicznego."
    },
    tools: [
      { label: "Tasks", to: "/tasks", icon: Video, description: "Dodaj próby i checklistę techniczną." },
      { label: "Today", to: "/today", icon: CalendarClock, description: "Pilnuj zadań na dzień szkolenia." },
      { label: "Notes", to: "/notes", icon: NotebookText, description: "Zapisz runbook prowadzenia." }
    ]
  },
  {
    id: "launch",
    order: 7,
    title: "Promocja, onboarding i komunikacja",
    shortTitle: "Launch",
    focus: "Doprowadź właściwych ludzi do szkolenia z jasnym oczekiwaniem.",
    objective: "Przygotować opis szkolenia, komunikację startową, przypomnienia i prework.",
    learn: "Nawet świetny kurs traci wartość, jeśli uczestnik nie wie, po co przychodzi i jak się przygotować. Onboarding ustawia motywację oraz poziom bezpieczeństwa.",
    nextStep: "Przygotuj opis szkolenia, mail startowy, wymagania, prework, przypomnienie i wiadomość po szkoleniu.",
    artifact: "Launch pack / opis szkolenia / maile",
    checklist: [
      {
        id: "course-description",
        label: "Napisz opis szkolenia językiem korzyści i efektów.",
        taskTitle: "Przygotować opis szkolenia",
        taskNotes: "Opisz dla kogo jest szkolenie, czego uczestnik się nauczy, jak wygląda format i co trzeba przygotować."
      },
      {
        id: "onboarding-mail",
        label: "Przygotuj mail startowy i przypomnienia.",
        taskTitle: "Przygotować komunikację do uczestników",
        taskNotes: "Napisz mail z celem, linkami, preworkiem, agendą, zasadami i osobą kontaktową."
      },
      {
        id: "sponsor-alignment",
        label: "Uzgodnij ze sponsorem oczekiwania i follow-up po szkoleniu.",
        taskTitle: "Uzgodnić launch szkolenia ze sponsorem",
        taskNotes: "Potwierdź grupę, termin, sposób komunikacji, mierniki i działania po szkoleniu."
      }
    ],
    mistakes: ["Opis szkolenia jako lista tematów.", "Brak preworku i oczekiwań.", "Sponsor nie wzmacnia transferu do pracy."],
    methods: {
      addie: "Implementation: komunikacja, dostęp i uruchomienie.",
      backwardDesign: "Komunikacja zapowiada efekty oraz dowody pracy uczestnika.",
      agileLearning: "Launch jako eksperyment komunikacyjny z pomiarem reakcji.",
      kirkpatrick: "Poziom 1 i 3: motywacja oraz przygotowanie do wdrożenia."
    },
    tools: [
      { label: "Social Plan", to: "/social-plan", icon: Megaphone, description: "Zaplanuj promocję." },
      { label: "CRM", to: "/crm", icon: Users, description: "Pilnuj grup i follow-upów." },
      { label: "Notes", to: "/notes", icon: MessageSquare, description: "Trzymaj copy maili." }
    ]
  },
  {
    id: "evaluation",
    order: 8,
    title: "Ewaluacja i ciągłe ulepszanie",
    shortTitle: "Ewaluacja",
    focus: "Sprawdź, czy szkolenie działa, i popraw kolejną edycję.",
    objective: "Zebrać dane z ankiet, quizów, zadań i obserwacji wdrożenia.",
    learn: "Ankieta po szkoleniu mówi tylko część prawdy. Profesjonalna ewaluacja łączy reakcję uczestnika, wynik nauki, zastosowanie w pracy i wpływ na cel.",
    nextStep: "Zaprojektuj ankietę, quiz, kryteria zadania i plan follow-up po 2-4 tygodniach.",
    artifact: "Evaluation report / improvement backlog",
    checklist: [
      {
        id: "survey",
        label: "Przygotuj ankietę z pytaniami o wartość, jasność i transfer.",
        taskTitle: "Przygotować ankietę ewaluacyjną",
        taskNotes: "Dodaj pytania o przydatność, tempo, materiały, pewność zastosowania i bariery wdrożenia."
      },
      {
        id: "learning-data",
        label: "Zbierz dane z quizów, zadań i aktywności.",
        taskTitle: "Zebrać dane o efektach uczenia",
        taskNotes: "Porównaj wyniki quizu, jakość zadań, ukończenie modułów i najczęstsze błędy."
      },
      {
        id: "improvement-backlog",
        label: "Zamień feedback w backlog poprawek.",
        taskTitle: "Przygotować backlog ulepszeń szkolenia",
        taskNotes: "Spisz poprawki programu, materiałów, komunikacji, technologii i ćwiczeń przed kolejną edycją."
      }
    ],
    mistakes: ["Ocena tylko przez NPS.", "Feedback bez decyzji o poprawkach.", "Brak follow-upu po wdrożeniu w pracy."],
    methods: {
      addie: "Evaluation: pomiar, wnioski i poprawki.",
      backwardDesign: "Ewaluacja sprawdza dowody zaprojektowane na początku.",
      agileLearning: "Backlog ulepszeń i iteracje kolejnych edycji.",
      kirkpatrick: "Poziomy 1-4: reakcja, nauka, zachowanie i rezultat."
    },
    tools: [
      { label: "Dashboard", to: "/", icon: BarChart3, description: "Zobacz wpływ na projekt." },
      { label: "Tasks", to: "/tasks", icon: ListTodo, description: "Dodaj poprawki kolejnej edycji." },
      { label: "Notes", to: "/notes", icon: FileQuestion, description: "Zapisz feedback i wnioski." }
    ]
  }
];

export const trainingOverview = [
  { label: "Proces", value: `${trainingStages.length} etapów`, icon: BookOpenCheck },
  { label: "Artefakty", value: "Syllabus / quiz / runbook", icon: Presentation },
  { label: "Metodyka", value: "ADDIE / Backward", icon: Target },
  { label: "Ewaluacja", value: "Kirkpatrick", icon: ClipboardCheck }
];

export const trainingProfessionalNotes: Record<string, TrainingProfessionalNote> = {
  needs: {
    stageId: "needs",
    comment: "Na tym etapie nie projektuj jeszcze slajdów. Profesjonalny instructional designer najpierw sprawdza, czy szkolenie jest właściwym rozwiązaniem i jaka zmiana ma nastąpić po stronie uczestnika.",
    hints: [
      "Poproś sponsora o przykład sytuacji, w której uczestnik ma działać inaczej.",
      "Zapisz, co uczestnicy już wiedzą, bo to chroni przed zbyt podstawowym kursem.",
      "Jeżeli problemem jest proces albo narzędzie, samo szkolenie może nie wystarczyć."
    ],
    qualityGate: [
      "Grupa docelowa i poziom wejściowy są jasne.",
      "Problem szkoleniowy jest opisany jako luka zachowania lub wyniku.",
      "Sukces ma miernik i właściciela."
    ],
    reviewQuestions: [
      "Czy szkolenie rozwiązuje właściwy problem?",
      "Co uczestnik ma robić inaczej po szkoleniu?",
      "Skąd będziemy wiedzieć, że szkolenie zadziałało?"
    ]
  },
  outcomes: {
    stageId: "outcomes",
    comment: "Efekty uczenia są kontraktem jakości. Jeśli nie da się ich sprawdzić, program zwykle rozmywa się w treści zamiast prowadzić do praktyki.",
    hints: [
      "Używaj czasowników działania: przygotuje, oceni, wdroży, rozwiąże.",
      "Dla każdego efektu zaplanuj konkretny dowód.",
      "Nie dawaj więcej efektów niż realnie da się przećwiczyć."
    ],
    qualityGate: [
      "Efekty są mierzalne i napisane z perspektywy uczestnika.",
      "Każdy efekt ma sposób oceny.",
      "Kryteria zaliczenia są zrozumiałe."
    ],
    reviewQuestions: [
      "Czy efekt opisuje zachowanie, a nie temat?",
      "Jak uczestnik pokaże, że to potrafi?",
      "Czy kryteria oceny są uczciwe dla poziomu grupy?"
    ]
  },
  curriculum: {
    stageId: "curriculum",
    comment: "Program online powinien mieć rytm. Uczestnik musi rozumieć, gdzie jest, po co wykonuje ćwiczenie i jak moduł łączy się z jego pracą.",
    hints: [
      "Buduj moduły wokół pytań i decyzji uczestnika.",
      "Co 10-15 minut dodaj mikrozadanie, pytanie albo refleksję.",
      "Zaplanuj follow-up, bo wdrożenie dzieje się po szkoleniu."
    ],
    qualityGate: [
      "Moduły prowadzą do efektów uczenia.",
      "Czas i energia uczestnika są realnie zaplanowane.",
      "Program zawiera praktykę, feedback i transfer."
    ],
    reviewQuestions: [
      "Czy kolejność modułów jest logiczna dla początkującego?",
      "Gdzie uczestnik ćwiczy, a nie tylko słucha?",
      "Co musi się wydarzyć po szkoleniu?"
    ]
  },
  "lesson-design": {
    stageId: "lesson-design",
    comment: "Scenariusz prowadzenia jest miejscem, gdzie szkolenie staje się doświadczeniem. Bez niego trener improwizuje, a jakość zależy od dnia i energii grupy.",
    hints: [
      "Każde ćwiczenie opisz przez instrukcję, czas, output i omówienie.",
      "Zaplanuj pytania otwierające dyskusję, nie tylko treść do powiedzenia.",
      "Przygotuj wariant krótszy, jeśli grupa będzie wolniejsza."
    ],
    qualityGate: [
      "Lekcja ma flow i timeboxy.",
      "Aktywności mają instrukcje i kryteria.",
      "Istnieje plan awaryjny."
    ],
    reviewQuestions: [
      "Co uczestnik robi w każdej części lekcji?",
      "Jak trener pozna, że grupa nadąża?",
      "Co skracamy, jeśli zabraknie czasu?"
    ]
  },
  materials: {
    stageId: "materials",
    comment: "Materiały są przedłużeniem szkolenia w pracy uczestnika. Warto projektować je tak, aby po tygodniu nadal pomagały podjąć decyzję albo wykonać zadanie.",
    hints: [
      "Slajd powinien wspierać prowadzenie, a workbook działanie uczestnika.",
      "Do quizu dodaj wyjaśnienia, nie tylko poprawne odpowiedzi.",
      "Każdy template przetestuj na przykładowym case."
    ],
    qualityGate: [
      "Materiały są czytelne online.",
      "Workbook prowadzi do zastosowania w pracy.",
      "Quiz lub zadanie daje informację zwrotną."
    ],
    reviewQuestions: [
      "Czy uczestnik użyje materiału po szkoleniu?",
      "Który materiał jest krytyczny, a który tylko dodatkiem?",
      "Czy zadanie sprawdza realną umiejętność?"
    ]
  },
  production: {
    stageId: "production",
    comment: "Technologia powinna zniknąć z pierwszego planu. Jeśli uczestnik walczy z linkiem, dźwiękiem albo instrukcją, jego uwaga nie jest już na nauce.",
    hints: [
      "Testuj dokładnie na tej samej platformie i ustawieniach.",
      "Przygotuj checklistę prowadzącego oraz osobę wsparcia, jeśli grupa jest duża.",
      "Wyślij materiały i linki wcześniej, nie w ostatniej minucie."
    ],
    qualityGate: [
      "Platforma i linki są przetestowane.",
      "Audio-wideo oraz udostępnianie ekranu działają.",
      "Jest plan awaryjny i dostępne materiały."
    ],
    reviewQuestions: [
      "Co może zepsuć doświadczenie uczestnika?",
      "Czy trener wie, co robić przy awarii?",
      "Czy materiały są dostępne na różnych urządzeniach?"
    ]
  },
  launch: {
    stageId: "launch",
    comment: "Komunikacja przed szkoleniem ustawia oczekiwania. Dobrze napisany opis i mail startowy zwiększają frekwencję, przygotowanie i jakość pracy w trakcie.",
    hints: [
      "Opis szkolenia pisz przez efekty, a nie przez agendę.",
      "W mailu startowym jasno powiedz, co przygotować.",
      "Poproś sponsora o krótkie wzmocnienie sensu szkolenia."
    ],
    qualityGate: [
      "Uczestnik wie, dla kogo jest szkolenie i co z niego wyniesie.",
      "Linki, terminy i wymagania są jasne.",
      "Sponsor i prowadzący mają wspólne oczekiwania."
    ],
    reviewQuestions: [
      "Czy uczestnik wie, dlaczego warto przyjść?",
      "Czy prework jest krótki i wykonalny?",
      "Jak przypomnimy o transferze po szkoleniu?"
    ]
  },
  evaluation: {
    stageId: "evaluation",
    comment: "Ewaluacja jest paliwem kolejnej edycji. Najlepsze szkolenia online dojrzewają przez iteracje: dane, feedback, decyzja, poprawka.",
    hints: [
      "Oddziel opinię o trenerze od informacji o zastosowaniu wiedzy.",
      "Analizuj błędy w quizach i zadaniach jako wskazówki do poprawy programu.",
      "Po 2-4 tygodniach zapytaj o wdrożenie w pracy."
    ],
    qualityGate: [
      "Ankieta mierzy wartość, jasność i transfer.",
      "Dane z quizów lub zadań są przeanalizowane.",
      "Feedback jest zamieniony w backlog poprawek."
    ],
    reviewQuestions: [
      "Co poprawimy przed kolejną edycją?",
      "Czy uczestnicy potrafią zastosować materiał w pracy?",
      "Który element szkolenia ma największy wpływ na rezultat?"
    ]
  }
};
