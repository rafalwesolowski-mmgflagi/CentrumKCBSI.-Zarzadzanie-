import type { Project, Task } from "./types";
import type { PMGuideProfessionalNote, PMGuideStage } from "./pmGuide";

interface GeneratePMDocumentInput {
  outline: string;
  project: Project | null;
  stages: PMGuideStage[];
  notes: Record<string, PMGuideProfessionalNote>;
  tasks?: Task[];
  workspace?: PMStageWorkspaceState;
}

export interface PMStageWorkspaceEntry {
  methodology: string;
  notes: string;
  evidence: string;
  reviewAnswers: string;
  confidence: number;
  updatedAt?: string;
}

export type PMStageWorkspaceState = Record<string, PMStageWorkspaceEntry>;

interface OutlineInsights {
  title: string;
  goal: string;
  sponsor: string;
  audience: string;
  deadline: string;
  budget: string;
  constraints: string[];
  risks: string[];
  deliverables: string[];
  rawBullets: string[];
}

export function generatePMDocument({ outline, project, stages, notes, workspace = {} }: GeneratePMDocumentInput) {
  const insights = extractOutlineInsights(outline, project);
  const createdAt = new Date().toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return [
    `# ${insights.title}`,
    "",
    `Data przygotowania: ${createdAt}`,
    `Projekt w Centrum: ${project?.name ?? "Nie wybrano projektu"}`,
    "",
    "## 1. Executive Summary",
    "",
    `Cel: ${insights.goal}`,
    `Odbiorcy / interesariusze: ${insights.audience}`,
    `Sponsor / właściciel decyzji: ${insights.sponsor}`,
    `Termin docelowy: ${insights.deadline}`,
    `Budżet / ograniczenie finansowe: ${insights.budget}`,
    "",
    "## 2. Dane wejściowe z konspektu",
    "",
    outline.trim()
      ? insights.rawBullets.map((line) => `- ${line}`).join("\n")
      : "- Brak konspektu. Dokument został przygotowany jako profesjonalny szablon do uzupełnienia.",
    "",
    "## 3. Zakres i produkty",
    "",
    renderList(insights.deliverables, "Produkty nie zostały jawnie wskazane w konspekcie. Przyjmij listę rezultatów do doprecyzowania z zespołem."),
    "",
    "## 4. Ograniczenia i założenia",
    "",
    renderList(insights.constraints, "Ograniczenia wymagają doprecyzowania: czas, koszt, zasoby, jakość, ryzyko i zależności."),
    "",
    "## 5. Rejestr ryzyk startowych",
    "",
    renderRiskTable(insights.risks),
    "",
    "## 6. Plan procesu PM",
    "",
    ...stages.flatMap((stage) => renderStage(stage, notes[stage.id])),
    "",
    "## 7. Uzupełnienia praktyczne PM",
    "",
    renderWorkspaceSummary(stages, workspace),
    "",
    "## 8. Plan komunikacji",
    "",
    "| Odbiorca | Informacja | Rytm | Kanał | Cel |",
    "| --- | --- | --- | --- | --- |",
    `| ${insights.sponsor} | Status, ryzyka, decyzje | Tygodniowo | Mail / spotkanie | Sterowanie projektem |`,
    `| Zespół | Priorytety, blokady, zadania | 2-3 razy w tygodniu | Tablica / spotkanie | Przepływ pracy |`,
    `| ${insights.audience} | Postęp i odbiory | Po milestone'ach | Demo / przegląd | Feedback i akceptacja |`,
    "",
    "## 9. Definition of Done dla dokumentu",
    "",
    "- Sponsor i decydenci są nazwani.",
    "- Zakres, produkty i kryteria odbioru są jasne.",
    "- Ryzyka mają właścicieli i reakcje.",
    "- Plan zawiera rytm kontroli oraz komunikacji.",
    "- Zadania wynikające z dokumentu zostały przeniesione do narzędzia pracy.",
    "",
    "## 10. Następne kroki",
    "",
    "- Przejrzeć dokument ze sponsorem i zespołem.",
    "- Zamienić otwarte punkty w zadania w Centrum.",
    "- Ustalić pierwszy punkt kontrolny i właściciela aktualizacji dokumentu.",
    ""
  ].join("\n");
}

