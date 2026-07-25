import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, Target, Trophy, Eye, TrendingDown, TrendingUp, Droplets, Moon, Footprints, Activity, User as UserIcon, BellRing, Clock, Flame, HeartPulse, Utensils, ShieldCheck } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";

type MetricKey = "weight" | "waist" | "hip" | "chest" | "arm" | "thigh";
type Measurement = { id: string; metric: MetricKey; value: number; unit: string; measured_at: string };
type Goal = { id: string; metric: MetricKey; target_value: number; start_value: number | null; achieved: boolean };
type PhotoRow = { id: string; metric: MetricKey; kind: "before" | "after"; image_path: string; created_at?: string };
type Entry = {
  id: string;
  entry_date: string;
  weight_kg: number | null; waist_cm: number | null; hip_cm: number | null;
  chest_cm: number | null; arm_cm: number | null; thigh_cm: number | null;
  water_ml: number | null; sleep_hours: number | null; mood: number | null;
  exercise: string | null; steps: number | null; notes: string | null;
  energy?: number | null;
  updated_at?: string;
};
type ClientRow = { id: string; email: string | null; display_name: string | null; last_activity: string | null };
type ProfileDetail = {
  display_name: string | null;
  preferences: {
    allergies?: string;
    target_calories?: string | number;
    objective?: string;
  } | null;
};
type ActivityRow = {
  id: string;
  category: string;
  label: string | null;
  last_seen_at: string;
  active_seconds: number;
};
type ClientFavorite = {
  id: string;
  content_type: "recipe" | "video" | "guide" | "exercise";
  content_id: string;
  created_at: string;
  last_opened_at: string | null;
  open_count: number;
  title: string;
};

const METRICS: { key: MetricKey; label: string; unit: "kg" | "cm"; color: string }[] = [
  { key: "weight", label: "Peso", unit: "kg", color: "hsl(325 70% 65%)" },
  { key: "waist", label: "Cintura", unit: "cm", color: "hsl(290 60% 65%)" },
  { key: "hip", label: "Cadera", unit: "cm", color: "hsl(275 55% 65%)" },
  { key: "chest", label: "Pecho", unit: "cm", color: "hsl(330 65% 68%)" },
  { key: "arm", label: "Brazos", unit: "cm", color: "hsl(310 60% 65%)" },
  { key: "thigh", label: "Muslos", unit: "cm", color: "hsl(260 55% 68%)" },
];
const MOODS = ["🌧️ Muy mal", "☁️ Regular", "🌸 Bien", "🌷 Muy bien", "💮 Excelente"];

const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString() : "—";
const formatDuration = (seconds: number) => {
  const minutes = Math.round(Math.max(0, seconds) / 60);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};
