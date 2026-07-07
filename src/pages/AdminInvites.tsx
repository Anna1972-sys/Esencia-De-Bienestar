import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Plus, ArrowLeft, Trash2 } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const CONFIRM_DELETE = "¿Estás segura de que deseas eliminar este elemento? Esta acción no se puede deshacer.";
const PUBLIC_APP_ORIGIN = "https://esencia-de-bienestar-49ii.vercel.app";

const getInvitationOrigin = () => {
  const host = window.location.hostname;
  const isLovableWorkspace = host.includes("lovableproject.com") || host.includes("id-preview--");
  return isLovableWorkspace ? PUBLIC_APP_ORIGIN : window.location.origin;
};


export default function AdminInvites() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [email, setEmail] = useState("");

  const load = async () => {
    const { data } = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "");
    const invitationEmail = email.trim().toLowerCase();
    const { error } = await supabase.from("invitations").insert({ token, email: invitationEmail || null, created_by: user.id });
    if (error) return toast.error(error.message);
    setEmail(""); load(); toast.success("Invitación creada");
  };

  const copy = (token: string) => {
    const url = `${getInvitationOrigin()}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  };

  return (
    <div className="pb-28">
      <AdminPageHeader title="Invitaciones" subtitle="Crear y revocar invitaciones" />

      <form onSubmit={create} className="card-soft p-4 mb-4 space-y-3">
        <input value={email} onChange={e => setEmail(e.target.value)} className="field" placeholder="Email opcional" />
        <button className="btn-primary w-full"><Plus className="h-4 w-4" /> Crear invitación</button>
      </form>
      <div className="space-y-2">
        {items.map(i => (
          <div key={i.id} className="card-soft p-3 text-sm flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{i.email ?? "sin email"}</div>
              <div className="text-xs muted">{i.status} · {new Date(i.created_at).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {i.status === "pending" && <button onClick={() => copy(i.token)} className="btn-ghost text-xs"><Copy className="h-3 w-3" /> Copiar</button>}
              <button onClick={async () => {
                if (!confirm(CONFIRM_DELETE)) return;
                const { error } = await supabase.from("invitations").delete().eq("id", i.id);
                if (error) toast.error(error.message); else { toast.success("Eliminada"); load(); }
              }} className="text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
