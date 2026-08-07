import type { Project, Task } from "./types";
import type { TrainingProfessionalNote, TrainingStage } from "./trainingGuide";
import { downloadTextFile } from "./pmDocument";

interface GenerateTrainingDocumentInput {
  outline: string;
  project: Project | null;
  stages: TrainingStage[];
  notes: Record<string, TrainingProfessionalNote>;
  tasks?: Task[];
  workspace?: TrainingWorkspaceState;
}

export interface TrainingWorkspaceEntry {
  format: string;
  notes: string;
  evidence: string;
  reviewAnswers: string;
  confidence: number;
  updatedAt?: string;
}

export type TrainingWorkspaceState = Record<string, TrainingWorkspaceEntry>;

interface TrainingInsights {
  title: string;
  audience: string;
  goal: string;
  duration: string;
  format: string;
  sponsor: string;
  outcomes: string[];
  modules: string[];
  risks: string[];
  rawBullets: string[];
}

export function generateTrainingDocument({ outline, project, stages, workspace = {} }: GenerateTrainingDocumentInput) {
  const insights = extractTrainingInsights(outline, project);
  const createdAt = new Date().toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return [
    `# ${insights.title}`,
    "",
    `Wygenerowano: ${createdAt}`,
    `Projekt: ${project?.name ?? "nie wybrano projektu"}`,
    "",
    "## 1. Executive summary",
    "",
    `Cel szkolenia: ${insights.goal}`,
    `Grupa docelowa: ${insights.audience}`,
    `Sponsor / właściciel: ${insights.sponsor}`,
    `Format: ${insights.format}`,
    `Czas trwania: ${insights.duration}`,
    "",
    "## 2. Diagnoza potrzeby",
    "",
    outline.trim()
      ? renderList(insights.rawBullets.slice(0, 10), "Brak danych wejściowych.")
      : "- Do uzupełnienia: problem, grupa, kontekst, oczekiwany rezultat i miernik sukcesu.",
    "",
    "## 3. Efekty uczenia",
    "",
    renderList(insights.outcomes, "Uczestnik potrafi zastosować materiał w praktycznej sytuacji zawodowej."),
    "",
    "## 4. Program i moduły",
    "",
    renderModuleTable(insights.modules),
    "",
    "## 5. Scenariusz prowadzącego",
    "",
    "| Segment | Czas | Aktywność | Output uczestnika |",
    "| --- | ---: | --- | --- |",
    "| Otwarcie | 5-10 min | Kontrakt, cel, agenda | Jasne oczekiwania |",
    "| Kontekst | 10-15 min | Problem, przykład, mini-demo | Wspólne rozumienie tematu |",
    "| Praktyka | 20-40 min | Ćwiczenie / case / praca indywidualna | Uzupełniony template lub decyzja |",
    "| Feedback | 10-20 min | Omówienie, pytania, korekty | Lista wniosków |",
    "| Transfer | 5-10 min | Zadanie wdrożeniowe | Pierwszy krok po szkoleniu |",
    "",
    "## 6. Materiały i ocena",
    "",
    "- Slajdy: krótkie, wspierające prowadzenie.",
    "- Workbook: pola do uzupełnienia i checklisty do użycia po szkoleniu.",
    "- Quiz: pytania z feedbackiem i wyjaśnieniami.",
    "- Zadanie praktyczne: case lub mini-projekt powiązany z efektem uczenia.",
    "- Rubryka: kryteria jakości oraz próg zaliczenia.",
    "",
    "## 7. Uzupełnienia praktyczne",
    "",
    renderWorkspaceSummary(stages, workspace),
    "",
    "## 8. Ryzyka i plan produkcyjny",
    "",
    renderRiskTable(insights.risks),
    "",
    "## 9. Komunikacja i launch",
    "",
    "| Moment | Odbiorca | Treść | Cel |",
    "| --- | --- | --- | --- |",
    "| Przed szkoleniem | Uczestnicy | Cel, agenda, link, prework | Przygotowanie |",
    "| Przed szkoleniem | Sponsor | Zakres, mierniki, oczekiwania | Alignment |",
    "| Po szkoleniu | Uczestnicy | Materiały, zadanie, ankieta | Transfer |",
    "| Po szkoleniu | Sponsor | Wyniki, feedback, rekomendacje | Decyzje o kolejnej edycji |",
    "",
    "## 10. Definition of Done",
    "",
    "- Potrzeba szkoleniowa jest opisana i potwierdzona.",
    "- Efekty uczenia mają kryteria sprawdzenia.",
    "- Program zawiera teorię, praktykę, feedback i transfer.",
    "- Materiały są gotowe do użycia online.",
    "- Technologia i komunikacja zostały przetestowane.",
    "- Ewaluacja prowadzi do backlogu ulepszeń.",
    "",
    "## 11. Następne kroki",
    "",
    "- Potwierdzić brief ze sponsorem.",
    "- Uzupełnić scenariusz pierwszej lekcji.",
    "- Przygotować materiały i quiz.",
    "- Wykonać próbę techniczną.",
    "- Zaplanować ewaluację i follow-up."
  ].join("\n");
}

