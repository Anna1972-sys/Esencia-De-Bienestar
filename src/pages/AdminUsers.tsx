import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, ShieldOff, Trash2, User, Search, Ban, RotateCcw, Activity, Clock, X, BellRing, UserCheck, UserX, AlertTriangle } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdvancedUserAlerts from "@/components/admin/AdvancedUserAlerts";
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
  user_id?: string;
  path: string;
  category: string;
  label: string | null;
  started_at: string;
  last_seen_at: string;
  active_seconds: number;
};
type FavoriteEvent = {
  id: string;
  content_type: "recipe" | "video" | "guide" | "exercise";
  action: "added" | "removed" | "opened";
  created_at: string;
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
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEvent[]>([]);
  const [allActivityRows, setAllActivityRows] = useState<ActivityRow[]>([]);

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
    const { data: activityData, error: activitySummaryError } = await (supabase as any)
      .from("user_activity_sessions")
      .select("id,user_id,path,category,label,started_at,last_seen_at,active_seconds")
      .order("last_seen_at", { ascending: false })
      .limit(5000);
    if (activitySummaryError) {
      console.error("[user-activity-summary]", activitySummaryError);
      setAllActivityRows([]);
    } else {
      setAllActivityRows((activityData ?? []) as ActivityRow[]);
    }
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
      setFavoriteEvents([]);
      setActivityError("");
      return;
    }
    setActivityUser(r);
    setActivityRows([]);
    setActivityError("");
    setActivityLoading(true);
    const [activityResult, favoriteResult] = await Promise.all([
      (supabase as any)
        .from("user_activity_sessions")
        .select("id,path,category,label,started_at,last_seen_at,active_seconds")
        .eq("user_id", r.id)
        .order("started_at", { ascending: false })
        .limit(1000),
      (supabase as any)
        .from("favorite_activity_events")
        .select("id,content_type,action,created_at")
        .eq("user_id", r.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setActivityLoading(false);
    if (activityResult.error) {
      console.error("[user-activity]", activityResult.error);
      setActivityError("No se pudo cargar la actividad. Comprueba que la actualización de Supabase esté aplicada.");
      return;
    }
    setActivityRows((activityResult.data ?? []) as ActivityRow[]);
    setFavoriteEvents((favoriteResult.data ?? []) as FavoriteEvent[]);
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

  const activityByUser = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    allActivityRows.forEach(row => {
      if (!row.user_id) return;
      const list = map.get(row.user_id) ?? [];
      list.push(row);
      map.set(row.user_id, list);
    });
    return map;
  }, [allActivityRows]);

  const clientAlerts = useMemo(() => rows
    .filter(row => !isAdmin(row) && !row.is_banned)
    .map(row => {
      const activity = activityByUser.get(row.id) ?? [];
      const latestActivity = activity[0]?.last_seen_at ?? row.last_sign_in_at;
      const daysInactive = latestActivity
        ? Math.floor((Date.now() - +new Date(latestActivity)) / (24 * 60 * 60 * 1000))
        : Number.POSITIVE_INFINITY;
      const activeDaysThisWeek = new Set(activity
        .filter(item => +new Date(item.last_seen_at) >= Date.now() - 7 * 24 * 60 * 60 * 1000)
        .map(item => dayKey(item.last_seen_at))).size;
      const level = !row.email_confirmed_at || !latestActivity || daysInactive >= 14
        ? "urgent"
        : daysInactive >= 7
          ? "attention"
          : activeDaysThisWeek >= 5
            ? "positive"
            : "normal";
      const message = !row.email_confirmed_at
        ? "Acceso pendiente de confirmar"
        : !latestActivity
          ? "Todavía no ha entrado"
          : daysInactive >= 14
            ? `Sin entrar desde hace ${daysInactive} días`
            : daysInactive >= 7
              ? `Lleva ${daysInactive} días sin entrar`
              : activeDaysThisWeek >= 5
                ? "Muy activa esta semana"
                : "Seguimiento al día";
      return { row, level, message, daysInactive };
    })
    .sort((a, b) => {
      const priority = { urgent: 0, attention: 1, positive: 2, normal: 3 };
      return priority[a.level as keyof typeof priority] - priority[b.level as keyof typeof priority]
        || b.daysInactive - a.daysInactive;
    }), [rows, activityByUser]);

  const urgentAlerts = clientAlerts.filter(alert => alert.level === "urgent").length;
  const attentionAlerts = clientAlerts.filter(alert => alert.level === "attention").length;
  const activeClients = clientAlerts.filter(alert => alert.level === "positive").length;

  return (
    <div className="pb-28">
      <AdminPageHeader title="Usuarias" subtitle={`${rows.length} usuario${rows.length === 1 ? "" : "s"} registrados.`} />

      <section className="card-elegant p-4 mb-4" aria-label="Alertas de seguimiento">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>Alertas de seguimiento</h2>
            </div>
            <p className="text-[11px] muted mt-1">Privadas y visibles solo para administración.</p>
          </div>
          <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-1">{clientAlerts.length} clientas</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <AlertMetric icon={UserX} label="Necesitan atención" value={urgentAlerts} tone="rose" />
          <AlertMetric icon={AlertTriangle} label="Revisar pronto" value={attentionAlerts} tone="amber" />
          <AlertMetric icon={UserCheck} label="Muy activas" value={activeClients} tone="emerald" />
        </div>
        {clientAlerts.filter(alert => alert.level !== "normal").length === 0 ? (
          <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-xs">No hay avisos pendientes en este momento.</div>
        ) : (
          <div className="space-y-1.5">
            {clientAlerts.filter(alert => alert.level !== "normal").slice(0, 5).map(alert => (
              <Link
                key={alert.row.id}
                to={`/app/admin/seguimiento/${alert.row.id}`}
                className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs ${
                  alert.level === "urgent"
                    ? "bg-rose-50 text-rose-700"
                    : alert.level === "attention"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <span className="font-semibold truncate flex-1">{alert.row.display_name || alert.row.email || "Clienta"}</span>
                <span className="shrink-0">{alert.message}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AdvancedUserAlerts
        clients={rows.filter(row => !isAdmin(row) && !row.is_banned).map(row => ({
          id: row.id,
          display_name: row.display_name,
          email: row.email,
        }))}
      />

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
            const alert = clientAlerts.find(item => item.row.id === r.id);
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
                    {!admin && alert && (
                      <div className={`text-[10px] mt-1 font-medium ${
                        alert.level === "urgent"
                          ? "text-rose-600"
                          : alert.level === "attention"
                            ? "text-amber-600"
                            : alert.level === "positive"
                              ? "text-emerald-600"
                              : "muted"
                      }`}>
                        {alert.message}
                      </div>
                    )}
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
                    favoriteEvents={favoriteEvents}
                    loading={activityLoading}
                    error={activityError}
                    onClose={() => {
                      setActivityUser(null);
                      setActivityRows([]);
                      setFavoriteEvents([]);
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
  favoriteEvents,
  loading,
  error,
  onClose,
}: {
  rows: ActivityRow[];
  favoriteEvents: FavoriteEvent[];
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
  const favoriteActionText = (event: FavoriteEvent) => {
    const type = event.content_type === "recipe" ? "una receta"
      : event.content_type === "video" ? "un vídeo"
        : event.content_type === "guide" ? "una guía"
          : "un ejercicio";
    if (event.action === "removed") return `Eliminó ${type} de Favoritos`;
    if (event.action === "opened") return `Abrió ${type} desde Favoritos`;
    return `Guardó ${type} en Favoritos`;
  };

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
              {favoriteEvents.slice(0, 6).map(event => (
                <div key={event.id} className="rounded-xl bg-primary/5 px-3 py-2 flex items-start gap-2 text-xs">
                  <span className="text-primary shrink-0">❤️</span>
                  <span className="min-w-0 flex-1">{favoriteActionText(event)}</span>
                  <span className="muted shrink-0">{relativeTime(event.created_at)}</span>
                </div>
              ))}
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

function AlertMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BellRing;
  label: string;
  value: number;
  tone: "rose" | "amber" | "emerald";
}) {
  const styles = {
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <div className={`rounded-xl p-2.5 ${styles}`}>
      <Icon className="h-4 w-4 mb-1" />
      <div className="font-serif text-xl leading-none">{value}</div>
      <div className="text-[9px] leading-tight mt-1">{label}</div>
    </div>
  );
}
