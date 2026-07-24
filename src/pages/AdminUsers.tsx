import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, ShieldOff, Trash2, User, Search, Ban, RotateCcw, Activity, Clock, X } from "lucide-react";
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

type ActivityRow = {
  id: string;
  path: string;
  category: string;
  label: string | null;
  started_at: string;
  last_seen_at: string;
  active_seconds: number;
};

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";
const formatDuration = (seconds: number) => {
  const totalMinutes = Math.round(Math.max(0, seconds) / 60);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
};
const dayKey = (value: string | number | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};
const consecutiveDays = (rows: ActivityRow[]) => {
  const activeDays = new Set(rows.map(row => dayKey(row.last_seen_at)));
  if (!activeDays.size) return 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};
const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.round((Date.now() - +new Date(value)) / 1000));
  if (seconds < 60) return "Ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
};
const actionText = (row: ActivityRow) => {
  const label = row.label?.trim();
  if (row.category === "Generador de recetas") return label && !/^hola/i.test(label) ? `Usó ${label}` : "Abrió el Generador de recetas";
  if (row.category === "Vídeos") return label ? `Vio ${label}` : "Vio un vídeo";
  if (row.category === "Guías") return label ? `Abrió ${label}` : "Abrió una guía";
  if (row.category === "Retos de 5 días") return label ? `Consultó ${label}` : "Entró en el reto de 5 días";
  if (label && label !== "Esencia de Bienestar") return `Abrió ${label}`;
  return `Visitó ${row.category}`;
};

export default function AdminUsers() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "client">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "suspended" | "unconfirmed">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "lastSeen" | "az">("newest");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activityUser, setActivityUser] = useState<Row | null>(null);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.functions.invoke("admin-list-users");
    setLoading(false);
    if (error || !data?.ok) {
      const message = data?.error || error?.message || "Error al cargar usuarias";
      console.error("[admin-list-users] Error completo al cargar usuarias", {
        functionName: "admin-list-users",
        error,
        data,
      });
      setRows([]);
      setLoadError(message);
      toast.error(message);
      return;
    }
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

  const openActivity = async (r: Row) => {
    if (activityUser?.id === r.id) {
      setActivityUser(null);
      setActivityRows([]);
      setActivityError("");
      return;
    }
    setActivityUser(r);
    setActivityRows([]);
    setActivityError("");
    setActivityLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_activity_sessions")
      .select("id,path,category,label,started_at,last_seen_at,active_seconds")
      .eq("user_id", r.id)
      .order("started_at", { ascending: false })
      .limit(1000);
    setActivityLoading(false);
    if (error) {
      console.error("[user-activity]", error);
      setActivityError("No se pudo cargar la actividad. Comprueba que la actualización de Supabase esté aplicada.");
      return;
    }
    setActivityRows((data ?? []) as ActivityRow[]);
  };

  const visible = useMemo(() => {
    const needle = String(q ?? "").trim().toLowerCase();
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

      {loadError && (
        <div className="card-soft p-4 mb-3 border-destructive/40 bg-destructive/5 text-sm">
          <div className="font-semibold text-destructive mb-1">No se pudo cargar la lista de usuarias</div>
          <div className="muted">{loadError}</div>
          <button className="btn-primary mt-3 w-full" onClick={load}>Volver a intentar</button>
        </div>
      )}

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
                  {!admin && (
                    <button
                      type="button"
                      onClick={() => openActivity(r)}
                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary"
                      aria-expanded={activityUser?.id === r.id}
                    >
                      <Clock className="h-3.5 w-3.5" /> {activityUser?.id === r.id ? "Cerrar actividad" : "Ver actividad"}
                    </button>
                  )}
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
                {activityUser?.id === r.id && (
                  <UserActivityPanel
                    rows={activityRows}
                    loading={activityLoading}
                    error={activityError}
                    onClose={() => {
                      setActivityUser(null);
                      setActivityRows([]);
                      setActivityError("");
                    }}
                  />
                )}
              </div>
            );
          })}
          {visible.length === 0 && <div className="card-soft p-6 text-center muted">No hay usuarios que coincidan.</div>}
        </div>
      )}
    </div>
  );
}

