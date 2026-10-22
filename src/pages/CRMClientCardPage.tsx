import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUp,
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Mail,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Users,
  X
} from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import { supabase } from "../lib/supabase";
import type { CRMClientStage } from "../lib/types";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_ORDER,
  CONTACT_STATUSES,
  DEFAULT_PINNED_KINDS,
  MIGRATION_HINT,
  PRICE_GROUPS,
  REMINDER_LANGUAGES,
  activityVerb,
  errorText,
  formatAmount,
  formatDateTime,
  fromDatetimeLocal,
  isMissingSchemaError,
  normalizeActivities,
  normalizeClientDetails,
  normalizeContacts,
  optionalText,
  splitList,
  toDatetimeLocal,
  websiteHref,
  type CRMActivity,
  type CRMActivityKind,
  type CRMClientDetails,
  type CRMContact,
  type CRMDeliveryAddress
} from "../lib/crm";

type TabKey = "timeline" | CRMActivityKind;

interface ClientFields {
  company: string;
  website: string;
  address: string;
  taxId: string;
  priceGroup: string;
  bankAccount: string;
  email: string;
  phone: string;
  stage: CRMClientStage;
  nextFollowUp: string;
  nextContactReminder: string;
  invoiceNote: string;
  ccEmails: string;
  reminderLanguage: string;
  deliveryAddresses: CRMDeliveryAddress[];
}

interface ContactFields {
  fullName: string;
  position: string;
  phones: string;
  emails: string;
  status: string;
  notes: string;
}

interface ActivityFields {
  kind: CRMActivityKind;
  title: string;
  body: string;
  direction: "" | "in" | "out";
  counterpart: string;
  reference: string;
  amount: string;
  currency: string;
  status: "" | "open" | "done";
  url: string;
  occurredAt: string;
  contactId: string;
}

const STAGES: Array<{ value: CRMClientStage; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Zakwalifikowany" },
  { value: "active", label: "Aktywny klient" },
  { value: "follow_up", label: "Follow-up" },
  { value: "paused", label: "Wstrzymany" },
  { value: "closed", label: "Zamknięty" }
];

const FIELD_LABELS: Record<keyof ClientFields, string> = {
  company: "Nazwa",
  website: "Strona www",
  address: "Adres",
  taxId: "NIP",
  priceGroup: "Gr. cenowa",
  bankAccount: "Nr konta",
  email: "E-mail",
  phone: "Telefon",
  stage: "Etap",
  nextFollowUp: "Data następnego kontaktu",
  nextContactReminder: "Przypomnienie",
  invoiceNote: "Notatka",
  ccEmails: "Do wiadomości (CC)",
  reminderLanguage: "Język przypomnień",
  deliveryAddresses: "Adresy dostawy"
};

function displayValue(value: ClientFields[keyof ClientFields]) {
  if (Array.isArray(value)) {
    return value.map((item) => [item.label, item.address].filter(Boolean).join(": ")).join(" | ") || "—";
  }
  return value || "—";
}

const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF", "NOK"];
const PINNED_STORAGE_KEY = "centrum-crm-card-tabs";
const BODY_PREVIEW_LIMIT = 260;

const QUICK_ADD: CRMActivityKind[] = ["email", "note", "offer", "opportunity", "order", "warehouse", "reminder"];

const emptyContact: ContactFields = { fullName: "", position: "", phones: "", emails: "", status: "", notes: "" };

function fieldsFromClient(client: CRMClientDetails): ClientFields {
  return {
    company: client.company,
    website: client.website ?? "",
    address: client.address ?? "",
    taxId: client.tax_id ?? "",
    priceGroup: client.price_group ?? "",
    bankAccount: client.bank_account ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    stage: client.stage,
    nextFollowUp: client.next_follow_up ?? "",
    nextContactReminder: toDatetimeLocal(client.next_contact_reminder),
    invoiceNote: client.invoice_note ?? "",
    ccEmails: client.cc_emails.join(", "),
    reminderLanguage: client.reminder_language ?? "pl",
    deliveryAddresses: client.delivery_addresses.map((item) => ({ ...item }))
  };
}

function emptyActivity(kind: CRMActivityKind): ActivityFields {
  return {
    kind,
    title: "",
    body: "",
    direction: kind === "email" ? "in" : "",
    counterpart: "",
    reference: "",
    amount: "",
    currency: "PLN",
    status: ACTIVITY_KINDS[kind].tracksStatus ? "open" : "",
    url: "",
    occurredAt: toDatetimeLocal(new Date().toISOString()),
    contactId: ""
  };
}