export function generatePMObsidianPack({ outline, project, stages, notes, tasks = [], workspace = {} }: GeneratePMDocumentInput) {
  const insights = extractOutlineInsights(outline, project);
  const title = insights.title;
  const projectTasks = project ? tasks.filter((task) => task.project_id === project.id) : tasks.slice(0, 20);
  const openTasks = projectTasks.filter((task) => task.status !== "done");
  const riskTasks = openTasks.filter((task) => task.risk_status === "risk" || task.risk_status === "blocked" || task.priority === "critical");
  const createdAt = new Date().toISOString().slice(0, 10);

  return [
    "---",
    `title: ${escapeYaml(title)}`,
    "type: pm-vault-pack",
    "source: Centrum PM Guide",
    `created: ${createdAt}`,
    `project: ${escapeYaml(project?.name ?? "Nie wybrano projektu")}`,
    "tags:",
    "  - pm",
    "  - project-management",
    "  - obsidian",
    "---",
    "",
    `# ${title} - PM Vault Pack`,
    "",
    "> Ten plik jest gotowy do Obsidiana. Zawiera komplet bazowych artefaktów PM, wikilinki, tabele oraz diagramy Mermaid.",
    "",
    "## MOC - mapa notatek",
    "",
    "- [[Project Charter]]",
    "- [[WBS i zakres]]",
    "- [[Roadmapa i milestone'y]]",
    "- [[Rejestr ryzyk]]",
    "- [[Stakeholder map]]",
    "- [[RACI]]",
    "- [[Decision log]]",
    "- [[PM practice log]]",
    "- [[Plan komunikacji]]",
    "- [[Change control]]",
    "- [[Quality plan]]",
    "- [[Finance tracker]]",
    "- [[Lessons learned]]",
    "",
    "## Project Charter",
    "",
    `Cel: ${insights.goal}`,
    `Sponsor: ${insights.sponsor}`,
    `Interesariusze: ${insights.audience}`,
    `Termin: ${insights.deadline}`,
    `Budżet: ${insights.budget}`,
    "",
    "### Problem / potrzeba",
    "",
    outline.trim() ? renderList(insights.rawBullets.slice(0, 8), "Brak danych.") : "- Do uzupełnienia na podstawie rozmowy startowej.",
    "",
    "### Kryteria sukcesu",
    "",
    "- Wartość biznesowa jest potwierdzona przez sponsora.",
    "- Produkty mają właścicieli i kryteria odbioru.",
    "- Ryzyka krytyczne mają reakcje i daty przeglądu.",
    "",
    "## WBS i zakres",
    "",
    renderList(insights.deliverables, "Zakres wymaga doprecyzowania z zespołem i sponsorem."),
    "",
    "```mermaid",
    "mindmap",
    `  root(("${escapeMermaid(title)}"))`,
    "    Inicjacja",
    "      Business case",
    "      Sponsor",
    "      Kryteria sukcesu",
    "    Planowanie",
    "      Produkty",
    "      Milestone'y",
    "      Odpowiedzialności",
    "    Realizacja",
    "      Kanban",
    "      Status",
    "      Blokady",
    "    Kontrola",
    "      Ryzyka",
    "      Decyzje",
    "      Raporty",
    "    Zamknięcie",
    "      Odbiór",
    "      Rozliczenie",
    "      Lessons learned",
    "```",
    "",
    "## Roadmapa i milestone'y",
    "",
    "```mermaid",
    "gantt",
    `    title ${escapeMermaid(title)} - roadmapa robocza`,
    "    dateFormat  YYYY-MM-DD",
    "    section Start",
    `    Project brief           :a1, ${createdAt}, 7d`,
    "    section Plan",
    `    Plan etapów i WBS       :a2, after a1, 10d`,
    "    section Realizacja",
    `    Iteracje / dostawy      :a3, after a2, 30d`,
    "    section Zamknięcie",
    `    Odbiór i lessons learned :a4, after a3, 7d`,
    "```",
    "",
    "## Rejestr ryzyk",
    "",
    renderRiskTable([...insights.risks, ...riskTasks.map((task) => task.name)].slice(0, 10)),
    "",
    "```mermaid",
    "quadrantChart",
    "    title Mapa ryzyk",
    "    x-axis Niski wpływ --> Wysoki wpływ",
    "    y-axis Niskie prawdopodobieństwo --> Wysokie prawdopodobieństwo",
    "    quadrant-1 Monitoruj",
    "    quadrant-2 Eskaluj",
    "    quadrant-3 Akceptuj",
    "    quadrant-4 Planuj reakcję",
    ...renderRiskQuadrantPoints([...insights.risks, ...riskTasks.map((task) => task.name)]),
    "```",
    "",
    "## Stakeholder map",
    "",
    "| Interesariusz | Wpływ | Zainteresowanie | Strategia |",
    "| --- | --- | --- | --- |",
    `| ${insights.sponsor} | Wysoki | Wysokie | Zarządzać blisko |`,
    `| ${insights.audience} | Średni | Wysokie | Konsultować i zbierać feedback |`,
    "| Zespół projektowy | Średni | Wysokie | Synchronizacja operacyjna |",
    "",
    "```mermaid",
    "quadrantChart",
    "    title Mapa interesariuszy",
    "    x-axis Niski wpływ --> Wysoki wpływ",
    "    y-axis Niskie zainteresowanie --> Wysokie zainteresowanie",
    "    quadrant-1 Keep satisfied",
    "    quadrant-2 Manage closely",
    "    quadrant-3 Monitor",
    "    quadrant-4 Keep informed",
    `    Sponsor: [0.86, 0.82]`,
    `    Użytkownicy: [0.48, 0.78]`,
    `    Zespół: [0.62, 0.72]`,
    "```",
    "",
    "## RACI",
    "",
    "| Obszar | Responsible | Accountable | Consulted | Informed |",
    "| --- | --- | --- | --- | --- |",
    `| Uzasadnienie biznesowe | PM | ${insights.sponsor} | Interesariusze | Zespół |`,
    `| Zakres i WBS | PM / zespół | ${insights.sponsor} | Użytkownicy | Interesariusze |`,
    "| Realizacja | Zespół | PM | Sponsor | Interesariusze |",
    "| Ryzyka i zmiany | PM | Sponsor | Zespół | Interesariusze |",
    "| Odbiór | Właściciel produktu | Sponsor | PM / zespół | Interesariusze |",
    "",
    "## Graf zależności",
    "",
    "```mermaid",
    "flowchart LR",
    "    A[Project brief] --> B[WBS i plan etapów]",
    "    B --> C[Backlog / zadania]",
    "    C --> D[Realizacja]",
    "    D --> E[Kontrola jakości]",
    "    E --> F[Odbiór]",
    "    C --> G[Rejestr ryzyk]",
    "    G --> H[Decyzje sponsora]",
    "    H --> B",
    "```",
    "",
    "## Decision log",
    "",
    "| Data | Decyzja | Właściciel | Konsekwencja | Status |",
    "| --- | --- | --- | --- | --- |",
    `| ${createdAt} | Zatwierdzić założenia startowe | ${insights.sponsor} | Start planowania | Otwarte |`,
    "",
    "## PM practice log",
    "",
    renderWorkspaceSummary(stages, workspace),
    "",
    "## Plan komunikacji",
    "",
    "| Rytm | Uczestnicy | Agenda | Artefakt |",
    "| --- | --- | --- | --- |",
    "| Daily / sync | Zespół | Blokady, focus, decyzje | Kanban / Tasks |",
    "| Weekly status | PM + sponsor | Postęp, ryzyka, decyzje | Status report |",
    "| Review milestone | Sponsor + użytkownicy | Odbiór i feedback | Demo / protokół odbioru |",
    "",
    "## Change control",
    "",
    "- Każda zmiana ma opis potrzeby, wpływ na zakres/czas/koszt/jakość i rekomendację PM.",
    "- Zmiany przekraczające tolerancje trafiają do sponsora.",
    "- Decyzje o zmianach zapisuj w [[Decision log]].",
    "",
    "## Quality plan",
    "",
    "- Definition of Done dla każdego produktu.",
    "- Przegląd jakości przed milestone'em.",
    "- Odbiór przez wskazanego właściciela biznesowego.",
    "",
    "## Finance tracker",
    "",
    "| Pozycja | Kwota | Status | Uwagi |",
    "| --- | ---: | --- | --- |",
    `| Budżet bazowy | ${insights.budget} | Do potwierdzenia | Zgodnie z project charter |`,
    "| Koszty rzeczywiste | Do uzupełnienia | Otwarte | Aktualizować cyklicznie |",
    "| Rezerwa ryzyka | Do uzupełnienia | Otwarte | Ustalić ze sponsorem |",
    "",
    "## Lessons learned",
    "",
    "| Obszar | Co zadziałało | Co poprawić | Decyzja na przyszłość |",
    "| --- | --- | --- | --- |",
    "| Proces | Do uzupełnienia | Do uzupełnienia | Do uzupełnienia |",
    "| Komunikacja | Do uzupełnienia | Do uzupełnienia | Do uzupełnienia |",
    "| Ryzyka | Do uzupełnienia | Do uzupełnienia | Do uzupełnienia |",
    "",
    "## Checklisty PM Guide",
    "",
    ...stages.flatMap((stage) => renderObsidianStageChecklist(stage, notes[stage.id])),
    ""
  ].join("\n");
}

