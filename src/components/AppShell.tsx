import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AlertTriangle, BarChart3, BookOpen, Bot, Briefcase, CalendarDays, CalendarRange, ChevronDown, CircleHelp, ClipboardList, Clock, Columns3, Contact, DollarSign, GitBranch, GraduationCap, HeartHandshake, LayoutDashboard, Link, ListTodo, LogOut, Mail, Megaphone, Moon, NotebookText, PackageCheck, Rocket, RotateCw, Search, Sun, TrendingUp, Users, WifiOff, Wrench, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { connectGoogleIdentity, getGoogleIntegrationStatus, type GoogleIntegrationStatus } from "../lib/googleAuth";

interface AppShellProps {
  children: ReactNode;
  session: Session;
  metrics: { activeProjects: number; progress: number; riskyTasks: number };
  loading: boolean;
  error: string | null;
  lastLoadedAt: string | null;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onRefresh: () => void;
  onOpenCopilot: () => void;
}

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  keywords?: string[];
  mobile?: boolean;
  external?: boolean;
};

const navGroups: Array<{ id: string; label: string; items: NavItem[] }> = [
  {
    id: "overview",
    label: "Centrum pracy",
    items: [
      { to: "/", label: "Start", icon: LayoutDashboard, description: "Szybki obraz portfolio, ryzyk i następnego kroku.", keywords: ["dashboard", "centrum", "portfolio"], mobile: true },
      { to: "/today", label: "Dzisiaj", icon: CalendarDays, description: "Zadania po terminie, na dziś i blokujące tydzień.", keywords: ["today", "daily", "dzień"], mobile: true },
      { to: "/calendar", label: "Kalendarz", icon: CalendarRange, description: "Agenda, wydarzenia, odnotacje i najbliższe deadline'y.", keywords: ["kalendarz", "agenda", "wydarzenia", "odnotacje"], mobile: true },
      { to: "/work-log", label: "Praca", icon: ClipboardList, description: "Rejestr czasu i dzienny raport pracy.", keywords: ["czas", "log", "timesheet"], mobile: true },
      { to: "/weekly", label: "Tydzień", icon: CalendarRange, description: "Plan tygodniowy, obciążenie i rytm przeglądu.", keywords: ["weekly", "plan tygodnia"] },
      { to: "/workload", label: "Obciążenie", icon: Users, description: "Rozkład pracy między osoby, obszary i projekty.", keywords: ["workload", "zespół"] }
    ]
  },
  {
    id: "planning",
    label: "Planowanie",
    items: [
      { to: "/execution", label: "Mission OS", icon: Rocket, description: "Od celu do sekwencji wykonania i kontraktu zmiany.", keywords: ["misja", "roadmap"] },
      { to: "/toolbox", label: "Narzędziownik", icon: Wrench, description: "Gotowe narzędzia PM, decyzji, ryzyk i analizy.", keywords: ["toolbox", "narzędzia"] },
      { to: "/gantt", label: "Gantt", icon: BarChart3, description: "Oś czasu projektu, fazy i zależności dat.", keywords: ["harmonogram"] },
      { to: "/mind-map", label: "Mapa myśli", icon: GitBranch, description: "Wizualne porządkowanie projektów i zależności.", keywords: ["mind map"] },
      { to: "/pm-guide", label: "PM Guide", icon: BookOpen, description: "Przewodnik po prowadzeniu projektu i checklistach.", keywords: ["prince2", "pmbok"] },
      { to: "/training-studio", label: "Training", icon: GraduationCap, description: "Projektowanie szkolenia, materiałów i scenariusza.", keywords: ["szkolenia"] },
      { to: "/kanban", label: "Kanban", icon: Columns3, description: "Tablica statusów dla zadań operacyjnych.", keywords: ["tablica"] }
    ]
  },
  {
    id: "execution",
    label: "Realizacja",
    items: [
      { to: "/tasks", label: "Zadania", icon: ListTodo, description: "Lista zadań, priorytety, statusy i załączniki.", keywords: ["tasks", "todo"], mobile: true },
      { to: "/notes", label: "Notatki", icon: NotebookText, description: "Notatki projektowe, TODO i ekstrakcja z dokumentów.", keywords: ["notes", "dokumenty"] },
      { to: "/email", label: "Poczta", icon: Mail, description: "Skrzynka, wysyłka i robocze odpowiedzi.", keywords: ["mail", "email"] }
    ]
  },
  {
    id: "business",
    label: "Biznes",
    items: [
      { to: "/business-designer", label: "Business", icon: Briefcase, description: "Modele biznesowe, canvas i mapa wartości.", keywords: ["biznes", "canvas"] },
      { to: "/social-plan", label: "Social Plan", icon: Megaphone, description: "Plan publikacji i kampanii social media.", keywords: ["marketing", "content"] },
      { to: "/crm", label: "CRM", icon: Contact, description: "Klienci, follow-upy, pipeline i relacje z projektami.", keywords: ["klienci", "sprzedaż"] },
      { to: "/finance", label: "Finanse", icon: DollarSign, description: "Budżety, faktury, płatności i marże projektów.", keywords: ["finance", "pieniądze"] },
      { to: "/market-intel", label: "AI Market", icon: TrendingUp, description: "Analiza rynku, firm i potencjalnych leadów.", keywords: ["rynek", "leady"] }
    ]
  },
  {
    id: "wellbeing",
    label: "Dobrostan",
    items: [
      { to: "/time-blocks", label: "Bloki czasu", icon: Clock, description: "Planowanie pracy w blokach i rytmach dnia.", keywords: ["time blocking"] },
      { to: "/wellbeing", label: "Dobrostan", icon: HeartHandshake, description: "Cele osobiste, refleksje i nawyki.", keywords: ["wellbeing", "zdrowie"] },
      { to: "/oczyszczanie", label: "Oczyszczanie", icon: PackageCheck, description: "Praktyczny plan porządkowania życia i przestrzeni.", keywords: ["declutter"] }
    ]
  }
];

