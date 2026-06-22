import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ChevronLeft, ChevronRight, LineChart, Save, Sparkles, Droplets, Moon, Footprints, Activity, Scale, Ruler, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  { emoji: "🌧️", label: "Muy mal", color: "from-purple-300 to-fuchsia-300" },
  { emoji: "☁️", label: "Regular", color: "from-pink-200 to-purple-300" },
  { emoji: "🌸", label: "Bien", color: "from-pink-300 to-rose-300" },
  { emoji: "🌷", label: "Muy bien", color: "from-fuchsia-300 to-pink-400" },
  { emoji: "💮", label: "Excelente", color: "from-pink-400 to-fuchsia-500" },
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
    if (error) toast.error("No se pudo guardar"); else { toast.success("Registro guardado ✨"); setMarks(new Set([...marks, selected])); }
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

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-sm muted hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Link to="/app/progreso" className="chip-lavender">
          <LineChart className="h-3.5 w-3.5" /> Mi progreso
        </Link>
      </div>

      <header>
        <p className="muted text-xs tracking-[0.18em] uppercase">Diario de Bienestar</p>
        <h1 className="heading-lg mt-1">Tu jornada</h1>
        <p className="muted text-sm italic mt-1.5">"Cada día es una nueva oportunidad para cuidarte."</p>
      </header>

      {/* Calendario */}
      <section className="card-elegant p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted transition"><ChevronLeft className="h-4 w-4" /></button>
          <div className="font-serif text-lg capitalize" style={{ color: "hsl(var(--plum))" }}>
            {month.toLocaleDateString("es", { month: "long", year: "numeric" })}
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted transition"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] muted mb-1">
          {["L","M","X","J","V","S","D"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
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
                className={`aspect-square rounded-xl text-sm font-medium transition relative ${isSel ? "text-white shadow-soft" : has ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground/80"} ${isToday && !isSel ? "ring-1 ring-primary/40" : ""}`}
                style={isSel ? { backgroundImage: "var(--gradient-primary)" } : undefined}
              >
                {d.getDate()}
                {has && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Medidas corporales */}
      <Section title="Medidas">
        <div className="grid grid-cols-2 gap-3">
          <Field icon={Scale} label="Peso (kg)" value={entry.weight_kg} onChange={(v) => update("weight_kg", v)} step="0.1" />
          <Field icon={Ruler} label="Cintura (cm)" value={entry.waist_cm} onChange={(v) => update("waist_cm", v)} step="0.1" />
          <Field icon={Ruler} label="Cadera (cm)" value={entry.hip_cm} onChange={(v) => update("hip_cm", v)} step="0.1" />
          <Field icon={Heart} label="Pecho (cm)" value={entry.chest_cm} onChange={(v) => update("chest_cm", v)} step="0.1" />
          <Field icon={Ruler} label="Brazos (cm)" value={entry.arm_cm} onChange={(v) => update("arm_cm", v)} step="0.1" />
          <Field icon={Ruler} label="Muslos (cm)" value={entry.thigh_cm} onChange={(v) => update("thigh_cm", v)} step="0.1" />
        </div>
      </Section>

      {/* Hábitos */}
      <Section title="Hábitos del día">
        <div className="grid grid-cols-2 gap-3">
          <Field icon={Droplets} label="Agua (ml)" value={entry.water_ml} onChange={(v) => update("water_ml", v)} step="50" />
          <Field icon={Moon} label="Sueño (h)" value={entry.sleep_hours} onChange={(v) => update("sleep_hours", v)} step="0.5" />
          <Field icon={Footprints} label="Pasos" value={entry.steps} onChange={(v) => update("steps", v)} step="100" />
        </div>
        <div className="mt-3">
          <label className="label flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-primary" /> Ejercicio realizado</label>
          <input className="field" placeholder="Yoga 30 min, caminata..." value={entry.exercise ?? ""} onChange={(e) => update("exercise", e.target.value)} />
        </div>
      </Section>

      {/* Estado de ánimo */}
      <Section title="¿Cómo te sientes?">
        <div className="flex justify-between gap-2">
          {MOODS.map((m, i) => {
            const selected = entry.mood === i + 1;
            return (
              <button
                key={i}
                onClick={() => update("mood", i + 1)}
                title={m.label}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-1 rounded-2xl transition border ${selected ? "shadow-soft scale-105 border-primary/40 text-white" : "border-border bg-card/80 hover:bg-muted"}`}
                style={selected ? { backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` , background: `linear-gradient(135deg, hsl(330 75% 75%), hsl(290 65% 70%))`} : undefined}
              >
                <span className="text-2xl leading-none">{m.emoji}</span>
                <span className={`text-[9px] font-semibold tracking-wide ${selected ? "text-white/95" : "text-foreground/60"}`}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Notas */}
      <Section title="Notas personales">
        <textarea className="field min-h-[110px] resize-y" placeholder="Lo que quieras recordar de hoy..." value={entry.notes ?? ""} onChange={(e) => update("notes", e.target.value)} maxLength={2000} />
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

      <Link to="/app/progreso" className="card-soft p-5 flex items-center gap-4 hover:shadow-elegant transition">
        <div className="h-12 w-12 rounded-2xl grid place-items-center text-white shadow-soft" style={{ backgroundImage: "var(--gradient-primary)" }}>
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-serif text-lg" style={{ color: "hsl(var(--plum))" }}>Mi progreso</div>
          <p className="text-xs muted">Evolución, gráficos y objetivos</p>
        </div>
        <ChevronRight className="h-5 w-5 muted" />
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-elegant p-5">
      <h2 className="font-serif text-lg mb-3" style={{ color: "hsl(var(--plum))" }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, step, icon: Icon }: { label: string; value: number | null; onChange: (v: string) => void; step?: string; icon?: any }) {
  return (
    <div>
      <label className="label text-xs flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? "1"}
        className="field"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