export function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildPMDocumentFileName(projectName: string | null) {
  const baseName = projectName?.trim() || "pm-guide";
  const safeName = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "pm-guide";
  return `${safeName}-pm-plan.md`;
}

export function buildObsidianPackFileName(projectName: string | null) {
  return buildPMDocumentFileName(projectName).replace("-pm-plan.md", "-obsidian-pm-pack.md");
}

function extractOutlineInsights(outline: string, project: Project | null): OutlineInsights {
  const lines = outline
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\d.\s]+/, "").trim())
    .filter(Boolean);
  const text = outline.trim();

  return {
    title: findValue(text, ["tytuł", "nazwa", "projekt"]) || project?.name || "Dokument projektowy PM",
    goal: findValue(text, ["cel", "goal", "objective"]) || project?.goal || "Do potwierdzenia: oczekiwana wartość i rezultat projektu.",
    sponsor: findValue(text, ["sponsor", "właściciel", "owner", "decydent"]) || "Do wskazania",
    audience: findValue(text, ["odbiorcy", "interesariusze", "stakeholders", "użytkownicy"]) || "Sponsor, zespół projektowy, użytkownicy końcowi",
    deadline: findValue(text, ["termin", "deadline", "data"]) || "Do ustalenia",
    budget: findValue(text, ["budżet", "budget", "koszt"]) || formatProjectBudget(project),
    constraints: findTaggedLines(lines, ["ograniczenie", "constraint", "założenie", "assumption"]),
    risks: findTaggedLines(lines, ["ryzyko", "risk", "blokada", "problem"]),
    deliverables: findTaggedLines(lines, ["produkt", "rezultat", "deliverable", "zakres"]),
    rawBullets: lines.length ? lines : text ? [text] : []
  };
}

