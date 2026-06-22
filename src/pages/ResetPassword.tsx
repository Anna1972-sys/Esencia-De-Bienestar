import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    nav("/app", { replace: true });
  };

  return (
    <div className="app-shell px-6 pt-16">
      <h1 className="heading-lg mb-2 text-center">Nueva contraseña</h1>
      <p className="muted text-sm text-center mb-6">Elige una nueva contraseña</p>
      <form onSubmit={submit} className="space-y-4">
        <input type="password" required minLength={6} value={pwd} onChange={e => setPwd(e.target.value)} className="field" placeholder="Mínimo 6 caracteres" />
        <button disabled={loading} className="btn-primary w-full">{loading ? "Guardando…" : "Guardar"}</button>
      </form>
    </div>
  );
}
