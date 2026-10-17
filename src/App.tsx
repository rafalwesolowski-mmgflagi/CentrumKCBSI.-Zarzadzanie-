import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useProjectData } from "./lib/useProjectData";
import { AppShell } from "./components/AppShell";
import { CopilotPanel } from "./components/CopilotPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthPage } from "./pages/AuthPage";
import { BusinessDesignerPage } from "./pages/BusinessDesignerPage";
import { CalendarPage } from "./pages/CalendarPage";
import { CentrumGuidePage } from "./pages/CentrumGuidePage";
import { CRMPage } from "./pages/CRMPage";
import { CRMClientCardPage } from "./pages/CRMClientCardPage";
import { CRMContactsPage } from "./pages/CRMContactsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeclutteringPage } from "./pages/DeclutteringPage";
import { EmailPage } from "./pages/EmailPage";
import { ExecutionPage } from "./pages/ExecutionPage";
import { FinancePage } from "./pages/FinancePage";
import { GanttPage } from "./pages/GanttPage";
import { KanbanPage } from "./pages/KanbanPage";
import { MindMapPage } from "./pages/MindMapPage";
import { NotesPage } from "./pages/NotesPage";
import { PMGuidePage } from "./pages/PMGuidePage";
import { SocialPlannerPage } from "./pages/SocialPlannerPage";
import { TasksPage } from "./pages/TasksPage";
import { TodayPage } from "./pages/TodayPage";
import { TimeBlocksPage } from "./pages/TimeBlocksPage";
import { ToolboxPage } from "./pages/ToolboxPage";
import { TrainingStudioPage } from "./pages/TrainingStudioPage";
import { WeeklyPage } from "./pages/WeeklyPage";
import { ProjectPage } from "./pages/ProjectPage";
import { WorkloadPage } from "./pages/WorkloadPage";
import { WorkLogPage } from "./pages/WorkLogPage";
import { WellbeingPage } from "./pages/WellbeingPage";
import { MarketIntelPage } from "./pages/MarketIntelPage";

type Theme = "dark" | "light";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const data = useProjectData(session);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("centrum-theme", theme);
    } catch {
      // Theme still works for the current session if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    getInitialSession()
      .then((result) => {
        if (cancelled) return;
        setSession(result.session);
        setSessionError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSessionError(error instanceof Error ? error.message : "Nie udało się odczytać sesji.");
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
      setSessionError(null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setCopilotOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const context = useMemo(() => ({ session, ...data }), [data, session]);
  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");

  if (sessionLoading) {
    return <div className="app-loading">Ładowanie centrum projektów...</div>;
  }

  if (sessionError) {
    return (
      <div className="fatal-screen">
        <div className="fatal-card">
          <span className="eyebrow">Auth recovery</span>
          <h1>Nie mogę połączyć sesji</h1>
          <p>Sprawdź konfigurację Supabase i odśwież stronę.</p>
          <code>{sessionError}</code>
          <button className="primary-button" onClick={() => window.location.reload()}>
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell
          session={session}
          metrics={data.metrics}
          loading={data.loading}
          error={data.error}
          lastLoadedAt={data.lastLoadedAt}
          theme={theme}
          onToggleTheme={toggleTheme}
          onRefresh={() => void data.reload()}
          onOpenCopilot={() => setCopilotOpen(true)}
        >
          <Routes>
            <Route path="/" element={<DashboardPage context={context} onOpenCopilot={() => setCopilotOpen(true)} />} />
            <Route path="/today" element={<TodayPage context={context} />} />
            <Route path="/weekly" element={<WeeklyPage context={context} />} />
            <Route path="/workload" element={<WorkloadPage context={context} />} />
            <Route path="/work-log" element={<WorkLogPage />} />
            <Route path="/execution" element={<ExecutionPage />} />
            <Route path="/calendar" element={<CalendarPage context={context} />} />
            <Route path="/toolbox" element={<ToolboxPage />} />
            <Route path="/gantt" element={<GanttPage context={context} />} />
            <Route path="/mind-map" element={<MindMapPage context={context} />} />
            <Route path="/pm-guide" element={<PMGuidePage context={context} />} />
            <Route path="/training-studio" element={<TrainingStudioPage context={context} />} />
            <Route path="/business-designer" element={<BusinessDesignerPage context={context} />} />
            <Route path="/kanban" element={<KanbanPage context={context} />} />
            <Route path="/tasks" element={<TasksPage context={context} />} />
            <Route path="/notes" element={<NotesPage context={context} />} />
            <Route path="/email" element={<EmailPage />} />
            <Route path="/social-plan" element={<SocialPlannerPage />} />
            <Route path="/project/:id" element={<ProjectPage context={context} />} />
            <Route path="/crm" element={<CRMPage context={context} />} />
            <Route path="/crm/client/:id" element={<CRMClientCardPage context={context} />} />
            <Route path="/crm/contacts" element={<CRMContactsPage context={context} />} />
            <Route path="/finance" element={<FinancePage context={context} />} />
            <Route path="/time-blocks" element={<TimeBlocksPage />} />
            <Route path="/wellbeing" element={<WellbeingPage context={context} />} />
            <Route path="/oczyszczanie" element={<DeclutteringPage context={context} />} />
            <Route path="/market-intel" element={<MarketIntelPage />} />
            <Route path="/centrum-guide" element={<CentrumGuidePage context={context} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
        <CopilotPanel
          open={copilotOpen}
          context={context}
          onClose={() => setCopilotOpen(false)}
        />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  try {
    const storedTheme = window.localStorage.getItem("centrum-theme");
    if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
  } catch {
    return "dark";
  }

  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

async function getInitialSession() {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { data } = await supabase.auth.getSession();
      return data;
    } catch (error) {
      if (!isSupabaseAuthLockError(error) || attempt === maxAttempts) {
        throw error;
      }

      await wait(150 * attempt);
    }
  }

  return { session: null };
}

function isSupabaseAuthLockError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === "NavigatorLockAcquireTimeoutError" ||
    message.includes("lock:") && message.includes("auth-token") ||
    message.includes("navigatorlockacquiretimeouterror")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