function renderStage(stage: PMGuideStage, note?: PMGuideProfessionalNote) {
  return [
    `### ${stage.order}. ${stage.title}`,
    "",
    `Cel etapu: ${stage.objective}`,
    `Artefakt: ${stage.artifact}`,
    "",
    "Co przygotować:",
    ...stage.checklist.map((item) => `- ${item.label} ${item.taskNotes}`),
    "",
    note ? `Komentarz PM: ${note.comment}` : "",
    "",
    note ? "Kryteria jakości:" : "",
    ...(note?.qualityGate.map((item) => `- ${item}`) ?? []),
    "",
    "Powiązanie metodyczne:",
    `- PRINCE2: ${stage.methods.prince2}`,
    `- PMBoK: ${stage.methods.pmbok}`,
    `- Agile: ${stage.methods.agile}`,
    `- IPMA: ${stage.methods.ipma}`,
    ""
  ].filter((line) => line !== "").concat([""]);
}

function renderRiskTable(risks: string[]) {
  const rows = risks.length
    ? risks.map((risk) => `| ${risk} | Do oceny | Do wskazania | Opracować reakcję i termin przeglądu |`)
    : ["| Brak jawnych ryzyk w konspekcie | Średni | PM | Przeprowadzić warsztat ryzyk |"];
  return [
    "| Ryzyko | Wpływ | Właściciel | Reakcja |",
    "| --- | --- | --- | --- |",
    ...rows
  ].join("\n");
}

