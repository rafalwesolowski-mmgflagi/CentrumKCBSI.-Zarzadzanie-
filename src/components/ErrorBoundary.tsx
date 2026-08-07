import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch() {
    // Keep the app usable in production; detailed logging can be wired to monitoring later.
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal-screen">
          <div className="fatal-card">
            <span className="eyebrow">Application recovery</span>
            <h1>Coś poszło nie tak</h1>
            <p>Widok napotkał błąd, ale dane w Supabase są bezpieczne. Odśwież aplikację i wróć do pracy.</p>
            <code>{this.state.error.message}</code>
            <button className="primary-button" onClick={() => window.location.reload()}>
              Odśwież aplikację
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
