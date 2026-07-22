import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        console.error("[ResetPassword] getSession failed", { message: error.message });
        setHasRecoverySession(false);
      } else {
        setHasRecoverySession(Boolean(data.session));
      }
      setCheckingSession(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(Boolean(session));
        setCheckingSession(false);
      }
    });

    checkRecoverySession();

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasRecoverySession) {
      toast.error("El enlace de recuperación no es válido o ha caducado. Pide un nuevo correo de recuperación.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) {
      console.error("[ResetPassword] updateUser failed", { message: error.message });
      return toast.error("No se ha podido guardar la nueva contraseña. Pide un nuevo enlace e inténtalo otra vez.");
    }
    toast.success("Contraseña actualizada");
    nav("/app", { replace: true });
  };

  return (
    <div className="app-shell px-6 pt-16">
      <h1 className="heading-lg mb-2 text-center">Nueva contraseña</h1>
      <p className="muted text-sm text-center mb-6">Elige una nueva contraseña</p>
      {!checkingSession && !hasRecoverySession && (
        <div className="card p-4 mb-4 text-sm text-center text-amber-700 bg-amber-50 border-amber-200">
          Este enlace no es válido o ha caducado. Vuelve a pedir el correo de recuperación desde la pantalla de acceso.
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <input type="password" required minLength={6} value={pwd} onChange={e => setPwd(e.target.value)} className="field" placeholder="Mínimo 6 caracteres" />
        <button disabled={loading || checkingSession || !hasRecoverySession} className="btn-primary w-full">{loading ? "Guardando…" : checkingSession ? "Comprobando enlace…" : "Guardar"}</button>
      </form>
    </div>
  );
}