const assistantNavItems: NavItem[] = [
  { to: "/centrum-guide", label: "POMOC", icon: CircleHelp, description: "Krótki poradnik po logice Centrum, widokach i dobrych praktykach.", keywords: ["pomoc", "poradnik", "guide", "jak używać", "jak uzywac"] }
];

function groupForPath(pathname: string) {
  if (assistantNavItems.some((item) => item.to === pathname || pathname.startsWith(`${item.to}/`))) return "assistant";
  return navGroups.find((group) =>
    group.items.some((item) => item.to === pathname || (item.to !== "/" && pathname.startsWith(`${item.to}/`)))
  )?.id ?? "overview";
}

const navItems = [
  ...navGroups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: group.label }))),
  ...assistantNavItems.map((item) => ({ ...item, groupLabel: "Asystent" }))
];
const mobileNavItems = navItems.filter((item) => item.mobile);

const NAV_GROUPS_VERSION = 5;

function readOpenGroups(pathname: string) {
  const activeGroup = groupForPath(pathname);
  const freshDefaults = { [activeGroup]: true };
  if (typeof window === "undefined") return freshDefaults;

  try {
    const stored = window.localStorage.getItem("centrum-nav-groups");
    if (!stored) return freshDefaults;
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    if (parsed.__version !== NAV_GROUPS_VERSION) return freshDefaults;
    return { ...Object.fromEntries(navGroups.map((group) => [group.id, parsed[group.id] === true])), [activeGroup]: true };
  } catch {
    return freshDefaults;
  }
}

