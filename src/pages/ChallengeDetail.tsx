import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { EXTRAS } from "@/lib/challengeExtras";
import menuImage from "@/assets/challenge-menu.png";
import shoppingImage from "@/assets/challenge-shopping.png";
import videosImage from "@/assets/challenge-videos.png";
import downloadsImage from "@/assets/challenge-downloads.png";
import faqImage from "@/assets/challenge-faq.png";

const EXTRA_DETAILS = {
  menu: { image: menuImage, subtitle: "Plan completo" },
  shopping: { image: shoppingImage, subtitle: "Todo lo necesario" },
  videos: { image: videosImage, subtitle: "Aprende paso a paso" },
  downloads: { image: downloadsImage, subtitle: "Guías y recursos" },
  faq: { image: faqImage, subtitle: "Resuelve tus dudas" },
};

const DAY_SUBTITLES = [
  "Comienza tu cambio",
  "Construye el hábito",
  "Más energía",
  "Consolidando resultados",
  "Final del reto",
];

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
          const subtitle = DAY_SUBTITLES[d.day - 1];
          return (
            <Link key={d.day} to={`/app/retos/${id}/dia/${d.day}`} className="block">
              <div className={`challenge-premium rounded-[24px] p-5 relative overflow-hidden ${done ? "bg-[#fff7fb]" : "bg-white/90"}`}>
                <div className="absolute inset-y-0 left-0 w-1" style={{ background: done ? "var(--gradient-primary)" : "#f4c7dc" }} />
                <div className="flex items-center gap-4">
                  <div className="h-11 w-1 shrink-0 rounded-full" style={{ background: done ? "var(--gradient-primary)" : "#f6bfd9" }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg leading-tight" style={{ color: "hsl(var(--plum))" }}>Día {d.day}</div>
                    <div className="text-sm muted mt-1">{subtitle}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 muted shrink-0" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="pt-2">
        <div className="text-xs muted uppercase tracking-wider px-1">Contenido del reto</div>
        <div className="grid grid-cols-2 gap-4 mt-3">
        {EXTRAS.map(e => {
          const detail = EXTRA_DETAILS[e.key];
          return (
            <Link key={e.key} to={`/app/retos/${id}/extra/${e.key}`}
              className="challenge-premium overflow-hidden block rounded-[24px] bg-white/90 transition hover:-translate-y-1">
              <img src={detail.image} alt={e.label} className="w-full aspect-[4/3] object-cover" />
              <div className="p-3.5">
                <div className="font-sans font-bold text-sm leading-tight text-foreground">{e.label}</div>
                <p className="text-[10.5px] mt-1 text-muted-foreground">{detail.subtitle}</p>
              </div>
            </Link>
          );
        })}
        </div>
      </div>
    </div>
  );
}
