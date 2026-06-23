import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[App] render failed", { message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-[100dvh] grid place-items-center bg-background px-6 text-center">
          <div className="card-elegant max-w-sm p-6">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-primary">Esencia de Bienestar</p>
            <h1 className="heading-md mt-2">No se pudo cargar esta pantalla</h1>
            <p className="muted mt-2 text-sm">Puedes volver a intentarlo. Si el problema continúa, revisa la conexión con Supabase.</p>
            <button className="btn-primary mt-5" onClick={() => window.location.reload()}>Reintentar</button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
