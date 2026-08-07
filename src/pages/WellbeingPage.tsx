import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, BookOpen, CheckCircle2, ClipboardCheck, FileText, HeartHandshake, Pencil, Plus, Sparkles, Target, Trash2, X } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import type { WellbeingChallengeStatus, WellbeingGoalHorizon, WellbeingGoalStatus } from "../lib/types";
import { affirmationSeeds, wellbeingAssessmentQuestions, wellbeingCourseNotes, wellbeingPractices } from "../lib/wellbeingEbook";

type WellbeingTab = "journal" | "goals" | "test" | "practices" | "learn";

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyGoal = {
  title: "",
  horizon: "short_term" as WellbeingGoalHorizon,
  status: "active" as WellbeingGoalStatus,
  description: "",
  successCriteria: "",
  targetDate: "",
  tagsText: "",
  projectId: ""
};

const emptyReflection = {
  entryDate: todayIso(),
  goalId: "",
  projectId: "",
  mood: 3,
  energy: 3,
  gratitude: "",
  wins: "",
  challenge: "",
  lesson: "",
  nextStep: "",
  tagsText: ""
};

const emptyDiaryEntry = {
  entryDate: todayIso(),
  body: ""
};

export function WellbeingPage({ context }: { context: AppContextValue }) {
  const [activeTab, setActiveTab] = useState<WellbeingTab>("journal");
  const [goalDraft, setGoalDraft] = useState(emptyGoal);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [reflectionDraft, setReflectionDraft] = useState(emptyReflection);
  const [practiceKey, setPracticeKey] = useState(wellbeingPractices[0]?.key ?? "gratitude");
  const [practiceDate, setPracticeDate] = useState(todayIso());
  const [practiceNote, setPracticeNote] = useState("");
  const [practiceValue, setPracticeValue] = useState(10);
  const [dailyCommitmentText, setDailyCommitmentText] = useState("");
  const [dailyCommitmentNote, setDailyCommitmentNote] = useState("");
  const [dailyCommitmentCompleted, setDailyCommitmentCompleted] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState(emptyDiaryEntry);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>(() => Object.fromEntries(wellbeingAssessmentQuestions.map((question) => [question.id, 3])));
  const [assessmentSummary, setAssessmentSummary] = useState("");
  const [affirmationText, setAffirmationText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedPractice = wellbeingPractices.find((practice) => practice.key === practiceKey) ?? wellbeingPractices[0];
  const activePracticeChallenge = context.wellbeingRewirementChallenges.find((challenge) => challenge.practice_key === practiceKey && challenge.status === "active");
  const practiceLogs = activePracticeChallenge
    ? context.wellbeingRewirementLogs.filter((log) => log.challenge_id === activePracticeChallenge.id)
    : [];
  const practiceDone = practiceLogs.filter((log) => log.completed).length;
  const shortGoals = context.wellbeingGoals.filter((goal) => goal.horizon === "short_term" && goal.status !== "archived");
  const longGoals = context.wellbeingGoals.filter((goal) => goal.horizon === "long_term" && goal.status !== "archived");
  const goalById = useMemo(() => new Map(context.wellbeingGoals.map((goal) => [goal.id, goal])), [context.wellbeingGoals]);
  const projectById = useMemo(() => new Map(context.projects.map((project) => [project.id, project])), [context.projects]);
  const assessmentScore = Math.round((Object.values(assessmentAnswers).reduce((sum, value) => sum + value, 0) / (wellbeingAssessmentQuestions.length * 5)) * 100);
  const activeAffirmations = context.wellbeingAffirmations.filter((affirmation) => affirmation.is_active);
  const dailyAffirmation = activeAffirmations[0]?.text ?? affirmationSeeds[new Date().getDate() % affirmationSeeds.length];
  const todaysCommitment = context.wellbeingDailyCommitments.find((commitment) => commitment.commitment_date === todayIso());
  const declaredCommitments = context.wellbeingDailyCommitments.length;
  const completedCommitments = context.wellbeingDailyCommitments.filter((commitment) => commitment.completed).length;
  const commitmentFollowThrough = declaredCommitments ? Math.round((completedCommitments / declaredCommitments) * 100) : 0;

  useEffect(() => {
    setDailyCommitmentText(todaysCommitment?.title ?? "");
    setDailyCommitmentNote(todaysCommitment?.note ?? "");
    setDailyCommitmentCompleted(todaysCommitment?.completed ?? false);
  }, [todaysCommitment?.completed, todaysCommitment?.id, todaysCommitment?.note, todaysCommitment?.title, todaysCommitment?.updated_at]);

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    if (!goalDraft.title.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const input = {
        title: goalDraft.title,
        horizon: goalDraft.horizon,
        status: goalDraft.status,
        description: goalDraft.description,
        successCriteria: goalDraft.successCriteria,
        targetDate: goalDraft.targetDate,
        tags: parseTags(goalDraft.tagsText),
        projectId: goalDraft.projectId || null
      };
      if (editingGoalId) {
        await context.updateWellbeingGoal(editingGoalId, input);
      } else {
        await context.createWellbeingGoal(input);
      }
      setGoalDraft(emptyGoal);
      setEditingGoalId(null);
      setMessage(editingGoalId ? "Cel dobrostanowy zaktualizowany." : "Cel dobrostanowy zapisany.");
    } catch (error) {
      setMessage(errorMessage(error, editingGoalId ? "Nie udało się zaktualizować celu." : "Nie udało się zapisać celu."));
    } finally {
      setSaving(false);
    }
  }

  function startGoalEdit(goal: AppContextValue["wellbeingGoals"][number]) {
    setActiveTab("goals");
    setEditingGoalId(goal.id);
    setGoalDraft({
      title: goal.title,
      horizon: goal.horizon,
      status: goal.status,
      description: goal.description ?? "",
      successCriteria: goal.success_criteria ?? "",
      targetDate: goal.target_date ?? "",
      tagsText: goal.tags.join(", "),
      projectId: goal.project_id ?? ""
    });
  }

  function cancelGoalEdit() {
    setEditingGoalId(null);
    setGoalDraft(emptyGoal);
  }

  async function moveGoal(goal: AppContextValue["wellbeingGoals"][number]) {
    const nextHorizon: WellbeingGoalHorizon = goal.horizon === "short_term" ? "long_term" : "short_term";
    setSaving(true);
    setMessage(null);
    try {
      await context.updateWellbeingGoal(goal.id, {
        title: goal.title,
        horizon: nextHorizon,
        status: goal.status,
        description: goal.description ?? "",
        successCriteria: goal.success_criteria ?? "",
        targetDate: goal.target_date ?? "",
        tags: goal.tags,
        projectId: goal.project_id
      });
      setMessage(nextHorizon === "short_term" ? "Cel przeniesiony do krótkoterminowych." : "Cel przeniesiony do długoterminowych.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się przenieść celu."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleGoalDone(goal: AppContextValue["wellbeingGoals"][number]) {
    const nextStatus: WellbeingGoalStatus = goal.status === "done" ? "active" : "done";
    setSaving(true);
    setMessage(null);
    try {
      await context.updateWellbeingGoal(goal.id, {
        title: goal.title,
        horizon: goal.horizon,
        status: nextStatus,
        description: goal.description ?? "",
        successCriteria: goal.success_criteria ?? "",
        targetDate: goal.target_date ?? "",
        tags: goal.tags,
        projectId: goal.project_id
      });
      setMessage(nextStatus === "done" ? "Cel oznaczony jako zrealizowany." : "Cel przywrócony jako aktywny.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się zmienić statusu celu."));
    } finally {
      setSaving(false);
    }
  }

  async function createReflection(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await context.createWellbeingReflection({
        entryDate: reflectionDraft.entryDate,
        goalId: reflectionDraft.goalId || null,
        projectId: reflectionDraft.projectId || null,
        mood: reflectionDraft.mood,
        energy: reflectionDraft.energy,
        gratitude: reflectionDraft.gratitude,
        wins: reflectionDraft.wins,
        challenge: reflectionDraft.challenge,
        lesson: reflectionDraft.lesson,
        nextStep: reflectionDraft.nextStep,
        tags: parseTags(reflectionDraft.tagsText)
      });
      setReflectionDraft({ ...emptyReflection, entryDate: todayIso() });
      setMessage("Refleksja zapisana w dzienniku.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się zapisać refleksji."));
    } finally {
      setSaving(false);
    }
  }

  async function startPracticeChallenge() {
    if (!selectedPractice) return;
    setSaving(true);
    setMessage(null);
    try {
      const startDate = todayIso();
      const end = new Date(`${startDate}T00:00:00`);
      end.setDate(end.getDate() + 27);
      await context.createRewirementChallenge({
        practiceKey: selectedPractice.key,
        title: selectedPractice.title,
        description: selectedPractice.description,
        startDate,
        endDate: end.toISOString().slice(0, 10),
        status: "active" as WellbeingChallengeStatus
      });
      setMessage("Uruchomiono 4-tygodniową praktykę.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się uruchomić praktyki."));
    } finally {
      setSaving(false);
    }
  }

  async function logPractice() {
    if (!activePracticeChallenge) {
      setMessage("Najpierw uruchom praktykę dla wybranego rewirement.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await context.logRewirementDay({
        challengeId: activePracticeChallenge.id,
        logDate: practiceDate,
        completed: true,
        note: practiceNote,
        value: practiceValue
      });
      setPracticeNote("");
      setMessage("Check-in praktyki zapisany.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się zapisać check-ina."));
    } finally {
      setSaving(false);
    }
  }

  async function saveDailyCommitment(completed = dailyCommitmentCompleted) {
    setSaving(true);
    setMessage(null);
    try {
      await context.saveWellbeingDailyCommitment({
        commitmentDate: todayIso(),
        title: dailyCommitmentText,
        completed,
        note: dailyCommitmentNote
      });
      setDailyCommitmentCompleted(completed);
      setMessage(completed ? "Jedna rzecz na dziś oznaczona jako wykonana." : "Deklaracja na dziś zapisana.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się zapisać deklaracji."));
    } finally {
      setSaving(false);
    }
  }

  async function createDiaryEntry(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await context.createWellbeingDiaryEntry({
        entryDate: diaryDraft.entryDate,
        body: diaryDraft.body
      });
      setDiaryDraft({ ...emptyDiaryEntry, entryDate: todayIso() });
      setMessage("Wpis w pamiętniku zapisany.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się zapisać wpisu w pamiętniku."));
    } finally {
      setSaving(false);
    }
  }

  async function saveAssessment(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await context.saveWellbeingAssessment({
        answers: assessmentAnswers,
        summary: assessmentSummary
      });
      setAssessmentSummary("");
      setMessage(`Test zapisany. Wynik: ${assessmentScore}/100.`);
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się zapisać testu."));
    } finally {
      setSaving(false);
    }
  }

  async function saveAffirmation(text = affirmationText, source: "manual" | "reflection" | "assessment" | "ebook" = "manual", reflectionId: string | null = null) {
    const cleanText = text.trim();
    if (!cleanText) return;
    setSaving(true);
    setMessage(null);
    try {
      await context.createWellbeingAffirmation({ text: cleanText, source, reflectionId });
      setAffirmationText("");
      setMessage("Afirmacja zapisana.");
    } catch (error) {
      setMessage(errorMessage(error, "Nie udało się zapisać afirmacji."));
    } finally {
      setSaving(false);
    }
  }

  function buildAffirmationFromReflection() {
    const lastReflection = context.wellbeingReflections[0];
    if (!lastReflection) {
      setAffirmationText(affirmationSeeds[0]);
      return;
    }
    const basis = lastReflection.wins || lastReflection.lesson || lastReflection.gratitude || "robię małe kroki";
    setAffirmationText(`Widzę dowody postępu: ${basis}. Mogę wracać do praktyki spokojnie i konsekwentnie.`);
  }

  return (
    <div className="page wellbeing-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dobrostan</span>
          <h1>Dziennik, cele i praktyki</h1>
          <p className="page-subtitle">Praktyki dobrostanu i osobisty system refleksji.</p>
        </div>
        <div className="header-summary">{context.wellbeingGoals.length} celów · {context.wellbeingReflections.length} refleksji</div>
      </header>

      <div className="wellbeing-tabs" role="tablist" aria-label="Sekcje dobrostanu">
        <TabButton id="journal" active={activeTab} onClick={setActiveTab} icon={<FileText size={16} />} label="Dziennik" />
        <TabButton id="goals" active={activeTab} onClick={setActiveTab} icon={<Target size={16} />} label="Cele" />
        <TabButton id="test" active={activeTab} onClick={setActiveTab} icon={<ClipboardCheck size={16} />} label="Test" />
        <TabButton id="practices" active={activeTab} onClick={setActiveTab} icon={<HeartHandshake size={16} />} label="Praktyki" />
        <TabButton id="learn" active={activeTab} onClick={setActiveTab} icon={<Sparkles size={16} />} label="Nauka" />
      </div>

      {message && <div className="warning-box">{message}</div>}

      {activeTab === "journal" && (
        <section className="wellbeing-layout">
          <section className="panel wellbeing-form wellbeing-daily-panel">
            <div className="panel-header">
              <h2><CheckCircle2 size={18} />Jedna rzecz na dziś</h2>
              <span>{completedCommitments}/{declaredCommitments} · {commitmentFollowThrough}%</span>
            </div>
            <div className="wellbeing-daily-grid">
              <div className="wellbeing-daily-main">
                <label>
                  <span>Deklaracja</span>
                  <input value={dailyCommitmentText} onChange={(event) => setDailyCommitmentText(event.target.value)} placeholder="Jedna konkretna rzecz, którą dziś zrobię" />
                </label>
                <textarea value={dailyCommitmentNote} onChange={(event) => setDailyCommitmentNote(event.target.value)} placeholder="Krótka notatka po wykonaniu albo przeszkoda" />
              </div>
              <div className="wellbeing-daily-side">
                <strong>{todaysCommitment ? (dailyCommitmentCompleted ? "Dziś domknięte" : "Dziś zadeklarowane") : "Jeszcze bez deklaracji"}</strong>
                <p>{declaredCommitments ? `Po deklaracji realizujesz ${commitmentFollowThrough}% wpisów z ostatnich ${declaredCommitments} dni.` : "Zacznij od jednej małej, sprawdzalnej rzeczy."}</p>
                <label className="wellbeing-checkbox">
                  <input type="checkbox" checked={dailyCommitmentCompleted} onChange={(event) => setDailyCommitmentCompleted(event.target.checked)} />
                  Wykonane
                </label>
                <div className="wellbeing-actions">
                  <button className="primary-button" type="button" onClick={() => void saveDailyCommitment(dailyCommitmentCompleted)} disabled={saving || !dailyCommitmentText.trim()}>
                    <ClipboardCheck size={16} />Zapisz
                  </button>
                  <button className="secondary-button" type="button" onClick={() => void saveDailyCommitment(true)} disabled={saving || !dailyCommitmentText.trim()}>
                    <CheckCircle2 size={16} />Zrobione
                  </button>
                </div>
              </div>
            </div>
            <div className="wellbeing-commitment-history">
              {context.wellbeingDailyCommitments.slice(0, 7).map((commitment) => (
                <div className={commitment.completed ? "done" : ""} key={commitment.id}>
                  <span>{commitment.commitment_date}</span>
                  <strong>{commitment.title}</strong>
                  <small>{commitment.completed ? "wykonane" : "zadeklarowane"}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="panel wellbeing-form wellbeing-diary-panel">
            <div className="panel-header">
              <h2><BookOpen size={18} />Pamiętnik</h2>
              <span>{context.wellbeingDiaryEntries.length} wpisów</span>
            </div>
            <form className="wellbeing-diary-form" onSubmit={createDiaryEntry}>
              <label>
                <span>Data</span>
                <input type="date" value={diaryDraft.entryDate} onChange={(event) => setDiaryDraft((current) => ({ ...current, entryDate: event.target.value }))} />
              </label>
              <textarea value={diaryDraft.body} onChange={(event) => setDiaryDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Krótka informacja z dnia: co się wydarzyło, co warto zapamiętać?" />
              <button className="primary-button" disabled={saving || !diaryDraft.body.trim()}><Plus size={16} />Dodaj wpis</button>
            </form>
            <div className="wellbeing-diary-list">
              {context.wellbeingDiaryEntries.slice(0, 8).map((entry) => (
                <article className="wellbeing-card" key={entry.id}>
                  <div className="wellbeing-card-header">
                    <strong>{entry.entry_date}</strong>
                    <button className="icon-button danger-action" type="button" onClick={() => void context.deleteWellbeingDiaryEntry(entry.id)} aria-label="Usuń wpis z pamiętnika"><Trash2 size={16} /></button>
                  </div>
                  <p>{entry.body}</p>
                </article>
              ))}
              {!context.wellbeingDiaryEntries.length && <div className="empty-state">Brak wpisów. Dodaj pierwszą krótką informację z dnia.</div>}
            </div>
          </section>

          <form className="panel wellbeing-form" onSubmit={createReflection}>
            <div className="panel-header">
              <h2><FileText size={18} />Nowa refleksja</h2>
              <span>{reflectionDraft.entryDate}</span>
            </div>
            <div className="wellbeing-form-grid">
              <label>
                <span>Data</span>
                <input type="date" value={reflectionDraft.entryDate} onChange={(event) => setReflectionDraft((current) => ({ ...current, entryDate: event.target.value }))} />
              </label>
              <label>
                <span>Cel</span>
                <select value={reflectionDraft.goalId} onChange={(event) => setReflectionDraft((current) => ({ ...current, goalId: event.target.value }))}>
                  <option value="">Bez celu</option>
                  {context.wellbeingGoals.map((goal) => <option value={goal.id} key={goal.id}>{goal.title}</option>)}
                </select>
              </label>
              <label>
                <span>Projekt</span>
                <select value={reflectionDraft.projectId} onChange={(event) => setReflectionDraft((current) => ({ ...current, projectId: event.target.value }))}>
                  <option value="">Bez projektu</option>
                  {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                </select>
              </label>
              <Rating label="Nastrój" value={reflectionDraft.mood} onChange={(mood) => setReflectionDraft((current) => ({ ...current, mood }))} />
              <Rating label="Energia" value={reflectionDraft.energy} onChange={(energy) => setReflectionDraft((current) => ({ ...current, energy }))} />
            </div>
            <textarea value={reflectionDraft.gratitude} onChange={(event) => setReflectionDraft((current) => ({ ...current, gratitude: event.target.value }))} placeholder="Wdzięczność: co dziś było dobre?" />
            <textarea value={reflectionDraft.wins} onChange={(event) => setReflectionDraft((current) => ({ ...current, wins: event.target.value }))} placeholder="Wygrane: co udało się domknąć albo zauważyć?" />
            <textarea value={reflectionDraft.challenge} onChange={(event) => setReflectionDraft((current) => ({ ...current, challenge: event.target.value }))} placeholder="Trudność: co było napięciem?" />
            <textarea value={reflectionDraft.lesson} onChange={(event) => setReflectionDraft((current) => ({ ...current, lesson: event.target.value }))} placeholder="Lekcja dnia" />
            <textarea value={reflectionDraft.nextStep} onChange={(event) => setReflectionDraft((current) => ({ ...current, nextStep: event.target.value }))} placeholder="Następny krok" />
            <input value={reflectionDraft.tagsText} onChange={(event) => setReflectionDraft((current) => ({ ...current, tagsText: event.target.value }))} placeholder="Tagi, np. wdzięczność, sen, relacje" />
            <button className="primary-button" disabled={saving}><Plus size={16} />Zapisz refleksję</button>
          </form>

          <section className="panel">
            <div className="panel-header">
              <h2>Ostatnie wpisy</h2>
              <span>{context.wellbeingReflections.length}</span>
            </div>
            <div className="wellbeing-list">
              {context.wellbeingReflections.slice(0, 12).map((reflection) => (
                <article className="wellbeing-card" key={reflection.id}>
                  <div className="wellbeing-card-header">
                    <strong>{reflection.entry_date}</strong>
                    <span>Nastrój {reflection.mood ?? "-"} · Energia {reflection.energy ?? "-"}</span>
                  </div>
                  {reflection.goal_id && <span className="tag-pill">Cel: {goalById.get(reflection.goal_id)?.title ?? "odpięty"}</span>}
                  {reflection.gratitude && <p><strong>Wdzięczność:</strong> {reflection.gratitude}</p>}
                  {reflection.lesson && <p><strong>Lekcja:</strong> {reflection.lesson}</p>}
                  {reflection.next_step && <p><strong>Następny krok:</strong> {reflection.next_step}</p>}
                  <div className="wellbeing-card-actions">
                    {reflection.tags.map((tag) => <span className="tag-pill" key={tag}>{tag}</span>)}
                    <button className="icon-button danger-action" type="button" onClick={() => void context.deleteWellbeingReflection(reflection.id)} aria-label="Usuń refleksję"><Trash2 size={16} /></button>
                  </div>
                </article>
              ))}
              {!context.wellbeingReflections.length && <div className="empty-state">Brak refleksji. Zapisz pierwszy wpis dziennika.</div>}
            </div>
          </section>
        </section>
      )}

      {activeTab === "goals" && (
        <section className="wellbeing-layout">
          <form className="panel wellbeing-form" onSubmit={saveGoal}>
            <div className="panel-header">
              <h2><Target size={18} />{editingGoalId ? "Edytuj cel" : "Nowy cel"}</h2>
              <span>{goalDraft.horizon === "short_term" ? "krótki" : "długi"}</span>
            </div>
            <input value={goalDraft.title} onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Tytuł celu" required />
            <div className="wellbeing-form-grid">
              <select value={goalDraft.horizon} onChange={(event) => setGoalDraft((current) => ({ ...current, horizon: event.target.value as WellbeingGoalHorizon }))}>
                <option value="short_term">Krótkoterminowy</option>
                <option value="long_term">Długoterminowy</option>
              </select>
              <select value={goalDraft.status} onChange={(event) => setGoalDraft((current) => ({ ...current, status: event.target.value as WellbeingGoalStatus }))}>
                <option value="active">Aktywny</option>
                <option value="paused">Wstrzymany</option>
                <option value="done">Zrobiony</option>
                <option value="archived">Archiwum</option>
              </select>
              <input type="date" value={goalDraft.targetDate} onChange={(event) => setGoalDraft((current) => ({ ...current, targetDate: event.target.value }))} />
              <select value={goalDraft.projectId} onChange={(event) => setGoalDraft((current) => ({ ...current, projectId: event.target.value }))}>
                <option value="">Bez projektu</option>
                {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
              </select>
            </div>
            <textarea value={goalDraft.description} onChange={(event) => setGoalDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Dlaczego ten cel ma znaczenie?" />
            <textarea value={goalDraft.successCriteria} onChange={(event) => setGoalDraft((current) => ({ ...current, successCriteria: event.target.value }))} placeholder="Po czym poznasz, że cel jest spełniony?" />
            <input value={goalDraft.tagsText} onChange={(event) => setGoalDraft((current) => ({ ...current, tagsText: event.target.value }))} placeholder="Tagi po przecinku" />
            <div className="wellbeing-actions">
              <button className="primary-button" disabled={saving}>
                {editingGoalId ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                {editingGoalId ? "Zapisz zmiany" : "Zapisz cel"}
              </button>
              {editingGoalId && (
                <button className="secondary-button" type="button" onClick={cancelGoalEdit} disabled={saving}>
                  <X size={16} />Anuluj
                </button>
              )}
            </div>
          </form>

          <section className="wellbeing-goals-grid">
            <GoalColumn title="Krótkoterminowe" goals={shortGoals} projectById={projectById} onToggleDone={(goal) => void toggleGoalDone(goal)} onEdit={startGoalEdit} onMove={(goal) => void moveGoal(goal)} onDelete={(id) => void context.deleteWellbeingGoal(id)} />
            <GoalColumn title="Długoterminowe" goals={longGoals} projectById={projectById} onToggleDone={(goal) => void toggleGoalDone(goal)} onEdit={startGoalEdit} onMove={(goal) => void moveGoal(goal)} onDelete={(id) => void context.deleteWellbeingGoal(id)} />
          </section>
        </section>
      )}

      {activeTab === "test" && (
        <section className="wellbeing-layout">
          <form className="panel wellbeing-form" onSubmit={saveAssessment}>
            <div className="panel-header">
              <h2><ClipboardCheck size={18} />Test dobrostanu</h2>
              <span>{assessmentScore}/100</span>
            </div>
            <div className="wellbeing-assessment-score">
              <strong>{assessmentScore}</strong>
              <span>Indeks kontroli i dobrostanu</span>
              <div className="progress-track"><span style={{ width: `${assessmentScore}%` }} /></div>
            </div>
            {wellbeingAssessmentQuestions.map((question) => (
              <label className="wellbeing-question" key={question.id}>
                <span>{question.label}</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={assessmentAnswers[question.id] ?? 3}
                  onChange={(event) => setAssessmentAnswers((current) => ({ ...current, [question.id]: Number(event.target.value) }))}
                />
                <small>{question.low} ← {assessmentAnswers[question.id] ?? 3}/5 → {question.high}</small>
              </label>
            ))}
            <textarea value={assessmentSummary} onChange={(event) => setAssessmentSummary(event.target.value)} placeholder="Wniosek z testu: co wzmacniam przez najbliższy tydzień?" />
            <button className="primary-button" disabled={saving}><CheckCircle2 size={16} />Zapisz test</button>
          </form>

          <section className="panel wellbeing-form">
            <div className="panel-header">
              <h2><Sparkles size={18} />Afirmacje</h2>
              <span>{activeAffirmations.length} aktywnych</span>
            </div>
            <div className="wellbeing-affirmation-hero">
              <span className="eyebrow">Afirmacja na dziś</span>
              <strong>{dailyAffirmation}</strong>
            </div>
            <textarea value={affirmationText} onChange={(event) => setAffirmationText(event.target.value)} placeholder="Napisz afirmację, np. Mogę działać konsekwentnie bez przemocy wobec siebie." />
            <div className="wellbeing-actions">
              <button className="primary-button" type="button" onClick={() => void saveAffirmation()} disabled={saving || !affirmationText.trim()}><Plus size={16} />Zapisz afirmację</button>
              <button className="secondary-button" type="button" onClick={buildAffirmationFromReflection}>Z refleksji</button>
              <button className="secondary-button" type="button" onClick={() => setAffirmationText(affirmationSeeds[Math.floor(Math.random() * affirmationSeeds.length)])}>Losuj</button>
            </div>
            <div className="wellbeing-list">
              {context.wellbeingAffirmations.slice(0, 10).map((affirmation) => (
                <article className={`wellbeing-card ${affirmation.is_active ? "" : "muted"}`} key={affirmation.id}>
                  <div className="wellbeing-card-header">
                    <strong>{affirmation.text}</strong>
                    <span>{affirmation.source}</span>
                  </div>
                  <div className="wellbeing-actions">
                    <button className="secondary-button" type="button" onClick={() => void context.toggleWellbeingAffirmation(affirmation.id, !affirmation.is_active)}>
                      {affirmation.is_active ? "Wyłącz" : "Włącz"}
                    </button>
                    <button className="icon-button danger-action" type="button" onClick={() => void context.deleteWellbeingAffirmation(affirmation.id)} aria-label="Usuń afirmację"><Trash2 size={16} /></button>
                  </div>
                </article>
              ))}
              {!context.wellbeingAffirmations.length && <div className="empty-state">Brak afirmacji. Zapisz pierwszą albo wygeneruj ją z refleksji.</div>}
            </div>
          </section>

          <section className="panel wellbeing-history-panel">
            <div className="panel-header">
              <h2>Historia testów</h2>
              <span>{context.wellbeingAssessments.length}</span>
            </div>
            <div className="wellbeing-assessment-history">
              {context.wellbeingAssessments.map((assessment) => (
                <div className="wellbeing-history-row" key={assessment.id}>
                  <strong>{assessment.score}/100</strong>
                  <span>{new Date(assessment.taken_at).toLocaleDateString("pl-PL")}</span>
                  {assessment.summary && <p>{assessment.summary}</p>}
                </div>
              ))}
              {!context.wellbeingAssessments.length && <div className="empty-state">Zapisz pierwszy test, żeby zobaczyć trend.</div>}
            </div>
          </section>
        </section>
      )}

      {activeTab === "practices" && (
        <section className="wellbeing-layout">
          <section className="panel wellbeing-form">
            <div className="panel-header">
              <h2><HeartHandshake size={18} />Rewirements</h2>
              <span>{activePracticeChallenge ? `${practiceDone}/28` : "wybierz"}</span>
            </div>
            <select value={practiceKey} onChange={(event) => setPracticeKey(event.target.value)}>
              {wellbeingPractices.map((practice) => <option value={practice.key} key={practice.key}>{practice.title}</option>)}
            </select>
            {selectedPractice && (
              <div className="wellbeing-practice-hero">
                <strong>{selectedPractice.title}</strong>
                <p>{selectedPractice.description}</p>
                <span>Rytuał: {selectedPractice.cue}</span>
              </div>
            )}
            <button className="secondary-button" type="button" onClick={() => void startPracticeChallenge()} disabled={saving || Boolean(activePracticeChallenge)}>
              <Sparkles size={16} />
              {activePracticeChallenge ? "Praktyka aktywna" : "Start 4 tygodnie"}
            </button>
            <div className="progress-track"><span style={{ width: `${Math.min(100, Math.round((practiceDone / 28) * 100))}%` }} /></div>
            <div className="wellbeing-form-grid">
              <input type="date" value={practiceDate} onChange={(event) => setPracticeDate(event.target.value)} />
              <Rating label="Wartość" value={practiceValue / 20} onChange={(value) => setPracticeValue(value * 20)} />
            </div>
            <textarea value={practiceNote} onChange={(event) => setPracticeNote(event.target.value)} placeholder="Krótki check-in praktyki" />
            <button className="primary-button" type="button" onClick={() => void logPractice()} disabled={saving || !activePracticeChallenge}><CheckCircle2 size={16} />Zapisz check-in</button>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Aktywne praktyki</h2>
              <span>{context.wellbeingRewirementChallenges.length}</span>
            </div>
            <div className="wellbeing-list">
              {context.wellbeingRewirementChallenges.map((challenge) => {
                const logs = context.wellbeingRewirementLogs.filter((log) => log.challenge_id === challenge.id && log.completed).length;
                return (
                  <article className="wellbeing-card" key={challenge.id}>
                    <div className="wellbeing-card-header">
                      <strong>{challenge.title}</strong>
                      <span>{challenge.status} · {logs}/28</span>
                    </div>
                    <p>{challenge.description}</p>
                    <div className="progress-track"><span style={{ width: `${Math.min(100, Math.round((logs / 28) * 100))}%` }} /></div>
                  </article>
                );
              })}
              {!context.wellbeingRewirementChallenges.length && <div className="empty-state">Uruchom pierwszą praktykę dobrostanu.</div>}
            </div>
          </section>
        </section>
      )}

      {activeTab === "learn" && (
        <div className="wellbeing-learn-stack">
          <section className="wellbeing-learn-grid">
            {wellbeingCourseNotes.map((note) => (
              <article className="panel wellbeing-learn-card" key={note.title}>
                <Sparkles size={18} />
                <strong>{note.title}</strong>
                <p>{note.body}</p>
              </article>
            ))}
            {wellbeingPractices.map((practice) => (
              <article className="panel wellbeing-learn-card" key={practice.key}>
                <HeartHandshake size={18} />
                <strong>{practice.title}</strong>
                <p>{practice.description}</p>
                <span className="muted-note">Rytuał: {practice.cue}</span>
              </article>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

function TabButton({ id, active, onClick, icon, label }: { id: WellbeingTab; active: WellbeingTab; onClick: (tab: WellbeingTab) => void; icon: JSX.Element; label: string }) {
  return (
    <button className={active === id ? "active" : ""} type="button" onClick={() => onClick(id)}>
      {icon}
      {label}
    </button>
  );
}

function Rating({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number) => void }) {
  return (
    <label>
      <span>{label}: {value ?? "-"}/5</span>
      <input type="range" min="1" max="5" value={value ?? 3} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function GoalColumn({
  title,
  goals,
  projectById,
  onToggleDone,
  onEdit,
  onMove,
  onDelete
}: {
  title: string;
  goals: AppContextValue["wellbeingGoals"];
  projectById: Map<string, AppContextValue["projects"][number]>;
  onToggleDone: (goal: AppContextValue["wellbeingGoals"][number]) => void;
  onEdit: (goal: AppContextValue["wellbeingGoals"][number]) => void;
  onMove: (goal: AppContextValue["wellbeingGoals"][number]) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span>{goals.length}</span>
      </div>
      <div className="wellbeing-list">
        {goals.map((goal) => (
          <article className={`wellbeing-card goal-${goal.status}`} key={goal.id}>
            <div className="wellbeing-card-header">
              <strong>{goal.title}</strong>
              <span>{goal.status}{goal.target_date ? ` · ${goal.target_date}` : ""}</span>
            </div>
            {goal.description && <p>{goal.description}</p>}
            {goal.success_criteria && <p><strong>Kryteria:</strong> {goal.success_criteria}</p>}
            {goal.project_id && <span className="area-pill">Projekt: {projectById.get(goal.project_id)?.name ?? "odpięty"}</span>}
            <div className="wellbeing-card-actions">
              {goal.tags.map((tag) => <span className="tag-pill" key={tag}>{tag}</span>)}
              <div className="wellbeing-goal-actions">
                <button className={`icon-button ${goal.status === "done" ? "success-action" : ""}`} type="button" onClick={() => onToggleDone(goal)} aria-label={goal.status === "done" ? "Cofnij realizację celu" : "Oznacz cel jako zrealizowany"}><CheckCircle2 size={16} /></button>
                <button className="icon-button" type="button" onClick={() => onEdit(goal)} aria-label="Edytuj cel"><Pencil size={16} /></button>
                <button className="icon-button" type="button" onClick={() => onMove(goal)} aria-label={goal.horizon === "short_term" ? "Przenieś do długoterminowych" : "Przenieś do krótkoterminowych"}><ArrowLeftRight size={16} /></button>
                <button className="icon-button danger-action" type="button" onClick={() => onDelete(goal.id)} aria-label="Usuń cel"><Trash2 size={16} /></button>
              </div>
            </div>
          </article>
        ))}
        {!goals.length && <div className="empty-state">Brak celów w tej perspektywie.</div>}
      </div>
    </section>
  );
}

function parseTags(value: string) {
  return Array.from(new Set(value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)))
    .slice(0, 12);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
}