function readPinned(): CRMActivityKind[] {
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return DEFAULT_PINNED_KINDS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PINNED_KINDS;
    return parsed.filter((kind): kind is CRMActivityKind => typeof kind === "string" && kind in ACTIVITY_KINDS);
  } catch {
    return DEFAULT_PINNED_KINDS;
  }
}

function writePinned(kinds: CRMActivityKind[]) {
  try {
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(kinds));
  } catch {
    // Pinned tabs still work for this visit without storage.
  }
}

export function CRMClientCardPage({ context }: { context: AppContextValue }) {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = context.session?.user.id ?? null;

  const [client, setClient] = useState<CRMClientDetails | null>(null);
  const [fields, setFields] = useState<ClientFields | null>(null);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pinned, setPinned] = useState<CRMActivityKind[]>(readPinned);
  const [activeTab, setActiveTab] = useState<TabKey>("timeline");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [composer, setComposer] = useState<ActivityFields | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [contactSort, setContactSort] = useState<"asc" | "desc">("asc");
  const [contactForm, setContactForm] = useState<ContactFields | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setMessage(null);
    try {
      const [clientRes, contactsRes, activitiesRes] = await Promise.all([
        supabase.from("crm_clients").select("*").eq("id", id).maybeSingle(),
        supabase.from("crm_contacts").select("*").eq("client_id", id),
        supabase.from("crm_activities").select("*").eq("client_id", id).order("occurred_at", { ascending: false })
      ]);
      if (clientRes.error) throw clientRes.error;
      const details = normalizeClientDetails(clientRes.data);
      setClient(details);
      setFields(details ? fieldsFromClient(details) : null);
      setNotFound(!details);

      const missing = [contactsRes.error, activitiesRes.error].some((error) => error && isMissingSchemaError(error));
      setSchemaMissing(missing);
      const otherError = [contactsRes.error, activitiesRes.error].find((error) => error && !isMissingSchemaError(error));
      if (otherError) throw otherError;
      setContacts(normalizeContacts(contactsRes.data));
      setActivities(normalizeActivities(activitiesRes.data));
    } catch (error) {
      setMessage(errorText(error, "Nie udało się wczytać karty klienta."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    setActiveTab("timeline");
    setComposer(null);
    setContactForm(null);
    setEditingContactId(null);
  }, [load]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const orderedClients = useMemo(
    () => [...context.clients].sort((a, b) => a.company.localeCompare(b.company, "pl")),
    [context.clients]
  );
  const position = orderedClients.findIndex((item) => item.id === id);
  const prevClient = position > 0 ? orderedClients[position - 1] : null;
  const nextClient = position >= 0 && position < orderedClients.length - 1 ? orderedClients[position + 1] : null;

  const counts = useMemo(() => {
    const result = new Map<CRMActivityKind, number>();
    for (const activity of activities) result.set(activity.kind, (result.get(activity.kind) ?? 0) + 1);
    return result;
  }, [activities]);

  const visibleActivities = useMemo(
    () => activeTab === "timeline"
      ? activities.filter((activity) => activity.kind !== "change")
      : activities.filter((activity) => activity.kind === activeTab),
    [activeTab, activities]
  );

  const sortedContacts = useMemo(() => {
    const list = [...contacts].sort((a, b) => a.full_name.localeCompare(b.full_name, "pl"));
    return contactSort === "asc" ? list : list.reverse();
  }, [contactSort, contacts]);

  const contactById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const menuKinds = ACTIVITY_KIND_ORDER.filter((kind) => !pinned.includes(kind));
  const isDirty = Boolean(client && fields && JSON.stringify(fields) !== JSON.stringify(fieldsFromClient(client)));

  function updateField<K extends keyof ClientFields>(key: K, value: ClientFields[K]) {
    setFields((current) => current ? { ...current, [key]: value } : current);
  }

  function updateAddress(index: number, patch: Partial<CRMDeliveryAddress>) {
    setFields((current) => current ? {
      ...current,
      deliveryAddresses: current.deliveryAddresses.map((item, i) => i === index ? { ...item, ...patch } : item)
    } : current);
  }

  function addAddress() {
    setFields((current) => current ? {
      ...current,
      deliveryAddresses: [...current.deliveryAddresses, { label: "", address: "" }]
    } : current);
  }

  function removeAddress(index: number) {
    setFields((current) => current ? {
      ...current,
      deliveryAddresses: current.deliveryAddresses.filter((_, i) => i !== index)
    } : current);
  }

  function pinTab(kind: CRMActivityKind) {
    const next = ACTIVITY_KIND_ORDER.filter((item) => item === kind || pinned.includes(item));
    setPinned(next);
    writePinned(next);
  }

  function unpinTab(kind: CRMActivityKind) {
    const next = pinned.filter((item) => item !== kind);
    setPinned(next);
    writePinned(next);
    if (activeTab === kind) setActiveTab("timeline");
  }

  function openComposer(kind: CRMActivityKind) {
    setComposer(emptyActivity(kind));
    setActiveTab(kind === "change" ? "timeline" : kind);
    setMenuOpen(false);
  }

  async function saveClient() {
    if (!client || !fields) return;
    const company = fields.company.trim();
    if (!company) {
      setMessage("Nazwa klienta nie może być pusta.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const before = fieldsFromClient(client);
    const changed = (Object.keys(FIELD_LABELS) as Array<keyof ClientFields>).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(fields[key]));
    try {
      const { error } = await supabase.from("crm_clients").update({
        company,
        website: optionalText(fields.website),
        address: optionalText(fields.address),
        tax_id: optionalText(fields.taxId),
        price_group: optionalText(fields.priceGroup),
        bank_account: optionalText(fields.bankAccount),
        email: optionalText(fields.email),
        phone: optionalText(fields.phone),
        stage: fields.stage,
        next_follow_up: optionalText(fields.nextFollowUp),
        next_contact_reminder: fromDatetimeLocal(fields.nextContactReminder),
        invoice_note: optionalText(fields.invoiceNote),
        cc_emails: splitList(fields.ccEmails),
        reminder_language: optionalText(fields.reminderLanguage),
        delivery_addresses: fields.deliveryAddresses
          .map((item) => ({ label: item.label.trim(), address: item.address.trim() }))
          .filter((item) => item.label || item.address),
        updated_at: new Date().toISOString()
      }).eq("id", client.id);
      if (error) {
        if (isMissingSchemaError(error)) throw new Error(MIGRATION_HINT);
        throw error;
      }
      if (changed.length && userId && !schemaMissing) {
        // Best effort: the change history must never block saving the card.
        await supabase.from("crm_activities").insert({
          user_id: userId,
          client_id: client.id,
          kind: "change",
          title: `Zmieniono: ${changed.map((key) => FIELD_LABELS[key]).join(", ")}`,
          body: changed.map((key) => `${FIELD_LABELS[key]}: ${displayValue(before[key])} → ${displayValue(fields[key])}`).join("\n")
        });
      }
      setMessage("Karta klienta zapisana.");
      await Promise.all([load(), context.reload()]);
    } catch (error) {
      setMessage(errorText(error, "Nie udało się zapisać karty klienta."));
    } finally {
      setSaving(false);
    }
  }

  async function saveActivity(event: FormEvent) {
    event.preventDefault();
    if (!composer || !client || !userId) return;
    const title = composer.title.trim();
    if (!title) {
      setMessage("Podaj tytuł wpisu.");
      return;
    }
    const amount = composer.amount.trim() ? Number(composer.amount.replace(",", ".")) : null;
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.from("crm_activities").insert({
        user_id: userId,
        client_id: client.id,
        contact_id: composer.contactId || null,
        kind: composer.kind,
        title,
        body: optionalText(composer.body),
        direction: composer.direction || null,
        counterpart: optionalText(composer.counterpart),
        reference: optionalText(composer.reference),
        amount: amount != null && Number.isFinite(amount) ? amount : null,
        currency: composer.currency || "PLN",
        status: composer.status || null,
        url: optionalText(composer.url),
        occurred_at: fromDatetimeLocal(composer.occurredAt) ?? new Date().toISOString()
      });
      if (error) {
        if (isMissingSchemaError(error)) throw new Error(MIGRATION_HINT);
        throw error;
      }
      setComposer(null);
      await load();
    } catch (error) {
      setMessage(errorText(error, "Nie udało się dodać wpisu."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivityStatus(activity: CRMActivity) {
    const status = activity.status === "done" ? "open" : "done";
    const { error } = await supabase.from("crm_activities").update({ status, updated_at: new Date().toISOString() }).eq("id", activity.id);
    if (error) {
      setMessage(errorText(error, "Nie udało się zmienić statusu."));
      return;
    }
    setActivities((current) => current.map((item) => item.id === activity.id ? { ...item, status } : item));
  }

  async function deleteActivity(activity: CRMActivity) {
    if (!window.confirm(`Usunąć wpis "${activity.title}"?`)) return;
    const { error } = await supabase.from("crm_activities").delete().eq("id", activity.id);
    if (error) {
      setMessage(errorText(error, "Nie udało się usunąć wpisu."));
      return;
    }
    setActivities((current) => current.filter((item) => item.id !== activity.id));
  }

  function startContactEdit(contact: CRMContact | null) {
    setEditingContactId(contact?.id ?? null);
    setContactForm(contact ? {
      fullName: contact.full_name,
      position: contact.position ?? "",
      phones: contact.phones.join("; "),
      emails: contact.emails.join("; "),
      status: contact.status ?? "",
      notes: contact.notes ?? ""
    } : emptyContact);
  }

  async function saveContact(event: FormEvent) {
    event.preventDefault();
    if (!contactForm || !client || !userId) return;
    const fullName = contactForm.fullName.trim();
    if (!fullName) {
      setMessage("Podaj imię i nazwisko.");
      return;
    }
    const row = {
      full_name: fullName,
      position: optionalText(contactForm.position),
      phones: splitList(contactForm.phones),
      emails: splitList(contactForm.emails),
      status: optionalText(contactForm.status),
      notes: optionalText(contactForm.notes),
      updated_at: new Date().toISOString()
    };
    setSaving(true);
    setMessage(null);
    try {
      const { error } = editingContactId
        ? await supabase.from("crm_contacts").update(row).eq("id", editingContactId)
        : await supabase.from("crm_contacts").insert({ ...row, user_id: userId, client_id: client.id });
      if (error) {
        if (isMissingSchemaError(error)) throw new Error(MIGRATION_HINT);
        throw error;
      }
      setContactForm(null);
      setEditingContactId(null);
      await load();
    } catch (error) {
      setMessage(errorText(error, "Nie udało się zapisać osoby kontaktowej."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contact: CRMContact) {
    if (!window.confirm(`Usunąć osobę kontaktową "${contact.full_name}"?`)) return;
    const { error } = await supabase.from("crm_contacts").delete().eq("id", contact.id);
    if (error) {
      setMessage(errorText(error, "Nie udało się usunąć osoby kontaktowej."));
      return;
    }
    setContactForm(null);
    setEditingContactId(null);
    setContacts((current) => current.filter((item) => item.id !== contact.id));
  }

  if (loading && !client) {
    return <div className="page"><div className="empty-state">Ładowanie karty klienta...</div></div>;
  }

  if (notFound || !client || !fields) {
    return (
      <div className="page">
        <Link to="/crm" className="breadcrumb-link"><ChevronLeft size={16} /> Wróć do CRM</Link>
        <div className="warning-box">{message ?? "Nie znaleziono klienta. Mógł zostać usunięty."}</div>
      </div>
    );
  }

  const activeLabel = activeTab === "timeline" ? "Oś czasu" : ACTIVITY_KINDS[activeTab].tab;

  return (
    <div className="page crm-card-page">
      <header className="crm-card-header">
        <div className="crm-card-title">
          <Link to="/crm" className="icon-button" aria-label="Wróć do listy klientów"><ChevronLeft size={20} /></Link>
          <h1 title={client.company}>{client.company}</h1>
          <button className="icon-button" onClick={() => void load()} aria-label="Odśwież kartę" disabled={loading}>
            <RefreshCw size={17} className={loading ? "spin-icon" : ""} />
          </button>
        </div>

        <div className="crm-card-actions">
          <button className="primary-button" onClick={() => openComposer("invoice")}>
            <Plus size={16} /> Dodaj fakturę
          </button>
          <div className="crm-card-quick-add" role="group" aria-label="Szybkie dodawanie">
            {QUICK_ADD.map((kind) => {
              const Icon = ACTIVITY_KINDS[kind].icon;
              return (
                <button key={kind} className="icon-button" onClick={() => openComposer(kind)} title={`Dodaj: ${ACTIVITY_KINDS[kind].noun.toLowerCase()}`} aria-label={`Dodaj: ${ACTIVITY_KINDS[kind].noun}`}>
                  <Icon size={17} />
                </button>
              );
            })}
          </div>
          <div className="crm-card-pager">
            <span>{position >= 0 ? position + 1 : "–"} z {orderedClients.length}</span>
            <button className="icon-button" disabled={!prevClient} onClick={() => prevClient && navigate(`/crm/client/${prevClient.id}`)} aria-label="Poprzedni klient"><ChevronLeft size={17} /></button>
            <button className="icon-button" disabled={!nextClient} onClick={() => nextClient && navigate(`/crm/client/${nextClient.id}`)} aria-label="Następny klient"><ChevronRight size={17} /></button>
          </div>
        </div>
      </header>

      {schemaMissing && <div className="warning-box">{MIGRATION_HINT}</div>}
      {message && <div className="warning-box">{message}</div>}

      <div className="crm-card-layout">
        <aside className="crm-card-side">
          <section className="crm-card-panel">
            <div className="crm-card-fields">
              <label className="crm-field wide">
                <span>Nazwa</span>
                <input value={fields.company} onChange={(event) => updateField("company", event.target.value)} />
              </label>
              <label className="crm-field wide">
                <span>Strona www</span>
                <div className="crm-field-with-link">
                  <input value={fields.website} onChange={(event) => updateField("website", event.target.value)} placeholder="np. firma.pl" />
                  {fields.website.trim() && (
                    <a className="icon-button" href={websiteHref(fields.website.trim())} target="_blank" rel="noopener noreferrer" aria-label="Otwórz stronę"><Globe size={16} /></a>
                  )}
                </div>
              </label>
              <label className="crm-field wide">
                <span>Adres</span>
                <input value={fields.address} onChange={(event) => updateField("address", event.target.value)} placeholder="Ulica, kod, miasto, kraj" />
              </label>
              <label className="crm-field">
                <span>NIP</span>
                <input value={fields.taxId} onChange={(event) => updateField("taxId", event.target.value)} />
              </label>
              <label className="crm-field">
                <span>Etap</span>
                <select value={fields.stage} onChange={(event) => updateField("stage", event.target.value as CRMClientStage)}>
                  {STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
                </select>
              </label>
              <label className="crm-field">
                <span>E-mail</span>
                <input type="email" value={fields.email} onChange={(event) => updateField("email", event.target.value)} />
              </label>
              <label className="crm-field">
                <span>Telefon</span>
                <input value={fields.phone} onChange={(event) => updateField("phone", event.target.value)} />
              </label>
              <label className="crm-field">
                <span>Gr. cenowa</span>
                <select value={fields.priceGroup} onChange={(event) => updateField("priceGroup", event.target.value)}>
                  <option value="">—</option>
                  {PRICE_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
                </select>
              </label>
              <label className="crm-field">
                <span>Nr konta</span>
                <input value={fields.bankAccount} onChange={(event) => updateField("bankAccount", event.target.value)} />
              </label>
              <label className="crm-field">
                <span>Data następnego kontaktu</span>
                <input type="date" value={fields.nextFollowUp} onChange={(event) => updateField("nextFollowUp", event.target.value)} />
              </label>
              <label className="crm-field">
                <span>Przypomnij o dacie nast. kontaktu</span>
                <input type="datetime-local" value={fields.nextContactReminder} onChange={(event) => updateField("nextContactReminder", event.target.value)} />
              </label>
              <label className="crm-field wide">
                <span>Do wiadomości (CC, po przecinku)</span>
                <input value={fields.ccEmails} onChange={(event) => updateField("ccEmails", event.target.value)} placeholder="np. ksiegowosc@firma.pl, szef@firma.pl" />
              </label>
              <label className="crm-field wide">
                <span>Język przypomnień</span>
                <select value={fields.reminderLanguage} onChange={(event) => updateField("reminderLanguage", event.target.value)}>
                  {REMINDER_LANGUAGES.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
                </select>
              </label>
              <div className="crm-field wide">
                <span>Adresy dostawy</span>
                {!fields.deliveryAddresses.length && <p className="muted-note crm-address-empty">Brak adresów.</p>}
                <div className="crm-address-list">
                  {fields.deliveryAddresses.map((item, index) => (
                    <div className="crm-address-row" key={index}>
                      <input value={item.label} onChange={(event) => updateAddress(index, { label: event.target.value })} placeholder="Nazwa, np. Magazyn" aria-label="Nazwa adresu" />
                      <input value={item.address} onChange={(event) => updateAddress(index, { address: event.target.value })} placeholder="Ulica, kod, miasto, kraj" aria-label="Adres dostawy" />
                      <button type="button" className="icon-button danger-action" onClick={() => removeAddress(index)} aria-label="Usuń adres"><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="secondary-button crm-address-add" onClick={addAddress}>
                  <Plus size={15} /> Dodaj adres
                </button>
              </div>
              <label className="crm-field wide">
                <span>Notatka (np. faktury na)</span>
                <textarea value={fields.invoiceNote} onChange={(event) => updateField("invoiceNote", event.target.value)} placeholder="FAKTURY NA: ksiegowosc@firma.pl" rows={2} />
              </label>
            </div>
            {isDirty && (
              <div className="crm-card-save-bar">
                <button className="secondary-button" onClick={() => setFields(fieldsFromClient(client))} disabled={saving}>
                  <RotateCcw size={15} /> Cofnij
                </button>
                <button className="primary-button" onClick={() => void saveClient()} disabled={saving}>
                  <Save size={15} /> Zapisz zmiany
                </button>
              </div>
            )}
          </section>

          <section className="crm-card-panel">
            <div className="crm-card-panel-head">
              <Link to={`/crm/contacts?client=${client.id}`} className="crm-card-panel-title">
                Osoby kontaktowe ({contacts.length})
              </Link>
              <button className="icon-button crm-add-button" onClick={() => startContactEdit(null)} aria-label="Dodaj osobę kontaktową" disabled={schemaMissing}>
                <Plus size={20} />
              </button>
            </div>

            {contactForm && (
              <form className="crm-contact-form" onSubmit={saveContact}>
                <input value={contactForm.fullName} onChange={(event) => setContactForm({ ...contactForm, fullName: event.target.value })} placeholder="Imię i nazwisko" required autoFocus />
                <input value={contactForm.position} onChange={(event) => setContactForm({ ...contactForm, position: event.target.value })} placeholder="Stanowisko" />
                <input value={contactForm.phones} onChange={(event) => setContactForm({ ...contactForm, phones: event.target.value })} placeholder="Telefony (oddziel ;)" />
                <input value={contactForm.emails} onChange={(event) => setContactForm({ ...contactForm, emails: event.target.value })} placeholder="E-maile (oddziel ;)" />
                <input value={contactForm.status} onChange={(event) => setContactForm({ ...contactForm, status: event.target.value })} placeholder="Status" list="crm-contact-statuses" />
                <textarea value={contactForm.notes} onChange={(event) => setContactForm({ ...contactForm, notes: event.target.value })} placeholder="Notatka o osobie" rows={2} />
                <div className="crm-form-actions">
                  {editingContactId && (
                    <button type="button" className="icon-button danger-action" onClick={() => { const contact = contactById.get(editingContactId); if (contact) void deleteContact(contact); }} aria-label="Usuń osobę"><Trash2 size={16} /></button>
                  )}
                  <button type="button" className="secondary-button" onClick={() => { setContactForm(null); setEditingContactId(null); }}>Anuluj</button>
                  <button className="primary-button" disabled={saving}><Check size={15} /> Zapisz</button>
                </div>
                <datalist id="crm-contact-statuses">
                  {CONTACT_STATUSES.map((status) => <option key={status} value={status} />)}
                </datalist>
              </form>
            )}

            <div className="crm-mini-table-wrap">
              <table className="crm-mini-table">
                <thead>
                  <tr>
                    <th>
                      <button className="crm-sort-button" onClick={() => setContactSort((current) => current === "asc" ? "desc" : "asc")}>
                        Imię i nazwisko {contactSort === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                      </button>
                    </th>
                    <th>Telefony</th>
                    <th>E-maile</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>
                        <button className="crm-link-button" onClick={() => startContactEdit(contact)} title={contact.position ?? undefined}>
                          {contact.full_name}
                        </button>
                      </td>
                      <td className="crm-ellipsis" title={contact.phones.join("; ")}>
                        {contact.phones[0] ? <a href={`tel:${contact.phones[0]}`}>{contact.phones.join("; ")}</a> : ""}
                      </td>
                      <td>
                        {contact.emails[0] && (
                          <a className="crm-mail-cell" href={`mailto:${contact.emails[0]}`} title={contact.emails.join("; ")}>
                            <span>{contact.emails[0]}</span>
                            <Mail size={15} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!sortedContacts.length && (
                    <tr><td colSpan={3} className="muted-note crm-mini-empty">Brak osób kontaktowych.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </aside>

        <section className="crm-card-main">
          <nav className="crm-card-tabs" aria-label="Sekcje karty klienta">
            <div className={`crm-card-tab ${activeTab === "timeline" ? "active" : ""}`}>
              <button onClick={() => setActiveTab("timeline")}>Oś czasu</button>
            </div>
            {pinned.map((kind) => {
              const count = counts.get(kind) ?? 0;
              return (
                <div key={kind} className={`crm-card-tab ${activeTab === kind ? "active" : ""}`}>
                  <button onClick={() => setActiveTab(kind)}>
                    {ACTIVITY_KINDS[kind].tab}{count ? ` (${count})` : ""}
                  </button>
                  <button className="crm-card-tab-close" onClick={() => unpinTab(kind)} aria-label={`Odepnij ${ACTIVITY_KINDS[kind].tab}`}><X size={13} /></button>
                </div>
              );
            })}
            {activeTab !== "timeline" && !pinned.includes(activeTab) && (
              <div className="crm-card-tab active">
                <button>{ACTIVITY_KINDS[activeTab].tab}{counts.get(activeTab) ? ` (${counts.get(activeTab)})` : ""}</button>
                <button className="crm-card-tab-close" onClick={() => pinTab(activeTab)} aria-label="Przypnij zakładkę"><Pin size={13} /></button>
              </div>
            )}
            <div className="crm-card-more" ref={menuRef}>
              <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Więcej zakładek">
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="crm-card-menu" role="menu">
                  {menuKinds.map((kind) => {
                    const count = counts.get(kind) ?? 0;
                    return (
                      <div key={kind} className="crm-card-menu-item">
                        <button role="menuitem" onClick={() => { setActiveTab(kind); setMenuOpen(false); }}>
                          {ACTIVITY_KINDS[kind].tab}{count ? ` (${count})` : ""}
                        </button>
                        <button className="crm-card-menu-pin" onClick={() => pinTab(kind)} aria-label={`Przypnij ${ACTIVITY_KINDS[kind].tab}`}><Pin size={14} /></button>
                      </div>
                    );
                  })}
                  <Link className="crm-card-menu-link" to={`/crm/contacts?client=${client.id}`} role="menuitem">
                    <Users size={14} /> Osoby kontaktowe ({contacts.length})
                  </Link>
                </div>
              )}
            </div>
          </nav>

          <div className="crm-card-feed">
            <div className="crm-card-feed-head">
              <strong>{activeLabel}</strong>
              {activeTab !== "timeline" && activeTab !== "change" && !composer && (
                <button className="secondary-button" onClick={() => openComposer(activeTab)} disabled={schemaMissing}>
                  <Plus size={15} /> Dodaj: {ACTIVITY_KINDS[activeTab].noun.toLowerCase()}
                </button>
              )}
            </div>

            {composer && (
              <ActivityComposer
                value={composer}
                contacts={sortedContacts}
                saving={saving}
                onChange={setComposer}
                onCancel={() => setComposer(null)}
                onSubmit={saveActivity}
              />
            )}

            {visibleActivities.map((activity) => {
              const meta = ACTIVITY_KINDS[activity.kind];
              const Icon = meta.icon;
              const when = formatDateTime(activity.occurred_at);
              const contact = activity.contact_id ? contactById.get(activity.contact_id) : null;
              const who = activity.counterpart ?? contact?.full_name ?? null;
              const body = activity.body ?? "";
              const isExpanded = expanded.has(activity.id);
              const isLong = body.length > BODY_PREVIEW_LIMIT || body.split("\n").length > 5;
              const amount = formatAmount(activity.amount, activity.currency);

              return (
                <article key={activity.id} className={`crm-activity kind-${activity.kind}`}>
                  {activity.status && meta.tracksStatus && (
                    <button className={`crm-activity-status ${activity.status}`} onClick={() => void toggleActivityStatus(activity)} title="Zmień status">
                      {activity.status === "done" ? "Wykonane" : "Do zrobienia"}
                    </button>
                  )}
                  <div className="crm-activity-line">
                    <span className={`crm-activity-icon ${activity.direction ?? ""}`}><Icon size={18} /></span>
                    <p className="crm-activity-summary">
                      {meta.noun}{" "}
                      {activity.url ? (
                        <a href={activity.url} target="_blank" rel="noopener noreferrer">{activity.reference ?? activity.title} <ExternalLink size={12} /></a>
                      ) : (
                        <span className="crm-activity-title">{activity.reference ?? activity.title}</span>
                      )}{" "}
                      {activityVerb(activity)}
                      {amount && <span className="crm-activity-amount">{amount}</span>}
                    </p>
                    <div className="crm-activity-meta">
                      {who && <span className="crm-activity-who" title={who}>{who}</span>}
                      {typeof when === "string" ? <span>{when}</span> : <span>{when.date} <small>{when.time}</small></span>}
                      <div className="crm-activity-tools">
                        <button className="icon-button" onClick={() => void deleteActivity(activity)} aria-label="Usuń wpis"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                  {(activity.reference && activity.title !== activity.reference) || body ? (
                    <div className={`crm-activity-body ${isLong && !isExpanded ? "clamped" : ""}`}>
                      {activity.reference && activity.title !== activity.reference && <strong className="crm-activity-subject">{activity.title}</strong>}
                      {body && <div className="crm-activity-text">{body}</div>}
                      {isLong && (
                        <button className="secondary-button crm-more-button" onClick={() => setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(activity.id)) next.delete(activity.id); else next.add(activity.id);
                          return next;
                        })}>
                          {isExpanded ? "Mniej" : "Więcej"}
                        </button>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}

            {!visibleActivities.length && !composer && (
              <div className="empty-state">
                {activeTab === "timeline"
                  ? "Brak aktywności. Dodaj e-mail, notatkę, ofertę albo zamówienie przyciskami u góry."
                  : `Brak wpisów w zakładce „${activeLabel}”.`}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

interface ComposerProps {
  value: ActivityFields;
  contacts: CRMContact[];
  saving: boolean;
  onChange: (value: ActivityFields) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

function ActivityComposer({ value, contacts, saving, onChange, onCancel, onSubmit }: ComposerProps) {
  const meta = ACTIVITY_KINDS[value.kind];
  const set = <K extends keyof ActivityFields>(key: K, next: ActivityFields[K]) => onChange({ ...value, [key]: next });

  return (
    <form className="crm-composer" onSubmit={onSubmit}>
      <div className="crm-composer-head">
        <strong>Nowy wpis</strong>
        <select value={value.kind} onChange={(event) => {
          const kind = event.target.value as CRMActivityKind;
          onChange({ ...emptyActivity(kind), title: value.title, body: value.body, occurredAt: value.occurredAt, contactId: value.contactId });
        }}>
          {ACTIVITY_KIND_ORDER.filter((kind) => kind !== "change").map((kind) => <option key={kind} value={kind}>{ACTIVITY_KINDS[kind].noun}</option>)}
        </select>
      </div>
      <div className="crm-composer-grid">
        <input className="wide" value={value.title} onChange={(event) => set("title", event.target.value)} placeholder={value.kind === "email" ? "Temat wiadomości" : "Tytuł"} required autoFocus />
        {value.kind === "email" && (
          <select value={value.direction} onChange={(event) => set("direction", event.target.value as ActivityFields["direction"])}>
            <option value="in">Odebrany</option>
            <option value="out">Wysłany</option>
          </select>
        )}
        <input value={value.counterpart} onChange={(event) => set("counterpart", event.target.value)} placeholder={value.kind === "email" ? "Od / do (adres)" : "Osoba / autor"} />
        <select value={value.contactId} onChange={(event) => set("contactId", event.target.value)}>
          <option value="">Osoba kontaktowa: —</option>
          {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
        </select>
        {meta.money && (
          <>
            <input value={value.reference} onChange={(event) => set("reference", event.target.value)} placeholder="Numer dokumentu, np. 2026/09/013/Z/S" />
            <div className="crm-composer-money">
              <input type="number" min="0" step="0.01" value={value.amount} onChange={(event) => set("amount", event.target.value)} placeholder="Kwota" />
              <select value={value.currency} onChange={(event) => set("currency", event.target.value)}>
                {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </div>
          </>
        )}
        {!meta.money && value.kind === "warehouse" && (
          <input value={value.reference} onChange={(event) => set("reference", event.target.value)} placeholder="Numer dokumentu (WZ, PZ...)" />
        )}
        {meta.tracksStatus && (
          <select value={value.status} onChange={(event) => set("status", event.target.value as ActivityFields["status"])}>
            <option value="open">Do zrobienia</option>
            <option value="done">Wykonane</option>
          </select>
        )}
        <input type="datetime-local" value={value.occurredAt} onChange={(event) => set("occurredAt", event.target.value)} aria-label="Data i godzina" />
        <input className="wide" type="url" value={value.url} onChange={(event) => set("url", event.target.value)} placeholder={value.kind === "file" ? "Link do pliku (Drive, Dropbox...)" : "Link (opcjonalnie)"} required={value.kind === "file"} />
        <textarea className="wide" value={value.body} onChange={(event) => set("body", event.target.value)} placeholder={value.kind === "email" ? "Treść wiadomości" : "Opis"} rows={4} />
      </div>
      <div className="crm-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Anuluj</button>
        <button className="primary-button" disabled={saving}><Pencil size={15} /> Zapisz wpis</button>
      </div>
    </form>
  );
}