const relativeTime = (value: string | null) => {
  if (!value) return "Sin actividad";
  const days = Math.floor((Date.now() - +new Date(value)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
};
const activityAction = (row: ActivityRow) => {
  if (row.label && row.label !== "Esencia de Bienestar") return `Abrió ${row.label}`;
  return `Visitó ${row.category}`;
};

function periodCutoff(period: "week" | "month" | "all") {
  if (period === "all") return null;
  const days = period === "week" ? 7 : 30;
  const c = new Date(); c.setDate(c.getDate() - days);
  return c;
}

export default function AdminUserTracking() {
  const { userId } = useParams<{ userId?: string }>();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");

  // detail data
  const [entries, setEntries] = useState<Entry[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [clientFavorites, setClientFavorites] = useState<ClientFavorite[]>([]);

  // Load list of clients
  useEffect(() => {
    (async () => {
      setLoadingClients(true);
      const { data, error } = await supabase.functions.invoke("admin-list-users");
      setLoadingClients(false);
      if (error || !data?.ok) { toast.error(data?.error || error?.message || "Error al cargar usuarias"); return; }
      const rows: ClientRow[] = (data.users ?? []).map((u: any) => ({
        id: u.id, email: u.email, display_name: u.display_name, last_activity: u.last_sign_in_at,
      }));
      setClients(rows);
    })();
  }, []);

  // Fetch most recent updates per client for "última actualización"
  const [lastUpdates, setLastUpdates] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("wellness_entries")
        .select("user_id, updated_at, entry_date")
        .order("updated_at", { ascending: false })
        .limit(1000);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        const t = r.updated_at ?? r.entry_date;
        if (!map[r.user_id] || new Date(t) > new Date(map[r.user_id])) map[r.user_id] = t;
      });
      setLastUpdates(map);
    })();
  }, []);

  // If userId param, preselect
  useEffect(() => {
    if (!userId || clients.length === 0) return;
    const c = clients.find(x => x.id === userId);
    if (c) setSelected(c);
  }, [userId, clients]);

  // Load detail when selected changes
  useEffect(() => {
    if (!selected) {
      setEntries([]);
      setMeasurements([]);
      setGoals([]);
      setPhotos([]);
      setProfile(null);
      setActivityRows([]);
      setClientFavorites([]);
      return;
    }
    (async () => {
      setLoadingDetail(true);
      const [es, ms, gs, ps, profileResult, activityResult, favoritesResult] = await Promise.all([
        supabase.from("wellness_entries").select("*").eq("user_id", selected.id).order("entry_date", { ascending: false }),
        supabase.from("wellness_measurements" as any).select("*").eq("user_id", selected.id).order("measured_at", { ascending: true }),
        supabase.from("wellness_goals").select("*").eq("user_id", selected.id).order("created_at", { ascending: false }),
        supabase.from("wellness_progress_photos" as any).select("*").eq("user_id", selected.id),
        supabase.from("profiles").select("display_name,preferences").eq("id", selected.id).maybeSingle(),
        (supabase as any).from("user_activity_sessions")
          .select("id,category,label,last_seen_at,active_seconds")
          .eq("user_id", selected.id)
          .order("last_seen_at", { ascending: false })
          .limit(1000),
        (supabase as any).from("user_favorites")
          .select("id,content_type,content_id,created_at,last_opened_at,open_count")
          .eq("user_id", selected.id)
          .order("created_at", { ascending: false }),
      ]);
      setEntries((es.data as any) ?? []);
      setMeasurements((ms.data as any) ?? []);
      setGoals((gs.data as any) ?? []);
      setPhotos((ps.data as any) ?? []);
      setProfile((profileResult.data as ProfileDetail | null) ?? null);
      setActivityRows((activityResult.data as ActivityRow[] | null) ?? []);
      const favoriteRows = (favoritesResult.data ?? []) as Omit<ClientFavorite, "title">[];
      const recipeIds = favoriteRows.filter(row => row.content_type === "recipe").map(row => row.content_id);
      const resourceIds = favoriteRows.filter(row => row.content_type === "video" || row.content_type === "guide").map(row => row.content_id);
      const exerciseIds = favoriteRows.filter(row => row.content_type === "exercise").map(row => row.content_id);
      const [favoriteRecipes, favoriteResources, favoriteExercises] = await Promise.all([
        recipeIds.length ? supabase.from("recipes").select("id,title").in("id", recipeIds) : Promise.resolve({ data: [] }),
        resourceIds.length ? supabase.from("resources").select("id,title").in("id", resourceIds) : Promise.resolve({ data: [] }),
        exerciseIds.length ? (supabase as any).from("movement_items").select("id,title").in("id", exerciseIds) : Promise.resolve({ data: [] }),
      ]);
      const titles = new Map<string, string>();
      [...(favoriteRecipes.data ?? []), ...(favoriteResources.data ?? []), ...(favoriteExercises.data ?? [])]
        .forEach((row: any) => titles.set(row.id, row.title));
      setClientFavorites(favoriteRows.map(row => ({ ...row, title: titles.get(row.content_id) ?? "Contenido eliminado" })));
      setLoadingDetail(false);
    })();
  }, [selected]);

  // sign photos
  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage.from("progress-photos").createSignedUrl(p.image_path, 3600);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      setPhotoUrls(next);
    })();
  }, [photos]);

  const filteredClients = useMemo(() => {
    const needle = String(q ?? "").trim().toLowerCase();
    let list = clients;
    if (needle) list = list.filter(c => String(c.display_name ?? "").toLowerCase().includes(needle) || String(c.email ?? "").toLowerCase().includes(needle));
    return [...list].sort((a, b) => {
      const la = lastUpdates[a.id] ? +new Date(lastUpdates[a.id]) : 0;
      const lb = lastUpdates[b.id] ? +new Date(lastUpdates[b.id]) : 0;
      return lb - la;
    });
  }, [clients, q, lastUpdates]);

  const cutoff = periodCutoff(period);
  const inPeriod = <T extends { measured_at?: string; entry_date?: string }>(it: T) => {
    if (!cutoff) return true;
    const d = it.measured_at ?? it.entry_date;
    return d ? new Date(d) >= cutoff : false;
  };

  const entriesFiltered = useMemo(() => entries.filter(inPeriod), [entries, period]);
  const totalActivitySeconds = activityRows.reduce((sum, row) => sum + Number(row.active_seconds || 0), 0);
  const lastSeen = activityRows[0]?.last_seen_at ?? selected?.last_activity ?? null;
  const daysSinceLastSeen = lastSeen
    ? Math.floor((Date.now() - +new Date(lastSeen)) / (24 * 60 * 60 * 1000))
    : Number.POSITIVE_INFINITY;
  const activeDaysThisWeek = new Set(activityRows
    .filter(row => +new Date(row.last_seen_at) >= Date.now() - 7 * 24 * 60 * 60 * 1000)
    .map(row => new Date(row.last_seen_at).toLocaleDateString("en-CA"))).size;
  const alert = !lastSeen || daysSinceLastSeen >= 14
    ? { label: "Necesita atención", detail: !lastSeen ? "Todavía no ha utilizado la aplicación" : `No entra desde hace ${daysSinceLastSeen} días`, tone: "bg-rose-50 text-rose-700" }
    : daysSinceLastSeen >= 7
      ? { label: "Revisar pronto", detail: `Lleva ${daysSinceLastSeen} días sin entrar`, tone: "bg-amber-50 text-amber-700" }
      : activeDaysThisWeek >= 5
        ? { label: "Muy activa", detail: `${activeDaysThisWeek} días activa esta semana`, tone: "bg-emerald-50 text-emerald-700" }
        : { label: "Seguimiento al día", detail: relativeTime(lastSeen), tone: "bg-sky-50 text-sky-700" };
  const preferences = profile?.preferences ?? {};
  const latestEntry = entries[0] ?? null;

  return (
    <div className="pb-28">
      {!selected ? (
        <>
          <AdminPageHeader
            title="Seguimiento de clientas"
            subtitle="Vista de solo lectura del progreso de cada clienta."
            backTo="/app/admin/usuarios"
            backLabel="Volver a Usuarias"
          />

          <div className="card-soft p-3 mb-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 muted" />
              <input className="field pl-8" placeholder="Buscar por nombre o correo…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </div>
          {loadingClients ? (
            <div className="card-soft p-6 text-center muted">Cargando…</div>
          ) : (
            <div className="space-y-2">
              {filteredClients.map(c => (
                <button key={c.id} onClick={() => setSelected(c)} className="w-full text-left card-soft p-3 hover:shadow-soft transition">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center shrink-0"><UserIcon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{c.display_name || "Usuaria sin nombre"}</div>
                      <div className="text-xs muted truncate">{c.email ?? "—"}</div>
                      <div className="text-[11px] muted">Última actualización: {fmt(lastUpdates[c.id])}</div>
                    </div>
                    <Eye className="h-4 w-4 muted" />
                  </div>
                </button>
              ))}
              {filteredClients.length === 0 && <div className="card-soft p-6 text-center muted">No hay resultados.</div>}
            </div>
          )}
        </>
      ) : (
        <>
          <button onClick={() => setSelected(null)} className="text-xs muted mb-3 inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Cambiar de clienta
          </button>
          <header className="card-elegant p-4 mb-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center shrink-0"><UserIcon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <h1 className="font-serif text-lg" style={{ color: "hsl(var(--plum))" }}>{selected.display_name || "Usuaria sin nombre"}</h1>
                <p className="text-xs muted truncate">{selected.email ?? "—"}</p>
                <p className="text-[11px] muted">Última actualización: {fmt(lastUpdates[selected.id])}</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-muted shrink-0">Solo lectura</span>
            </div>
          </header>

          {!loadingDetail && (
            <section className="card-elegant p-4 mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h2 className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>Ficha integral</h2>
                  </div>
                  <p className="text-[11px] muted mt-1">Información privada para tu acompañamiento.</p>
                </div>
                <span className={`text-[10px] font-semibold rounded-full px-2 py-1 ${alert.tone}`}>{alert.label}</span>
              </div>

              <div className={`rounded-xl p-3 mb-3 flex items-start gap-2 ${alert.tone}`}>
                <BellRing className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">{alert.label}</div>
                  <div className="text-[11px] opacity-80">{alert.detail}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <IntegralMetric icon={Clock} label="Último acceso" value={relativeTime(lastSeen)} />
                <IntegralMetric icon={Flame} label="Actividad semanal" value={`${activeDaysThisWeek} días`} />
                <IntegralMetric icon={Activity} label="Tiempo total" value={formatDuration(totalActivitySeconds)} />
                <IntegralMetric icon={HeartPulse} label="Último registro" value={latestEntry ? fmt(latestEntry.entry_date) : "Sin registros"} />
              </div>

              <div className="rounded-2xl border border-border/60 divide-y divide-border/50">
                <IntegralDetail
                  icon={Target}
                  label="Objetivo"
                  value={preferences.objective || (goals.length ? `${goals.length} objetivo${goals.length === 1 ? "" : "s"} registrado${goals.length === 1 ? "" : "s"}` : "No indicado")}
                />
                <IntegralDetail icon={Utensils} label="Alergias o alimentos a evitar" value={preferences.allergies || "No indicado"} />
                <IntegralDetail icon={Activity} label="Calorías objetivo" value={preferences.target_calories ? `${preferences.target_calories} kcal` : "No indicado"} />
              </div>

              {activityRows.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold mb-2">Últimas acciones</h3>
                  <div className="space-y-1.5">
                    {activityRows.slice(0, 5).map(row => (
                      <div key={row.id} className="rounded-xl bg-secondary/45 px-3 py-2 flex items-start gap-2 text-xs">
                        <span className="text-primary">•</span>
                        <span className="min-w-0 flex-1">{activityAction(row)}</span>
                        <span className="muted shrink-0">{relativeTime(row.last_seen_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <HeartPulse className="h-3.5 w-3.5 text-primary" /> Favoritos
                </h3>
                {clientFavorites.length === 0 ? (
                  <p className="rounded-xl bg-secondary/45 p-3 text-xs muted text-center">Esta clienta todavía no ha guardado favoritos.</p>
                ) : (
                  <div className="space-y-2">
                    {clientFavorites.map(favorite => (
                      <div key={favorite.id} className="rounded-xl border border-border/60 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-xs truncate">{favorite.title} ❤️</div>
                            <div className="text-[10px] muted mt-0.5">
                              {favorite.content_type === "recipe" ? "Receta" : favorite.content_type === "video" ? "Vídeo" : favorite.content_type === "guide" ? "Guía" : "Ejercicio"}
                              {" · "}Guardado {fmt(favorite.created_at)}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-primary shrink-0">
                            {favorite.open_count} {favorite.open_count === 1 ? "apertura" : "aperturas"}
                          </span>
                        </div>
                        <div className="text-[10px] muted mt-1">
                          {favorite.last_opened_at ? `Último uso: ${relativeTime(favorite.last_opened_at)}` : "Todavía no consultado desde Favoritos"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="flex gap-1 bg-muted rounded-full p-1 mb-3 w-fit">
            {(["week","month","all"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${period === p ? "bg-white text-foreground shadow-soft" : "text-foreground/60"}`}>
                {p === "week" ? "7 días" : p === "month" ? "30 días" : "Todo"}
              </button>
            ))}
          </div>

          {loadingDetail ? (
            <div className="card-soft p-6 text-center muted">Cargando…</div>
          ) : (
            <div className="space-y-4">
              {/* Métricas con mini-gráficas */}
              <section className="card-elegant p-4">
                <h2 className="font-serif text-base mb-3" style={{ color: "hsl(var(--plum))" }}>Evolución</h2>
                <div className="space-y-4">
                  {METRICS.map(mt => {
                    const all = measurements.filter(x => x.metric === mt.key);
                    const filt = all.filter(inPeriod);
                    const first = filt.length >= 2 ? filt[0].value : null;
                    const last = filt[filt.length - 1]?.value ?? null;
                    const diff = filt.length >= 2 && first != null && last != null ? +(last - first).toFixed(2) : null;
                    return (
                      <div key={mt.key} className="border-t border-border/40 pt-3 first:border-0 first:pt-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-semibold text-sm" style={{ color: mt.color }}>{mt.label}</span>
                          <span className="text-[11px] muted">{filt.length} registro{filt.length === 1 ? "" : "s"}</span>
                        </div>
                        <LineChart points={filt.map(s => s.value)} color={mt.color} unit={mt.unit} />
                        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                          <Stat label="Inicial" value={first} unit={mt.unit} />
                          <Stat label="Actual" value={last} unit={mt.unit} />
                          <Stat label="Cambio" value={diff} unit={mt.unit} trend={diff} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Objetivos */}
              <section className="card-elegant p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-primary" />
                  <h2 className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>Objetivos</h2>
                </div>
                {goals.length === 0 ? (
                  <p className="text-sm muted text-center py-2">Sin objetivos.</p>
                ) : (
                  <ul className="space-y-2">
                    {goals.map(g => {
                      const def = METRICS.find(m => m.key === g.metric);
                      const lbl = def?.label ?? g.metric;
                      const unit = def?.unit ?? "";
                      const current = [...measurements].reverse().find(x => x.metric === g.metric)?.value ?? null;
                      const start = g.start_value;
                      const goingDown = start != null ? g.target_value < start : g.target_value < (current ?? g.target_value);
                      const reached = current != null && (goingDown ? current <= g.target_value : current >= g.target_value);
                      const remaining = current != null ? Math.max(0, +(goingDown ? current - g.target_value : g.target_value - current).toFixed(2)) : null;
                      return (
                        <li key={g.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${g.achieved ? "border-primary/40" : "border-border"}`}>
                          <div className={`h-9 w-9 rounded-full grid place-items-center ${g.achieved ? "text-white shadow-soft" : "bg-muted text-foreground/50"}`}
                            style={g.achieved ? { backgroundImage: "var(--gradient-primary)" } : undefined}>
                            <Trophy className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">{lbl} · Objetivo: {g.target_value} {unit}</div>
                            <div className="text-xs muted">
                              Actual: {current ?? "—"} {unit}
                              {remaining != null && <> · {reached ? "¡Meta alcanzada!" : `Restan: ${remaining} ${unit}`}</>}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Fotos antes/después */}
              {photos.length > 0 && (
                <section className="card-elegant p-4">
                  <h2 className="font-serif text-base mb-3" style={{ color: "hsl(var(--plum))" }}>Fotos antes/después</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map(p => {
                      const def = METRICS.find(m => m.key === p.metric);
                      return (
                        <div key={p.id} className="rounded-2xl overflow-hidden aspect-[3/4] bg-muted relative">
                          {photoUrls[p.id] ? (
                            <img src={photoUrls[p.id]} alt={`${def?.label} ${p.kind}`} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 grid place-items-center text-[10px] muted">Cargando…</div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent text-white">
                            <p className="text-[10px] uppercase tracking-wider">{def?.label} · {p.kind === "before" ? "Antes" : "Ahora"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Diario / Tu jornada */}
              <section className="card-elegant p-4">
                <h2 className="font-serif text-base mb-3" style={{ color: "hsl(var(--plum))" }}>Tu jornada</h2>
                {entriesFiltered.length === 0 ? (
                  <p className="text-sm muted text-center py-3">Sin registros en este período.</p>
                ) : (
                  <ul className="space-y-3">
                    {entriesFiltered.map(e => (
                      <li key={e.id} className="rounded-2xl border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold">{new Date(e.entry_date).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })}</span>
                          {e.mood != null && <span className="text-xs">{MOODS[e.mood - 1] ?? `Ánimo ${e.mood}`}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          {e.weight_kg != null && <Cell label="Peso" value={`${e.weight_kg} kg`} />}
                          {e.waist_cm != null && <Cell label="Cintura" value={`${e.waist_cm} cm`} />}
                          {e.hip_cm != null && <Cell label="Cadera" value={`${e.hip_cm} cm`} />}
                          {e.chest_cm != null && <Cell label="Pecho" value={`${e.chest_cm} cm`} />}
                          {e.arm_cm != null && <Cell label="Brazos" value={`${e.arm_cm} cm`} />}
                          {e.thigh_cm != null && <Cell label="Muslos" value={`${e.thigh_cm} cm`} />}
                          {e.water_ml != null && <Cell icon={Droplets} label="Agua" value={`${e.water_ml} ml`} />}
                          {e.sleep_hours != null && <Cell icon={Moon} label="Sueño" value={`${e.sleep_hours} h`} />}
                          {e.steps != null && <Cell icon={Footprints} label="Pasos" value={`${e.steps}`} />}
                          {e.energy != null && <Cell label="Energía" value={`${e.energy}/5`} />}
                        </div>
                        {e.exercise && (
                          <div className="mt-2 text-xs flex items-start gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <span><span className="muted">Ejercicio:</span> {e.exercise}</span>
                          </div>
                        )}
                        {e.notes && (
                          <div className="mt-2 text-xs">
                            <p className="muted">Notas</p>
                            <p className="whitespace-pre-wrap">{e.notes}</p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Cell({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon className="h-3 w-3 text-primary" />}
      <span className="muted">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function IntegralMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/55 p-2.5">
      <Icon className="h-3.5 w-3.5 text-primary mb-1" />
      <div className="text-[10px] muted">{label}</div>
      <div className="text-xs font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function IntegralDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 p-3">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] muted">{label}</div>
        <div className="text-xs font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, trend }: { label: string; value: number | null; unit: string; trend?: number | null }) {
  const TrendIcon = trend == null ? null : trend < 0 ? TrendingDown : trend > 0 ? TrendingUp : null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider muted">{label}</p>
      <div className="flex items-baseline justify-center gap-1 mt-0.5">
        <p className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>
          {value == null ? "—" : (trend != null && value > 0 ? `+${value}` : value)}
        </p>
        <span className="text-[10px] muted">{unit}</span>
        {TrendIcon && <TrendIcon className="h-3 w-3 text-primary" />}
      </div>
    </div>
  );
}

function LineChart({ points, color, unit }: { points: number[]; color: string; unit: string }) {
  if (points.length < 2) {
    return <div className="h-24 grid place-items-center text-xs muted">Añade al menos 2 registros para ver tu evolución.</div>;
  }
  const W = 320, H = 100, P = 14;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => P + (i * (W - P * 2)) / (points.length - 1));
  const ys = points.map(v => H - P - ((v - min) / range) * (H - P * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${d} L${xs[xs.length - 1].toFixed(1)},${H - P} L${xs[0].toFixed(1)},${H - P} Z`;
  const id = "ag" + color.replace(/\D/g, "");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 3.5 : 2} fill={color} />
      ))}
      <text x={W - P} y={P} textAnchor="end" fontSize="9" fill="hsl(290 18% 42%)">{max.toFixed(1)} {unit}</text>
      <text x={W - P} y={H - 4} textAnchor="end" fontSize="9" fill="hsl(290 18% 42%)">{min.toFixed(1)} {unit}</text>
    </svg>
  );
}
