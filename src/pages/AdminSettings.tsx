import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";

type Settings = {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  welcome_title: string;
  welcome_message: string;
};

const empty: Settings = {
  app_name: "Esencia de Bienestar",
  logo_url: "",
  primary_color: "#D9A6B3",
  secondary_color: "#F4E7E1",
  accent_color: "#C8B6E2",
  welcome_title: "",
  welcome_message: "",
};

export default function AdminSettings() {
  const [s, setS] = useState<Settings>(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from("app_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }: any) => data && setS({ ...empty, ...data }));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await (supabase as any)
      .from("app_settings")
      .update({ ...s, updated_at: new Date().toISOString() })
      .eq("id", true);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Configuración guardada");
  };

  return (
    <div className="pb-28">
      <AdminPageHeader title="Ajustes generales" subtitle="Personaliza la apariencia y los textos principales." />


      <form onSubmit={save} className="card-soft p-4 space-y-4">
        <div>
          <label className="text-xs muted">Nombre de la aplicación</label>
          <input className="field" value={s.app_name} onChange={(e) => setS({ ...s, app_name: e.target.value })} required />
        </div>

        <div>
          <label className="text-xs muted">URL del logo</label>
          <input className="field" placeholder="https://…" value={s.logo_url ?? ""} onChange={(e) => setS({ ...s, logo_url: e.target.value })} />
          {s.logo_url && <img src={s.logo_url} alt="Logo" className="mt-2 h-16 w-16 object-contain rounded-xl border" />}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            ["primary_color", "Primario"],
            ["secondary_color", "Secundario"],
            ["accent_color", "Acento"],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <label className="text-xs muted">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="h-10 w-10 rounded border" />
                <input className="field flex-1" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs muted">Título de bienvenida</label>
          <input className="field" value={s.welcome_title} onChange={(e) => setS({ ...s, welcome_title: e.target.value })} />
        </div>

        <div>
          <label className="text-xs muted">Mensaje de bienvenida</label>
          <textarea className="field min-h-24" value={s.welcome_message} onChange={(e) => setS({ ...s, welcome_message: e.target.value })} />
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          <Save className="h-4 w-4" /> Guardar cambios
        </button>
      </form>
    </div>
  );
}