function UserActivityPanel({
  rows,
  loading,
  error,
  onClose,
}: {
  rows: ActivityRow[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const now = Date.now();
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const totalSeconds = rows.reduce((sum, row) => sum + Number(row.active_seconds || 0), 0);
  const lastSeen = rows.reduce<string | null>((latest, row) => {
    if (!latest || +new Date(row.last_seen_at) > +new Date(latest)) return row.last_seen_at;
    return latest;
  }, null);
  const categories = Array.from(rows.reduce((map, row) => {
    map.set(row.category, (map.get(row.category) ?? 0) + Number(row.active_seconds || 0));
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);
  const maxCategorySeconds = categories[0]?.[1] ?? 1;
  const streak = consecutiveDays(rows);
  const averageSeconds = rows.length ? totalSeconds / rows.length : 0;
  const activeDaysLastWeek = new Set(
    rows.filter(row => +new Date(row.last_seen_at) >= weekStart).map(row => dayKey(row.last_seen_at)),
  ).size;
  const daysSinceLastSeen = lastSeen ? (now - +new Date(lastSeen)) / (24 * 60 * 60 * 1000) : Number.POSITIVE_INFINITY;
  const engagement = daysSinceLastSeen <= 2 && activeDaysLastWeek >= 5
    ? { label: "Muy activa", color: "bg-emerald-500", tone: "bg-emerald-50 text-emerald-700" }
    : daysSinceLastSeen <= 7 || activeDaysLastWeek >= 2
      ? { label: "Actividad media", color: "bg-amber-400", tone: "bg-amber-50 text-amber-700" }
      : { label: "Inactiva", color: "bg-rose-500", tone: "bg-rose-50 text-rose-700" };
  const recentActions = [...rows]
    .sort((a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at))
    .slice(0, 8);

  return (
    <section className="mt-3 rounded-2xl border border-primary/30 bg-white/80 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-sm">Actividad de la clienta</div>
          <div className="text-[11px] muted">Información privada, visible solo para administración.</div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-full bg-muted" aria-label="Cerrar actividad">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="text-sm muted py-4 text-center">Cargando actividad…</div>
      ) : error ? (
        <div className="text-sm text-destructive rounded-xl bg-destructive/5 p-3">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm muted rounded-xl bg-secondary/50 p-3 text-center">
          Todavía no hay actividad registrada para esta clienta.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ActivityMetric label="Último acceso" value={lastSeen ? relativeTime(lastSeen) : "—"} />
            <ActivityMetric label="Días consecutivos" value={`${streak} ${streak === 1 ? "día" : "días"}`} />
            <ActivityMetric label="Tiempo total" value={formatDuration(totalSeconds)} />
            <ActivityMetric label="Media por sesión" value={formatDuration(averageSeconds)} />
          </div>
          <div className={`rounded-xl p-3 flex items-center justify-between gap-3 ${engagement.tone}`}>
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${engagement.color}`} />
              <div>
                <div className="text-[11px] opacity-75">Implicación</div>
                <div className="text-sm font-semibold">{engagement.label}</div>
              </div>
            </div>
            <div className="text-xs text-right opacity-75">{activeDaysLastWeek} días activos esta semana</div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-2">Tiempo por categoría</div>
            <div className="space-y-2">
              {categories.map(([category, seconds]) => (
                <div key={category}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{category}</span>
                    <span className="muted shrink-0">{formatDuration(seconds)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (seconds / maxCategorySeconds) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-2">Últimas acciones</div>
            <div className="space-y-1.5">
              {recentActions.map(row => (
                <div key={row.id} className="rounded-xl bg-secondary/45 px-3 py-2 flex items-start gap-2 text-xs">
                  <span className="text-primary shrink-0">•</span>
                  <span className="min-w-0 flex-1">{actionText(row)}</span>
                  <span className="muted shrink-0">{relativeTime(row.last_seen_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ActivityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/55 p-2.5">
      <div className="text-[10px] muted">{label}</div>
      <div className="font-semibold text-sm mt-0.5">{value}</div>
    </div>
  );
}
