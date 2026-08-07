import { useEffect, useState } from "react";
import { Archive, ArrowLeft, Forward, Mail, Reply, ReplyAll, RotateCw, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type MailboxSummary = { key: string; label: string; email: string };
type MailListItem = { uid: number; from: string; subject: string; date: string | null; seen: boolean };
type MailMessage = {
  uid: number;
  from: string;
  fromAddress: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string | null;
  text: string;
};
type ReplyMode = "reply" | "replyAll" | "forward";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Blad zapytania do skrzynki pocztowej.");
  return data as T;
}

export function EmailPage() {
  const [mailboxes, setMailboxes] = useState<MailboxSummary[] | null>(null);
  const [mailboxesError, setMailboxesError] = useState<string | null>(null);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);

  const [items, setItems] = useState<MailListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [composeMode, setComposeMode] = useState<ReplyMode | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeSuccess, setComposeSuccess] = useState(false);

  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentMailbox = mailboxes?.find((m) => m.key === selectedMailbox) ?? null;

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ mailboxes: MailboxSummary[] }>("/api/hostinger-mail?action=mailboxes")
      .then((data) => {
        if (cancelled) return;
        setMailboxes(data.mailboxes);
        if (data.mailboxes.length) setSelectedMailbox(data.mailboxes[0].key);
      })
      .catch((error) => {
        if (cancelled) return;
        setMailboxesError(error instanceof Error ? error.message : "Nie udalo sie wczytac listy skrzynek.");
        setMailboxes([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedMailbox) return;
    loadList(selectedMailbox);
    setSelectedUid(null);
    setMessage(null);
  }, [selectedMailbox]);

  function loadList(mailboxKey: string) {
    setListLoading(true);
    setListError(null);
    fetchJson<{ items: MailListItem[] }>(`/api/hostinger-mail?action=list&mailbox=${encodeURIComponent(mailboxKey)}`)
      .then((data) => setItems(data.items))
      .catch((error) => setListError(error instanceof Error ? error.message : "Nie udalo sie wczytac wiadomosci."))
      .finally(() => setListLoading(false));
  }

  function openMessage(uid: number) {
    if (!selectedMailbox) return;
    setSelectedUid(uid);
    setMessageLoading(true);
    setMessageError(null);
    setComposeMode(null);
    setComposeError(null);
    setComposeSuccess(false);
    setActionError(null);
    fetchJson<{ message: MailMessage }>(`/api/hostinger-mail?action=message&mailbox=${encodeURIComponent(selectedMailbox)}&uid=${uid}`)
      .then((data) => {
        setMessage(data.message);
        setItems((prev) => prev.map((item) => (item.uid === uid ? { ...item, seen: true } : item)));
        fetchJson("/api/hostinger-mail", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "markRead", mailbox: selectedMailbox, uid })
        }).catch(() => {});
      })
      .catch((error) => setMessageError(error instanceof Error ? error.message : "Nie udalo sie wczytac wiadomosci."))
      .finally(() => setMessageLoading(false));
  }

  function openCompose(mode: ReplyMode) {
    if (!message || !currentMailbox) return;
    setComposeMode(mode);
    setComposeError(null);
    setComposeSuccess(false);
    const selfEmail = currentMailbox.email.toLowerCase();
    if (mode === "reply") {
      setComposeTo(message.fromAddress);
      setComposeCc("");
      setComposeBody("");
    } else if (mode === "replyAll") {
      const to = [message.fromAddress, ...message.to.filter((addr) => addr.toLowerCase() !== selfEmail)].filter(
        (addr, index, arr) => addr && arr.indexOf(addr) === index
      );
      const cc = message.cc.filter((addr) => addr.toLowerCase() !== selfEmail);
      setComposeTo(to.join(", "));
      setComposeCc(cc.join(", "));
      setComposeBody("");
    } else {
      setComposeTo("");
      setComposeCc("");
      setComposeBody(
        `\n\n---- Wiadomosc przekazana ----\nOd: ${message.from}\nData: ${formatDate(message.date)}\nTemat: ${message.subject}\n\n${message.text}`
      );
    }
  }

  function closeCompose() {
    setComposeMode(null);
    setComposeError(null);
  }

  function sendCompose() {
    if (!selectedMailbox || !selectedUid || !composeMode) return;
    const to = composeTo.split(",").map((value) => value.trim()).filter(Boolean);
    const cc = composeCc.split(",").map((value) => value.trim()).filter(Boolean);
    if (!to.length) {
      setComposeError("Podaj przynajmniej jednego adresata.");
      return;
    }
    if (!composeBody.trim()) {
      setComposeError("Wpisz tresc wiadomosci.");
      return;
    }
    setComposeSending(true);
    setComposeError(null);
    fetchJson("/api/hostinger-mail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reply", mailbox: selectedMailbox, uid: selectedUid, mode: composeMode, to, cc, body: composeBody })
    })
      .then(() => {
        setComposeMode(null);
        setComposeSuccess(true);
      })
      .catch((error) => setComposeError(error instanceof Error ? error.message : "Nie udalo sie wyslac wiadomosci."))
      .finally(() => setComposeSending(false));
  }

  function performAction(action: "archive" | "delete") {
    if (!selectedMailbox || !selectedUid) return;
    if (action === "delete" && !window.confirm("Przeniesc wiadomosc do kosza?")) return;
    setActionPending(true);
    setActionError(null);
    fetchJson("/api/hostinger-mail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, mailbox: selectedMailbox, uid: selectedUid })
    })
      .then(() => {
        setItems((prev) => prev.filter((item) => item.uid !== selectedUid));
        setSelectedUid(null);
        setMessage(null);
        setComposeMode(null);
      })
      .catch((error) => setActionError(error instanceof Error ? error.message : "Operacja nie powiodla sie."))
      .finally(() => setActionPending(false));
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Komunikacja</span>
          <h1>Poczta</h1>
          <p className="page-subtitle">Podglad skrzynek odbiorczych Hostinger.</p>
        </div>
        {mailboxes && mailboxes.length > 0 && (
          <button className="secondary-button" type="button" onClick={() => selectedMailbox && loadList(selectedMailbox)} disabled={listLoading}>
            <RotateCw size={16} className={listLoading ? "spin-icon" : undefined} />Odswiez
          </button>
        )}
      </header>

      {mailboxesError && <div className="warning-box">{mailboxesError}</div>}

      {mailboxes && mailboxes.length === 0 && !mailboxesError && (
        <div className="warning-box">
          Brak skonfigurowanych skrzynek. Ustaw zmienna srodowiskowa HOSTINGER_MAILBOXES w Vercel (JSON z lista skrzynek: key, label, host, port, user, password).
        </div>
      )}

      {mailboxes && mailboxes.length > 0 && (
        <>
          {mailboxes.length > 1 && (
            <div className="segmented-control">
              {mailboxes.map((mailbox) => (
                <button
                  key={mailbox.key}
                  type="button"
                  className={mailbox.key === selectedMailbox ? "active" : undefined}
                  onClick={() => setSelectedMailbox(mailbox.key)}
                >
                  {mailbox.label}
                </button>
              ))}
            </div>
          )}

          <div className={`mail-layout ${selectedUid ? "has-selected-message" : ""}`}>
            <div className="panel mail-list-panel">
              <div className="panel-header">
                <h2>Skrzynka odbiorcza</h2>
                <span>{items.length} wiadomosci</span>
              </div>
              {listError && <div className="warning-box">{listError}</div>}
              {listLoading && !items.length && <div className="empty-state">Wczytywanie...</div>}
              {!listLoading && !listError && !items.length && <div className="empty-state">Brak wiadomosci.</div>}
              <div className="mail-list">
                {items.map((item) => (
                  <button
                    key={item.uid}
                    type="button"
                    className={`mail-list-item${item.uid === selectedUid ? " active" : ""}${!item.seen ? " unread" : ""}`}
                    onClick={() => openMessage(item.uid)}
                  >
                    <div className="mail-list-item-top">
                      <span className="mail-from">{item.from}</span>
                      <span className="mail-date">{formatDate(item.date)}</span>
                    </div>
                    <span className="mail-subject">{item.subject}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel mail-reader-panel">
              {selectedUid && (
                <button className="secondary-button mail-mobile-back" type="button" onClick={() => setSelectedUid(null)}>
                  <ArrowLeft size={16} />Wróć do listy
                </button>
              )}
              {!selectedUid && <div className="empty-state"><Mail size={28} /><p>Wybierz wiadomosc z listy.</p></div>}
              {selectedUid && messageLoading && <div className="empty-state">Wczytywanie...</div>}
              {selectedUid && messageError && <div className="warning-box">{messageError}</div>}
              {selectedUid && message && !messageLoading && (
                <div className="mail-reader">
                  <h2>{message.subject}</h2>
                  <div className="mail-reader-meta">
                    <span>{message.from}</span>
                    <span>{formatDate(message.date)}</span>
                  </div>
                  <div className="mail-reader-actions">
                    <button className="secondary-button" type="button" onClick={() => openCompose("reply")}>
                      <Reply size={16} />Odpowiedz
                    </button>
                    <button className="secondary-button" type="button" onClick={() => openCompose("replyAll")}>
                      <ReplyAll size={16} />Odpowiedz wszystkim
                    </button>
                    <button className="secondary-button" type="button" onClick={() => openCompose("forward")}>
                      <Forward size={16} />Przekaz dalej
                    </button>
                    <button className="secondary-button" type="button" onClick={() => performAction("archive")} disabled={actionPending}>
                      <Archive size={16} />Archiwizuj
                    </button>
                    <button className="secondary-button danger-action" type="button" onClick={() => performAction("delete")} disabled={actionPending}>
                      <Trash2 size={16} />Usun
                    </button>
                  </div>
                  {actionError && <div className="warning-box">{actionError}</div>}
                  {composeSuccess && !composeMode && <div className="empty-state">Wiadomosc wyslana.</div>}
                  {composeMode && (
                    <div className="mail-compose-form">
                      <h3>
                        {composeMode === "reply" && "Odpowiedz"}
                        {composeMode === "replyAll" && "Odpowiedz wszystkim"}
                        {composeMode === "forward" && "Przekaz dalej"}
                      </h3>
                      <label>
                        Do
                        <input value={composeTo} onChange={(event) => setComposeTo(event.target.value)} placeholder="adres@domena.pl, adres2@domena.pl" />
                      </label>
                      <label>
                        DW
                        <input value={composeCc} onChange={(event) => setComposeCc(event.target.value)} placeholder="opcjonalnie" />
                      </label>
                      <label>
                        Tresc
                        <textarea value={composeBody} onChange={(event) => setComposeBody(event.target.value)} rows={8} />
                      </label>
                      {composeError && <div className="warning-box">{composeError}</div>}
                      <div className="mail-compose-actions">
                        <button className="ghost-button" type="button" onClick={closeCompose} disabled={composeSending}>
                          Anuluj
                        </button>
                        <button className="primary-button" type="button" onClick={sendCompose} disabled={composeSending}>
                          {composeSending ? "Wysylanie..." : "Wyslij"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="mail-reader-body">{message.text || "(brak tresci tekstowej)"}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
