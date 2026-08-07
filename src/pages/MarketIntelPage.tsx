import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, ClipboardCopy, Download, ExternalLink, Loader2, Mail, Plus, Printer, RefreshCw, RotateCcw, Trash2, TrendingUp, X } from "lucide-react";
import { supabase } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

type ReportStatus = "pending" | "in_progress" | "done" | "partial" | "failed";
type Confidence = "high" | "medium" | "low";
type SectionKey = "places" | "websites" | "reviews" | "youtube" | "market" | "scoring" | "personas" | "proposals" | "marketplace" | "report";
type ReportType = "services" | "products";

interface MarketReport {
  id: string;
  industry: string;
  region: string;
  status: ReportStatus;
  report_type: ReportType;
  cost_limit_pln: number | null;
  total_cost_usd: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface PricingSummary {
  id: string;
  price_min_text: string | null;
  price_max_text: string | null;
  price_common_range: string | null;
  price_source_count: number;
  outliers: string[];
  claude_summary: string | null;
  confidence: Confidence;
}

type CrmStatus = "new" | "contacted" | "interested" | "client" | "rejected";

interface MarketCompany {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  google_rating: number | null;
  review_count: number | null;
  maps_url: string;
  website_url: string | null;
  opportunity_score: number | null;
  score_reason: string | null;
  crm_status: CrmStatus;
  crm_notes: string | null;
  market_website_analysis?: {
    has_website: boolean;
    ssl: boolean | null;
    pagespeed_mobile: number | null;
    reachable: boolean;
    price_range_text: string | null;
    contact_email: string | null;
    has_pricing_page: boolean | null;
  } | null;
}

interface ReviewInsight {
  id: string;
  category: string;
  percentage: number;
  sample_quotes: string[];
  sources: string[];
  confidence: Confidence;
  low_confidence_note: string | null;
}

interface MarketEstimate {
  id: string;
  value_low_pln: number | null;
  value_high_pln: number | null;
  confidence: Confidence;
  rationale: string;
  market_gaps: string[];
  sources: string[];
  low_confidence_note: string | null;
}

interface MarketPersona {
  id: string;
  name: string;
  age_range: string | null;
  role: string;
  pain_points: string[];
  goals: string[];
  buying_triggers: string[];
}

interface ServiceProposal {
  id: string;
  title: string;
  description: string;
  target_segment: string;
  estimated_value_pln: number | null;
  priority: number;
  rationale: string;
}

interface YoutubeSignal {
  id: string;
  signal_type: "trending_topic" | "common_question" | "market_opportunity" | string;
  title: string;
  description: string;
  video_count: number | null;
  example_titles: string[];
  confidence: Confidence;
}

interface ColdEmail {
  id?: string;
  company_id: string;
  company_name: string;
  contact_email: string | null;
  subject: string;
  body_text: string;
  personalization_notes: string | null;
}

interface ReportSection {
  section_key: SectionKey;
  status: ReportStatus;
  items_total: number;
  items_done: number;
  error_message: string | null;
}

const SECTION_LABELS: Record<SectionKey, string> = {
  places:      "Google Places — firmy",
  websites:    "Analiza stron www",
  reviews:     "Google Reviews + AI",
  youtube:     "YouTube — sygnały rynkowe",
  market:      "Szacunek rynku i luki",
  scoring:     "Score potencjalnych klientów",
  personas:    "Persony klientów",
  proposals:   "Propozycje usług",
  marketplace: "Analiza cen rynkowych",
  report:      "Generowanie raportu",
};

const SECTION_ORDER: SectionKey[] = ["places", "websites", "reviews", "youtube", "market", "scoring", "personas", "proposals", "marketplace", "report"];

// ── Main component ────────────────────────────────────────────────────────────

export function MarketIntelPage() {
  const [reports, setReports] = useState<MarketReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    const { data } = await supabase
      .from("market_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setReports(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  function handleCreated(id: string) {
    setShowForm(false);
    setSelectedId(id);
    loadReports();
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <TrendingUp size={20} />
          <h1 className="page-title">AI Market Intelligence</h1>
        </div>
        <button className="primary-button" onClick={() => { setShowForm(true); setSelectedId(null); }}>
          <Plus size={16} />
          Nowy raport
        </button>
      </div>

      {showForm && (
        <NewReportForm
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: selectedId ? "320px 1fr" : "1fr", gap: "1rem", alignItems: "start" }}>
        {/* Report list */}
        <div>
          {loading ? (
            <div className="empty-state"><Loader2 size={20} className="spin-icon" /><span>Ładowanie…</span></div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <TrendingUp size={32} style={{ opacity: 0.3 }} />
              <p>Brak raportów. Kliknij <strong>Nowy raport</strong>, żeby zacząć.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {reports.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  className={`card card-interactive ${r.id === selectedId ? "ring-accent" : ""}`}
                  style={{ textAlign: "left", width: "100%" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.industry}</div>
                      <div style={{ fontSize: "0.8125rem", opacity: 0.6 }}>{r.region}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      <StatusBadge status={r.status} />
                      <ChevronRight size={14} style={{ opacity: 0.4 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.45, marginTop: "0.25rem" }}>
                    {new Date(r.created_at).toLocaleDateString("pl-PL")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Report detail */}
        {selectedId && (
          <ReportDetail
            reportId={selectedId}
            onClose={() => setSelectedId(null)}
            onRefreshList={loadReports}
          />
        )}
      </div>
    </div>
  );
}

// ── New report form ───────────────────────────────────────────────────────────

function NewReportForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [reportType, setReportType] = useState<ReportType>("services");
  const [costLimit, setCostLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!industry.trim() || !region.trim()) return;
    setSaving(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Brak sesji."); setSaving(false); return; }

    const { data, error: dbErr } = await supabase
      .from("market_reports")
      .insert({
        user_id: session.user.id,
        industry: industry.trim(),
        region: region.trim(),
        report_type: reportType,
        cost_limit_pln: costLimit ? parseFloat(costLimit) : null,
        status: "pending",
      })
      .select()
      .single();

    if (dbErr || !data) { setError(dbErr?.message ?? "Błąd zapisu."); setSaving(false); return; }

    // Pre-create section rows
    await supabase.from("market_report_sections").insert(
      SECTION_ORDER.map(key => ({
        report_id: data.id,
        section_key: key,
        status: "pending",
      }))
    );

    onCreated(data.id);
  }

  return (
    <div className="card" style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <strong>Nowy raport rynkowy</strong>
        <button className="icon-button" onClick={onCancel}><X size={16} /></button>
      </div>
      <form onSubmit={e => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div>
          <label className="form-label">Typ analizy</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["services", "products"] as ReportType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className={reportType === t ? "primary-button" : "secondary-button"}
                style={{ flex: 1, fontSize: "0.8125rem" }}
              >
                {t === "services" ? "🏢 Usługi lokalne" : "📦 Produkty / e-commerce"}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", opacity: 0.5, margin: "0.25rem 0 0" }}>
            {reportType === "services"
              ? "Szuka firm świadczących usługę w regionie (dentysci, agencje marketingowe…)"
              : "Szuka sklepów sprzedających produkt + analizuje ceny rynkowe"}
          </p>
        </div>
        <div>
          <label className="form-label">{reportType === "services" ? "Branża / usługa" : "Produkt / kategoria"}</label>
          <input
            className="form-input"
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            placeholder={reportType === "services" ? "np. gabinety stomatologiczne" : "np. buty sportowe, laptopy do 3000 zł"}
            required
          />
        </div>
        <div>
          <label className="form-label">Region</label>
          <input
            className="form-input"
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="np. Oslo, Warszawa, Trójmiasto"
            required
          />
        </div>
        <div>
          <label className="form-label">Limit kosztu (PLN) <span style={{ opacity: 0.5 }}>— opcjonalnie</span></label>
          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            value={costLimit}
            onChange={e => setCostLimit(e.target.value)}
            placeholder="bez limitu"
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" className="secondary-button" onClick={onCancel}>Anuluj</button>
          <button type="submit" className="primary-button" disabled={saving || !industry.trim() || !region.trim()}>
            {saving ? <><Loader2 size={14} className="spin-icon" /> Tworzę…</> : "Utwórz raport"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Report detail ─────────────────────────────────────────────────────────────

function ReportDetail({ reportId, onClose, onRefreshList }: { reportId: string; onClose: () => void; onRefreshList: () => void }) {
  const [report, setReport] = useState<MarketReport | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [companies, setCompanies] = useState<MarketCompany[]>([]);
  const [insights, setInsights] = useState<ReviewInsight[]>([]);
  const [estimate, setEstimate] = useState<MarketEstimate | null>(null);
  const [personas, setPersonas] = useState<MarketPersona[]>([]);
  const [proposals, setProposals] = useState<ServiceProposal[]>([]);
  const [pricingSummary, setPricingSummary] = useState<PricingSummary | null>(null);
  const [youtubeSignals, setYoutubeSignals] = useState<YoutubeSignal[]>([]);
  const [coldEmails, setColdEmails] = useState<ColdEmail[]>([]);
  const [generatingEmails, setGeneratingEmails] = useState(false);
  const [showColdEmails, setShowColdEmails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const coldEmailsPanelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [rRes, sRes, cRes, iRes, eRes, pRes, prRes, psRes, ytRes, ceRes] = await Promise.all([
      supabase.from("market_reports").select("*").eq("id", reportId).single(),
      supabase.from("market_report_sections").select("*").eq("report_id", reportId),
      supabase.from("market_companies")
        .select("*, market_website_analysis(*)")
        .eq("report_id", reportId)
        .order("opportunity_score", { ascending: false }),
      supabase.from("market_review_insights").select("*").eq("report_id", reportId),
      supabase.from("market_estimates").select("*").eq("report_id", reportId).maybeSingle(),
      supabase.from("market_personas").select("*").eq("report_id", reportId),
      supabase.from("market_service_proposals").select("*").eq("report_id", reportId).order("priority"),
      supabase.from("market_pricing_summary").select("*").eq("report_id", reportId).maybeSingle(),
      supabase.from("market_youtube_signals").select("*").eq("report_id", reportId),
      supabase.from("market_cold_emails")
        .select("id, company_id, subject, body_text, personalization_notes, market_companies(name, market_website_analysis(contact_email))")
        .eq("report_id", reportId),
    ]);
    if (rRes.data) setReport(rRes.data);
    if (sRes.data) setSections(sRes.data);
    if (cRes.data) setCompanies(cRes.data);
    if (iRes.data) setInsights(iRes.data);
    if (eRes.data) setEstimate(eRes.data);
    if (pRes.data) setPersonas(pRes.data);
    if (prRes.data) setProposals(prRes.data);
    if (psRes.data) setPricingSummary(psRes.data);
    if (ytRes.data) setYoutubeSignals(ytRes.data as YoutubeSignal[]);
    if (ceRes.data && ceRes.data.length > 0) {
      const mapped: ColdEmail[] = ceRes.data.map((e) => {
        type CompJoin = { name: string; market_website_analysis: Array<{ contact_email: string | null }> | null };
        const comp = (e.market_companies as unknown) as CompJoin | null;
        const waArr = comp?.market_website_analysis ?? [];
        return {
          id: e.id as string,
          company_id: e.company_id as string,
          company_name: comp?.name ?? "—",
          contact_email: waArr[0]?.contact_email ?? null,
          subject: e.subject as string,
          body_text: e.body_text as string,
          personalization_notes: (e.personalization_notes ?? null) as string | null,
        };
      });
      setColdEmails(mapped);
      setShowColdEmails(true);
    }
    setLoading(false);
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  // Poll while running; fire browser notification on completion
  useEffect(() => {
    if (!report || (report.status !== "in_progress" && report.status !== "pending")) return;
    const t = setInterval(async () => {
      const prevStatus = report.status;
      await load();
      onRefreshList();
      // Check if status just changed to done/partial — load() updates report state async,
      // so we read from DB directly here for the notification trigger
      const { data } = await supabase.from("market_reports").select("status, industry, region").eq("id", reportId).single();
      if (data && (data.status === "done" || data.status === "partial") && prevStatus === "in_progress") {
        if (Notification.permission === "granted") {
          new Notification("Raport gotowy — AI Market Intelligence", {
            body: `${data.industry as string} · ${data.region as string} (${data.status as string})`,
            icon: "/favicon.ico",
          });
        } else if (Notification.permission === "default") {
          void Notification.requestPermission().then(perm => {
            if (perm === "granted") {
              new Notification("Raport gotowy — AI Market Intelligence", {
                body: `${data.industry as string} · ${data.region as string}`,
                icon: "/favicon.ico",
              });
            }
          });
        }
      }
    }, 3000);
    return () => clearInterval(t);
  }, [report, load, onRefreshList, reportId]);

  async function startGeneration() {
    if (!report) return;
    setStarting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke("market-intel-generate", {
        body: { reportId: report.id },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
    } catch { /* optimistic start */ }
    await supabase.from("market_reports").update({ status: "in_progress" }).eq("id", report.id);
    setStarting(false);
    load();
  }

  async function generateColdEmails() {
    if (!report) return;
    setGeneratingEmails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("market-intel-cold-emails", {
        body: { reportId: report.id },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      if (data?.emails) {
        setColdEmails(data.emails as ColdEmail[]);
        setShowColdEmails(true);
        setTimeout(() => coldEmailsPanelRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch (err) {
      alert(`Błąd generowania emaili: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGeneratingEmails(false);
    }
  }

  async function updateCompanyCrm(companyId: string, status: CrmStatus, notes: string) {
    await supabase.from("market_companies")
      .update({ crm_status: status, crm_notes: notes || null })
      .eq("id", companyId);
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, crm_status: status, crm_notes: notes || null } : c));
  }

  async function resetAndRun() {
    if (!report) return;
    if (!window.confirm("Uruchomić raport od nowa? Dane z poprzedniego runu zostaną usunięte.")) return;
    setStarting(true);
    setColdEmails([]);
    setShowColdEmails(false);
    setYoutubeSignals([]);
    // Delete all child data (cascade handles market_website_analysis and market_cold_emails)
    await Promise.all([
      supabase.from("market_review_insights").delete().eq("report_id", report.id),
      supabase.from("market_estimates").delete().eq("report_id", report.id),
      supabase.from("market_personas").delete().eq("report_id", report.id),
      supabase.from("market_service_proposals").delete().eq("report_id", report.id),
      supabase.from("market_pricing_summary").delete().eq("report_id", report.id),
      supabase.from("market_youtube_signals").delete().eq("report_id", report.id),
      supabase.from("market_companies").delete().eq("report_id", report.id),
    ]);
    await supabase.from("market_report_sections")
      .update({ status: "pending", items_total: 0, items_done: 0, error_message: null, started_at: null, completed_at: null })
      .eq("report_id", report.id);
    await supabase.from("market_reports")
      .update({ status: "pending", error_message: null, completed_at: null, total_cost_usd: 0 })
      .eq("id", report.id);
    await load();
    await startGeneration();
  }

  async function deleteReport() {
    if (!report) return;
    if (!window.confirm(`Usunąć raport "${report.industry} — ${report.region}"? Tej operacji nie można cofnąć.`)) return;
    await supabase.from("market_reports").delete().eq("id", report.id);
    onClose();
    onRefreshList();
  }

  if (loading) return <div className="card"><Loader2 size={18} className="spin-icon" /> Ładowanie…</div>;
  if (!report) return null;

  const isRunning = report.status === "in_progress";
  const isDone = report.status === "done" || report.status === "partial";

  return (
    <div className="card" style={{ minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{report.industry}</h2>
            <StatusBadge status={report.status} />
            <span style={{ fontSize: "0.7rem", opacity: 0.5, background: "var(--surface-2)", padding: "0.1rem 0.4rem", borderRadius: 999 }}>
              {report.report_type === "products" ? "📦 produkty" : "🏢 usługi"}
            </span>
          </div>
          <div style={{ fontSize: "0.8125rem", opacity: 0.6 }}>{report.region}</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {report.status === "pending" && (
            <button className="primary-button" onClick={() => void startGeneration()} disabled={starting}>
              {starting ? <Loader2 size={14} className="spin-icon" /> : null}
              {starting ? "Startuję…" : "▶ Start"}
            </button>
          )}
          {isRunning && (
            <button className="secondary-button" onClick={() => void load()}>
              <RefreshCw size={14} />
            </button>
          )}
          {(report.status === "done" || report.status === "partial" || report.status === "failed") && (<>
            <button
              className="secondary-button"
              onClick={() => void generateColdEmails()}
              disabled={generatingEmails}
              title="Generuj spersonalizowane cold emaile dla top 10 firm"
            >
              {generatingEmails ? <Loader2 size={14} className="spin-icon" /> : <Mail size={14} />}
              {generatingEmails ? "Generuję…" : coldEmails.length > 0 ? `Cold emails (${coldEmails.length})` : "Cold emails"}
            </button>
            <button className="secondary-button" onClick={() => void resetAndRun()} disabled={starting} title="Uruchom raport od nowa">
              {starting ? <Loader2 size={14} className="spin-icon" /> : <RotateCcw size={14} />}
              Re-run
            </button>
          </>)}
          <button className="icon-button" onClick={() => void deleteReport()} title="Usuń raport" style={{ color: "var(--danger)" }}>
            <Trash2 size={15} />
          </button>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
      </div>

      {/* Progress */}
      {sections.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="section-label" style={{ marginBottom: "0.5rem" }}>Postęp generowania</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {SECTION_ORDER.map(key => {
              const sec = sections.find(s => s.section_key === key);
              if (!sec) return null;
              return <SectionRow key={key} label={SECTION_LABELS[key]} section={sec} />;
            })}
          </div>
        </div>
      )}

      {report.error_message && (
        <div className="inline-warning" style={{ marginBottom: "1rem" }}>
          <AlertTriangle size={14} />
          <span>{report.error_message}</span>
        </div>
      )}

      {/* Companies */}
      {companies.length > 0 && (
        <CompaniesTable companies={companies} onCrmUpdate={updateCompanyCrm} />
      )}

      {/* Review insights */}
      {insights.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="section-label" style={{ marginBottom: "0.5rem" }}>Problemy klientów (Google Reviews)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {insights.map(ins => (
              <div key={ins.id} className="card" style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <strong style={{ fontSize: "0.875rem" }}>{ins.category}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <ConfidenceBadge level={ins.confidence} />
                    <strong style={{ color: "var(--accent)" }}>{ins.percentage.toFixed(0)}%</strong>
                  </div>
                </div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: "0.5rem" }}>
                  <div style={{ height: "100%", background: "var(--accent)", borderRadius: 2, width: `${Math.min(ins.percentage, 100)}%` }} />
                </div>
                {ins.sample_quotes.slice(0, 2).map((q, i) => (
                  <p key={i} style={{ fontSize: "0.75rem", opacity: 0.6, fontStyle: "italic", margin: "0.125rem 0" }}>„{q}"</p>
                ))}
                {ins.sources.length > 0 && (
                  <div style={{ marginTop: "0.375rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {ins.sources.map((s, i) => (
                      <span key={i} style={{ fontSize: "0.7rem", opacity: 0.5 }}>📌 {s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* YouTube signals */}
      {youtubeSignals.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="section-label" style={{ marginBottom: "0.5rem" }}>Sygnały rynkowe (YouTube)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {youtubeSignals.map(sig => (
              <div key={sig.id} className="card" style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 999, background: "var(--surface-2)", opacity: 0.8 }}>
                    {sig.signal_type === "trending_topic" ? "📈 trending" : sig.signal_type === "common_question" ? "❓ pytanie" : "💡 szansa"}
                  </span>
                  <ConfidenceBadge level={sig.confidence} />
                  <strong style={{ fontSize: "0.875rem" }}>{sig.title}</strong>
                </div>
                <p style={{ fontSize: "0.8125rem", opacity: 0.7, margin: "0 0 0.375rem" }}>{sig.description}</p>
                {sig.example_titles.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                    {sig.example_titles.slice(0, 2).map((t, i) => (
                      <div key={i} style={{ fontSize: "0.75rem", opacity: 0.5, fontStyle: "italic" }}>▶ {t}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market estimate */}
      {estimate && (
        <div>
          <div className="section-label" style={{ marginBottom: "0.5rem" }}>Szacunek rynku</div>
          <div className="card" style={{ padding: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div>
                {estimate.value_low_pln != null && estimate.value_high_pln != null ? (
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                    {fmtPln(estimate.value_low_pln)} – {fmtPln(estimate.value_high_pln)}
                  </div>
                ) : <span style={{ opacity: 0.5, fontSize: "0.875rem" }}>Brak danych</span>}
              </div>
              <ConfidenceBadge level={estimate.confidence} note={estimate.low_confidence_note} />
            </div>
            <p style={{ fontSize: "0.8125rem", opacity: 0.7, margin: "0 0 0.625rem" }}>{estimate.rationale}</p>
            {estimate.market_gaps.length > 0 && (
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>Luki rynkowe</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {estimate.market_gaps.map((gap, i) => (
                    <li key={i} style={{ fontSize: "0.8125rem", display: "flex", gap: "0.5rem" }}>
                      <span style={{ color: "var(--accent)" }}>›</span>{gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Summary */}
      {pricingSummary && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="section-label" style={{ marginBottom: "0.5rem" }}>Ceny rynkowe ({pricingSummary.price_source_count} źródeł)</div>
          <div className="card" style={{ padding: "0.875rem" }}>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {pricingSummary.price_min_text && (
                <div>
                  <div style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Minimum</div>
                  <div style={{ fontWeight: 700, color: "var(--success)" }}>{pricingSummary.price_min_text}</div>
                </div>
              )}
              {pricingSummary.price_common_range && (
                <div>
                  <div style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Typowy zakres</div>
                  <div style={{ fontWeight: 700, color: "var(--accent)" }}>{pricingSummary.price_common_range}</div>
                </div>
              )}
              {pricingSummary.price_max_text && (
                <div>
                  <div style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Maksimum</div>
                  <div style={{ fontWeight: 700 }}>{pricingSummary.price_max_text}</div>
                </div>
              )}
              <div style={{ marginLeft: "auto" }}>
                <ConfidenceBadge level={pricingSummary.confidence} />
              </div>
            </div>
            {pricingSummary.claude_summary && (
              <p style={{ fontSize: "0.8125rem", opacity: 0.75, margin: "0 0 0.5rem" }}>{pricingSummary.claude_summary}</p>
            )}
            {pricingSummary.outliers.length > 0 && (
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Outliery</div>
                {pricingSummary.outliers.map((o, i) => (
                  <div key={i} style={{ fontSize: "0.8rem", display: "flex", gap: "0.375rem" }}>
                    <span style={{ color: "var(--warning)" }}>⚠</span>{o}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Personas */}
      {personas.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="section-label" style={{ marginBottom: "0.5rem" }}>Persony klientów</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
            {personas.map(p => (
              <div key={p.id} className="card" style={{ padding: "0.875rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.125rem" }}>{p.name}</div>
                {p.age_range && <div style={{ fontSize: "0.75rem", opacity: 0.5, marginBottom: "0.5rem" }}>{p.role} · {p.age_range} lat</div>}
                {p.pain_points.length > 0 && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Problemy</div>
                    {p.pain_points.map((pt, i) => <div key={i} style={{ fontSize: "0.8rem", display: "flex", gap: "0.375rem" }}><span style={{ color: "var(--danger)" }}>✗</span>{pt}</div>)}
                  </div>
                )}
                {p.goals.length > 0 && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Cele</div>
                    {p.goals.map((g, i) => <div key={i} style={{ fontSize: "0.8rem", display: "flex", gap: "0.375rem" }}><span style={{ color: "var(--success)" }}>›</span>{g}</div>)}
                  </div>
                )}
                {p.buying_triggers.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Wyzwalacze zakupu</div>
                    {p.buying_triggers.map((bt, i) => <div key={i} style={{ fontSize: "0.8rem", display: "flex", gap: "0.375rem" }}><span style={{ color: "var(--accent)" }}>⚡</span>{bt}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Proposals */}
      {proposals.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="section-label" style={{ marginBottom: "0.5rem" }}>Propozycje usług dla CodeSpade</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {proposals.map(p => (
              <div key={p.id} className="card" style={{ padding: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.375rem" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{p.title}</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.125rem" }}>Segment: {p.target_segment}</div>
                  </div>
                  {p.estimated_value_pln != null && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: "1rem" }}>{fmtPln(p.estimated_value_pln)}</div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.45 }}>est. wartość</div>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: "0.8125rem", margin: "0 0 0.375rem", opacity: 0.8 }}>{p.description}</p>
                <p style={{ fontSize: "0.75rem", margin: 0, opacity: 0.55, fontStyle: "italic" }}>{p.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cold emails */}
      {showColdEmails && coldEmails.length > 0 && (
        <div ref={coldEmailsPanelRef} style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <div className="section-label">Cold emails — top {coldEmails.length} firm wg szansy</div>
            <button className="icon-button" style={{ fontSize: "0.75rem" }} onClick={() => setShowColdEmails(false)}><X size={14} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {coldEmails.map((em, idx) => (
              <ColdEmailCard key={em.id ?? idx} email={em} />
            ))}
          </div>
        </div>
      )}

      {/* Export bar — shown when report is done or partial */}
      {isDone && companies.length > 0 && (
        <ExportBar report={report} companies={companies} insights={insights} estimate={estimate} personas={personas} proposals={proposals} pricingSummary={pricingSummary} youtubeSignals={youtubeSignals} coldEmails={coldEmails} />
      )}

      {/* Empty state when pending */}
      {report.status === "pending" && sections.every(s => s.status === "pending") && companies.length === 0 && (
        <div className="empty-state" style={{ marginTop: "1rem" }}>
          <p style={{ opacity: 0.6, fontSize: "0.875rem" }}>Kliknij <strong>▶ Start</strong>, żeby uruchomić generowanie raportu.</p>
        </div>
      )}
    </div>
  );
}

// ── CRM helpers ──────────────────────────────────────────────────────────────

const CRM_CONFIG: Record<CrmStatus, { label: string; color: string }> = {
  new:        { label: "Nowy",           color: "var(--text-muted)" },
  contacted:  { label: "Kontakt",        color: "var(--accent)" },
  interested: { label: "Zainteresowany", color: "var(--warning)" },
  client:     { label: "Klient ✓",       color: "var(--success)" },
  rejected:   { label: "Odrzucony",      color: "var(--danger)" },
};

// ── Companies table (filters + stats + expandable rows + CRM) ────────────────

function CompaniesTable({ companies, onCrmUpdate }: {
  companies: MarketCompany[];
  onCrmUpdate: (id: string, status: CrmStatus, notes: string) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<CrmStatus | "all">("all");
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterNoSite, setFilterNoSite] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);

  const filtered = companies.filter(c => {
    if (filterStatus !== "all" && (c.crm_status ?? "new") !== filterStatus) return false;
    if (filterMinScore > 0 && (c.opportunity_score ?? 0) < filterMinScore) return false;
    if (filterHasEmail && !c.market_website_analysis?.contact_email) return false;
    if (filterNoSite && c.market_website_analysis?.has_website !== false) return false;
    return true;
  });

  const visible = showAll ? filtered : filtered.slice(0, 20);
  const hasFilters = filterStatus !== "all" || filterMinScore > 0 || filterHasEmail || filterNoSite;

  const stats = {
    total: companies.length,
    withEmail: companies.filter(c => c.market_website_analysis?.contact_email).length,
    highScore: companies.filter(c => (c.opportunity_score ?? 0) >= 50).length,
    noSite: companies.filter(c => c.market_website_analysis?.has_website === false).length,
    clients: companies.filter(c => c.crm_status === "client").length,
  };

  const filteredEmailCount = filtered.filter(c => c.market_website_analysis?.contact_email).length;

  function copyEmails() {
    const emails = filtered
      .map(c => c.market_website_analysis?.contact_email)
      .filter(Boolean)
      .join(", ");
    void navigator.clipboard.writeText(emails).then(() => {
      setCopiedEmails(true);
      setTimeout(() => setCopiedEmails(false), 2000);
    });
  }

  function clearFilters() {
    setFilterStatus("all");
    setFilterMinScore(0);
    setFilterHasEmail(false);
    setFilterNoSite(false);
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.625rem", alignItems: "center" }}>
        <div className="section-label" style={{ margin: 0 }}>Firmy</div>
        {[
          { label: "łącznie", value: stats.total, color: "var(--text)" },
          { label: "z emailem", value: stats.withEmail, color: "var(--accent)" },
          { label: "score≥50", value: stats.highScore, color: "var(--warning)" },
          { label: "bez www", value: stats.noSite, color: "var(--danger)" },
          { label: "klientów", value: stats.clients, color: "var(--success)" },
        ].map(s => (
          <div key={s.label} style={{ fontSize: "0.8rem", display: "flex", gap: "0.25rem", alignItems: "baseline" }}>
            <strong style={{ color: s.color }}>{s.value}</strong>
            <span style={{ opacity: 0.5, fontSize: "0.7rem" }}>{s.label}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {filteredEmailCount > 0 && (
          <button className="secondary-button" style={{ fontSize: "0.75rem" }} onClick={copyEmails}>
            {copiedEmails ? "✓ Skopiowano" : <><ClipboardCopy size={12} /> Kopiuj emaile ({filteredEmailCount})</>}
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem", padding: "0.5rem 0.625rem", background: "var(--surface-2)", borderRadius: 8 }}>
        <span style={{ fontSize: "0.7rem", opacity: 0.45, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "0.1rem" }}>Filtr:</span>

        {/* CRM status pills */}
        {(["all", "new", "contacted", "interested", "client", "rejected"] as (CrmStatus | "all")[]).map(s => {
          const cfg = s === "all" ? { label: "Wszystkie", color: "var(--accent)" } : CRM_CONFIG[s as CrmStatus];
          const count = s === "all" ? companies.length : companies.filter(c => (c.crm_status ?? "new") === s).length;
          if (s !== "all" && count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${filterStatus === s ? cfg.color : "var(--border)"}`,
                background: filterStatus === s ? `color-mix(in srgb, ${cfg.color} 12%, transparent)` : "transparent",
                color: filterStatus === s ? cfg.color : "var(--text-muted)",
                fontWeight: filterStatus === s ? 600 : 400,
              }}
            >
              {cfg.label} <span style={{ opacity: 0.55 }}>({count})</span>
            </button>
          );
        })}

        <div style={{ height: 14, width: 1, background: "var(--border)", margin: "0 0.125rem" }} />

        {/* Score select */}
        <select
          value={filterMinScore}
          onChange={e => setFilterMinScore(Number(e.target.value))}
          style={{ fontSize: "0.7rem", background: "var(--surface)", border: `1px solid ${filterMinScore > 0 ? "var(--warning)" : "var(--border)"}`, borderRadius: 6, padding: "0.15rem 0.375rem", color: "var(--text)", cursor: "pointer" }}
        >
          <option value={0}>Każdy score</option>
          <option value={30}>Score ≥ 30</option>
          <option value={50}>Score ≥ 50</option>
          <option value={70}>Score ≥ 70</option>
        </select>

        {/* Toggle: email */}
        <label style={{ fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", color: filterHasEmail ? "var(--accent)" : "var(--text-muted)", userSelect: "none" }}>
          <input type="checkbox" checked={filterHasEmail} onChange={e => setFilterHasEmail(e.target.checked)} style={{ margin: 0, accentColor: "var(--accent)" }} />
          ✉ z emailem
        </label>

        {/* Toggle: no website */}
        <label style={{ fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", color: filterNoSite ? "var(--danger)" : "var(--text-muted)", userSelect: "none" }}>
          <input type="checkbox" checked={filterNoSite} onChange={e => setFilterNoSite(e.target.checked)} style={{ margin: 0, accentColor: "var(--danger)" }} />
          bez www
        </label>

        {hasFilters && (
          <button onClick={clearFilters} style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", marginLeft: "0.125rem" }}>
            wyczyść
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.4 }}>
          {hasFilters ? `${filtered.length} z ${companies.length}` : `${companies.length} firm`}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "1rem", textAlign: "center", opacity: 0.5, fontSize: "0.875rem" }}>
            Brak firm spełniających kryteria filtrów.{" "}
            <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}>Wyczyść filtry</button>
          </div>
        ) : (
          <>
            <table style={{ width: "100%", fontSize: "0.8125rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "0.375rem 0.5rem 0.375rem 0", opacity: 0.6, fontWeight: 500 }}>#</th>
                  <th style={{ padding: "0.375rem 0.5rem 0.375rem 0", opacity: 0.6, fontWeight: 500 }}>Firma</th>
                  <th style={{ padding: "0.375rem 0.5rem", opacity: 0.6, fontWeight: 500 }}>Ocena</th>
                  <th style={{ padding: "0.375rem 0.5rem", opacity: 0.6, fontWeight: 500 }}>SSL</th>
                  <th style={{ padding: "0.375rem 0.5rem", opacity: 0.6, fontWeight: 500 }}>Speed</th>
                  <th style={{ padding: "0.375rem 0.5rem", opacity: 0.6, fontWeight: 500 }}>Ceny</th>
                  <th style={{ padding: "0.375rem 0.5rem", opacity: 0.6, fontWeight: 500 }}>✉</th>
                  <th style={{ padding: "0.375rem 0.5rem", opacity: 0.6, fontWeight: 500 }}>Score</th>
                  <th style={{ padding: "0.375rem 0", opacity: 0.6, fontWeight: 500 }}>CRM</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c, idx) => (
                  <CompanyRow
                    key={c.id}
                    company={c}
                    idx={idx}
                    expanded={expandedId === c.id}
                    onToggle={() => setExpandedId(prev => prev === c.id ? null : c.id)}
                    onCrmUpdate={onCrmUpdate}
                  />
                ))}
              </tbody>
            </table>
            {filtered.length > 20 && (
              <button
                className="link-button"
                style={{ fontSize: "0.8125rem", marginTop: "0.625rem" }}
                onClick={() => setShowAll(v => !v)}
              >
                {showAll ? `▲ Pokaż mniej` : `▼ Pokaż wszystkie ${filtered.length} firm`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CompanyRow({ company: c, idx, expanded, onToggle, onCrmUpdate }: {
  company: MarketCompany;
  idx: number;
  expanded: boolean;
  onToggle: () => void;
  onCrmUpdate: (id: string, status: CrmStatus, notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(c.crm_notes ?? "");
  const [saving, setSaving] = useState(false);
  const crm = CRM_CONFIG[c.crm_status ?? "new"];

  async function changeStatus(s: CrmStatus) {
    setSaving(true);
    await onCrmUpdate(c.id, s, notes);
    setSaving(false);
  }

  async function saveNotes() {
    setSaving(true);
    await onCrmUpdate(c.id, (c.crm_status ?? "new") as CrmStatus, notes);
    setSaving(false);
  }

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ borderBottom: expanded ? "none" : "1px solid var(--border-subtle)", cursor: "pointer" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "")}
      >
        <td style={{ padding: "0.375rem 0.5rem 0.375rem 0", opacity: 0.35, fontSize: "0.75rem" }}>
          <span style={{ marginRight: "0.25rem", fontSize: "0.65rem", opacity: 0.5 }}>{expanded ? "▼" : "▶"}</span>{idx + 1}
        </td>
        <td style={{ padding: "0.375rem 0.5rem 0.375rem 0" }}>
          <div style={{ fontWeight: 500 }}>{c.name}</div>
          {c.address && <div style={{ opacity: 0.45, fontSize: "0.725rem" }}>{c.address}</div>}
        </td>
        <td style={{ padding: "0.375rem 0.5rem" }}>
          {c.google_rating != null
            ? <span>{c.google_rating}<span style={{ opacity: 0.45 }}> ({c.review_count})</span></span>
            : <span style={{ opacity: 0.35 }}>—</span>}
        </td>
        <td style={{ padding: "0.375rem 0.5rem" }}>
          {!c.market_website_analysis
            ? <span style={{ opacity: 0.35 }}>—</span>
            : !c.market_website_analysis.has_website
              ? <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>brak</span>
              : c.market_website_analysis.ssl
                ? <span style={{ color: "var(--success)" }}>✓</span>
                : <span style={{ color: "var(--danger)" }}>✗</span>}
        </td>
        <td style={{ padding: "0.375rem 0.5rem" }}>
          {c.market_website_analysis?.pagespeed_mobile != null
            ? <SpeedBadge score={c.market_website_analysis.pagespeed_mobile} />
            : <span style={{ opacity: 0.35 }}>—</span>}
        </td>
        <td style={{ padding: "0.375rem 0.5rem", maxWidth: 120 }}>
          {c.market_website_analysis?.price_range_text
            ? <span style={{ fontSize: "0.7rem", color: "var(--success)" }} title={c.market_website_analysis.price_range_text}>
                {c.market_website_analysis.price_range_text.slice(0, 25)}{c.market_website_analysis.price_range_text.length > 25 ? "…" : ""}
              </span>
            : <span style={{ opacity: 0.35 }}>—</span>}
        </td>
        <td style={{ padding: "0.375rem 0.5rem" }}>
          {c.market_website_analysis?.contact_email
            ? <span style={{ fontSize: "0.7rem", color: "var(--accent)" }}>✉</span>
            : <span style={{ opacity: 0.35 }}>—</span>}
        </td>
        <td style={{ padding: "0.375rem 0.5rem" }}>
          {c.opportunity_score != null ? (
            <strong style={{ color: c.opportunity_score >= 50 ? "var(--accent)" : "var(--text-muted)" }}>
              {Math.round(c.opportunity_score)}
            </strong>
          ) : <span style={{ opacity: 0.35 }}>—</span>}
        </td>
        <td style={{ padding: "0.375rem 0" }}>
          <span style={{ fontSize: "0.7rem", color: crm.color, fontWeight: 500 }}>{crm.label}</span>
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={9} style={{ padding: "0.75rem 0.5rem 1rem", background: "var(--surface-2)" }}>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {/* Left: links */}
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>Kontakt</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <a href={c.maps_url} target="_blank" rel="noopener noreferrer" className="link" style={{ fontSize: "0.8rem", display: "flex", gap: "0.25rem", alignItems: "center" }}>
                    <ExternalLink size={11} /> Google Maps
                  </a>
                  {c.website_url && (
                    <a href={c.website_url} target="_blank" rel="noopener noreferrer" className="link" style={{ fontSize: "0.8rem", display: "flex", gap: "0.25rem", alignItems: "center" }}>
                      <ExternalLink size={11} /> {c.website_url.replace(/^https?:\/\//, "").slice(0, 30)}
                    </a>
                  )}
                  {c.market_website_analysis?.contact_email && (
                    <a href={`mailto:${c.market_website_analysis.contact_email}`} className="link" style={{ fontSize: "0.8rem" }}>
                      ✉ {c.market_website_analysis.contact_email}
                    </a>
                  )}
                  {c.phone && <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>📞 {c.phone}</div>}
                </div>
                {c.score_reason && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", opacity: 0.55 }}>
                    <span style={{ fontWeight: 600 }}>Powód score:</span> {c.score_reason}
                  </div>
                )}
              </div>
              {/* Right: CRM */}
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>Status CRM</div>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.625rem" }}>
                  {(Object.entries(CRM_CONFIG) as [CrmStatus, { label: string; color: string }][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={e => { e.stopPropagation(); void changeStatus(key); }}
                      disabled={saving}
                      style={{
                        fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: 999,
                        border: `1px solid ${c.crm_status === key ? cfg.color : "var(--border)"}`,
                        background: c.crm_status === key ? `color-mix(in srgb, ${cfg.color} 15%, transparent)` : "transparent",
                        color: c.crm_status === key ? cfg.color : "var(--text-muted)",
                        cursor: "pointer", fontWeight: c.crm_status === key ? 600 : 400,
                      }}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Notatki</div>
                <div style={{ display: "flex", gap: "0.375rem" }}>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder="Dodaj notatkę…"
                    rows={2}
                    style={{ flex: 1, fontSize: "0.8125rem", padding: "0.375rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", resize: "vertical" }}
                  />
                  <button
                    className="secondary-button"
                    onClick={e => { e.stopPropagation(); void saveNotes(); }}
                    disabled={saving}
                    style={{ alignSelf: "flex-end", fontSize: "0.75rem" }}
                  >
                    {saving ? <Loader2 size={12} className="spin-icon" /> : "Zapisz"}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Export bar ────────────────────────────────────────────────────────────────

function ExportBar({ report, companies, insights, estimate, personas, proposals, pricingSummary, youtubeSignals, coldEmails }: {
  report: MarketReport;
  companies: MarketCompany[];
  insights: ReviewInsight[];
  estimate: MarketEstimate | null;
  personas: MarketPersona[];
  proposals: ServiceProposal[];
  pricingSummary: PricingSummary | null;
  youtubeSignals: YoutubeSignal[];
  coldEmails: ColdEmail[];
}) {
  function downloadMd() {
    const md = generateMarkdown(report, companies, insights, estimate, personas, proposals, pricingSummary, youtubeSignals, coldEmails);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-${report.industry}-${report.region}-${new Date(report.created_at).toISOString().slice(0, 10)}.md`.replace(/\s+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    window.print();
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
      <button className="secondary-button" onClick={downloadMd}>
        <Download size={14} />
        Pobierz .md
      </button>
      <button className="secondary-button" onClick={printPdf}>
        <Printer size={14} />
        Drukuj / PDF
      </button>
    </div>
  );
}

// ── Cold email card ───────────────────────────────────────────────────────────

function ColdEmailCard({ email }: { email: ColdEmail }) {
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    const text = `Temat: ${email.subject}\n\n${email.body_text}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="card" style={{ padding: "0.875rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{email.company_name}</div>
          {email.contact_email && (
            <a href={`mailto:${email.contact_email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body_text)}`}
              className="link" style={{ fontSize: "0.75rem" }}>
              {email.contact_email}
            </a>
          )}
        </div>
        <button
          className="secondary-button"
          onClick={copyEmail}
          style={{ flexShrink: 0, fontSize: "0.75rem" }}
        >
          {copied ? "✓ Skopiowano" : <><ClipboardCopy size={13} /> Kopiuj</>}
        </button>
      </div>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Temat</div>
      <div style={{ fontSize: "0.875rem", marginBottom: "0.625rem", background: "var(--surface-2)", padding: "0.375rem 0.5rem", borderRadius: 6 }}>
        {email.subject}
      </div>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Treść</div>
      <div style={{ fontSize: "0.8125rem", lineHeight: 1.6, whiteSpace: "pre-wrap", opacity: 0.85 }}>{email.body_text}</div>
      {email.personalization_notes && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", opacity: 0.45, fontStyle: "italic" }}>
          💡 {email.personalization_notes}
        </div>
      )}
    </div>
  );
}

function generateMarkdown(
  report: MarketReport,
  companies: MarketCompany[],
  insights: ReviewInsight[],
  estimate: MarketEstimate | null,
  personas: MarketPersona[],
  proposals: ServiceProposal[],
  pricingSummary: PricingSummary | null,
  youtubeSignals: YoutubeSignal[] = [],
  coldEmails: ColdEmail[] = [],
): string {
  const date = new Date(report.created_at).toLocaleDateString("pl-PL");
  const typeLabel = report.report_type === "products" ? "Produkty / e-commerce" : "Usługi lokalne";
  const lines: string[] = [];

  lines.push(`# Raport rynkowy: ${report.industry} — ${report.region}`);
  lines.push(`**Data:** ${date} | **Typ:** ${typeLabel} | **Status:** ${report.status}`);
  lines.push("");

  // Executive summary
  if (estimate) {
    lines.push("## Executive Summary");
    if (estimate.value_low_pln != null && estimate.value_high_pln != null) {
      lines.push(`- **Szacunek rynku:** ${fmtPln(estimate.value_low_pln)} – ${fmtPln(estimate.value_high_pln)} rocznie`);
    }
    lines.push(`- **Pewność:** ${estimate.confidence}`);
    lines.push(`- **Firm znalezionych:** ${companies.length}`);
    const noWebsite = companies.filter(c => !c.website_url).length;
    lines.push(`- **Bez strony www:** ${noWebsite} (${Math.round(noWebsite / companies.length * 100)}%)`);
    lines.push("");
  }

  // Market estimate
  if (estimate) {
    lines.push("## Szacunek rynku");
    lines.push(estimate.rationale);
    lines.push("");
    if (estimate.market_gaps.length > 0) {
      lines.push("### Luki rynkowe");
      for (const gap of estimate.market_gaps) lines.push(`- ${gap}`);
      lines.push("");
      lines.push(`*Źródła: ${estimate.sources.join("; ")}*`);
    }
    lines.push("");
  }

  // Review insights
  if (insights.length > 0) {
    lines.push("## Problemy klientów (Google Reviews)");
    lines.push("");
    for (const ins of insights) {
      lines.push(`### ${ins.category} — ${ins.percentage.toFixed(0)}%`);
      lines.push(`**Pewność:** ${ins.confidence}`);
      for (const q of ins.sample_quotes) lines.push(`> „${q}"`);
      lines.push(`*Źródło: ${ins.sources.join("; ")}*`);
      lines.push("");
    }
  }

  // Pricing summary
  if (pricingSummary) {
    lines.push("## Ceny rynkowe");
    lines.push(`*Źródeł: ${pricingSummary.price_source_count} | Pewność: ${pricingSummary.confidence}*`);
    lines.push("");
    if (pricingSummary.price_min_text) lines.push(`- **Minimum:** ${pricingSummary.price_min_text}`);
    if (pricingSummary.price_common_range) lines.push(`- **Typowy zakres:** ${pricingSummary.price_common_range}`);
    if (pricingSummary.price_max_text) lines.push(`- **Maksimum:** ${pricingSummary.price_max_text}`);
    if (pricingSummary.claude_summary) { lines.push(""); lines.push(pricingSummary.claude_summary); }
    if (pricingSummary.outliers.length > 0) {
      lines.push(""); lines.push("**Outliery:**");
      for (const o of pricingSummary.outliers) lines.push(`- ⚠ ${o}`);
    }
    lines.push("");
  }

  // YouTube signals
  if (youtubeSignals.length > 0) {
    lines.push("## Sygnały rynkowe (YouTube)");
    lines.push("");
    for (const sig of youtubeSignals) {
      const typeLabel = sig.signal_type === "trending_topic" ? "📈 Trending" : sig.signal_type === "common_question" ? "❓ Pytanie" : "💡 Szansa";
      lines.push(`### ${typeLabel}: ${sig.title}`);
      lines.push(`**Pewność:** ${sig.confidence}`);
      lines.push(sig.description);
      if (sig.example_titles.length > 0) {
        for (const t of sig.example_titles) lines.push(`- ▶ *${t}*`);
      }
      lines.push("");
    }
  }

  // Personas
  if (personas.length > 0) {
    lines.push("## Persony klientów");
    lines.push("");
    for (const p of personas) {
      lines.push(`### ${p.name}`);
      lines.push(`**Rola:** ${p.role}${p.age_range ? ` · ${p.age_range} lat` : ""}`);
      lines.push("");
      if (p.pain_points.length > 0) {
        lines.push("**Problemy:**");
        for (const pt of p.pain_points) lines.push(`- ${pt}`);
      }
      if (p.goals.length > 0) {
        lines.push("**Cele:**");
        for (const g of p.goals) lines.push(`- ${g}`);
      }
      if (p.buying_triggers.length > 0) {
        lines.push("**Wyzwalacze zakupu:**");
        for (const bt of p.buying_triggers) lines.push(`- ${bt}`);
      }
      lines.push("");
    }
  }

  // Service proposals
  if (proposals.length > 0) {
    lines.push("## Propozycje usług");
    lines.push("");
    for (const p of proposals) {
      lines.push(`### ${p.title}${p.estimated_value_pln != null ? ` — ${fmtPln(p.estimated_value_pln)}` : ""}`);
      lines.push(`**Segment:** ${p.target_segment}`);
      lines.push(p.description);
      lines.push(`*${p.rationale}*`);
      lines.push("");
    }
  }

  // Companies table
  lines.push("## Lista potencjalnych klientów");
  lines.push(`Posortowane wg oceny szansy sprzedażowej (${companies.length} firm).`);
  lines.push("");
  lines.push("| # | Firma | Adres | Ocena | SSL | Speed | Ceny | Email | Score | Powód | CRM | Notatki |");
  lines.push("|---|-------|-------|-------|-----|-------|------|-------|-------|-------|-----|---------|");
  for (const [i, c] of companies.entries()) {
    const wa = c.market_website_analysis;
    const ssl = !wa ? "—" : !wa.has_website ? "brak strony" : wa.ssl ? "✓" : "✗";
    const spd = wa?.pagespeed_mobile != null ? String(wa.pagespeed_mobile) : "—";
    const score = c.opportunity_score != null ? String(Math.round(c.opportunity_score)) : "—";
    const rating = c.google_rating != null ? `${c.google_rating} (${c.review_count ?? 0})` : "—";
    const reason = (c.score_reason ?? "").replace(/\|/g, "/");
    const prices = (wa?.price_range_text ?? "—").replace(/\|/g, "/");
    const email = wa?.contact_email ?? "—";
    const crmLabel = CRM_CONFIG[c.crm_status ?? "new"]?.label ?? "Nowy";
    const notes = (c.crm_notes ?? "").replace(/\|/g, "/");
    lines.push(`| ${i + 1} | [${c.name}](${c.maps_url}) | ${c.address ?? "—"} | ${rating} | ${ssl} | ${spd} | ${prices} | ${email} | ${score} | ${reason} | ${crmLabel} | ${notes} |`);
  }
  lines.push("");

  // Cold emails
  if (coldEmails.length > 0) {
    lines.push("## Cold Emails (top firm)");
    lines.push("");
    for (const em of coldEmails) {
      lines.push(`### ${em.company_name}${em.contact_email ? ` — ${em.contact_email}` : ""}`);
      lines.push(`**Temat:** ${em.subject}`);
      lines.push("");
      lines.push(em.body_text);
      if (em.personalization_notes) lines.push(`\n*${em.personalization_notes}*`);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`*Raport wygenerowany przez AI Market Intelligence — Centrum (${date}). Dane źródłowe: Google Places API, Google PageSpeed Insights, YouTube Data API. Każda liczba oparta na publicznych danych.*`);

  return lines.join("\n");
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionRow({ label, section }: { label: string; section: ReportSection | null }) {
  const status = section?.status ?? "pending";
  const pct = section && section.items_total > 0
    ? Math.round((section.items_done / section.items_total) * 100)
    : null;

  const dotColor: Record<string, string> = {
    pending:     "var(--text-muted)",
    in_progress: "var(--accent)",
    done:        "var(--success)",
    partial:     "var(--warning)",
    failed:      "var(--danger)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor[status] ?? dotColor.pending, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: "0.8125rem" }}>{label}</div>
      <div style={{ width: 80, height: 4, background: "var(--border)", borderRadius: 2, flexShrink: 0 }}>
        {status === "done" && <div style={{ height: "100%", background: "var(--success)", borderRadius: 2 }} />}
        {status === "in_progress" && pct != null && (
          <div style={{ height: "100%", background: "var(--accent)", borderRadius: 2, width: `${pct}%` }} />
        )}
        {status === "in_progress" && pct == null && (
          <div style={{ height: "100%", background: "var(--accent)", borderRadius: 2, width: "30%", opacity: 0.6 }} />
        )}
      </div>
      <div style={{ fontSize: "0.7rem", opacity: 0.5, width: 36, textAlign: "right", flexShrink: 0 }}>
        {status === "done" ? "✓" : status === "in_progress" && pct != null ? `${pct}%` : status === "failed" ? "błąd" : ""}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:     { label: "oczekuje",   color: "var(--text-muted)",  bg: "var(--surface-2)" },
    in_progress: { label: "w toku",     color: "var(--accent)",      bg: "color-mix(in srgb, var(--accent) 15%, transparent)" },
    done:        { label: "gotowy",     color: "var(--success)",     bg: "color-mix(in srgb, var(--success) 15%, transparent)" },
    partial:     { label: "częściowy",  color: "var(--warning)",     bg: "color-mix(in srgb, var(--warning) 15%, transparent)" },
    failed:      { label: "błąd",       color: "var(--danger)",      bg: "color-mix(in srgb, var(--danger) 15%, transparent)" },
  };
  const { label, color, bg } = map[status] ?? map.pending;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, color, background: bg, padding: "0.125rem 0.5rem", borderRadius: 999 }}>
      {label}
    </span>
  );
}

function ConfidenceBadge({ level, note }: { level: string; note?: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    high:   { label: "wysoka pewność",  color: "var(--success)" },
    medium: { label: "średnia pewność", color: "var(--warning)"  },
    low:    { label: "niska pewność",   color: "var(--danger)"   },
  };
  const { label, color } = map[level] ?? map.low;
  return (
    <span title={note ?? undefined} style={{ fontSize: "0.7rem", fontWeight: 600, color, background: `color-mix(in srgb, ${color} 12%, transparent)`, padding: "0.125rem 0.5rem", borderRadius: 999 }}>
      {label}
    </span>
  );
}

function SpeedBadge({ score }: { score: number }) {
  const color = score >= 90 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";
  return <strong style={{ color }}>{score}</strong>;
}

function fmtPln(n: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);
}
