import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { AddressObject, ParsedMail } from "mailparser";
import { createTransport } from "nodemailer";

export type MailboxConfig = {
  key: string;
  label: string;
  host: string;
  port: number;
  user: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
};

export type MailListItem = {
  uid: number;
  from: string;
  subject: string;
  date: string | null;
  seen: boolean;
};

export type MailMessageDetail = {
  uid: number;
  from: string;
  fromAddress: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string | null;
  text: string;
};

export type ReplyMode = "reply" | "replyAll" | "forward";

export const LIST_LIMIT = 30;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ARCHIVE_CANDIDATES = ["Archive", "Archives", "Archiwum"];
const TRASH_CANDIDATES = ["Trash", "Deleted Items", "Deleted Messages", "Kosz"];

export function describeImapError(error: unknown): string {
  if (error instanceof Error) {
    const responseText = (error as { responseText?: string }).responseText;
    return responseText ? `${error.message}: ${responseText}` : error.message;
  }
  return "IMAP request failed";
}

export function requireMailbox(mailboxes: MailboxConfig[], key: string | undefined): MailboxConfig {
  const mailbox = mailboxes.find((m) => m.key === key);
  if (!mailbox) throw new Error(`Unknown mailbox: ${key ?? ""}`);
  return mailbox;
}

export function parseUid(value: unknown): number | null {
  const uid = Number(value);
  return Number.isInteger(uid) && uid > 0 ? uid : null;
}

export function parseAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || /[\r\n]/.test(trimmed) || !EMAIL_RE.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function loadMailboxes(): MailboxConfig[] {
  const raw = process.env.HOSTINGER_MAILBOXES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry): MailboxConfig | null => {
        if (!entry || typeof entry !== "object") return null;
        const e = entry as Record<string, unknown>;
        if (typeof e.key !== "string" || typeof e.label !== "string" || typeof e.host !== "string" || typeof e.user !== "string" || typeof e.password !== "string") {
          return null;
        }
        return {
          key: e.key,
          label: e.label,
          host: e.host,
          port: typeof e.port === "number" ? e.port : 993,
          user: e.user,
          password: e.password,
          smtpHost: typeof e.smtpHost === "string" ? e.smtpHost : deriveSmtpHost(e.host),
          smtpPort: typeof e.smtpPort === "number" ? e.smtpPort : 465
        };
      })
      .filter((m): m is MailboxConfig => m !== null);
  } catch {
    return [];
  }
}

function deriveSmtpHost(host: string): string {
  return /^imap\./i.test(host) ? host.replace(/^imap\./i, "smtp.") : host;
}

async function withClient<T>(mailbox: MailboxConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: mailbox.host,
    port: mailbox.port,
    secure: true,
    auth: { user: mailbox.user, pass: mailbox.password },
    logger: false
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export async function listMessages(mailbox: MailboxConfig): Promise<MailListItem[]> {
  return withClient(mailbox, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages ?? 0;
      if (total === 0) return [];

      const from = Math.max(1, total - LIST_LIMIT + 1);
      const items: MailListItem[] = [];
      for await (const msg of client.fetch(`${from}:*`, { envelope: true, flags: true, uid: true })) {
        items.push({
          uid: msg.uid,
          from: formatAddress(msg.envelope?.from?.[0]),
          subject: msg.envelope?.subject ?? "(brak tematu)",
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
          seen: msg.flags?.has("\\Seen") ?? false
        });
      }
      return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    } finally {
      lock.release();
    }
  });
}

export async function readMessage(mailbox: MailboxConfig, uid: number): Promise<MailMessageDetail | null> {
  return withClient(mailbox, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const download = await client.download(uid, undefined, { uid: true });
      if (!download) return null;
      const parsed = await simpleParser(download.content);
      return {
        uid,
        from: formatAddress(parsed.from?.value?.[0]),
        fromAddress: parsed.from?.value?.[0]?.address ?? "",
        to: extractAddresses(parsed.to),
        cc: extractAddresses(parsed.cc),
        subject: parsed.subject ?? "(brak tematu)",
        date: parsed.date ? parsed.date.toISOString() : null,
        text: parsed.text ?? (parsed.html ? stripHtml(parsed.html) : "")
      };
    } finally {
      lock.release();
    }
  });
}

