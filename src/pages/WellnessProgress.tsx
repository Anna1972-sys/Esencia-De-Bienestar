import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Target, Trophy, Trash2, Plus, TrendingDown, TrendingUp, Camera, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import imgWeight from "@/assets/metric-weight.png";
import imgWaist from "@/assets/metric-waist.png";
import imgHip from "@/assets/metric-hip.png";
import imgChest from "@/assets/metric-chest.png";
import imgArm from "@/assets/metric-arm.png";
import imgThigh from "@/assets/metric-thigh.png";

type MetricKey = "weight" | "waist" | "hip" | "chest" | "arm" | "thigh";
type Measurement = { id: string; metric: MetricKey; value: number; unit: string; measured_at: string };
type Goal = { id: string; metric: MetricKey; target_value: number; start_value: number | null; achieved: boolean };
type PhotoRow = { id: string; metric: MetricKey; kind: "before" | "after"; image_path: string };
type MeasurementForm = { value: string; unit: "kg" | "cm"; date: string };

const METRICS: { key: MetricKey; label: string; unit: "kg" | "cm"; color: string; image: string }[] = [
  { key: "weight", label: "Peso", unit: "kg", color: "hsl(325 70% 65%)", image: imgWeight },
  { key: "waist", label: "Cintura", unit: "cm", color: "hsl(290 60% 65%)", image: imgWaist },
  { key: "hip", label: "Cadera", unit: "cm", color: "hsl(275 55% 65%)", image: imgHip },
  { key: "chest", label: "Pecho", unit: "cm", color: "hsl(330 65% 68%)", image: imgChest },
  { key: "arm", label: "Brazos", unit: "cm", color: "hsl(310 60% 65%)", image: imgArm },
  { key: "thigh", label: "Muslos", unit: "cm", color: "hsl(260 55% 68%)", image: imgThigh },
];

const DISPLAY_METRIC_ORDER: MetricKey[] = ["weight", "waist", "chest", "hip", "arm", "thigh"];