export function generateTrainingObsidianPack({ outline, project, stages, notes, tasks = [], workspace = {} }: GenerateTrainingDocumentInput) {
  const insights = extractTrainingInsights(outline, project);
  const title = insights.title;
  const createdAt = new Date().toISOString().slice(0, 10);
  const projectTasks = project ? tasks.filter((task) => task.project_id === project.id) : tasks.slice(0, 20);
  const openTasks = projectTasks.filter((task) => task.status !== "done").slice(0, 12);

  return [
    "---",
    `title: ${escapeYaml(title)}`,
    "type: online-training-pack",
    "source: Centrum Training Studio",
    `created: ${createdAt}`,
    `project: ${escapeYaml(project?.name ?? "Nie wybrano projektu")}`,
    "tags:",
    "  - training",
    "  - online-learning",
    "  - instructional-design",
    "---",
    "",
    `# ${title} - Training Vault Pack`,
    "",
    "> Paczka gotowa do Obsidiana: brief, syllabus, scenariusz, quiz, runbook, ewaluacja i diagramy Mermaid.",
    "",
    "## MOC - mapa notatek",
    "",
    "- [[Training brief]]",
    "- [[Learning outcomes]]",
    "- [[Syllabus i mapa modulow]]",
    "- [[Facilitator guide]]",
    "- [[Material pack]]",
    "- [[Quiz i rubryka]]",
    "- [[Production runbook]]",
    "- [[Launch communication]]",
    "- [[Evaluation report]]",
    "- [[Improvement backlog]]",
    "",
    "## Training brief",
    "",
    `Cel: ${insights.goal}`,
    `Grupa: ${insights.audience}`,
    `Sponsor: ${insights.sponsor}`,
    `Format: ${insights.format}`,
    `Czas: ${insights.duration}`,
    "",
    "## Learning outcomes",
    "",
    renderList(insights.outcomes, "Uczestnik potrafi zastosować kluczową umiejętność w praktyce."),
    "",
    "## Syllabus i mapa modulow",
    "",
    renderModuleTable(insights.modules),
    "",
    "```mermaid",
    "flowchart TD",
    `    A[${escapeMermaid(title)}] --> B[Diagnoza potrzeby]`,
    "    B --> C[Efekty uczenia]",
    "    C --> D[Program i moduly]",
    "    D --> E[Scenariusz lekcji]",
    "    E --> F[Materialy i quiz]",
    "    F --> G[Produkcja online]",
    "    G --> H[Launch]",
    "    H --> I[Ewaluacja]",
    "    I --> J[Backlog ulepszen]",
    "```",
    "",
    "## Facilitator guide",
    "",
    "| Segment | Cel | Aktywnosc | Pytanie trenera |",
    "| --- | --- | --- | --- |",
    "| Hook | Skupic uwage | Problem / historia / mini-case | Gdzie widzicie to u siebie? |",
    "| Demo | Pokazac wzorzec | Przykład krok po kroku | Co tu jest kluczowa decyzja? |",
    "| Practice | Zbudowac umiejetnosc | Cwiczenie indywidualne lub grupowe | Co bylo najtrudniejsze? |",
    "| Debrief | Utrwalic wnioski | Omowienie wynikow | Co zastosujecie jako pierwsze? |",
    "",
    "## Quiz i rubryka",
    "",
    "| Efekt | Sposob sprawdzenia | Kryterium zaliczenia | Feedback |",
    "| --- | --- | --- | --- |",
    ...insights.outcomes.slice(0, 6).map((outcome) => `| ${outcome} | Zadanie praktyczne / quiz | Poprawne zastosowanie w case | Wyjasnienie i korekta |`),
    "",
    "## Production runbook",
    "",
    "- Link do szkolenia: do uzupełnienia.",
    "- Platforma: do uzupełnienia.",
    "- Nagranie: do potwierdzenia.",
    "- Backup: alternatywny link, pliki offline, kontakt techniczny.",
    "- Checklist: audio, kamera, ekran, czat, breakout rooms, ankiety.",
    "",
    "## Launch communication",
    "",
    "### Mail startowy",
    "",
    `Temat: ${title} - przygotowanie do szkolenia`,
    "",
    "Cześć,",
    "",
    `zapraszamy na szkolenie ${title}. Celem jest: ${insights.goal}.`,
    "Przed spotkaniem przygotuj: pytania, przykłady z pracy i dostęp do materiałów.",
    "",
    "## Evaluation report",
    "",
    "| Poziom | Pytanie | Dane | Decyzja |",
    "| --- | --- | --- | --- |",
    "| Reakcja | Czy szkolenie było wartościowe? | Ankieta | Poprawki doświadczenia |",
    "| Nauka | Czy efekty zostały osiągnięte? | Quiz / zadanie | Poprawki programu |",
    "| Zachowanie | Czy uczestnik zastosował wiedzę? | Follow-up | Wsparcie wdrożenia |",
    "| Wynik | Czy zmienił się wskaźnik biznesowy? | Dane sponsora | Kolejna edycja / skalowanie |",
    "",
    "## Risk map",
    "",
    "```mermaid",
    "quadrantChart",
    "    title Ryzyka szkolenia online",
    "    x-axis Niski wplyw --> Wysoki wplyw",
    "    y-axis Niskie prawdopodobienstwo --> Wysokie prawdopodobienstwo",
    "    quadrant-1 Monitoruj",
    "    quadrant-2 Eskaluj",
    "    quadrant-3 Akceptuj",
    "    quadrant-4 Planuj reakcje",
    ...renderRiskQuadrantPoints(insights.risks),
    "```",
    "",
    "## PM / produkcja - otwarte zadania z projektu",
    "",
    openTasks.length ? openTasks.map((task) => `- [ ] ${task.name} (${task.due_date})`).join("\n") : "- Brak otwartych zadań w wybranym projekcie.",
    "",
    "## Training practice log",
    "",
    renderWorkspaceSummary(stages, workspace),
    "",
    "## Checklisty Training Studio",
    "",
    ...stages.flatMap((stage) => renderObsidianStageChecklist(stage, notes[stage.id])),
    ""
  ].join("\n");
}

