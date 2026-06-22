import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { EXTRAS } from "@/lib/challengeExtras";

export default function ChallengeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState<any>(null);
  const [progress, setProgress] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    supabase.from("challenges").select("*").eq("id", id).maybeSingle().then(({ data }) => setC(data));
    if (user) supabase.from("challenge_progress").select("day").eq("user_id", user.id).eq("challenge_id", id)
      .then(({ data }) => setProgress(new Set((data ?? []).map((r: any) => r.day))));
  }, [id, user]);

  if (!c) return <div className="muted">Cargando…</div>;
  const raw: any[] = Array.isArray(c.days) ? c.days : [];
  const days: any[] = [1, 2, 3, 4, 5].map(n => raw.find((x: any) => x.day === n) ?? { day: n });
  const total = 5;
  const pct = Math.round((progress.size / total) * 100);

  return (
    <div className="space-y-5 pb-10">
      <Link to="/app/retos" className="text-sm muted inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Retos</Link>
      <header className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-2xl grid place-items-center text-3xl shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(330 70% 94%), hsl(280 60% 94%))" }}>
          {c.icon ?? "🌸"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="muted text-xs tracking-[0.18em] uppercase">Reto de 5 días</p>
          <h1 className="heading-lg mt-1">{c.title}</h1>
          {c.description && <p className="muted text-sm mt-1.5">{c.description}</p>}
        </div>
      </header>

      <section className="card-elegant p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs muted uppercase tracking-wider">Tu progreso</div>
          <div className="text-sm font-semibold" style={{ color: "hsl(var(--plum))" }}>{pct}%</div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundImage: "var(--gradient-primary)" }} />
        </div>
        <p className="text-xs muted mt-2">{progress.size} de {total} días completados</p>
      </section>

      <div className="space-y-3">
        {days.map((d: any) => {
          const done = progress.has(d.day);
          return (
            <Link key={d.day} to={`/app/retos/${id}/dia/${d.day}`} className="block">
              <div className={`rounded-[24px] p-5 border transition relative overflow-hidden hover:-translate-y-0.5 ${done ? "border-primary/30" : "border-white/80"}`}
                style={{
                  background: done
                    ? "linear-gradient(135deg, hsl(330 70% 96%), hsl(290 65% 96%))"
                    : "linear-gradient(160deg, hsl(0 0% 100% / 0.96), hsl(320 60% 97%) 100%)",
                  boxShadow: "0 12px 36px -16px hsl(315 55% 45% / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.85)",
                }}>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl grid place-items-center font-serif text-lg shrink-0"
                    style={done
                      ? { backgroundImage: "var(--gradient-primary)", color: "white" }
                      : { background: "hsl(320 50% 95%)", color: "hsl(var(--plum))" }}>
                    {d.day}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-base leading-tight" style={{ color: "hsl(var(--plum))" }}>
                      Día {d.day}{d.title ? ` · ${d.title}` : ""}
                    </div>
                    {done && <div className="text-[10px] uppercase tracking-wider muted mt-0.5">Completado</div>}
                  </div>
                  <ChevronRight className="h-5 w-5 muted shrink-0" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="pt-2 space-y-3">
        <div className="text-xs muted uppercase tracking-wider px-1">Contenido del reto</div>
        {EXTRAS.map(e => (
          <Link key={e.key} to={`/app/retos/${id}/extra/${e.key}`}
            className="block rounded-[24px] p-5 border border-white/80 transition hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(160deg, hsl(0 0% 100% / 0.96), hsl(330 70% 97%) 100%)",
              boxShadow: "0 12px 36px -16px hsl(315 55% 45% / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.85)",
            }}>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl grid place-items-center text-2xl shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(330 70% 94%), hsl(280 60% 94%))" }}>
                {e.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-base leading-tight" style={{ color: "hsl(var(--plum))" }}>{e.label}</div>
              </div>
              <ChevronRight className="h-5 w-5 muted shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
