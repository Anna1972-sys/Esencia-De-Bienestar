import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ChevronLeft, ChevronRight, LineChart, Save, Sparkles, Droplets, Moon, Footprints, Activity, Scale, Ruler, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import diaryHeroImage from "@/assets/diary/diary-hero.png";

type Entry = {
  id?: string;
  entry_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  water_ml: number | null;
  sleep_hours: number | null;
  mood: number | null;
  exercise: string | null;
  steps: number | null;
  notes: string | null;
};

const empty = (date: string): Entry => ({
  entry_date: date,
  weight_kg: null, waist_cm: null, hip_cm: null, chest_cm: null,
  arm_cm: null, thigh_cm: null, water_ml: null, sleep_hours: null,
  mood: null, exercise: null, steps: null, notes: null,
});

const MOODS = [
  { label: "Muy mal" },
  { label: "Regular" },
  { label: "Bien" },
  { label: "Muy bien" },
  { label: "Excelente" },
];
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export default function Wellness() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string>(fmt(new Date()));
  const [entry, setEntry] = useState<Entry>(empty(fmt(new Date())));
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  // Load entry for selected date
  useEffect(() => {
    if (!user) return;
    supabase.from("wellness_entries").select("*").eq("user_id", user.id).eq("entry_date", selected).maybeSingle()
      .then(({ data }) => setEntry((data as any) ?? empty(selected)));
  }, [user, selected]);

  // Load marks for current month
  useEffect(() => {
    if (!user) return;
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    supabase.from("wellness_entries").select("entry_date")
      .eq("user_id", user.id).gte("entry_date", fmt(start)).lte("entry_date", fmt(end))
      .then(({ data }) => setMarks(new Set((data ?? []).map((r: any) => r.entry_date))));
  }, [user, month]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const startWeekday = (first.getDay() + 6) % 7; // Lunes=0
    const arr: (Date | null)[] = Array(startWeekday).fill(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    return arr;
  }, [month]);

  const num = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      entry_date: selected,
      weight_kg: num(entry.weight_kg),
      waist_cm: num(entry.waist_cm),
      hip_cm: num(entry.hip_cm),
      chest_cm: num(entry.chest_cm),
      arm_cm: num(entry.arm_cm),
      thigh_cm: num(entry.thigh_cm),
      water_ml: num(entry.water_ml),
      sleep_hours: num(entry.sleep_hours),
      mood: num(entry.mood),
      exercise: entry.exercise || null,
      steps: num(entry.steps),
      notes: entry.notes || null,
    };
    const { error } = await supabase.from("wellness_entries")
      .upsert(payload, { onConflict: "user_id,entry_date" });
    setSaving(false);
    if (error) toast.error("No se pudo guardar"); else { toast.success("Registro guardado"); setMarks(new Set([...marks, selected])); }
  };

  const remove = async () => {
    if (!user || !entry.id) return;
    if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("wellness_entries").delete().eq("id", entry.id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    toast.success("Registro eliminado");
    const next = new Set(marks); next.delete(selected); setMarks(next);
    setEntry(empty(selected));
  };

  const update = (k: keyof Entry, v: any) => setEntry({ ...entry, [k]: v });
  const progress = (value: number | null | undefined, target: number) => Math.max(0, Math.min(100, ((value ?? 0) / target) * 100));
  const waterCups = Math.round((entry.water_ml ?? 0) / 250);
  const moodLabel = entry.mood ? MOODS[(entry.mood ?? 1) - 1]?.label ?? "Sin registrar" : "Sin registrar";
  const hasExercise = Boolean(entry.exercise?.trim());

  return (
    <div className="wellness-diary space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-sm muted hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Link to="/app/progreso" className="chip-lavender">
          <LineChart className="h-3.5 w-3.5" /> Mi progreso
        </Link>
      </div>

      <header>
        <p className="text-primary text-xs font-bold tracking-[0.28em] uppercase">Diario de Bienestar</p>
        <h1 className="heading-lg mt-1">Tu bienestar de hoy</h1>
        <p className="muted text-sm italic mt-1.5">"Cada día es una nueva oportunidad para cuidarte."</p>
      </header>

      <div className="card-elegant overflow-hidden p-0">
        <img
          src={diaryHeroImage}
          alt=""
          className="h-44 w-full object-cover"
        />
      </div>

      {/* Calendario */}
      <section className="card-elegant p-4">
        <div className="mb-3 flex items-center justify-between rounded-[22px] bg-[#1F1F1F] px-3 py-2 shadow-[0_14px_28px_-24px_hsl(0_0%_8%/.75)]">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-9 w-9 grid place-items-center rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition"><ChevronLeft className="h-4 w-4" /></button>
          <div className="font-sans text-lg font-bold capitalize text-white">
            {month.toLocaleDateString("es", { month: "long", year: "numeric" })}
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-9 w-9 grid place-items-center rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-x-1.5 gap-y-0.5 text-center text-[10px] font-bold text-primary mb-1.5">
          {["L","M","X","J","V","S","D"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-x-1.5 gap-y-0.5">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = fmt(d);
            const isSel = key === selected;
            const has = marks.has(key);
            const isToday = key === fmt(new Date());
            return (
              <button
                key={i}
                onClick={() => setSelected(key)}
                className={`relative grid h-8 place-items-center rounded-2xl text-sm font-semibold transition ${isSel ? "text-white" : has ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground/80"} ${isToday && !isSel ? "ring-1 ring-primary/40" : ""}`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-2xl ${isSel ? "shadow-soft" : ""}`}
                  style={isSel ? { backgroundImage: "var(--gradient-primary)" } : undefined}
                >
                  {d.getDate()}
                </span>
                {has && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <Section title="Resumen de hoy" variant="dark">
        <div className="grid grid-cols-2 gap-3">
          <SummaryMetric
            icon={Droplets}
            iconClassName="text-sky-500"
            label="Agua"
            value={`${waterCups} / 8 vasos`}
            status={entry.water_ml ? "Hidratación registrada" : "Objetivo diario"}
            percent={progress(entry.water_ml, 2000)}
          />
          <SummaryMetric
            icon={Moon}
            iconClassName="text-amber-500"
            label="Sueño"
            value={entry.sleep_hours ? `${entry.sleep_hours} h` : "Sin registrar"}
            status={entry.sleep_hours ? "Descanso registrado" : "Pendiente"}
            percent={progress(entry.sleep_hours, 8)}
          />
          <SummaryMetric
            icon={Footprints}
            iconClassName="text-neutral-800"
            label="Pasos"
            value={entry.steps ? entry.steps.toLocaleString("es") : "Sin registrar"}
            status={entry.steps ? "Actividad registrada" : "Pendiente"}
            percent={progress(entry.steps, 10000)}
          />
          <SummaryMetric
            icon={Heart}
            iconClassName="text-red-500"
            label="Estado general"
            value={moodLabel}
            status={entry.mood ? "Estado registrado" : "Sin valorar"}
            percent={entry.mood ? (entry.mood / 5) * 100 : 0}
          />
          <SummaryMetric
            icon={Activity}
            iconClassName="text-emerald-600"
            label="Ejercicio"
            value={hasExercise ? "Registrado" : "Sin registrar"}
            status={hasExercise ? "Movimiento completado" : "Pendiente"}
            percent={hasExercise ? 100 : 0}
            className="col-span-2"
          />
        </div>
      </Section>

      {/* Medidas corporales */}
      <Section title="Medidas" variant="light">
        <div className="grid grid-cols-2 gap-3">
          <Field variant="measure" icon={Scale} label="Peso (kg)" value={entry.weight_kg} onChange={(v) => update("weight_kg", v)} step="0.1" />
          <Field variant="measure" icon={Ruler} label="Cintura (cm)" value={entry.waist_cm} onChange={(v) => update("waist_cm", v)} step="0.1" />
          <Field variant="measure" icon={Ruler} label="Cadera (cm)" value={entry.hip_cm} onChange={(v) => update("hip_cm", v)} step="0.1" />
          <Field variant="measure" icon={Heart} label="Pecho (cm)" value={entry.chest_cm} onChange={(v) => update("chest_cm", v)} step="0.1" />
          <Field variant="measure" icon={Ruler} label="Brazos (cm)" value={entry.arm_cm} onChange={(v) => update("arm_cm", v)} step="0.1" />
          <Field variant="measure" icon={Ruler} label="Muslos (cm)" value={entry.thigh_cm} onChange={(v) => update("thigh_cm", v)} step="0.1" />
        </div>
      </Section>

      {/* Hábitos */}
      <Section title="Hábitos del día" variant="dark">
        <div className="grid grid-cols-2 gap-3">
          <Field variant="habit" icon={Droplets} label="Agua (ml)" value={entry.water_ml} onChange={(v) => update("water_ml", v)} step="50" />
          <Field variant="habit" icon={Moon} label="Sueño (h)" value={entry.sleep_hours} onChange={(v) => update("sleep_hours", v)} step="0.5" />
          <Field variant="habit" icon={Footprints} label="Pasos" value={entry.steps} onChange={(v) => update("steps", v)} step="100" />
        </div>
        <div className={`mt-3 rounded-[22px] border p-4 transition duration-300 ${hasExercise ? "border-primary bg-primary text-white shadow-[0_16px_30px_-22px_hsl(var(--primary)/.75)]" : "border-border bg-white text-foreground shadow-[0_10px_24px_-24px_hsl(0_0%_8%/.35)]"}`}>
          <label className={`mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] ${hasExercise ? "text-white/88" : "text-foreground/80"}`}>
            <Activity className={`h-4 w-4 transition-colors duration-300 ${hasExercise ? "text-white" : "text-foreground/45"}`} />
            Ejercicio realizado
          </label>
          <input
            className={`mt-1 w-full rounded-xl border border-transparent bg-transparent px-0 py-1.5 text-sm outline-none transition duration-300 focus:border-transparent focus:ring-0 ${hasExercise ? "font-semibold text-white placeholder:text-white/65" : "text-foreground placeholder:text-muted-foreground/65"}`}
            placeholder="Yoga 30 min, caminata..."
            value={entry.exercise ?? ""}
            onChange={(e) => update("exercise", e.target.value)}
          />
        </div>
      </Section>

      {/* Estado de ánimo */}
      <Section title="¿Cómo te sientes?">
        <div className="grid grid-cols-5 gap-2">
          {MOODS.map((m, i) => {
            const selected = entry.mood === i + 1;
            return (
              <button
                key={i}
                onClick={() => update("mood", i + 1)}
                title={m.label}
                className={`flex min-h-[104px] flex-col items-center justify-center gap-3 rounded-2xl border px-1.5 py-3 transition duration-300 ${selected ? "scale-[1.03] border-primary bg-primary text-white shadow-soft ring-1 ring-primary/20" : "border-border bg-white text-foreground hover:border-primary/45 hover:bg-muted/45"}`}
              >
                <MoodBars level={i + 1} active={selected} />
                <span className={`text-[10px] font-semibold leading-tight tracking-wide ${selected ? "text-white" : "text-foreground/70"}`}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Notas */}
      <Section title="Notas personales" variant="dark">
        <textarea className="field min-h-[145px] resize-y border-primary/35 bg-white px-5 py-4 leading-relaxed" placeholder="Escribe lo que quieras recordar de hoy..." value={entry.notes ?? ""} onChange={(e) => update("notes", e.target.value)} maxLength={2000} />
      </Section>

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-primary flex-1">
          <Save className="h-4 w-4" /> {saving ? "Guardando..." : entry.id ? "Actualizar registro" : "Guardar registro"}
        </button>
        {entry.id && (
          <button
            onClick={remove}
            className="px-4 rounded-2xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition flex items-center gap-1.5 text-sm font-medium"
            title="Eliminar registro"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        )}
      </div>

      <Link to="/app/progreso" className="card-soft bg-[#1F1F1F] p-5 flex items-center gap-4 text-white hover:shadow-elegant transition">
        <div className="h-12 w-12 rounded-2xl grid place-items-center text-primary shadow-soft shrink-0 bg-white/8 border border-white/10">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-sans text-lg font-bold text-white">Mi progreso</div>
          <p className="text-xs text-white/65">Evolución, gráficos y objetivos</p>
        </div>
        <MiniTrend />
        <ChevronRight className="h-5 w-5 text-white/55" />
      </Link>
    </div>
  );
}

function Section({ title, children, variant = "default" }: { title: string; children: React.ReactNode; variant?: "default" | "dark" | "light" }) {
  const isDark = variant === "dark";
  return (
    <section className={`card-elegant p-5 ${isDark ? "border-[#1F1F1F] bg-[#1F1F1F] text-white shadow-[0_20px_40px_-26px_hsl(0_0%_8%/.75)]" : ""}`}>
      <h2 className={`font-sans text-lg font-bold mb-4 ${isDark ? "text-primary" : ""}`} style={isDark ? undefined : { color: "hsl(var(--plum))" }}>{title}</h2>
      {children}
    </section>
  );
}

function SummaryMetric({
  icon: Icon,
  iconClassName,
  label,
  value,
  status,
  percent,
  className = "",
}: {
  icon: any;
  iconClassName: string;
  label: string;
  value: string;
  status: string;
  percent: number;
  className?: string;
}) {
  const hasValue = percent > 0 || value !== "Sin registrar";
  return (
    <div className={`rounded-[22px] border p-3.5 shadow-[0_12px_28px_-24px_hsl(0_0%_8%/.45)] transition duration-300 ${hasValue ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground"} ${className}`}>
      <div className="flex items-center gap-2.5">
        <div className={`grid h-9 w-9 place-items-center rounded-2xl shadow-[0_10px_22px_-20px_hsl(0_0%_8%/.45)] ${hasValue ? "bg-white/16" : "bg-white"}`}>
          <Icon className={`h-5 w-5 ${hasValue ? "text-white" : iconClassName}`} />
        </div>
        <div className="min-w-0">
          <span className={`block text-[11px] font-semibold uppercase tracking-[0.08em] ${hasValue ? "text-white/76" : "text-foreground/55"}`}>{label}</span>
          <span className={`block text-base font-bold leading-tight ${hasValue ? "text-white" : "text-foreground"}`}>{value}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className={`min-w-0 flex-1 truncate text-[11px] font-medium ${hasValue ? "text-white/72" : "text-muted-foreground"}`}>{status}</span>
        <div className={`h-2 w-20 overflow-hidden rounded-full ${hasValue ? "bg-white/20" : "bg-primary/14"}`}>
          <div className={`h-full rounded-full transition-all duration-300 ${hasValue ? "bg-white" : "bg-primary"}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

function MoodBars({ level, active }: { level: number; active: boolean }) {
  return (
    <div className="flex h-9 items-end justify-center gap-1.5">
      {[1, 2, 3, 4, 5].map((bar) => (
        <span
          key={bar}
          className={`w-2 rounded-full transition-all duration-300 ${active ? "bg-white" : bar <= level ? "bg-primary" : "bg-muted"} ${active && bar <= level ? "shadow-[0_0_12px_hsl(0_0%_100%/.35)]" : ""}`}
          style={{ height: `${9 + bar * 4}px` }}
        />
      ))}
    </div>
  );
}

function MiniTrend() {
  return (
    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-white/5">
      <svg viewBox="0 0 56 28" className="h-7 w-12" aria-hidden="true">
        <path d="M4 22 C12 18 15 20 22 13 S34 8 40 11 S48 8 52 5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
        <circle cx="52" cy="5" r="2.5" fill="hsl(var(--primary))" />
      </svg>
    </div>
  );
}

function Field({ label, value, onChange, step, icon: Icon, variant = "default" }: { label: string; value: number | null; onChange: (v: string) => void; step?: string; icon?: any; variant?: "default" | "measure" | "habit" }) {
  const hasValue = value !== null && value !== undefined;
  if (variant === "measure") {
    return (
      <div className="rounded-[22px] border border-[#1F1F1F] bg-[#1F1F1F] p-3.5 shadow-[0_14px_28px_-24px_hsl(0_0%_8%/.75)] transition duration-300">
        <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {label}
        </label>
        <input
          type="number"
          inputMode="decimal"
          step={step ?? "1"}
          className={`mt-1 w-full rounded-xl border border-transparent bg-transparent px-0 py-1.5 outline-none transition duration-300 placeholder:text-white/45 focus:border-transparent focus:ring-0 ${hasValue ? "text-lg font-bold text-white" : "text-sm text-white"}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  if (variant === "habit") {
    return (
      <div className={`rounded-[22px] border p-3.5 transition duration-300 ${hasValue ? "border-primary bg-primary text-white shadow-[0_14px_28px_-24px_hsl(var(--primary)/.75)]" : "border-border bg-white text-foreground shadow-[0_10px_24px_-24px_hsl(0_0%_8%/.35)]"}`}>
        <label className={`mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] ${hasValue ? "text-white/88" : "text-foreground/80"}`}>
          {Icon && <Icon className={`h-4 w-4 transition-colors duration-300 ${hasValue ? "text-white" : "text-foreground/45"}`} />}
          {label}
        </label>
        <input
          type="number"
          inputMode="decimal"
          step={step ?? "1"}
          className={`mt-1 w-full rounded-xl border border-transparent bg-transparent px-0 py-1.5 outline-none transition duration-300 focus:border-transparent focus:ring-0 ${hasValue ? "text-lg font-bold text-white placeholder:text-white/65" : "text-sm text-foreground placeholder:text-muted-foreground/65"}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className={`rounded-[22px] border p-3.5 transition duration-300 ${hasValue ? "border-primary/65 bg-primary/5 shadow-[0_14px_28px_-24px_hsl(var(--primary)/.55)]" : "border-border bg-white shadow-[0_10px_24px_-24px_hsl(0_0%_8%/.35)]"}`}>
      <label className="label text-xs flex items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 transition-colors duration-300 ${hasValue ? "text-primary" : "text-foreground/45"}`} />}
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? "1"}
        className={`mt-1 w-full rounded-xl border border-transparent bg-transparent px-0 py-1.5 outline-none transition duration-300 placeholder:text-muted-foreground/65 focus:border-transparent focus:ring-0 ${hasValue ? "text-lg font-bold text-foreground" : "text-sm text-foreground"}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
