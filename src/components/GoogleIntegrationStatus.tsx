import { CalendarCheck, Link, Mail, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { connectGoogleIdentity, getGoogleIntegrationStatus, type GoogleIntegrationStatus as GoogleStatus } from "../lib/googleAuth";

export function GoogleIntegrationStatus() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStatus(clearMessage = true) {
    setLoading(true);
    if (clearMessage) setMessage(null);
    try {
      setStatus(await getGoogleIntegrationStatus());
    } catch (error) {
      setStatus(emptyGoogleStatus());
      setMessage(error instanceof Error ? error.message : "Nie udało się sprawdzić połączenia Google.");
    } finally {
      setLoading(false);
    }
  }

  async function onConnect() {
    setLoading(true);
    setMessage(null);
    try {
      await connectGoogleIdentity();
    } catch (error) {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "Nie udało się rozpocząć autoryzacji Google.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "1") setMessage("Konto Google zostało połączone.");
    const googleError = params.get("google_error");
    if (googleError) setMessage(`Google: ${googleError}`);
    if (params.has("google_connected") || params.has("google_error")) {
      params.delete("google_connected");
      params.delete("google_error");
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
    void loadStatus(false);
  }, []);

  const connected = Boolean(status?.connected);
  const needsReconnect = Boolean(status?.needsReconnect);
  const stateClass = connected ? "connected" : needsReconnect ? "warning" : "disconnected";
  const headline = loading
    ? "Sprawdzam połączenie..."
    : connected
    ? "Połączone"
    : needsReconnect
    ? "Wymaga ponownego połączenia"
    : "Niepołączone";
  const description = connected
    ? status?.googleEmail ?? "Konto Google aktywne"
    : needsReconnect
    ? status?.message ?? "Połącz Google ponownie, żeby odświeżyć uprawnienia Calendar/Gmail."
    : "Połącz konto, żeby zapisywać zadania w swoim kalendarzu i wysyłać przypomnienia.";

  return (
    <section className={`google-integration-card ${stateClass}`} aria-label="Status połączenia Google">
      <div className="google-integration-main">
        <div className="google-integration-icon">
          {connected ? <CalendarCheck size={18} /> : <Link size={18} />}
        </div>
        <div>
          <span className="eyebrow">Google Calendar / Gmail</span>
          <strong>{headline}</strong>
          <span>{description}</span>
          {status?.missingScopes?.length ? (
            <span className="google-integration-message">
              Do pełnej integracji może brakować uprawnień: {status.missingScopes.join(", ")}
            </span>
          ) : null}
          {message && <span className="google-integration-message">{message}</span>}
        </div>
      </div>
      <div className="google-integration-actions">
        {connected && (
          <span className="google-integration-badge">
            <Mail size={14} /> aktywne
          </span>
        )}
        <button className="secondary-button" type="button" onClick={() => void loadStatus()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin-icon" : ""} /> Status
        </button>
        {!connected && (
          <button className="primary-button" type="button" onClick={() => void onConnect()} disabled={loading}>
            <Link size={15} /> {needsReconnect ? "Połącz ponownie" : "Połącz Google"}
          </button>
        )}
      </div>
    </section>
  );
}

function emptyGoogleStatus(): GoogleStatus {
  return {
    connected: false,
    needsReconnect: false,
    googleEmail: null,
    connectedAt: null,
    updatedAt: null,
    scopes: [],
    missingScopes: [],
    message: null
  };
}