function renderList(items: string[], emptyText: string) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${emptyText}`;
}

function renderWorkspaceSummary(stages: PMGuideStage[], workspace: PMStageWorkspaceState) {
  const rows = stages
    .map((stage) => ({ stage, entry: workspace[stage.id] }))
    .filter(({ entry }) => entry && (entry.notes.trim() || entry.evidence.trim() || entry.reviewAnswers.trim()));

  if (!rows.length) {
    return "- Brak uzupełnień praktycznych. W PM Guide uzupełnij sekcję praktyki dla etapów procesu.";
  }

  return rows.flatMap(({ stage, entry }) => entry ? [
    `### ${stage.order}. ${stage.title}`,
    "",
    `Metodyka w praktyce: ${formatMethodology(entry.methodology)}`,
    `Pewność / jakość wykonania: ${entry.confidence}/5`,
    entry.notes.trim() ? `\nNotatki PM:\n${entry.notes.trim()}` : "",
    entry.evidence.trim() ? `\nDowody / artefakty:\n${entry.evidence.trim()}` : "",
    entry.reviewAnswers.trim() ? `\nOdpowiedzi kontrolne:\n${entry.reviewAnswers.trim()}` : "",
    ""
  ] : []).join("\n");
}

function formatMethodology(methodology: string) {
  const labels: Record<string, string> = {
    hybrid: "Hybrydowa: PRINCE2/PMBoK governance + Agile delivery",
    prince2: "PRINCE2",
    pmbok: "PMBoK",
    agile: "Agile",
    ipma: "IPMA"
  };
  return labels[methodology] ?? methodology;
}

function renderObsidianStageChecklist(stage: PMGuideStage, note?: PMGuideProfessionalNote) {
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
  const source = risks.length ? risks : ["Brak danych wejściowych", "Niepotwierdzony zakres", "Brak właściciela decyzji"];
  return source.slice(0, 6).map((risk, index) => {
    const x = (0.42 + (index % 3) * 0.18).toFixed(2);
    const y = (0.48 + Math.floor(index / 3) * 0.22).toFixed(2);
    return `    ${escapeMermaid(risk).slice(0, 42)}: [${x}, ${y}]`;
  });
}

function findValue(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:\\-–]\\s*(.+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) return match[1].split(/\r?\n/)[0].trim();
  }
  return "";
}

function findTaggedLines(lines: string[], labels: string[]) {
  const result = lines.filter((line) => labels.some((label) => line.toLowerCase().includes(label)));
  return Array.from(new Set(result)).slice(0, 8);
}

function formatProjectBudget(project: Project | null) {
  if (!project?.budget) return "Do ustalenia";
  return `${project.budget.toLocaleString("pl-PL")} ${project.currency}`;
}

function escapeYaml(value: string) {
  return `"${value.replace(/"/g, "'")}"`;
}

function escapeMermaid(value: string) {
  return value.replace(/["[\]{}()|]/g, "").replace(/:/g, "-").trim() || "Element";
}