export function buildTrainingDocumentFileName(projectName: string | null) {
  const safeName = (projectName || "training-studio")
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "training-studio";
  return `${safeName}-training-plan.md`;
}

export function buildTrainingObsidianPackFileName(projectName: string | null) {
  return buildTrainingDocumentFileName(projectName).replace("-training-plan.md", "-training-obsidian-pack.md");
}

export { downloadTextFile };

function extractTrainingInsights(outline: string, project: Project | null): TrainingInsights {
  const lines = outline
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines.map((line) => line.replace(/^[-*]\s*/, ""));

  const title = findValue(outline, ["Tytuł", "Title", "Nazwa"]) || project?.name || "Szkolenie online";
  const audience = findValue(outline, ["Grupa", "Odbiorcy", "Audience", "Uczestnicy"]) || "Do ustalenia";
  const goal = findValue(outline, ["Cel", "Goal", "Rezultat"]) || project?.goal || "Rozwinąć praktyczną umiejętność uczestników";
  const duration = findValue(outline, ["Czas", "Duration", "Długość"]) || "Do ustalenia";
  const format = findValue(outline, ["Format", "Tryb", "Platforma"]) || "Online live / blended";
  const sponsor = findValue(outline, ["Sponsor", "Właściciel", "Owner"]) || "Do ustalenia";
  const outcomes = collectPrefixed(outline, ["Efekt", "Outcome", "Uczestnik potrafi"], [
    "Uczestnik potrafi wyjaśnić kluczowe pojęcia własnymi słowami.",
    "Uczestnik potrafi zastosować narzędzie na przykładzie ze swojej pracy.",
    "Uczestnik potrafi ocenić jakość wyniku i wskazać następny krok."
  ]);
  const modules = collectPrefixed(outline, ["Moduł", "Module", "Lekcja"], [
    "Start i kontekst",
    "Model / narzędzie krok po kroku",
    "Ćwiczenie praktyczne",
    "Feedback, wdrożenie i następne kroki"
  ]);
  const risks = collectPrefixed(outline, ["Ryzyko", "Risk"], [
    "Niski poziom zaangażowania uczestników",
    "Zbyt szeroki zakres względem czasu",
    "Problemy techniczne podczas sesji"
  ]);

  return { title, audience, goal, duration, format, sponsor, outcomes, modules, risks, rawBullets: bullets };
}

