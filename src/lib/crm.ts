import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, History, Mail, Package, Paperclip, Phone, Receipt, ShoppingCart, StickyNote, Tag, TrendingUp } from "lucide-react";
import type { CRMClientStage } from "./types";

export type CRMActivityKind =
  | "email"
  | "note"
  | "order"
  | "invoice"
  | "offer"
  | "opportunity"
  | "file"
  | "warehouse"
  | "reminder"
  | "call"
  | "meeting"
  | "change";

export type CRMActivityStatus = "open" | "done";
export type CRMActivityDirection = "in" | "out";

export interface CRMDeliveryAddress {
  label: string;
  address: string;
}

export interface CRMClientDetails {
  id: string;
  user_id: string;
  project_id: string | null;
  company: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  stage: CRMClientStage;
  value: number | null;
  currency: string;
  next_follow_up: string | null;
  notes: string | null;
  website: string | null;
  address: string | null;
  tax_id: string | null;
  price_group: string | null;
  bank_account: string | null;
  next_contact_reminder: string | null;
  invoice_note: string | null;
  cc_emails: string[];
  reminder_language: string | null;
  delivery_addresses: CRMDeliveryAddress[];
  created_at: string;
  updated_at: string;
}

export interface CRMContact {
  id: string;
  user_id: string;
  client_id: string;
  full_name: string;
  position: string | null;
  phones: string[];
  emails: string[];
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRMActivity {
  id: string;
  user_id: string;
  client_id: string;
  contact_id: string | null;
  kind: CRMActivityKind;
  title: string;
  body: string | null;
  direction: CRMActivityDirection | null;
  counterpart: string | null;
  reference: string | null;
  amount: number | null;
  currency: string;
  status: CRMActivityStatus | null;
  url: string | null;
  occurred_at: string;
  created_at: string;
}

interface KindMeta {
  /** Tab label, plural. */
  tab: string;
  /** Noun used at the start of a timeline line. */
  noun: string;
  /** Verb used after the title, e.g. "dodane". */
  added: string;
  icon: LucideIcon;
  /** Whether amount / currency make sense for this kind. */
  money: boolean;
  /** Whether the item tracks an open/done status. */
  tracksStatus: boolean;
}

export const ACTIVITY_KINDS: Record<CRMActivityKind, KindMeta> = {
  file: { tab: "Pliki", noun: "Plik", added: "dodany", icon: Paperclip, money: false, tracksStatus: false },
  email: { tab: "E-maile", noun: "E-mail", added: "zapisany", icon: Mail, money: false, tracksStatus: false },
  note: { tab: "Notatki", noun: "Notatka", added: "dodana", icon: StickyNote, money: false, tracksStatus: false },
  opportunity: { tab: "Szanse sprzedaży", noun: "Szansa sprzedaży", added: "dodana", icon: TrendingUp, money: true, tracksStatus: true },
  invoice: { tab: "Faktury", noun: "Faktura", added: "dodana", icon: Receipt, money: true, tracksStatus: true },
  offer: { tab: "Oferty", noun: "Oferta", added: "dodana", icon: Tag, money: true, tracksStatus: true },
  order: { tab: "Zamówienia", noun: "Zamówienie", added: "dodane", icon: ShoppingCart, money: true, tracksStatus: true },
  warehouse: { tab: "Dokumenty magazynowe", noun: "Dokument magazynowy", added: "dodany", icon: Package, money: false, tracksStatus: true },
  reminder: { tab: "Przypomnienia", noun: "Przypomnienie", added: "dodane", icon: Bell, money: false, tracksStatus: true },
  call: { tab: "Rozmowy", noun: "Rozmowa", added: "zapisana", icon: Phone, money: false, tracksStatus: false },
  meeting: { tab: "Spotkania", noun: "Spotkanie", added: "zaplanowane", icon: CalendarDays, money: false, tracksStatus: true },
  change: { tab: "Historia zmian", noun: "Zmiana", added: "zapisana", icon: History, money: false, tracksStatus: false }
};

export const ACTIVITY_KIND_ORDER: CRMActivityKind[] = [
  "file",
  "email",
  "note",
  "opportunity",
  "invoice",
  "offer",
  "order",
  "warehouse",
  "reminder",
  "call",
  "meeting",
  "change"
];

export const DEFAULT_PINNED_KINDS: CRMActivityKind[] = ["file", "email", "note", "opportunity", "invoice", "offer", "order", "warehouse"];

export const PRICE_GROUPS = ["A", "B", "C", "D", "E"];

export const REMINDER_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "pl", label: "polski" },
  { value: "en", label: "angielski" },
  { value: "fr", label: "francuski" },
  { value: "de", label: "niemiecki" }
];

export const CONTACT_STATUSES = ["Aktywny", "Decydent", "Księgowość", "Zaopatrzenie", "Nieaktywny"];

