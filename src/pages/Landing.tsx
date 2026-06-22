import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/app" replace />;
  return (
    <div className="app-shell">
      <div className="px-6 pt-12 pb-10 text-center">
        <div className="mx-auto h-24 w-24 rounded-3xl shadow-soft mb-6 overflow-hidden bg-white grid place-items-center">
          <img src="/icon-512.png" alt="Esencia de Bienestar" className="h-full w-full object-contain" />
        </div>
        <h1 className="heading-xl text-foreground">Esencia <span className="bg-gradient-rosa bg-clip-text text-transparent">de Bienestar</span></h1>
        <p className="muted mt-3 leading-relaxed">Tu espacio íntimo de recetas, retos y bienestar. Crea recetas con IA, sigue retos de 5 días y cuida de ti, paso a paso.</p>
      </div>

      <div className="px-6 pt-6 pb-12 space-y-3">
        <Link to="/login" className="btn-primary w-full">Acceder a mi espacio</Link>
        <p className="text-xs text-center muted">El acceso es solo con invitación. Si tienes un enlace, ábrelo desde tu correo.</p>
      </div>
    </div>
  );
}
