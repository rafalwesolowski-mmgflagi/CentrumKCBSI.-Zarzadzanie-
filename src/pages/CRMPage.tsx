import { FormEvent, useMemo, useState } from "react";
import { Check, Download, GitBranch, Globe, Mail, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import { exportCsv } from "../lib/exportCsv";
import type { CRMClient, CRMClientStage } from "../lib/types";

interface ClientForm {
  projectId: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  stage: CRMClientStage;
  value: string;
  currency: string;
  projectUrl: string;
  repositoryUrl: string;
  nextFollowUp: string;
  advancePayment: string;
  notes: string;
}

const STAGE_OPTIONS: Array<{ value: CRMClientStage; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Zakwalifikowany" },
  { value: "active", label: "Aktywny klient" },
  { value: "follow_up", label: "Follow-up" },
  { value: "paused", label: "Wstrzymany" },
  { value: "closed", label: "Zamknięty" }
];

const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF", "NOK"];

const emptyForm: ClientForm = {
  projectId: "",
  company: "",
  contactName: "",
  email: "",
  phone: "",
  stage: "lead",
  value: "",
  currency: "PLN",
  projectUrl: "",
  repositoryUrl: "",
  nextFollowUp: "",
  advancePayment: "",
  notes: ""
};

export function CRMPage({ context }: { context: AppContextValue }) {
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [stage, setStage] = useState<CRMClientStage | "all">("all");
  const [newClient, setNewClient] = useState<ClientForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClient, setEditClient] = useState<ClientForm>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const projectById = useMemo(
    () => new Map(context.projects.map((project) => [project.id, project])),
    [context.projects]
  );

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return context.clients
      .filter((client) => projectId === "all" || client.project_id === projectId)
      .filter((client) => stage === "all" || client.stage === stage)
      .filter((client) => {
        if (!normalizedQuery) return true;
        const projectName = client.project_id ? projectById.get(client.project_id)?.name ?? "" : "";
        return [
          client.company,
          client.contact_name ?? "",
          client.email ?? "",
          client.phone ?? "",
          client.notes ?? "",
          projectName,
          stageLabel(client.stage)
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        const nextA = a.next_follow_up ?? "9999-12-31";
        const nextB = b.next_follow_up ?? "9999-12-31";
        return nextA.localeCompare(nextB) || a.company.localeCompare(b.company);
      });
  }, [context.clients, projectById, projectId, query, stage]);

  const activeClients = context.clients.filter((client) => client.stage === "active").length;
  const openPipeline = context.clients
    .filter((client) => client.stage !== "closed")
    .reduce((sum, client) => sum + (client.value ?? 0), 0);
  const dueFollowUps = context.clients.filter((client) => isDue(client.next_follow_up) && client.stage !== "closed").length;

  async function createClient(event: FormEvent) {
    event.preventDefault();
    const company = newClient.company.trim();
    if (!company) {
      setMessage("Nazwa klienta nie może być pusta.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await context.createClient(toInput({ ...newClient, company }));
      setNewClient(emptyForm);
      setMessage("Klient dodany do CRM.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się dodać klienta.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(client: CRMClient) {
    setEditingId(client.id);
    setEditClient({
      projectId: client.project_id ?? "",
      company: client.company,
      contactName: client.contact_name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      stage: client.stage,
      value: client.value != null ? String(client.value) : "",
      currency: client.currency || "PLN",
      projectUrl: client.project_url ?? "",
      repositoryUrl: client.repository_url ?? "",
      nextFollowUp: client.next_follow_up ?? "",
      advancePayment: client.advance_payment != null ? String(client.advance_payment) : "",
      notes: client.notes ?? ""
    });
    setMessage(null);
  }

  async function saveEdit(clientId: string) {
    const company = editClient.company.trim();
    if (!company) {
      setMessage("Nazwa klienta nie może być pusta.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await context.updateClient(clientId, toInput({ ...editClient, company }));
      setEditingId(null);
      setMessage("CRM zaktualizowany.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać klienta.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient(client: CRMClient) {
    if (!window.confirm(`Usunąć klienta "${client.company}" z CRM?`)) return;
    setMessage(null);
    try {
      await context.deleteClient(client.id);
      setMessage("Klient usunięty.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się usunąć klienta.");
    }
  }

  function exportToCsv() {
    const rowsForExport = rows.map((client) => ({
      "Klient": client.company,
      "Osoba kontaktowa": client.contact_name ?? "",
      "Email": client.email ?? "",
      "Telefon": client.phone ?? "",
      "Projekt": client.project_id ? projectById.get(client.project_id)?.name ?? "" : "",
      "Etap": stageLabel(client.stage),
      "Wartość": client.value ?? "",
      "Waluta": client.currency,
      "Adres projektu": client.project_url ?? "",
      "Repozytorium": client.repository_url ?? "",
      "Follow-up": client.next_follow_up ?? "",
      "Zaliczka": client.advance_payment ?? "",
      "Notatki": client.notes ?? ""
    }));
    exportCsv("crm-klienci-projektow.csv", rowsForExport);
  }

  return (
    <div className="page crm-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Relacje klient-projekt</span>
          <h1>CRM</h1>
          <p className="page-subtitle">Klienci, kontakty i follow-upy przypisane do projektów</p>
        </div>
        <button className="secondary-button" onClick={exportToCsv}>
          <Download size={16} />
          Eksportuj CSV
        </button>
      </header>

      <div className="crm-summary-grid">
        <div className="crm-summary-card">
          <span>Klienci w CRM</span>
          <strong>{context.clients.length}</strong>
        </div>
        <div className="crm-summary-card">
          <span>Aktywni</span>
          <strong className="success-text">{activeClients}</strong>
        </div>
        <div className="crm-summary-card">
          <span>Follow-up teraz</span>
          <strong className={dueFollowUps ? "warning-text" : ""}>{dueFollowUps}</strong>
        </div>
        <div className="crm-summary-card">
          <span>Otwarty pipeline</span>
          <strong>{formatMoney(openPipeline, "PLN")}</strong>
        </div>
      </div>

      <div className="filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj klienta, osoby, maila, projektu..." />
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="all">Wszystkie projekty</option>
          {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
        <select value={stage} onChange={(event) => setStage(event.target.value as CRMClientStage | "all")}>
          <option value="all">Każdy etap</option>
          {STAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </div>

      <form className="crm-form" onSubmit={createClient}>
        <input value={newClient.company} onChange={(event) => setNewClient((current) => ({ ...current, company: event.target.value }))} placeholder="Firma / klient" required />
        <input value={newClient.contactName} onChange={(event) => setNewClient((current) => ({ ...current, contactName: event.target.value }))} placeholder="Osoba kontaktowa" />
        <input value={newClient.email} onChange={(event) => setNewClient((current) => ({ ...current, email: event.target.value }))} type="email" placeholder="Email" />
        <input value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon" />
        <select value={newClient.projectId} onChange={(event) => setNewClient((current) => ({ ...current, projectId: event.target.value }))}>
          <option value="">Bez projektu</option>
          {context.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
        <select value={newClient.stage} onChange={(event) => setNewClient((current) => ({ ...current, stage: event.target.value as CRMClientStage }))}>
          {STAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        <input value={newClient.value} onChange={(event) => setNewClient((current) => ({ ...current, value: event.target.value }))} type="number" min="0" step="0.01" placeholder="Wartość" />
        <select value={newClient.currency} onChange={(event) => setNewClient((current) => ({ ...current, currency: event.target.value }))}>
          {CURRENCIES.map((currency) => <option value={currency} key={currency}>{currency}</option>)}
        </select>
        <input value={newClient.projectUrl} onChange={(event) => setNewClient((current) => ({ ...current, projectUrl: event.target.value }))} type="url" placeholder="Adres projektu (URL)" />
        <input value={newClient.repositoryUrl} onChange={(event) => setNewClient((current) => ({ ...current, repositoryUrl: event.target.value }))} type="url" placeholder="Repozytorium (URL)" />
        <input value={newClient.nextFollowUp} onChange={(event) => setNewClient((current) => ({ ...current, nextFollowUp: event.target.value }))} type="date" />
        <input value={newClient.advancePayment} onChange={(event) => setNewClient((current) => ({ ...current, advancePayment: event.target.value }))} type="number" min="0" step="0.01" placeholder="Zaliczka" />
        <textarea value={newClient.notes} onChange={(event) => setNewClient((current) => ({ ...current, notes: event.target.value }))} placeholder="Notatki o relacji, ustaleniach, kolejnych krokach" />
        <button className="secondary-button" disabled={saving}>
          <Plus size={16} />
          Dodaj klienta
        </button>
      </form>
      {message && <div className="warning-box">{message}</div>}

      <div className="table-wrap crm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Klient</th>
              <th>Kontakt</th>
              <th>Projekt</th>
              <th>Etap</th>
              <th>Wartość</th>
              <th>Zaliczka</th>
              <th>Follow-up</th>
              <th>Notatki</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((client) => {
              const isEditing = editingId === client.id;
              const project = client.project_id ? projectById.get(client.project_id) : null;

              if (isEditing) {
                return (
                  <tr key={client.id}>
                    <td>
                      <div className="crm-contact-edit">
                        <input className="table-input" value={editClient.company} onChange={(event) => setEditClient((current) => ({ ...current, company: event.target.value }))} placeholder="Firma / klient" />
                        <input className="table-input" value={editClient.projectUrl} onChange={(event) => setEditClient((current) => ({ ...current, projectUrl: event.target.value }))} type="url" placeholder="Adres projektu (URL)" />
                        <input className="table-input" value={editClient.repositoryUrl} onChange={(event) => setEditClient((current) => ({ ...current, repositoryUrl: event.target.value }))} type="url" placeholder="Repozytorium (URL)" />
                      </div>
                    </td>
                    <td>
                      <div className="crm-contact-edit">
                        <input className="table-input" value={editClient.contactName} onChange={(event) => setEditClient((current) => ({ ...current, contactName: event.target.value }))} placeholder="Osoba" />
                        <input className="table-input" value={editClient.email} onChange={(event) => setEditClient((current) => ({ ...current, email: event.target.value }))} type="email" placeholder="Email" />
                        <input className="table-input" value={editClient.phone} onChange={(event) => setEditClient((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon" />
                      </div>
                    </td>
                    <td>
                      <select className="table-input" value={editClient.projectId} onChange={(event) => setEditClient((current) => ({ ...current, projectId: event.target.value }))}>
                        <option value="">Bez projektu</option>
                        {context.projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="table-input" value={editClient.stage} onChange={(event) => setEditClient((current) => ({ ...current, stage: event.target.value as CRMClientStage }))}>
                        {STAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="crm-money-edit">
                        <input className="table-input" value={editClient.value} onChange={(event) => setEditClient((current) => ({ ...current, value: event.target.value }))} type="number" min="0" step="0.01" placeholder="0.00" />
                        <select className="table-input" value={editClient.currency} onChange={(event) => setEditClient((current) => ({ ...current, currency: event.target.value }))}>
                          {CURRENCIES.map((currency) => <option value={currency} key={currency}>{currency}</option>)}
                        </select>
                      </div>
                    </td>
                    <td>
                      <input className="table-input" value={editClient.advancePayment} onChange={(event) => setEditClient((current) => ({ ...current, advancePayment: event.target.value }))} type="number" min="0" step="0.01" placeholder="0.00" />
                    </td>
                    <td>
                      <input className="table-input" value={editClient.nextFollowUp} onChange={(event) => setEditClient((current) => ({ ...current, nextFollowUp: event.target.value }))} type="date" />
                    </td>
                    <td>
                      <textarea className="table-input crm-notes-edit" value={editClient.notes} onChange={(event) => setEditClient((current) => ({ ...current, notes: event.target.value }))} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" disabled={saving} onClick={() => void saveEdit(client.id)} aria-label="Zapisz klienta"><Check size={16} /></button>
                        <button className="icon-button" onClick={() => setEditingId(null)} aria-label="Anuluj edycję"><X size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={client.id}>
                  <td>
                    <div className="crm-client-cell">
                      <strong>{client.company}</strong>
                      {client.contact_name && <span>{client.contact_name}</span>}
                      {(client.project_url || client.repository_url) && (
                        <div className="crm-client-links">
                          {client.project_url && <a href={client.project_url} target="_blank" rel="noopener noreferrer"><Globe size={13} /> Projekt</a>}
                          {client.repository_url && <a href={client.repository_url} target="_blank" rel="noopener noreferrer"><GitBranch size={13} /> Repo</a>}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="crm-contact-cell">
                      {client.email && <a href={`mailto:${client.email}`}><Mail size={14} />{client.email}</a>}
                      {client.phone && <a href={`tel:${client.phone}`}><Phone size={14} />{client.phone}</a>}
                      {!client.email && !client.phone && <span className="muted-note">Brak kontaktu</span>}
                    </div>
                  </td>
                  <td>
                    {project ? (
                      <span className="project-name-cell">
                        <span className="color-dot" style={{ background: project.color }} />
                        <strong>{project.name}</strong>
                      </span>
                    ) : (
                      <span className="muted-note">Bez projektu</span>
                    )}
                  </td>
                  <td><span className={`crm-stage-pill ${client.stage}`}>{stageLabel(client.stage)}</span></td>
                  <td>{formatMoney(client.value, client.currency)}</td>
                  <td>{client.advance_payment != null ? formatMoney(client.advance_payment, client.currency) : <span className="muted-note">—</span>}</td>
                  <td>
                    {client.next_follow_up ? (
                      <span className={isDue(client.next_follow_up) ? "warning-text" : ""}>{client.next_follow_up}</span>
                    ) : (
                      <span className="muted-note">Brak daty</span>
                    )}
                  </td>
                  <td><span className="crm-notes-text">{client.notes ?? "—"}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" onClick={() => startEdit(client)} aria-label="Edytuj klienta"><Pencil size={16} /></button>
                      <button className="icon-button danger-action" onClick={() => void deleteClient(client)} aria-label="Usuń klienta"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr className="table-empty-row">
                <td className="table-empty-cell" colSpan={9}>
                  <div className="empty-state">Brak klientów pasujących do filtrów. Dodaj pierwszą relację klient-projekt.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toInput(form: ClientForm) {
  return {
    projectId: form.projectId || null,
    company: form.company,
    contactName: form.contactName,
    email: form.email,
    phone: form.phone,
    stage: form.stage,
    value: nullableFloat(form.value),
    currency: form.currency || "PLN",
    projectUrl: form.projectUrl,
    repositoryUrl: form.repositoryUrl,
    nextFollowUp: form.nextFollowUp,
    advancePayment: nullableFloat(form.advancePayment),
    notes: form.notes
  };
}

function nullableFloat(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function stageLabel(stage: CRMClientStage) {
  return STAGE_OPTIONS.find((option) => option.value === stage)?.label ?? stage;
}

function formatMoney(value: number | null, currency: string) {
  if (value == null) return "-";
  return `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function isDue(date: string | null) {
  if (!date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return date <= today;
}