export function activityVerb(activity: Pick<CRMActivity, "kind" | "direction">) {
  if (activity.kind === "email") {
    if (activity.direction === "in") return "odebrany";
    if (activity.direction === "out") return "wysłany";
  }
  return ACTIVITY_KINDS[activity.kind].added;
}

export function normalizeClientDetails(value: unknown): CRMClientDetails | null {
  const row = isRecord(value) ? value : {};
  const id = text(row.id);
  const company = text(row.company);
  if (!id || !company) return null;
  return {
    id,
    user_id: text(row.user_id) ?? "",
    project_id: text(row.project_id),
    company,
    contact_name: text(row.contact_name),
    email: text(row.email),
    phone: text(row.phone),
    stage: normalizeStage(row.stage),
    value: nullableNumber(row.value),
    currency: text(row.currency) ?? "PLN",
    next_follow_up: text(row.next_follow_up),
    notes: text(row.notes),
    website: text(row.website),
    address: text(row.address),
    tax_id: text(row.tax_id),
    price_group: text(row.price_group),
    bank_account: text(row.bank_account),
    next_contact_reminder: text(row.next_contact_reminder),
    invoice_note: text(row.invoice_note),
    cc_emails: textList(row.cc_emails),
    reminder_language: text(row.reminder_language),
    delivery_addresses: normalizeAddresses(row.delivery_addresses),
    created_at: text(row.created_at) ?? new Date().toISOString(),
    updated_at: text(row.updated_at) ?? new Date().toISOString()
  };
}

function normalizeAddresses(value: unknown): CRMDeliveryAddress[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = isRecord(item) ? item : {};
      return { label: text(row.label) ?? "", address: text(row.address) ?? "" };
    })
    .filter((item) => item.label || item.address);
}

export function normalizeContacts(value: unknown): CRMContact[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeContact).filter((contact): contact is CRMContact => Boolean(contact));
}

function normalizeContact(value: unknown): CRMContact | null {
  const row = isRecord(value) ? value : {};
  const id = text(row.id);
  const clientId = text(row.client_id);
  const fullName = text(row.full_name);
  if (!id || !clientId || !fullName) return null;
  return {
    id,
    user_id: text(row.user_id) ?? "",
    client_id: clientId,
    full_name: fullName,
    position: text(row.position),
    phones: textList(row.phones),
    emails: textList(row.emails),
    status: text(row.status),
    notes: text(row.notes),
    created_at: text(row.created_at) ?? new Date().toISOString(),
    updated_at: text(row.updated_at) ?? new Date().toISOString()
  };
}

export function normalizeActivities(value: unknown): CRMActivity[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeActivity).filter((activity): activity is CRMActivity => Boolean(activity));
}

function normalizeActivity(value: unknown): CRMActivity | null {
  const row = isRecord(value) ? value : {};
  const id = text(row.id);
  const clientId = text(row.client_id);
  const title = text(row.title);
  const kind = text(row.kind);
  if (!id || !clientId || !title || !kind || !(kind in ACTIVITY_KINDS)) return null;
  const direction = text(row.direction);
  const status = text(row.status);
  return {
    id,
    user_id: text(row.user_id) ?? "",
    client_id: clientId,
    contact_id: text(row.contact_id),
    kind: kind as CRMActivityKind,
    title,
    body: text(row.body),
    direction: direction === "in" || direction === "out" ? direction : null,
    counterpart: text(row.counterpart),
    reference: text(row.reference),
    amount: nullableNumber(row.amount),
    currency: text(row.currency) ?? "PLN",
    status: status === "open" || status === "done" ? status : null,
    url: text(row.url),
    occurred_at: text(row.occurred_at) ?? new Date().toISOString(),
    created_at: text(row.created_at) ?? new Date().toISOString()
  };
}

/** Splits "a; b, c" or multi-line input into a clean list. */
export function splitList(value: string) {
  return Array.from(new Set(value.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean)));
}

export function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function errorText(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (isRecord(error) && typeof error.message === "string") return error.message || fallback;
  return fallback;
}

/** True when the CRM card migration has not been applied yet. */
export function isMissingSchemaError(error: unknown) {
  if (!isRecord(error)) return false;
  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    (message.includes("does not exist") && (message.includes("relation") || message.includes("column")))
  );
}

export const MIGRATION_HINT =
  "Brakuje tabel lub pól karty klienta. Uruchom migracje supabase/migrations/202610170001_crm_client_card.sql oraz 202610220001_crm_client_card_delivery.sql (supabase db push).";

export function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return {
    date: date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
  };
}

export function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromDatetimeLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatAmount(value: number | null, currency: string) {
  if (value == null) return null;
  return `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

export function websiteHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function normalizeStage(value: unknown): CRMClientStage {
  return value === "lead" || value === "qualified" || value === "active" || value === "follow_up" || value === "paused" || value === "closed"
    ? value
    : "lead";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function textList(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter((item): item is string => Boolean(item)) : [];
}

function nullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
