import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  archiveMessage,
  describeImapError,
  listMessages,
  loadMailboxes,
  markSeen,
  parseAddressList,
  readMessage,
  requireMailbox,
  sendReply,
  trashMessage
} from "../../lib/hostinger-mail";

const server = new McpServer({ name: "hostinger-mail", version: "1.0.0" });

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

server.registerTool(
  "list_mailboxes",
  {
    title: "List mailboxes",
    description: "List the configured Hostinger mailboxes (key, label, email address)."
  },
  async () => {
    const mailboxes = loadMailboxes();
    return jsonResult(mailboxes.map((m) => ({ key: m.key, label: m.label, email: m.user })));
  }
);

server.registerTool(
  "list_messages",
  {
    title: "List recent messages",
    description: "List the most recent messages in a mailbox's INBOX (uid, from, subject, date, seen).",
    inputSchema: { mailbox: z.string().describe("Mailbox key, see list_mailboxes") }
  },
  async ({ mailbox: mailboxKey }) => {
    try {
      const mailbox = requireMailbox(loadMailboxes(), mailboxKey);
      const items = await listMessages(mailbox);
      return jsonResult(items);
    } catch (error) {
      return errorResult(describeImapError(error));
    }
  }
);

server.registerTool(
  "read_message",
  {
    title: "Read a message",
    description: "Fetch the full content of a message (from, to, cc, subject, date, body text). Marks it as read.",
    inputSchema: {
      mailbox: z.string().describe("Mailbox key, see list_mailboxes"),
      uid: z.number().int().positive().describe("Message UID, from list_messages")
    }
  },
  async ({ mailbox: mailboxKey, uid }) => {
    try {
      const mailbox = requireMailbox(loadMailboxes(), mailboxKey);
      const message = await readMessage(mailbox, uid);
      if (!message) return errorResult("Message not found");
      await markSeen(mailbox, uid);
      return jsonResult(message);
    } catch (error) {
      return errorResult(describeImapError(error));
    }
  }
);

server.registerTool(
  "reply_message",
  {
    title: "Reply, reply-all, or forward a message",
    description:
      "Send a reply, reply-all, or forward for an existing message via SMTP. Plain text only, no attachments. " +
      "Threading headers (In-Reply-To/References) are set automatically for reply/replyAll.",
    inputSchema: {
      mailbox: z.string().describe("Mailbox key, see list_mailboxes"),
      uid: z.number().int().positive().describe("UID of the message being replied to/forwarded"),
      mode: z.enum(["reply", "replyAll", "forward"]),
      to: z.array(z.string()).min(1).describe("Recipient email addresses"),
      cc: z.array(z.string()).optional().describe("CC email addresses"),
      body: z.string().min(1).describe("Plain text message body")
    }
  },
  async ({ mailbox: mailboxKey, uid, mode, to, cc, body }) => {
    try {
      const mailbox = requireMailbox(loadMailboxes(), mailboxKey);
      const toAddresses = parseAddressList(to);
      const ccAddresses = parseAddressList(cc ?? []);
      if (!toAddresses.length) return errorResult("Brak poprawnego adresata");
      const text = body.trim();
      if (!text) return errorResult("Brak tresci wiadomosci");
      await sendReply(mailbox, uid, mode, toAddresses, ccAddresses, text);
      return jsonResult({ ok: true });
    } catch (error) {
      return errorResult(describeImapError(error));
    }
  }
);

server.registerTool(
  "archive_message",
  {
    title: "Archive a message",
    description: "Move a message to the mailbox's Archive folder.",
    inputSchema: {
      mailbox: z.string().describe("Mailbox key, see list_mailboxes"),
      uid: z.number().int().positive()
    }
  },
  async ({ mailbox: mailboxKey, uid }) => {
    try {
      const mailbox = requireMailbox(loadMailboxes(), mailboxKey);
      await archiveMessage(mailbox, uid);
      return jsonResult({ ok: true });
    } catch (error) {
      return errorResult(describeImapError(error));
    }
  }
);

server.registerTool(
  "delete_message",
  {
    title: "Delete a message",
    description: "Move a message to the mailbox's Trash folder (reversible, not a permanent delete).",
    inputSchema: {
      mailbox: z.string().describe("Mailbox key, see list_mailboxes"),
      uid: z.number().int().positive()
    }
  },
  async ({ mailbox: mailboxKey, uid }) => {
    try {
      const mailbox = requireMailbox(loadMailboxes(), mailboxKey);
      await trashMessage(mailbox, uid);
      return jsonResult({ ok: true });
    } catch (error) {
      return errorResult(describeImapError(error));
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
