import { createClient } from "@supabase/supabase-js";
import {
  archiveMessage,
  describeImapError,
  listMessages,
  loadMailboxes,
  markSeen,
  parseAddressList,
  parseUid,
  readMessage,
  requireMailbox,
  sendReply,
  trashMessage
} from "../lib/hostinger-mail.js";

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const authorized = await isAuthorized(req);
  if (!authorized) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const mailboxes = loadMailboxes();

  if (req.method === "GET" && readQuery(req, "action") === "mailboxes") {
    res.status(200).json({ mailboxes: mailboxes.map((m) => ({ key: m.key, label: m.label, email: m.user })) });
    return;
  }

  if (!mailboxes.length) {
    res.status(500).json({ error: "Missing or invalid HOSTINGER_MAILBOXES in Vercel environment variables" });
    return;
  }

  try {
    if (req.method === "GET" && readQuery(req, "action") === "list") {
      const mailbox = requireMailbox(mailboxes, readQuery(req, "mailbox"));
      const items = await listMessages(mailbox);
      res.status(200).json({ items });
      return;
    }

    if (req.method === "GET" && readQuery(req, "action") === "message") {
      const mailbox = requireMailbox(mailboxes, readQuery(req, "mailbox"));
      const uid = parseUid(readQuery(req, "uid"));
      if (uid === null) {
        res.status(400).json({ error: "Invalid uid" });
        return;
      }
      const message = await readMessage(mailbox, uid);
      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }
      res.status(200).json({ message });
      return;
    }

    if (req.method === "POST") {
      const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
      const action = body.action;

      if (action === "markRead" || action === "archive" || action === "delete") {
        const mailbox = requireMailbox(mailboxes, typeof body.mailbox === "string" ? body.mailbox : undefined);
        const uid = parseUid(body.uid);
        if (uid === null) {
          res.status(400).json({ error: "Invalid uid" });
          return;
        }
        if (action === "markRead") {
          await markSeen(mailbox, uid);
        } else if (action === "archive") {
          await archiveMessage(mailbox, uid);
        } else {
          await trashMessage(mailbox, uid);
        }
        res.status(200).json({ ok: true });
        return;
      }

      if (action === "reply") {
        const mailbox = requireMailbox(mailboxes, typeof body.mailbox === "string" ? body.mailbox : undefined);
        const uid = parseUid(body.uid);
        if (uid === null) {
          res.status(400).json({ error: "Invalid uid" });
          return;
        }
        const mode = body.mode;
        if (mode !== "reply" && mode !== "replyAll" && mode !== "forward") {
          res.status(400).json({ error: "Invalid mode" });
          return;
        }
        const to = parseAddressList(body.to);
        const cc = parseAddressList(body.cc);
        const text = typeof body.body === "string" ? body.body.trim() : "";
        if (!to.length) {
          res.status(400).json({ error: "Brak poprawnego adresata" });
          return;
        }
        if (!text) {
          res.status(400).json({ error: "Brak tresci wiadomosci" });
          return;
        }
        await sendReply(mailbox, uid, mode, to, cc, text);
        res.status(200).json({ ok: true });
        return;
      }
    }

    res.status(400).json({ error: "Unsupported request" });
  } catch (error) {
    res.status(502).json({ error: describeImapError(error) });
  }
}

async function isAuthorized(req: VercelRequest): Promise<boolean> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return false;

  const rawAuth = req.headers?.authorization ?? req.headers?.Authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return false;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}

function readQuery(req: VercelRequest, key: string): string | undefined {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}
