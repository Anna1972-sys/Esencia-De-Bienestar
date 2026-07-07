import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { supabaseConfig } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";

export default function Login() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) nav("/app", { replace: true });
  }, [authLoading, user, nav]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfig.isConfigured) {
      toast.error("La conexión con Supabase no está configurada en este despliegue.");
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) return toast.error("Correo o contraseña incorrectos. Si tienes una invitación, abre primero el enlace para crear tu contraseña.");
      toast.success("Te damos la bienvenida ✨");
      nav("/app", { replace: true });
    } catch (error) {
      console.error("[Login] signInWithPassword failed", { message: error instanceof Error ? error.message : String(error) });
      toast.error("No se pudo conectar con el servicio de acceso. Revisa la configuración de Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfig.isConfigured) {
      toast.error("La conexión con Supabase no está configurada en este despliegue.");
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) return toast.error(error.message);
      toast.success("Te enviamos un correo para restablecer la contraseña.");
      setMode("login");
    } catch (error) {
      console.error("[Login] resetPasswordForEmail failed", { message: error instanceof Error ? error.message : String(error) });
      toast.error("No se pudo conectar con el servicio de acceso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell px-6 pt-14">
      <div className="text-center mb-8">
        <img src="/icon-512.png" alt="" className="h-16 w-16 mx-auto mb-4" />
        <h1 className="heading-lg">{mode === "login" ? "Hola de nuevo" : "Recuperar acceso"}</h1>
        <p className="muted text-sm mt-1">{mode === "login" ? "Inicia sesión en tu espacio" : "Te enviaremos un enlace al correo"}</p>
      </div>

      <form onSubmit={mode === "login" ? onLogin : onForgot} className="space-y-4">
        <div>
          <label className="label">Correo</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="tu@correo.com" />
        </div>
        {mode === "login" && (
          <div>
            <label className="label">Contraseña</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field" placeholder="••••••••" />
          </div>
        )}
        <button disabled={loading} className="btn-primary w-full">{loading ? "Un momento…" : mode === "login" ? "Entrar" : "Enviar enlace"}</button>
      </form>

      <div className="mt-6 text-center text-sm space-y-2">
        {mode === "login" ? (
          <button onClick={() => setMode("forgot")} className="text-primary font-medium">¿Olvidaste tu contraseña?</button>
        ) : (
          <button onClick={() => setMode("login")} className="text-primary font-medium">Volver a iniciar sesión</button>
        )}
        <div className="muted">¿No tienes cuenta? El acceso es solo por invitación.</div>
        <BackButton fallbackTo="/" className="muted underline-offset-4 hover:underline">Volver</BackButton>
      </div>
    </div>
  );
}
