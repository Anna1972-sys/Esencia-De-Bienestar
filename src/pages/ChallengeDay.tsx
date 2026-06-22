import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ChallengeContentView from "@/components/ChallengeContentView";
import { ContentBlock } from "@/lib/challengeExtras";

type Day = ContentBlock & { day: number };

export default function ChallengeDay() {
  const { id, day } = useParams();
  const dayN = Number(day);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState<any>(null);
  const [progress, setProgress] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    supabase.from("challenges").select("*").eq("id", id).maybeSingle().then(({ data }) => setC(data));
    if (user) supabase.from("challenge_progress").select("day").eq("user_id", user.id).eq("challenge_id", id)
      .then(({ data }) => setProgress(new Set((data ?? []).map((r: any) => r.day))));
  }, [id, user]);

  const days: Day[] = useMemo(() => {
    const raw: any[] = Array.isArray(c?.days) ? c.days : [];
    return [1, 2, 3, 4, 5].map(n => raw.find(x => x.day === n) ?? { day: n });
  }, [c]);
  const d = days.find(x => x.day === dayN) ?? { day: dayN };
  const idx = days.findIndex(x => x.day === dayN);
  const prevDone = idx <= 0 || progress.has(days[idx - 1].day);
  const next = days[idx + 1];

  useEffect(() => {
    if (c && !prevDone && !progress.has(dayN)) {
      toast.error("Completa primero el día anterior");
      navigate(`/app/retos/${id}`, { replace: true });
    }
  }, [c, prevDone, progress, dayN, id, navigate]);

  if (!c) return <div className="muted">Cargando…</div>;

  const done = progress.has(dayN);
  const total = 5;
  const pct = Math.round((progress.size / total) * 100);

  const complete = async () => {
    if (!user) return;
    if (done) {
      await supabase.from("challenge_progress").delete().eq("user_id", user.id).eq("challenge_id", id!).eq("day", dayN);
      const ns = new Set(progress); ns.delete(dayN); setProgress(ns);
      toast("Día desmarcado");
    } else {
      const { error } = await supabase.from("challenge_progress").insert({ user_id: user.id, challenge_id: id!, day: dayN });
      if (error) { toast.error(error.message); return; }
      setProgress(new Set([...progress, dayN]));
      toast.success("¡Día completado! ✨");
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <Link to={`/app/retos/${id}`} className="text-sm muted inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> {c.title}</Link>

      <header className="rounded-[28px] p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(335 80% 96%), hsl(295 70% 95%) 55%, hsl(275 65% 95%))" }}>
        <div className="absolute -top-10 -right-10 h-44 w-44 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(320 90% 80%), transparent 70%)" }} />
        <div className="relative">
          <p className="muted text-xs tracking-[0.2em] uppercase">Día {dayN} de {total}</p>
          {d.title && <h1 className="heading-lg mt-1">{d.title}</h1>}
          <div className="mt-4 h-1.5 rounded-full bg-white/60 overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundImage: "var(--gradient-primary)" }} />
          </div>
        </div>
      </header>

      <ChallengeContentView block={d} />

      <div className="sticky bottom-4 z-10">
        <button onClick={complete}
          className={`w-full rounded-full py-4 font-semibold shadow-glow transition flex items-center justify-center gap-2 ${done ? "bg-white text-foreground border border-primary/30" : "text-white"}`}
          style={done ? undefined : { backgroundImage: "var(--gradient-primary)" }}>
          <Check className="h-5 w-5" /> {done ? "Día completado ✓ (toca para deshacer)" : "Marcar día como completado"}
        </button>
      </div>

      {done && next && (
        <Link to={`/app/retos/${id}/dia/${next.day}`}
          className="card-elegant p-4 flex items-center gap-3 hover:-translate-y-0.5 transition">
          <div className="h-10 w-10 rounded-xl grid place-items-center font-serif text-white shrink-0"
            style={{ backgroundImage: "var(--gradient-primary)" }}>{next.day}</div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider muted">Siguiente día desbloqueado</div>
            {next.title && <div className="font-serif text-sm" style={{ color: "hsl(var(--plum))" }}>{next.title}</div>}
          </div>
          <ChevronRight className="h-5 w-5 muted" />
        </Link>
      )}
    </div>
  );
}