function renderList(items: string[], emptyText: string) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${emptyText}`;
}

function renderModuleTable(modules: string[]) {
  const source = modules.length ? modules : ["Start", "Praktyka", "Podsumowanie"];
  return [
    "| Moduł | Cel | Aktywność | Materiał |",
    "| --- | --- | --- | --- |",
    ...source.map((module, index) => `| ${index + 1}. ${module} | Efekt uczenia do potwierdzenia | Mini-demo / ćwiczenie / dyskusja | Slajdy + worksheet |`)
  ].join("\n");
}

function renderRiskTable(risks: string[]) {
  const source = risks.length ? risks : ["Brak przygotowania uczestników", "Problemy techniczne", "Za szeroki zakres"];
  return [
    "| Ryzyko | Prawdopodobieństwo | Wpływ | Reakcja |",
    "| --- | --- | --- | --- |",
    ...source.map((risk) => `| ${risk} | Średnie | Średni/Wysoki | Właściciel i reakcja do uzupełnienia |`)
  ].join("\n");
}

function renderWorkspaceSummary(stages: TrainingStage[], workspace: TrainingWorkspaceState) {
  const rows = stages
    .map((stage) => ({ stage, entry: workspace[stage.id] }))
    .filter(({ entry }) => entry && (entry.notes.trim() || entry.evidence.trim() || entry.reviewAnswers.trim()));

  if (!rows.length) {
    return "- Brak uzupełnień praktycznych. W Training Studio uzupełnij sekcję praktyki dla etapów przygotowania szkolenia.";
  }

  return rows.flatMap(({ stage, entry }) => entry ? [
    `### ${stage.order}. ${stage.title}`,
    "",
    `Format pracy: ${formatTrainingMode(entry.format)}`,
    `Pewność / jakość wykonania: ${entry.confidence}/5`,
    entry.notes.trim() ? `\nNotatki projektowe:\n${entry.notes.trim()}` : "",
    entry.evidence.trim() ? `\nDowody / materiały:\n${entry.evidence.trim()}` : "",
    entry.reviewAnswers.trim() ? `\nOdpowiedzi kontrolne:\n${entry.reviewAnswers.trim()}` : "",
    ""
  ] : []).join("\n");
}

function renderObsidianStageChecklist(stage: TrainingStage, note?: TrainingProfessionalNote) {
  return [
    `### ${stage.order}. ${stage.title}`,
    "",
    `> ${stage.focus}`,
    "",
    ...stage.checklist.map((item) => `- [ ] ${item.label}`),
    note ? "" : "",
    note ? `Komentarz: ${note.comment}` : "",
    ""
  ].filter((line) => line !== "");
}

function renderRiskQuadrantPoints(risks: string[]) {
  const source = risks.length ? risks : ["Brak przygotowania", "Problemy techniczne", "Za szeroki zakres"];
  return source.slice(0, 6).map((risk, index) => {
    const x = (0.38 + (index % 3) * 0.2).toFixed(2);
    const y = (0.46 + Math.floor(index / 3) * 0.24).toFixed(2);
    return `    ${escapeMermaid(risk).slice(0, 42)}: [${x}, ${y}]`;
  });
}

function collectPrefixed(text: string, labels: string[], fallback: string[]) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matches = lines
    .map((line) => {
      for (const label of labels) {
        const pattern = new RegExp(`^[-*]?\\s*${label}\\s*\\d*\\s*[:\\-–]\\s*(.+)$`, "i");
        const match = line.match(pattern);
        if (match?.[1]) return match[1].trim();
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
  return matches.length ? matches : fallback;
}

function findValue(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:\\-–]\\s*(.+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function formatTrainingMode(format: string) {
  const labels: Record<string, string> = {
    live: "Online live",
    async: "Asynchronicznie",
    blended: "Blended learning",
    workshop: "Warsztat praktyczny"
  };
  return labels[format] ?? format;
}

function escapeYaml(value: string) {
  return `"${value.replace(/"/g, "'")}"`;
}

function escapeMermaid(value: string) {
  return value.replace(/["[\]{}()|]/g, "").replace(/:/g, "-").trim() || "Element";
}
