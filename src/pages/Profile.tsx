import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { LogOut, Settings, Crown, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, signOut, isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [allergies, setAllergies] = useState("");
  const [calories, setCalories] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setName(data?.display_name ?? "");
      const p = data?.preferences ?? {};
      const pp = (typeof p === "object" && p !== null ? p : {}) as any;
      setAllergies(pp.allergies ?? "");
      setCalories(pp.target_calories ?? "");
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: name,
      preferences: { allergies, target_calories: calories },
    }).eq("id", user.id);
    if (error) toast.error(error.message); else toast.success("Guardado");
  };

  return (
    <div>
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <h1 className="heading-lg mb-4">Mi perfil</h1>
      <div className="card-soft p-5 space-y-4">
        <div><label className="label">Nombre</label><input value={name} onChange={e => setName(e.target.value)} className="field" /></div>
        <div><label className="label">Correo</label><input value={user?.email ?? ""} disabled className="field opacity-70" /></div>
        <div><label className="label">Alergias / a evitar</label><input value={allergies} onChange={e => setAllergies(e.target.value)} className="field" placeholder="ej. lactosa" /></div>
        <div><label className="label">Calorías objetivo</label><input type="number" value={calories} onChange={e => setCalories(e.target.value)} className="field" placeholder="ej. 1800" /></div>
        <button onClick={save} className="btn-primary w-full">Guardar</button>
      </div>

      {isAdmin && (
        <div className="card-soft p-5 mt-4">
          <div className="flex items-center gap-2 mb-3"><Crown className="h-4 w-4 text-primary" /><div className="font-medium text-sm">Panel admin</div></div>
          <Link to="/app/admin" className="btn-ghost w-full justify-between"><span>Abrir panel de administración</span><Settings className="h-4 w-4" /></Link>
        </div>
      )}

      <button onClick={signOut} className="btn-ghost w-full mt-6 text-destructive"><LogOut className="h-4 w-4" /> Cerrar sesión</button>
    </div>
  );
}
