import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Shield, ShieldOff, Trash2, User, Search, Ban, RotateCcw, Activity } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";

type Row = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  is_banned: boolean;
  roles: string[];
};

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";

export default function AdminUsers() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "client">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "suspended" | "unconfirmed">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "lastSeen" | "az">("newest");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-list-users");
    setLoading(false);
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Error al cargar"); return; }
    setRows(data.users ?? []);
  };

  useEffect(() => { load(); }, []);

  const isAdmin = (r: Row) => r.roles.includes("admin");

  const setRole = async (r: Row, role: "admin", grant: boolean) => {
    if (r.id === user?.id && role === "admin" && !grant) { toast.error("No puedes quitarte tu rol"); return; }
    setBusy(r.id);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { userId: r.id, action: "set_role", role, grant },
    });
    setBusy(null);
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Error"); return; }
    toast.success(grant ? "Rol concedido" : "Rol retirado");
    load();
  };

  const suspend = async (r: Row) => {
    if (r.id === user?.id) { toast.error("No puedes suspender tu propia cuenta"); return; }
    if (!confirm(`¿Suspender a ${r.email ?? r.display_name ?? "este usuario"}? Se cerrarán todas sus sesiones y no podrá iniciar sesión.`)) return;
    setBusy(r.id);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { userId: r.id, action: "suspend" },
    });
    setBusy(null);
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Error"); return; }
    toast.success("Usuario suspendido");
    load();
  };

  const restore = async (r: Row) => {
    setBusy(r.id);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { userId: r.id, action: "restore" },
    });
    setBusy(null);
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Error"); return; }
    toast.success("Cuenta restaurada");
    load();
  };

  const remove = async (r: Row) => {
    if (r.id === user?.id) { toast.error("No puedes eliminar tu propia cuenta"); return; }
    if (!confirm(`¿Eliminar PERMANENTEMENTE a ${r.email ?? r.display_name ?? "este usuario"}?\n\nSe revocarán sus permisos, se cerrarán sus sesiones y no podrá volver a iniciar sesión. Esta acción no se puede deshacer.`)) return;
    setBusy(r.id);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { userId: r.id } });
    setBusy(null);
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Error"); return; }
    toast.success("Usuario eliminado");
    load();
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (needle) {
        const hay = `${r.display_name ?? ""} ${r.email ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (filterRole === "admin" && !isAdmin(r)) return false;
      if (filterRole === "client" && isAdmin(r)) return false;
      if (filterStatus === "active" && (r.is_banned || !r.email_confirmed_at)) return false;
      if (filterStatus === "suspended" && !r.is_banned) return false;
      if (filterStatus === "unconfirmed" && r.email_confirmed_at) return false;
      return true;
    });
    const cmp = {
      newest: (a: Row, b: Row) => +new Date(b.created_at) - +new Date(a.created_at),
      oldest: (a: Row, b: Row) => +new Date(a.created_at) - +new Date(b.created_at),
      lastSeen: (a: Row, b: Row) => +new Date(b.last_sign_in_at ?? 0) - +new Date(a.last_sign_in_at ?? 0),
      az: (a: Row, b: Row) => (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? "", "es"),
    }[sortBy];
    return [...list].sort(cmp);
  }, [rows, q, filterRole, filterStatus, sortBy]);

  return (
    <div className="pb-28">
      <AdminPageHeader title="Usuarias" subtitle={`${rows.length} usuario${rows.length === 1 ? "" : "s"} registrados.`} />


      <div className="card-soft p-3 mb-3 space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 muted" />
          <input className="field pl-8" placeholder="Buscar por nombre o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select className="field text-xs" value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)}>
            <option value="all">Todos los roles</option>
            <option value="admin">Admins</option>
            <option value="client">Clientes</option>
          </select>
          <select className="field text-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
            <option value="all">Cualquier estado</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
            <option value="unconfirmed">Sin confirmar</option>
          </select>
          <select className="field text-xs" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="lastSeen">Última actividad</option>
            <option value="az">Nombre A-Z</option>
          </select>
        </div>
        <div className="text-xs muted">{visible.length} resultado{visible.length === 1 ? "" : "s"}</div>
      </div>

      {loading ? (
        <div className="card-soft p-6 text-center muted">Cargando…</div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const admin = isAdmin(r);
            const isSelf = r.id === user?.id;
            return (
              <div key={r.id} className={`card-soft p-3 ${r.is_banned ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center shrink-0"><User className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate flex items-center gap-1.5">
                      {r.display_name || "Usuaria sin nombre"}
                      {admin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">ADMIN</span>}
                      {r.is_banned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">SUSPENDIDA</span>}
                      {!r.email_confirmed_at && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">SIN CONFIRMAR</span>}
                    </div>
                    <div className="text-xs muted truncate">{r.email ?? "—"}</div>
                    <div className="text-[11px] muted">Alta: {fmt(r.created_at)} · Última actividad: {fmt(r.last_sign_in_at)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    onClick={() => setRole(r, "admin", !admin)}
                    disabled={busy === r.id || (isSelf && admin)}
                    className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted disabled:opacity-40"
                    title={admin ? "Quitar admin" : "Hacer admin"}
                  >
                    {admin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {admin ? "Quitar admin" : "Hacer admin"}
                  </button>
                  <Link
                    to={`/app/admin/seguimiento/${r.id}`}
                    className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary"
                    title="Ver seguimiento (solo lectura)"
                  >
                    <Activity className="h-3.5 w-3.5" /> Ver seguimiento
                  </Link>
                  {r.is_banned ? (
                    <button onClick={() => restore(r)} disabled={busy === r.id} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted">
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                    </button>
                  ) : (
                    <button onClick={() => suspend(r)} disabled={busy === r.id || isSelf} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted disabled:opacity-40">
                      <Ban className="h-3.5 w-3.5" /> Suspender
                    </button>
                  )}
                  <button
                    onClick={() => remove(r)}
                    disabled={busy === r.id || isSelf}
                    className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive disabled:opacity-40 ml-auto"
                    title="Eliminar permanentemente"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <div className="card-soft p-6 text-center muted">No hay usuarios que coincidan.</div>}
        </div>
      )}
    </div>
  );
}