export default function WellnessProgress() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [metric, setMetric] = useState<MetricKey>("weight");
  const [newGoal, setNewGoal] = useState<{ metric: MetricKey; direction: "lose" | "gain"; amount: string }>({ metric: "weight", direction: "lose", amount: "" });
  const [showRegister, setShowRegister] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [reg, setReg] = useState<MeasurementForm>({ value: "", unit: "kg", date: localDateKey(new Date()) });
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const m = METRICS.find(x => x.key === metric)!;

  useEffect(() => {
    if (!editingMeasurement) setReg(r => ({ ...r, unit: m.unit }));
  }, [m.unit, editingMeasurement]);

  const reload = async () => {
    if (!user) return;
    const [meas, gls, phs] = await Promise.all([
      supabase.from("wellness_measurements" as any).select("*").eq("user_id", user.id).order("measured_at", { ascending: true }),
      supabase.from("wellness_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("wellness_progress_photos" as any).select("*").eq("user_id", user.id),
    ]);
    setMeasurements((meas.data as any) ?? []);
    setGoals((gls.data as any) ?? []);
    setPhotos((phs.data as any) ?? []);
  };
  useEffect(() => { reload(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wellness-measurements:${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "wellness_measurements",
        filter: `user_id=eq.${user.id}`,
      }, reload)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Sign photo URLs
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

  const metricMeas = useMemo(() => measurements.filter(x => x.metric === metric), [measurements, metric]);

  const filtered = useMemo(() => {
    if (period === "all") return metricMeas;
    const days = period === "week" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    return metricMeas.filter(e => new Date(e.measured_at) >= cutoff);
  }, [metricMeas, period]);

  const first = filtered.length >= 2 ? filtered[0]?.value ?? null : null;
  const last = filtered[filtered.length - 1]?.value ?? null;
  const diff = filtered.length >= 2 && first != null && last != null ? +(last - first).toFixed(2) : null;

  const beforePhoto = photos.find(p => p.metric === metric && p.kind === "before");
  const afterPhoto = photos.find(p => p.metric === metric && p.kind === "after");

  const openRegister = () => {
    setEditingMeasurement(null);
    setReg({ value: "", unit: m.unit, date: localDateKey(new Date()) });
    setShowRegister(true);
  };

  const openEdit = (measurement: Measurement) => {
    setEditingMeasurement(measurement);
    setReg({ value: String(measurement.value), unit: measurement.unit as "kg" | "cm", date: localDateKey(new Date(measurement.measured_at)) });
    setShowRegister(true);
  };

  const closeMeasurementForm = () => {
    if (isSavingMeasurement) return;
    setShowRegister(false);
    setEditingMeasurement(null);
  };

  const saveMeasurement = async () => {
    if (!user || reg.value.trim() === "") { toast.error("Introduce un valor"); return; }
    const v = Number(reg.value);
    if (!Number.isFinite(v) || v <= 0) { toast.error("Introduce un valor mayor que cero"); return; }
    if (!reg.date) { toast.error("Selecciona una fecha"); return; }
    const measuredAt = new Date(reg.date + "T12:00:00").toISOString();
    setIsSavingMeasurement(true);
    try {
      if (editingMeasurement) {
        const { data, error } = await supabase.from("wellness_measurements").update({ value: v, unit: reg.unit, measured_at: measuredAt }).eq("id", editingMeasurement.id).eq("user_id", user.id).select().single();
        if (error) throw error;
        setMeasurements(current => current.map(item => item.id === data.id ? data as Measurement : item).sort(compareMeasurements));
        toast.success("Medida actualizada");
      } else {
        const { data, error } = await supabase.from("wellness_measurements").insert({
          user_id: user.id, metric, value: v, unit: m.unit, measured_at: measuredAt,
        }).select().single();
        if (error) throw error;
        setMeasurements(current => [...current, data as Measurement].sort(compareMeasurements));
        toast.success("Medida registrada ✨");
      }
      setShowRegister(false);
      setEditingMeasurement(null);
    } catch (error) {
      console.error("Unable to save wellness measurement", error);
      toast.error("No se pudo guardar la medida. Inténtalo de nuevo.");
    } finally {
      setIsSavingMeasurement(false);
    }
  };

  const deleteMeasurement = async (id: string) => {
    const { error } = await supabase.from("wellness_measurements").delete().eq("id", id).eq("user_id", user?.id ?? "");
    if (error) { toast.error("No se pudo eliminar la medida"); return; }
    setMeasurements(current => current.filter(x => x.id !== id));
    toast.success("Medida eliminada");
  };

  const uploadPhoto = async (kind: "before" | "after", file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${metric}-${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, file, { upsert: true });
    if (upErr) { toast.error("No se pudo subir la imagen"); return; }
    // delete previous photo of same kind
    const existing = photos.find(p => p.metric === metric && p.kind === kind);
    if (existing) {
      await supabase.storage.from("progress-photos").remove([existing.image_path]);
      await supabase.from("wellness_progress_photos" as any).delete().eq("id", existing.id);
    }
    const { error: insErr } = await supabase.from("wellness_progress_photos" as any).insert({
      user_id: user.id, metric, kind, image_path: path,
    });
    if (insErr) { toast.error("No se pudo guardar la foto"); return; }
    toast.success("Foto guardada");
    reload();
  };

  const removePhoto = async (p: PhotoRow) => {
    await supabase.storage.from("progress-photos").remove([p.image_path]);
    await supabase.from("wellness_progress_photos" as any).delete().eq("id", p.id);
    setPhotos(photos.filter(x => x.id !== p.id));
  };

  const addGoal = async () => {
    if (!user || !newGoal.amount) return;
    const amount = Number(newGoal.amount);
    if (Number.isNaN(amount) || amount <= 0) { toast.error("Cantidad no válida"); return; }
    const current = [...measurements].reverse().find(x => x.metric === newGoal.metric)?.value ?? null;
    if (current == null) { toast.error("Registra primero una medida de esta métrica"); return; }
    const target = newGoal.direction === "lose" ? +(current - amount).toFixed(2) : +(current + amount).toFixed(2);
    const { data, error } = await supabase.from("wellness_goals")
      .insert({ user_id: user.id, metric: newGoal.metric, target_value: target, start_value: current })
      .select().single();
    if (error) toast.error("No se pudo crear el objetivo");
    else { setGoals([data as any, ...goals]); setNewGoal({ metric: "weight", direction: "lose", amount: "" }); toast.success("Objetivo creado ✨"); }
  };
  const toggleGoal = async (g: Goal) => {
    await supabase.from("wellness_goals").update({ achieved: !g.achieved }).eq("id", g.id);
    setGoals(goals.map(x => x.id === g.id ? { ...x, achieved: !g.achieved } : x));
  };
  const removeGoal = async (id: string) => {
    await supabase.from("wellness_goals").delete().eq("id", id);
    setGoals(goals.filter(g => g.id !== id));
  };

  return (
    <div className="progress-page space-y-6 pb-6">
      <button
        onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/app")}
        className="inline-flex items-center gap-1.5 text-sm muted hover:text-foreground transition"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <header className="wellness-hero relative overflow-hidden rounded-[28px] px-6 py-7">
        <div className="absolute -right-7 -top-8 h-32 w-32 rounded-full bg-primary/25 blur-2xl" />
        <div className="relative">
          <p className="text-xs tracking-[0.18em] uppercase text-white/65">Mi progreso</p>
          <h1 className="heading-lg mt-1 text-white">Tu evolución</h1>
          <p className="mt-2 text-sm text-white/80">Pequeños hábitos, cambios visibles.</p>
        </div>
      </header>

      {/* Selector de métrica */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {DISPLAY_METRIC_ORDER.map(key => METRICS.find(item => item.key === key)!).map(x => {
          const active = metric === x.key;
          const darkFrame = x.key === "weight" || x.key === "chest" || x.key === "arm";
          return (
            <button key={x.key} onClick={() => setMetric(x.key)}
              className={`wellness-progress-metric ${darkFrame ? "metric-frame-dark" : "metric-frame-pink"} group relative flex min-h-[168px] overflow-hidden rounded-[26px] border p-0 transition duration-300 ${active ? "is-active shadow-soft scale-[1.035] ring-4 ring-primary/28" : "hover:border-primary/45"}`}
            >
              <img src={x.image} alt={x.label} loading="lazy" width={512} height={512}
                className={`absolute inset-0 h-full w-full object-cover transition duration-500 ease-out ${active ? "-translate-y-2 scale-[1.24]" : "scale-105 group-hover:-translate-y-0.5 group-hover:scale-[1.12]"}`} />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/90 to-transparent" />
              <span className="relative mt-auto flex w-full items-center justify-center px-3 pb-3.5 text-[15px] font-extrabold tracking-wide text-foreground drop-shadow-[0_1px_2px_hsl(0_0%_100%/.9)]">
                {x.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Botón registrar */}
      <button onClick={openRegister} className="btn-primary w-full flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Registrar medida
      </button>

      {/* Gráfico */}
      <section className="card-elegant wellness-progress-evolution p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-sans font-bold text-lg">{m.label}</h2>
            <p className="text-xs muted">Evolución en {period === "week" ? "7 días" : period === "month" ? "30 días" : "total"}</p>
          </div>
          <div className="flex gap-1 bg-muted rounded-full p-1">
            {(["week","month","all"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${period === p ? "bg-white text-foreground shadow-soft" : "text-foreground/60"}`}>
                {p === "week" ? "7d" : p === "month" ? "30d" : "Todo"}
              </button>
            ))}
          </div>
        </div>

        <LineChart points={filtered.map(s => s.value)} color={m.color} unit={m.unit} />

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/60">
          <Stat label="Inicial" value={first} unit={m.unit} />
          <Stat label="Actual" value={last} unit={m.unit} />
          <Stat label="Cambio" value={diff} unit={m.unit} trend={diff} />
        </div>
      </section>

      {/* Antes y después con fotos */}
      <section className="card-elegant wellness-progress-photos p-5">
        <h2 className="font-sans font-bold text-lg">Antes y después</h2>
        <p className="mt-1 mb-4 text-xs muted">Guarda tus fotos para ver tu transformación con el tiempo.</p>
        <div className="grid grid-cols-2 gap-3">
          <PhotoCard
            label="Antes"
            photo={beforePhoto}
            url={beforePhoto ? photoUrls[beforePhoto.id] : undefined}
            gradient="linear-gradient(135deg, hsl(290 60% 95%), hsl(320 60% 96%))"
            onPick={() => beforeInputRef.current?.click()}
            onRemove={beforePhoto ? () => removePhoto(beforePhoto) : undefined}
          />
          <PhotoCard
            label="Ahora"
            photo={afterPhoto}
            url={afterPhoto ? photoUrls[afterPhoto.id] : undefined}
            gradient="var(--gradient-primary)"
            dark
            onPick={() => afterInputRef.current?.click()}
            onRemove={afterPhoto ? () => removePhoto(afterPhoto) : undefined}
          />
        </div>
        <input ref={beforeInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && uploadPhoto("before", e.target.files[0])} />
        <input ref={afterInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && uploadPhoto("after", e.target.files[0])} />
      </section>

      {/* Historial semanal y mensual */}
      <section className="card-elegant wellness-progress-history p-5">
        <h2 className="font-sans font-bold text-lg mb-3">Historial</h2>
        <div className="grid grid-cols-2 gap-3">
          <HistoryCard label="Esta semana" entries={lastN(metricMeas, 7)} unit={m.unit} />
          <HistoryCard label="Este mes" entries={lastN(metricMeas, 30)} unit={m.unit} />
        </div>
        {filtered.length > 0 && (
          <ul className="mt-4 space-y-1.5 max-h-48 overflow-auto">
            {[...filtered].reverse().map(e => (
              <li key={e.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-muted/50">
                <span className="muted">{new Date(e.measured_at).toLocaleDateString()}</span>
                <span className="font-semibold">{e.value} {e.unit}</span>
                <button onClick={() => openEdit(e)} aria-label={`Editar medida del ${new Date(e.measured_at).toLocaleDateString()}`} className="text-muted-foreground hover:text-foreground">Editar</button>
                <button onClick={() => deleteMeasurement(e.id)} className="text-muted-foreground hover:text-foreground">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {metricMeas.length > 0 && filtered.length === 0 && <p className="mt-4 text-xs muted text-center">No hay registros en este periodo.</p>}
        {metricMeas.length === 0 && <p className="mt-4 rounded-2xl bg-white/65 px-3 py-3 text-center text-xs muted">Aún no hay medidas registradas para esta categoría.</p>}
      </section>

      {/* Objetivos */}
      <section className="card-elegant wellness-progress-goals p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="font-sans font-bold text-lg">Mis objetivos</h2>
        </div>
        <p className="mb-4 text-xs muted">Define pequeños objetivos y sigue tu avance.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <select className="field goal-select flex-1 min-w-[120px]" value={newGoal.metric} onChange={e => setNewGoal({ ...newGoal, metric: e.target.value as MetricKey })}>
            {METRICS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <select className="field goal-select w-28" value={newGoal.direction} onChange={e => setNewGoal({ ...newGoal, direction: e.target.value as "lose" | "gain" })}>
            <option value="lose">Perder</option>
            <option value="gain">Aumentar</option>
          </select>
          <input type="number" step="0.1" min="0" placeholder="Cantidad" className="field w-24" value={newGoal.amount} onChange={e => setNewGoal({ ...newGoal, amount: e.target.value })} />
          <button onClick={addGoal} className="btn-primary px-4"><Plus className="h-4 w-4" /></button>
        </div>
        {goals.length === 0 ? (
          <p className="text-sm muted text-center py-2">Aún no has añadido objetivos.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map(g => {
              const def = METRICS.find(mm => mm.key === g.metric);
              const lbl = def?.label ?? g.metric;
              const unit = def?.unit ?? "";
              const current = [...measurements].reverse().find(x => x.metric === g.metric)?.value ?? null;
              const start = g.start_value;
              const goingDown = start != null ? g.target_value < start : g.target_value < (current ?? g.target_value);
              const reached = current != null && (goingDown ? current <= g.target_value : current >= g.target_value);
              const remaining = current != null ? Math.max(0, +(goingDown ? current - g.target_value : g.target_value - current).toFixed(2)) : null;
              return (
                <li key={g.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${g.achieved ? "border-primary/40" : "border-border"}`}
                  style={g.achieved ? { background: "linear-gradient(135deg, hsl(330 70% 96%), hsl(290 65% 96%))" } : undefined}>
                  <button onClick={() => toggleGoal(g)} className={`h-9 w-9 rounded-full grid place-items-center transition ${g.achieved ? "text-white shadow-soft" : "bg-muted text-foreground/50"}`}
                    style={g.achieved ? { backgroundImage: "var(--gradient-primary)" } : undefined}>
                    <Trophy className="h-4 w-4" />
                  </button>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{lbl} · Objetivo: {g.target_value} {unit}</div>
                    <div className="text-xs muted">
                      Actual: {current ?? "—"} {unit}
                      {remaining != null && <> · {reached ? "¡Meta alcanzada!" : `Restan: ${remaining} ${unit}`}</>}
                    </div>
                  </div>
                  <button onClick={() => removeGoal(g.id)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Modal de registro */}
      {showRegister && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={closeMeasurementForm}>
          <div className="card-elegant p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-sans font-bold text-lg">{editingMeasurement ? "Editar" : "Registrar"} {m.label}</h3>
              <button onClick={closeMeasurementForm} disabled={isSavingMeasurement} className="h-8 w-8 grid place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider muted">Valor</label>
                <input type="number" step="0.1" autoFocus className="field w-full" value={reg.value} onChange={e => setReg({ ...reg, value: e.target.value })} />
              </div>
              <p className="text-xs muted">Unidad: {reg.unit}</p>
              <div>
                <label className="text-[11px] uppercase tracking-wider muted">Fecha</label>
                <input type="date" className="field w-full" value={reg.date} onChange={e => setReg({ ...reg, date: e.target.value })} />
              </div>
              <button onClick={saveMeasurement} disabled={isSavingMeasurement} className="btn-primary w-full">{isSavingMeasurement ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareMeasurements(a: Measurement, b: Measurement) {
  return new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime();
}

function PhotoCard({ label, photo, url, gradient, dark, onPick, onRemove }: {
  label: string; photo?: PhotoRow; url?: string; gradient: string; dark?: boolean;
  onPick: () => void; onRemove?: () => void;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden aspect-[3/4]" style={{ backgroundImage: gradient }}>
      {url ? (
        <>
          <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
          <button onClick={onRemove} className="absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <p className={`text-[10px] uppercase tracking-wider text-white/90`}>{label}</p>
          </div>
        </>
      ) : (
        <button onClick={onPick} className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Camera className={`h-6 w-6 ${dark ? "text-white" : "text-foreground/60"}`} />
          <span className={`text-[10px] uppercase tracking-wider ${dark ? "text-white/80" : "muted"}`}>{label}</span>
          <span className={`text-[11px] ${dark ? "text-white" : "text-foreground"}`}>Subir foto</span>
        </button>
      )}
      {url && (
        <button onClick={onPick} className="absolute bottom-2 right-2 h-7 px-2 rounded-full bg-black/40 text-white text-[10px] hover:bg-black/60">
          Cambiar
        </button>
      )}
    </div>
  );
}

function lastN(entries: Measurement[], n: number) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - n);
  return entries.filter(e => new Date(e.measured_at) >= cutoff);
}

function HistoryCard({ label, entries, unit }: { label: string; entries: Measurement[]; unit: string }) {
  const first = entries.length >= 2 ? entries[0]?.value ?? null : null;
  const last = entries[entries.length - 1]?.value ?? null;
  const diff = entries.length >= 2 && first != null && last != null ? +(last - first).toFixed(2) : null;
  return (
    <div className="wellness-history-card rounded-2xl p-4">
      <div className="flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] uppercase tracking-wider muted">{label}</p>
      </div>
      <p className="font-sans font-bold text-xl mt-1">
        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff}`} <span className="text-xs muted">{unit}</span>
      </p>
      <p className="text-[10px] muted mt-0.5">{entries.length} registros</p>
    </div>
  );
}

function Stat({ label, value, unit, trend }: { label: string; value: number | null; unit: string; trend?: number | null }) {
  const TrendIcon = trend == null ? null : trend < 0 ? TrendingDown : trend > 0 ? TrendingUp : null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider muted">{label}</p>
      <div className="flex items-baseline gap-1 mt-0.5">
        <p className={`font-sans font-bold text-lg ${trend != null && trend < 0 ? "trend-positive" : ""}`}>
          {value == null ? "—" : (trend != null && value > 0 ? `+${value}` : value)}
        </p>
        <span className="text-xs muted">{unit}</span>
        {TrendIcon && <TrendIcon className="h-3.5 w-3.5 text-primary ml-auto" />}
      </div>
    </div>
  );
}

function LineChart({ points, color, unit }: { points: number[]; color: string; unit: string }) {
  if (points.length < 2) {
    return <div className="wellness-chart-empty h-40 grid place-items-center px-6 text-center text-sm muted">Añade tus primeros registros para empezar a ver tu evolución.</div>;
  }
  const W = 320, H = 140, P = 16;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => P + (i * (W - P * 2)) / (points.length - 1));
  const ys = points.map(v => H - P - ((v - min) / range) * (H - P * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${d} L${xs[xs.length - 1].toFixed(1)},${H - P} L${xs[0].toFixed(1)},${H - P} Z`;
  const id = "g" + color.replace(/\D/g, "");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 4 : 2.5} fill={color} />
      ))}
      <text x={W - P} y={P} textAnchor="end" fontSize="10" fill="hsl(290 18% 42%)">{max.toFixed(1)} {unit}</text>
      <text x={W - P} y={H - 4} textAnchor="end" fontSize="10" fill="hsl(290 18% 42%)">{min.toFixed(1)} {unit}</text>
    </svg>
  );
}
