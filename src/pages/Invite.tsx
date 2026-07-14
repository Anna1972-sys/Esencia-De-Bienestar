import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Invite() {
  const { token } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState<"checking" | "valid">("checking");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      // If already signed in, go straight to the app.
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session) {
        nav("/app", { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke("validate-invitation", { body: { token } });
      if (error) {
        console.warn("[Invite] validate-invitation unavailable; continuing with secure accept-invitation validation", {
          message: error.message,
        });
        setState("valid");
        return;
      }
      if (!data?.valid) {
        // Used/invalid invitations must never block existing users.
        // If there is no active session, continue through the normal login flow.
        toast.info("Inicia sesión con tu correo y contraseña.");
        nav("/login", { replace: true });
        return;
      }
      if (data.email) setEmail(data.email);
      setState("valid");
    })();
  }, [token, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("accept-invitation", {
      body: { token, email: normalizedEmail, password, name },
    });
    if (error || !data?.ok) {
      setSubmitting(false);
      return toast.error(data?.error || error?.message || "No se pudo crear la cuenta");
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setSubmitting(false);
    if (signInErr) {
      toast.success("Cuenta creada. Inicia sesión para continuar.");
      return nav("/login", { replace: true });
    }
    toast.success("Cuenta creada ✨");
    nav("/app", { replace: true });
  };

  if (state === "checking") return <div className="app-shell grid place-items-center muted">Validando invitación…</div>;

  return (
    <div className="app-shell px-6 pt-12">
      <div className="text-center mb-6">
        <img src="/icon-512.png" alt="" className="h-16 w-16 mx-auto mb-3" />
        <h1 className="heading-lg">Crea tu cuenta</h1>
        <p className="muted text-sm">Tu invitación es válida ✨</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Tu nombre</label><input required value={name} onChange={e => setName(e.target.value)} className="field" placeholder="Cómo te llamamos" /></div>
        <div><label className="label">Correo</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="field" /></div>
        <div><label className="label">Contraseña</label><input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="field" placeholder="Mínimo 6 caracteres" /></div>
        <button disabled={submitting} className="btn-primary w-full">{submitting ? "Creando…" : "Crear mi cuenta"}</button>
        <p className="text-center text-sm muted">¿Ya tienes cuenta? <Link to="/login" className="underline">Inicia sesión</Link></p>
      </form>
    </div>
  );
}
