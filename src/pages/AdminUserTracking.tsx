import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, Target, Trophy, Eye, TrendingDown, TrendingUp, Droplets, Moon, Footprints, Activity, User as UserIcon } from "lucide-react";
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
    if (!selected) { setEntries([]); setMeasurements([]); setGoals([]); setPhotos([]); return; }
    (async () => {
      setLoadingDetail(true);
      const [es, ms, gs, ps] = await Promise.all([
        supabase.from("wellness_entries").select("*").eq("user_id", selected.id).order("entry_date", { ascending: false }),
        supabase.from("wellness_measurements" as any).select("*").eq("user_id", selected.id).order("measured_at", { ascending: true }),
        supabase.from("wellness_goals").select("*").eq("user_id", selected.id).order("created_at", { ascending: false }),
        supabase.from("wellness_progress_photos" as any).select("*").eq("user_id", selected.id),
      ]);
      setEntries((es.data as any) ?? []);
      setMeasurements((ms.data as any) ?? []);
      setGoals((gs.data as any) ?? []);
      setPhotos((ps.data as any) ?? []);
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
    const needle = q.trim().toLowerCase();
    let list = clients;
    if (needle) list = list.filter(c => (c.display_name ?? "").toLowerCase().includes(needle) || (c.email ?? "").toLowerCase().includes(needle));
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