function extractAddresses(value: AddressObject | AddressObject[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((entry) => entry.value.map((addr) => addr.address).filter((addr): addr is string => Boolean(addr)));
}

export async function markSeen(mailbox: MailboxConfig, uid: number): Promise<void> {
  await withClient(mailbox, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

async function moveMessage(mailbox: MailboxConfig, uid: number, specialUse: string, candidates: string[]): Promise<void> {
  await withClient(mailbox, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const folder = await resolveSpecialFolder(client, specialUse, candidates);
      const moved = await client.messageMove(uid, folder, { uid: true });
      if (!moved) throw new Error(`Nie udalo sie przeniesc wiadomosci do folderu ${folder}`);
    } finally {
      lock.release();
    }
  });
}

export function archiveMessage(mailbox: MailboxConfig, uid: number): Promise<void> {
  return moveMessage(mailbox, uid, "\\Archive", ARCHIVE_CANDIDATES);
}

export function trashMessage(mailbox: MailboxConfig, uid: number): Promise<void> {
  return moveMessage(mailbox, uid, "\\Trash", TRASH_CANDIDATES);
}

async function resolveSpecialFolder(client: ImapFlow, specialUse: string, candidates: string[]): Promise<string> {
  const folders = await client.list();
  const bySpecialUse = folders.find((folder) => folder.specialUse === specialUse);
  if (bySpecialUse) return bySpecialUse.path;
  const byName = folders.find((folder) => candidates.some((name) => name.toLowerCase() === folder.name.toLowerCase()));
  if (byName) return byName.path;
  throw new Error(`Nie znaleziono folderu ${specialUse === "\\Archive" ? "Archiwum" : "Kosz"} na serwerze pocztowym`);
}

export async function sendReply(mailbox: MailboxConfig, uid: number, mode: ReplyMode, to: string[], cc: string[], text: string): Promise<void> {
  const original: ParsedMail = await withClient(mailbox, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const download = await client.download(uid, undefined, { uid: true });
      if (!download) throw new Error("Oryginalna wiadomosc nie zostala znaleziona");
      return simpleParser(download.content);
    } finally {
      lock.release();
    }
  });

  const isThreaded = mode !== "forward";
  const subject = buildSubject(mode, original.subject ?? "(brak tematu)");
  const references = isThreaded
    ? [
        ...(Array.isArray(original.references) ? original.references : original.references ? [original.references] : []),
        original.messageId
      ].filter((value): value is string => Boolean(value))
    : [];

  const transporter = createTransport({
    host: mailbox.smtpHost,
    port: mailbox.smtpPort,
    secure: true,
    auth: { user: mailbox.user, pass: mailbox.password }
  });

  await transporter.sendMail({
    from: mailbox.user,
    to: to.join(", "),
    cc: cc.length ? cc.join(", ") : undefined,
    subject,
    text,
    inReplyTo: isThreaded ? original.messageId : undefined,
    references: references.length ? references.join(" ") : undefined
  });
}

function buildSubject(mode: ReplyMode, originalSubject: string): string {
  const prefix = mode === "forward" ? "Fwd:" : "Re:";
  const trimmed = originalSubject.trim();
  return trimmed.toLowerCase().startsWith(prefix.toLowerCase()) ? trimmed : `${prefix} ${trimmed}`;
}

function formatAddress(address: { name?: string; address?: string } | undefined): string {
  if (!address) return "(nieznany nadawca)";
  if (address.name && address.address) return `${address.name} <${address.address}>`;
  return address.address ?? address.name ?? "(nieznany nadawca)";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