export function AppShell({ children, session, metrics, loading, error, lastLoadedAt, theme, onToggleTheme, onRefresh, onOpenCopilot }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const activeItem = navItems.find((item) => item.to === location.pathname || (item.to !== "/" && location.pathname.startsWith(`${item.to}/`)));
  const [googleStatus, setGoogleStatus] = useState<GoogleIntegrationStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => readOpenGroups(location.pathname));
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  const googleConnected = Boolean(googleStatus?.connected);

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    const rankedItems = navItems
      .map((item) => {
        const haystack = [item.label, item.description, item.groupLabel, ...(item.keywords ?? [])].join(" ").toLowerCase();
        const score = !query
          ? item.mobile ? 2 : 1
          : haystack.includes(query) ? (item.label.toLowerCase().includes(query) ? 4 : 3) : 0;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "pl"))
      .slice(0, 8)
      .map((entry) => entry.item);

    return rankedItems;
  }, [commandQuery]);

  useEffect(() => {
    const activeGroup = groupForPath(location.pathname);
    setOpenGroups((current) => ({ ...current, [activeGroup]: true }));
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    const frame = window.requestAnimationFrame(() => commandInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [commandOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem("centrum-nav-groups", JSON.stringify({ ...openGroups, __version: NAV_GROUPS_VERSION }));
    } catch {
      // Navigation still works if storage is unavailable.
    }
  }, [openGroups]);

  useEffect(() => {
    const updateNetworkStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGoogleLoading(true);
    getGoogleIntegrationStatus()
      .then((status) => {
        if (!cancelled) setGoogleStatus(status);
      })
      .catch(() => {
        if (!cancelled) setGoogleStatus({
          connected: false,
          needsReconnect: false,
          googleEmail: null,
          connectedAt: null,
          updatedAt: null,
          scopes: [],
          missingScopes: [],
          message: null
        });
      })
      .finally(() => {
        if (!cancelled) setGoogleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.user.id]);

  async function onConnectGoogle() {
    setGoogleLoading(true);
    try {
      await connectGoogleIdentity();
    } catch {
      setGoogleLoading(false);
    }
  }

  function closeCommand() {
    setCommandOpen(false);
    setCommandQuery("");
  }

  function openNavItem(item: NavItem) {
    if (item.external) {
      window.location.href = item.to;
    } else {
      navigate(item.to);
    }
    closeCommand();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Przejdź do treści</a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <strong>Centrum</strong>
            <span>AI Project Hub</span>
          </div>
        </div>

        <div className="workspace-card">
          <span className="eyebrow">Workspace</span>
          <strong>Portfolio operacyjne</strong>
          <span>{metrics.activeProjects} aktywnych · {metrics.progress}% done · {metrics.riskyTasks} ryzyk</span>
        </div>

        <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)}>
          <Search size={16} />
          <span>Szukaj widoku lub akcji</span>
        </button>

        <span className="sidebar-label">Widoki</span>
        <nav className="nav-list" aria-label="Główna nawigacja">
          {navGroups.map((group) => {
            const isOpen = openGroups[group.id] ?? false;
            const isCurrentGroup = group.id === groupForPath(location.pathname);
            return (
              <section className="nav-group" key={group.id}>
                <button
                  className={`nav-group-button ${isCurrentGroup ? "current" : ""}`}
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !(current[group.id] ?? false) }))}
                >
                  <span>{group.label}</span>
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div className="nav-group-items">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      if (item.external) {
                        return (
                          <a key={item.to} href={item.to} className="nav-item">
                            <Icon size={18} />
                            {item.label}
                          </a>
                        );
                      }
                      return (
                        <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                          <Icon size={18} />
                          {item.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <span className="sidebar-label">Asystent</span>
        <button className="copilot-button" onClick={onOpenCopilot}>
          <Bot size={18} />
          Copilot
          {metrics.riskyTasks > 0 && (
            <span className="topbar-risk-badge" aria-hidden="true">{metrics.riskyTasks}</span>
          )}
        </button>
        <div className="assistant-nav">
          {assistantNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item assistant-help-link ${isActive ? "active" : ""}`}>
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </div>

        <button className="secondary-button sidebar-refresh" onClick={onRefresh} disabled={loading}>
          <RotateCw size={16} className={loading ? "spin-icon" : ""} />
          {loading ? "Synchronizuję" : "Odśwież dane"}
        </button>

        <button className="theme-toggle" onClick={onToggleTheme} type="button" aria-label="Przełącz motyw" aria-pressed={theme === "light"}>
          <ThemeIcon size={16} />
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>

        <button className="mobile-logout icon-button" onClick={() => void supabase.auth.signOut()} type="button" aria-label="Wyloguj">
          <LogOut size={16} />
        </button>

        <div className="sidebar-stats">
          <div>
            <strong>{metrics.activeProjects}</strong>
            <span>aktywnych</span>
          </div>
          <div>
            <strong>{metrics.progress}%</strong>
            <span>done</span>
          </div>
          <div className={metrics.riskyTasks ? "danger-text" : ""}>
            <strong>{metrics.riskyTasks}</strong>
            <span>ryzyk</span>
          </div>
          <div className="sync-row">
            <span className={`sync-dot ${loading ? "loading" : ""}`} />
            <span>{lastLoadedAt ? `Sync ${new Date(lastLoadedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}` : "Brak sync"}</span>
          </div>
        </div>

        <div className="account-card">
          <div>
            <span className="eyebrow">Konto</span>
            <strong>{session.user.email}</strong>
            <span>{googleConnected ? `Google: ${googleStatus?.googleEmail ?? "połączone"}` : "Google Calendar/Gmail niepołączone"}</span>
          </div>
          {!googleConnected && (
            <button className="icon-button" onClick={() => void onConnectGoogle()} aria-label="Połącz konto Google" title="Połącz konto Google" disabled={googleLoading}>
              <Link size={16} />
            </button>
          )}
          <button className="icon-button" onClick={() => void supabase.auth.signOut()} aria-label="Wyloguj">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main-content" id="main-content">
        <div className="top-context-bar">
          <div>
            <span className="eyebrow">Aktualny widok</span>
            <strong>{activeItem?.label ?? "Centrum"}</strong>
            <span>{activeItem?.description ?? "Operacyjne centrum pracy."}</span>
          </div>
          <button className="command-trigger compact" type="button" onClick={() => setCommandOpen(true)}>
            <Search size={16} />
            <span>Szukaj</span>
          </button>
        </div>
        <div className="system-status-stack" aria-live="polite">
          {isOffline && (
            <div className="system-status-banner danger">
              <WifiOff size={16} />
              <span>Brak połączenia. Możesz czytać widoki, ale zapis może się nie udać.</span>
            </div>
          )}
          {error && (
            <div className="system-status-banner warning">
              <AlertTriangle size={16} />
              <span>{error}</span>
              <button className="link-button" type="button" onClick={onRefresh}>Ponów</button>
            </div>
          )}
          {loading && (
            <div className="system-status-banner neutral">
              <RotateCw size={16} className="spin-icon" />
              <span>Synchronizuję dane...</span>
            </div>
          )}
        </div>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Nawigacja mobilna">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          if (item.external) {
            return (
              <a key={item.to} href={item.to} className="mobile-nav-item">
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            );
          }
          return (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}>
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <button className="mobile-nav-item mobile-command-button" type="button" onClick={() => setCommandOpen(true)}>
          <Search size={18} />
          <span>Szukaj</span>
        </button>
        <button className="mobile-nav-item mobile-command-button" type="button" onClick={onOpenCopilot}>
          <Bot size={18} />
          <span>AI</span>
          {metrics.riskyTasks > 0 && <span className="mobile-risk-dot" aria-label={`${metrics.riskyTasks} ryzyk`} />}
        </button>
      </nav>
      {commandOpen && (
        <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Szybka nawigacja">
          <div className="command-palette">
            <div className="command-search-row">
              <Search size={18} />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && commandResults[0]) openNavItem(commandResults[0]);
                }}
                placeholder="Wpisz: zadania, CRM, finanse, tydzień..."
                aria-label="Szukaj widoków i akcji"
              />
              <button className="icon-button" type="button" onClick={closeCommand} aria-label="Zamknij wyszukiwarkę">
                <X size={16} />
              </button>
            </div>

            <div className="command-section">
              <span className="eyebrow">Widoki</span>
              <div className="command-results">
                {commandResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button className="command-result" type="button" onClick={() => openNavItem(item)} key={item.to}>
                      <span className="command-result-icon"><Icon size={17} /></span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      <em>{item.external ? "otwórz" : item.groupLabel}</em>
                    </button>
                  );
                })}
                {!commandResults.length && <div className="empty-state">Brak pasujących widoków.</div>}
              </div>
            </div>

            <div className="command-actions">
              <button type="button" onClick={() => { onOpenCopilot(); closeCommand(); }}>
                <Bot size={16} />
                Copilot
              </button>
              <button type="button" onClick={() => { onRefresh(); closeCommand(); }} disabled={loading}>
                <RotateCw size={16} className={loading ? "spin-icon" : ""} />
                Odśwież
              </button>
              <button type="button" onClick={() => { onToggleTheme(); closeCommand(); }}>
                <ThemeIcon size={16} />
                Motyw
              </button>
              {!googleConnected && (
                <button type="button" onClick={() => { void onConnectGoogle(); closeCommand(); }} disabled={googleLoading}>
                  <Link size={16} />
                  Google
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
