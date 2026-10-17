import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, Copy, Download, Filter, Plus, Trash2, X } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import { exportCsv } from "../lib/exportCsv";
import { supabase } from "../lib/supabase";
import {
  CONTACT_STATUSES,
  MIGRATION_HINT,
  errorText,
  isMissingSchemaError,
  normalizeContacts,
  optionalText,
  splitList,
  type CRMContact
} from "../lib/crm";

type SortKey = "name" | "client";

interface NewContact {
  clientId: string;
  fullName: string;
  position: string;
  phones: string;
  emails: string;
  status: string;
}

export function CRMContactsPage({ context }: { context: AppContextValue }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get("client") ?? "";
  const userId = context.session?.user.id ?? null;

  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<NewContact | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase.from("crm_contacts").select("*");
    if (error) {
      setSchemaMissing(isMissingSchemaError(error));
      if (!isMissingSchemaError(error)) setMessage(errorText(error, "Nie udało się wczytać kontaktów."));
      setContacts([]);
    } else {
      setSchemaMissing(false);
      setContacts(normalizeContacts(data));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clientById = useMemo(() => new Map(context.clients.map((client) => [client.id, client])), [context.clients]);
  const filteredClient = clientFilter ? clientById.get(clientFilter) : null;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const positionNeedle = position.trim().toLowerCase();
    const list = contacts
      .filter((contact) => !clientFilter || contact.client_id === clientFilter)
      .filter((contact) => !positionNeedle || (contact.position ?? "").toLowerCase().includes(positionNeedle))
      .filter((contact) => {
        if (!needle) return true;
        return [
          contact.full_name,
          contact.position ?? "",
          contact.status ?? "",
          clientById.get(contact.client_id)?.company ?? "",
          ...contact.phones,
          ...contact.emails
        ].some((value) => value.toLowerCase().includes(needle));
      });
    list.sort((a, b) => {
      const left = sortKey === "name" ? a.full_name : clientById.get(a.client_id)?.company ?? "";
      const right = sortKey === "name" ? b.full_name : clientById.get(b.client_id)?.company ?? "";
      return left.localeCompare(right, "pl") || a.full_name.localeCompare(b.full_name, "pl");
    });
    return sortAsc ? list : list.reverse();
  }, [clientById, clientFilter, contacts, position, query, sortAsc, sortKey]);

  const activeFilters = [query.trim(), position.trim(), clientFilter].filter(Boolean).length;
  const selectedRows = rows.filter((contact) => selected.has(contact.id));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((current) => !current);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function clearFilters() {
    setQuery("");
    setPosition("");
    setSearchParams({});
  }

  function clearClientFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete("client");
    setSearchParams(next);
  }

  function toggleRow(contactId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId); else next.add(contactId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((contact) => contact.id)));
  }

  async function copyEmails() {
    const emails = Array.from(new Set((selectedRows.length ? selectedRows : rows).flatMap((contact) => contact.emails)));
    if (!emails.length) {
      setMessage("Zaznaczone osoby nie mają adresów e-mail.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join("; "));
      setMessage(`Skopiowano adresy e-mail: ${emails.length}.`);
    } catch {
      setMessage(emails.join("; "));
    }
  }

  function exportRows() {
    exportCsv("crm-osoby-kontaktowe.csv", (selectedRows.length ? selectedRows : rows).map((contact) => ({
      "Imię i nazwisko": contact.full_name,
      "Klient": clientById.get(contact.client_id)?.company ?? "",
      "Stanowisko": contact.position ?? "",
      "Telefony": contact.phones.join("; "),
      "E-maile": contact.emails.join("; "),
      "Status": contact.status ?? "",
      "Notatka": contact.notes ?? ""
    })));
  }

  async function deleteSelected() {
    if (!selectedRows.length) return;
    if (!window.confirm(`Usunąć zaznaczone osoby kontaktowe (${selectedRows.length})?`)) return;
    const ids = selectedRows.map((contact) => contact.id);
    const { error } = await supabase.from("crm_contacts").delete().in("id", ids);
    if (error) {
      setMessage(errorText(error, "Nie udało się usunąć kontaktów."));
      return;
    }
    setSelected(new Set());
    setContacts((current) => current.filter((contact) => !ids.includes(contact.id)));
  }

  async function createContact(event: FormEvent) {
    event.preventDefault();
    if (!form || !userId) return;
    const fullName = form.fullName.trim();
    if (!fullName || !form.clientId) {
      setMessage("Wybierz klienta i podaj imię i nazwisko.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("crm_contacts").insert({
      user_id: userId,
      client_id: form.clientId,
      full_name: fullName,
      position: optionalText(form.position),
      phones: splitList(form.phones),
      emails: splitList(form.emails),
      status: optionalText(form.status)
    });
    setSaving(false);
    if (error) {
      setMessage(isMissingSchemaError(error) ? MIGRATION_HINT : errorText(error, "Nie udało się dodać osoby kontaktowej."));
      return;
    }
    setForm(null);
    await load();
  }

  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : null;

  return (
    <div className="page crm-contacts-page">
      <header className="page-header">
        <div>
          <Link to={filteredClient ? `/crm/client/${filteredClient.id}` : "/crm"} className="breadcrumb-link">
            <ChevronLeft size={15} /> {filteredClient ? filteredClient.company : "CRM"}
          </Link>
          <h1>Osoby kontaktowe</h1>
          <p className="page-subtitle">Wszystkie kontakty przypisane do klientów CRM</p>
        </div>
        <button
          className="primary-button"
          onClick={() => setForm({ clientId: clientFilter || context.clients[0]?.id || "", fullName: "", position: "", phones: "", emails: "", status: "" })}
          disabled={schemaMissing || !context.clients.length}
        >
          <Plus size={16} /> Dodaj kontakt
        </button>
      </header>

      {schemaMissing && <div className="warning-box">{MIGRATION_HINT}</div>}
      {message && <div className="warning-box">{message}</div>}

      {form && (
        <form className="crm-contacts-form" onSubmit={createContact}>
          <select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} required>
            {[...context.clients].sort((a, b) => a.company.localeCompare(b.company, "pl")).map((client) => (
              <option key={client.id} value={client.id}>{client.company}</option>
            ))}
          </select>
          <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Imię i nazwisko" required autoFocus />
          <input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Stanowisko" />
          <input value={form.phones} onChange={(event) => setForm({ ...form, phones: event.target.value })} placeholder="Telefony (oddziel ;)" />
          <input value={form.emails} onChange={(event) => setForm({ ...form, emails: event.target.value })} placeholder="E-maile (oddziel ;)" />
          <input value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} placeholder="Status" list="crm-contacts-statuses" />
          <datalist id="crm-contacts-statuses">
            {CONTACT_STATUSES.map((status) => <option key={status} value={status} />)}
          </datalist>
          <div className="crm-form-actions">
            <button type="button" className="secondary-button" onClick={() => setForm(null)}>Anuluj</button>
            <button className="primary-button" disabled={saving}>Zapisz</button>
          </div>
        </form>
      )}

      <div className="crm-filter-bar">
        <span className="crm-filter-count"><Filter size={16} /> Wszystkie filtry ({activeFilters})</span>
        {activeFilters > 0 && (
          <button className="icon-button" onClick={clearFilters} aria-label="Wyczyść filtry"><X size={16} /></button>
        )}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj w kontaktach" />
        <input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Stanowisko" />
        {clientFilter && (
          <span className="crm-filter-chip" title={filteredClient?.company}>
            <span>{filteredClient?.company ?? "Klient"}</span>
            <button onClick={clearClientFilter} aria-label="Usuń filtr klienta"><X size={14} /></button>
          </span>
        )}
        {selectedRows.length > 0 && (
          <div className="crm-bulk-actions">
            <span>Zaznaczono: {selectedRows.length}</span>
            <button className="secondary-button" onClick={() => void copyEmails()}><Copy size={14} /> Kopiuj e-maile</button>
            <button className="secondary-button" onClick={exportRows}><Download size={14} /> CSV</button>
            <button className="icon-button danger-action" onClick={() => void deleteSelected()} aria-label="Usuń zaznaczone"><Trash2 size={15} /></button>
          </div>
        )}
        {!selectedRows.length && rows.length > 0 && (
          <div className="crm-bulk-actions">
            <button className="secondary-button" onClick={() => void copyEmails()}><Copy size={14} /> Kopiuj e-maile</button>
            <button className="secondary-button" onClick={exportRows}><Download size={14} /> CSV</button>
          </div>
        )}
      </div>

      <div className="table-wrap crm-contacts-table-wrap">
        <table className="crm-contacts-table">
          <thead>
            <tr>
              <th className="crm-check-cell">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Zaznacz wszystkie" />
              </th>
              <th className={sortKey === "name" ? "sorted" : ""}>
                <button className="crm-sort-button" onClick={() => toggleSort("name")}>Imię i nazwisko {sortIcon("name")}</button>
              </th>
              <th className={sortKey === "client" ? "sorted" : ""}>
                <button className="crm-sort-button" onClick={() => toggleSort("client")}>Klient {sortIcon("client")}</button>
              </th>
              <th>Numery telefonów</th>
              <th>E-maile</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((contact) => {
              const client = clientById.get(contact.client_id);
              return (
                <tr key={contact.id} className={selected.has(contact.id) ? "selected" : ""}>
                  <td className="crm-check-cell">
                    <input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggleRow(contact.id)} aria-label={`Zaznacz ${contact.full_name}`} />
                  </td>
                  <td>
                    <Link to={`/crm/client/${contact.client_id}`} className="crm-table-link">{contact.full_name}</Link>
                    {contact.position && <span className="crm-subtext">{contact.position}</span>}
                  </td>
                  <td className="crm-ellipsis">
                    {client ? <Link to={`/crm/client/${client.id}`} className="crm-table-link" title={client.company}>{client.company}</Link> : <span className="muted-note">—</span>}
                  </td>
                  <td>
                    {contact.phones.map((phone, index) => (
                      <span key={phone}>{index > 0 && <span className="crm-separator">; </span>}<a href={`tel:${phone}`} className="crm-table-link">{phone}</a></span>
                    ))}
                  </td>
                  <td>
                    {contact.emails.map((email, index) => (
                      <span key={email}>{index > 0 && <span className="crm-separator">; </span>}<a href={`mailto:${email}`} className="crm-table-link">{email}</a></span>
                    ))}
                  </td>
                  <td>{contact.status ?? ""}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr className="table-empty-row">
                <td className="table-empty-cell" colSpan={6}>
                  <div className="empty-state">{loading ? "Ładowanie kontaktów..." : "Brak kontaktów pasujących do filtrów."}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
