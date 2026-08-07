import { FormEvent, useState } from "react";
import { Lock, Mail, Moon, Sun } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { signInWithGoogle } from "../lib/googleAuth";

export function AuthPage({ theme, onToggleTheme }: { theme: "dark" | "light"; onToggleTheme: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage(mode === "register" ? "Konto utworzone. Sprawdź email, jeśli Supabase wymaga potwierdzenia." : null);
  }

  async function onGoogleSignIn() {
    setLoading(true);
    setMessage(null);
    const result = await signInWithGoogle();
    setLoading(false);
    if (result.error) setMessage(result.error.message);
  }

  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <div className="auth-screen">
      <button className="theme-toggle auth-theme-toggle" onClick={onToggleTheme} type="button" aria-label="Przełącz motyw" aria-pressed={theme === "light"}>
        <ThemeIcon size={16} />
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-icon"><Lock size={24} /></div>
        <h1>AI Project Hub</h1>
        <p>Pełna kontrola projektów, deadline’ów i decyzji AI.</p>
        {!isSupabaseConfigured && (
          <div className="warning-box">Uzupełnij `.env` wartościami Supabase, żeby auth i dane działały.</div>
        )}
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          Hasło
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} required />
        </label>
        {message && <div className="warning-box">{message}</div>}
        <button className="primary-button" disabled={loading}>
          {loading ? "Pracuję..." : mode === "login" ? "Zaloguj" : "Utwórz konto"}
        </button>
        <button className="secondary-button" type="button" onClick={() => void onGoogleSignIn()} disabled={loading}>
          <Mail size={16} /> Zaloguj z Google
        </button>
        <button className="link-button" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Nie masz konta? Rejestracja" : "Masz konto? Logowanie"}
        </button>
      </form>
    </div>
  );
}
