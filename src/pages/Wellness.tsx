import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LineChart, Save, Sparkles, Droplets, Moon, Footprints, Activity, Scale, Heart, Trash2 } from "lucide-react";
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

  const hasAnyValue = (keys: (keyof Entry)[]) =>
    keys.some((key) => {
      const value = entry[key];
      return value !== null && value !== undefined && value !== "";
    });

  const clearSection = async (keys: (keyof Entry)[], label: string) => {
    if (!hasAnyValue(keys)) return;
    if (!confirm(`¿Borrar ${label}? Solo se eliminarán estos datos del día seleccionado.`)) return;

    const cleared = keys.reduce((acc, key) => ({ ...acc, [key]: null }), {} as Partial<Entry>);
    setEntry((current) => ({ ...current, ...cleared }));

    if (!entry.id) {
      toast.success(`${label} borrado`);
      return;
    }

    const { error } = await supabase
      .from("wellness_entries")
      .update(cleared as any)
      .eq("id", entry.id);

    if (error) {
      toast.error(`No se pudo borrar ${label}`);
      return;
    }
    toast.success(`${label} borrado`);
  };

  const measureKeys: (keyof Entry)[] = ["weight_kg", "waist_cm", "hip_cm", "chest_cm", "arm_cm", "thigh_cm"];
  const habitKeys: (keyof Entry)[] = ["water_ml", "sleep_hours", "steps", "exercise"];
  const moodKeys: (keyof Entry)[] = ["mood"];

  const update = (k: keyof Entry, v: any) => setEntry({ ...entry, [k]: v });
  const progress = (value: number | null | undefined, target: number) => Math.max(0, Math.min(100, ((value ?? 0) / target) * 100));
  const formatWater = (ml: number | null | undefined) => {
    if (!ml) return "Sin registrar";
    if (ml >= 1000) {
      const liters = ml / 1000;
      return `${Number.isInteger(liters) ? liters.toFixed(0) : liters.toFixed(1).replace(".", ",")} L`;
    }
    return `${Math.round(ml)} ml`;
  };
  const moodLabel = entry.mood ? MOODS[(entry.mood ?? 1) - 1]?.label ?? "Sin registrar" : "Sin registrar";
  const hasExercise = Boolean(entry.exercise?.trim());

  return (
    <div className="wellness-diary space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <BackButton fallbackTo="/app" className="inline-flex items-center gap-1.5 text-sm muted hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Volver
        </BackButton>
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
      <section className="card-elegant diary-calendar-card p-4">
        <div className="mb-3 flex items-center justify-between rounded-[22px] bg-[#1F1F1F] px-3 py-2 shadow-[0_14px_28px_-24px_hsl(0_0%_8%/.75)]">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-9 w-9 grid place-items-center rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition"><ChevronLeft className="h-4 w-4" /></button>
          <div className="font-sans text-lg font-bold capitalize text-white">
            {month.toLocaleDateString("es", { month: "long", year: "numeric" })}
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-9 w-9 grid place-items-center rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="diary-weekdays grid grid-cols-7 gap-x-1.5 gap-y-0.5 text-center text-[10px] font-bold text-primary mb-1.5">
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
        <div className="diary-summary-grid grid grid-cols-2 gap-3">
          <SummaryMetric
            icon={Droplets}
            iconClassName="text-fuchsia-500"
            label="Agua"
            value={formatWater(entry.water_ml)}
            status={entry.water_ml ? "Hidratación registrada" : "Objetivo diario"}
            percent={progress(entry.water_ml, 2000)}
          />
          <SummaryMetric
            icon={Moon}
            iconClassName="text-purple-500"
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
            iconClassName="text-pink-500"
            label="Estado general"
            value={moodLabel}
            status={entry.mood ? "Estado registrado" : "Sin valorar"}
            percent={entry.mood ? (entry.mood / 5) * 100 : 0}
          />
          <SummaryMetric
            icon={Activity}
            iconClassName="text-fuchsia-600"
            label="Ejercicio"
            value={hasExercise ? "Registrado" : "Sin registrar"}
            status={hasExercise ? "Movimiento completado" : "Pendiente"}
            percent={hasExercise ? 100 : 0}
            className="col-span-2"
          />
        </div>
      </Section>

      {/* Medidas corporales */}
      <Section
        title="Medidas"
        variant="light"
        action={<SectionClearButton disabled={!hasAnyValue(measureKeys)} onClick={() => clearSection(measureKeys, "medidas")} />}
      >
        <div className="diary-measures-grid grid grid-cols-2 gap-3">
          <MetricInput icon={Scale} iconClassName="text-neutral-800" label="Peso" value={entry.weight_kg} onChange={(v) => update("weight_kg", v)} step="0.1" unit="kg" min={0.1} max={70} />
          <MetricInput label="Cintura" value={entry.waist_cm} onChange={(v) => update("waist_cm", v)} step="1" unit="cm" min={1} max={100} />
          <MetricInput label="Cadera" value={entry.hip_cm} onChange={(v) => update("hip_cm", v)} step="1" unit="cm" min={1} max={100} />
          <MetricInput label="Pecho" value={entry.chest_cm} onChange={(v) => update("chest_cm", v)} step="1" unit="cm" min={1} max={100} />
          <MetricInput label="Brazos" value={entry.arm_cm} onChange={(v) => update("arm_cm", v)} step="1" unit="cm" min={1} max={100} />
          <MetricInput label="Muslos" value={entry.thigh_cm} onChange={(v) => update("thigh_cm", v)} step="1" unit="cm" min={1} max={100} />
        </div>
      </Section>

      {/* Hábitos */}
      <Section
        title="Hábitos del día"
        variant="dark"
        action={<SectionClearButton disabled={!hasAnyValue(habitKeys)} onClick={() => clearSection(habitKeys, "hábitos")} />}
      >
        <div className="diary-habits-grid grid grid-cols-2 gap-3">
          <MetricInput icon={Droplets} iconClassName="text-fuchsia-500" label="Agua" value={entry.water_ml} onChange={(v) => update("water_ml", v)} step="100" unit="water" min={0} max={5000} />
          <MetricInput icon={Moon} iconClassName="text-purple-500" label="Sueño" value={entry.sleep_hours} onChange={(v) => update("sleep_hours", v)} step="0.5" unit="hours" min={1} max={15} />
          <MetricInput icon={Footprints} iconClassName="text-neutral-800" label="Pasos" value={entry.steps} onChange={(v) => update("steps", v)} step="100" unit="steps" min={0} max={60000} />
        </div>
        <MetricTextInput
          icon={Activity}
          iconClassName="text-fuchsia-600"
          label="Ejercicio"
          value={entry.exercise ?? ""}
          onChange={(v) => update("exercise", v)}
          placeholder="Yoga 30 min, caminata..."
          className="mt-3"
        />
      </Section>

      {/* Estado de ánimo */}
      <Section
        title="¿Cómo te sientes?"
        action={<SectionClearButton disabled={!hasAnyValue(moodKeys)} onClick={() => clearSection(moodKeys, "cómo te sientes")} />}
      >
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

function Section({
  title,
  children,
  variant = "default",
  action,
}: {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "dark" | "light";
  action?: React.ReactNode;
}) {
  const isDark = variant === "dark";
  return (
    <section className={`card-elegant p-5 ${isDark ? "border-[#1F1F1F] bg-[#1F1F1F] text-white shadow-[0_20px_40px_-26px_hsl(0_0%_8%/.75)]" : ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className={`font-sans text-lg font-bold ${isDark ? "text-primary" : ""}`} style={isDark ? undefined : { color: "hsl(var(--plum))" }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionClearButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="diary-section-clear-button"
      title="Borrar esta sección"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Borrar
    </button>
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
    <MetricCardBase
      icon={Icon}
      iconClassName={iconClassName}
      label={label}
      valueNode={value}
      status={status}
      percent={percent}
      hasValue={hasValue}
      className={className}
    />
  );
}

function MetricCardBase({
  icon: Icon,
  iconClassName = "text-neutral-800",
  label,
  valueNode,
  rightControl,
  status,
  percent,
  hasValue,
  className = "",
}: {
  icon?: any;
  iconClassName?: string;
  label: string;
  valueNode: React.ReactNode;
  rightControl?: React.ReactNode;
  status: string;
  percent: number;
  hasValue: boolean;
  className?: string;
}) {
  return (
    <div className={`relative rounded-[22px] border p-3.5 shadow-[0_12px_28px_-24px_hsl(0_0%_8%/.45)] transition duration-300 ${hasValue ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground"} ${className}`}>
      <div className="flex items-center gap-2.5">
        <div className={`grid h-9 w-9 place-items-center rounded-2xl shadow-[0_10px_22px_-20px_hsl(0_0%_8%/.45)] ${hasValue ? "bg-white/16" : "bg-white"}`}>
          {Icon ? <Icon className={`h-5 w-5 ${hasValue ? "text-white" : iconClassName}`} /> : <span className="h-5 w-5" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <span className={`metric-label block text-[11px] font-semibold uppercase tracking-[0.08em] ${hasValue ? "text-white/76" : "text-foreground/55"}`}>{label}</span>
          <div className={`block text-base font-bold leading-tight ${hasValue ? "text-white" : "text-foreground"}`}>{valueNode}</div>
        </div>
      </div>
      {rightControl && <div className="metric-right-control absolute right-3 top-1/2 -translate-y-1/2">{rightControl}</div>}
      <div className="mt-3 flex items-center gap-3">
        <span className={`min-w-0 flex-1 truncate text-[11px] font-medium ${hasValue ? "text-white/72" : "text-muted-foreground"}`}>{status}</span>
        <div className={`h-2 w-20 overflow-hidden rounded-full ${hasValue ? "bg-white/20" : "bg-primary/14"}`}>
          <div className={`h-full rounded-full transition-all duration-300 ${hasValue ? "bg-white" : "bg-primary"}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

function MetricInput({
  icon: Icon,
  iconClassName = "text-neutral-800",
  label,
  value,
  onChange,
  step,
  unit,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  className = "",
}: {
  icon?: any;
  iconClassName?: string;
  label: string;
  value: number | string | null;
  onChange: (v: string) => void;
  step?: string;
  unit: "kg" | "cm" | "water" | "hours" | "steps";
  min?: number;
  max?: number;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const increment = Number(step ?? "1") || 1;
  const decimals = increment.toString().includes(".") ? increment.toString().split(".")[1].length : 0;
  const parseNumericValue = (raw: number | string | null | undefined) => {
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    if (typeof raw === "string") {
      const lower = String(raw ?? "").trim().toLowerCase();
      const isLiters = unit === "water" && /\bl\b/.test(lower) && !/\bml\b/.test(lower);
      const normalized = lower
        .replace(/\s+/g, "")
        .replace(/pasos|kg|cm|ml|l|h/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(",", ".");
      if (!normalized) return null;
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) return null;
      return isLiters ? parsed * 1000 : parsed;
    }
    return null;
  };
  const currentValue = parseNumericValue(value);
  const hasValue = currentValue !== null;
  const formatValue = (next: number) => {
    const fixed = decimals > 0 ? next.toFixed(decimals) : String(Math.round(next));
    return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  };
  function formatValueForEditing(next: number) {
    return formatValue(next).replace(".", ",");
  }
  const formatDecimal = (next: number, precision = decimals) => {
    const fixed = precision > 0 ? next.toFixed(precision) : String(Math.round(next));
    return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(".", ",");
  };
  const formatDisplayValue = (next: number) => {
    if (unit === "kg") return `${formatDecimal(next, next % 1 === 0 ? 0 : 1)} kg`;
    if (unit === "cm") return `${Math.round(next)} cm`;
    if (unit === "water") {
      if (next >= 1000) return `${formatDecimal(next / 1000, next % 1000 === 0 ? 0 : 1)} L`;
      return `${Math.round(next)} ml`;
    }
    if (unit === "hours") return `${formatDecimal(next, next % 1 === 0 ? 0 : 1)} h`;
    return `${Math.round(next).toLocaleString("es-ES")} pasos`;
  };
  const displayValue = hasValue ? (isEditing ? formatValueForEditing(currentValue) : formatDisplayValue(currentValue)) : "";
  const clampValue = (next: number) => Math.min(max, Math.max(min, next));
  const nudge = (direction: -1 | 1) => {
    const start = currentValue ?? (direction > 0 ? Math.max(min - increment, 0) : min);
    const next = clampValue(start + increment * direction);
    onChange(formatValue(next));
  };
  const handleChange = (text: string) => {
    if (!text.trim()) {
      onChange("");
      return;
    }
    const parsed = parseNumericValue(text);
    if (parsed === null) return;
    onChange(formatValue(clampValue(parsed)));
  };

  return (
    <MetricCardBase
      icon={Icon}
      iconClassName={iconClassName}
      label={label}
      status=""
      percent={hasValue ? 100 : 0}
      hasValue={hasValue}
      className={`diary-editable-metric ${className}`}
      valueNode={
        <div className="metric-value-control" aria-label={`Control de ${label}`}>
          <input
            type="text"
            inputMode="decimal"
            step={step ?? "1"}
            aria-label={label}
            className="metric-value-input"
            placeholder=""
            value={displayValue}
            onFocus={(event) => {
              const target = event.currentTarget;
              setIsEditing(true);
              window.requestAnimationFrame(() => target.select());
            }}
            onBlur={() => setIsEditing(false)}
            onChange={(e) => handleChange(e.target.value)}
          />
          <div className="metric-stepper" aria-label={`Ajustar ${label}`}>
            <button type="button" onClick={() => nudge(1)} aria-label={`Subir ${label}`}>
              <ChevronUp />
            </button>
            <button type="button" onClick={() => nudge(-1)} aria-label={`Bajar ${label}`}>
              <ChevronDown />
            </button>
          </div>
        </div>
      }
    />
  );
}

function MetricTextInput({
  icon: Icon,
  iconClassName = "text-neutral-800",
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  icon: any;
  iconClassName?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const hasValue = Boolean(value.trim());
  return (
    <MetricCardBase
      icon={Icon}
      iconClassName={iconClassName}
      label={label}
      status=""
      percent={hasValue ? 100 : 0}
      hasValue={hasValue}
      className={className}
      valueNode={
        <input
          className={`block w-full min-w-0 border-0 bg-transparent p-0 text-base font-bold leading-tight outline-none placeholder:text-muted-foreground focus:ring-0 ${hasValue ? "text-white placeholder:text-white/65" : "text-foreground"}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      }
    />
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
