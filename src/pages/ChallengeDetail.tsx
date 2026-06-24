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
import challengeHero from "@/assets/home-retos.png";

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
  const nextDay = days.find((d: any) => !progress.has(d.day))?.day ?? total;

  return (
    <div className="space-y-5 pb-10">
      <Link to="/app/retos" className="text-sm muted inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Retos</Link>
      <header className="challenge-premium relative min-h-[270px] overflow-hidden rounded-[28px] text-white">
        <img src={challengeHero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        <div className="relative flex min-h-[270px] flex-col justify-end p-6">
          <p className="text-xs tracking-[0.18em] uppercase text-white/75">Reto de 5 días</p>
          <h1 className="font-serif text-3xl leading-tight text-white mt-2">{c.title}</h1>
          {c.description && <p className="text-sm text-white/80 mt-2 max-w-[85%]">{c.description}</p>}
          <Link to={`/app/retos/${id}/dia/${nextDay}`} className="btn-primary mt-5 w-max px-5 py-2.5 text-sm">
            {progress.size === 0 ? "Comenzar reto" : progress.size === total ? "Repasar reto" : "Continuar reto"}
            <ChevronRight className="h-4 w-4" />
          </Link>
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

      <section>
        <div className="text-xs muted uppercase tracking-wider px-1 mb-4">Tu recorrido</div>
        <div className="relative space-y-4">
          <div className="absolute left-6 top-7 bottom-7 w-px bg-[#f2cbdd]" />
        {days.map((d: any) => {
          const done = progress.has(d.day);
          const subtitle = DAY_SUBTITLES[d.day - 1];
          return (
            <Link key={d.day} to={`/app/retos/${id}/dia/${d.day}`} className="block">
              <div className={`challenge-premium rounded-[28px] p-5 relative overflow-hidden ${done ? "bg-[#fff7fb]" : "bg-white/90"}`}>
                <div className="flex items-center gap-4">
                  <div className="relative z-10 h-12 w-12 rounded-full shrink-0 grid place-items-center border border-white shadow-[0_8px_18px_-12px_rgba(45,25,37,0.55)]"
                    style={done ? { backgroundImage: "var(--gradient-primary)", color: "white" } : { background: "#fff2f8", color: "#d96a9d" }}>
                    <span className="font-serif text-lg">{d.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-xl leading-tight" style={{ color: "hsl(var(--plum))" }}>Día {d.day}</div>
                    <div className="text-sm muted mt-1.5">{subtitle}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 muted shrink-0" />
                </div>
              </div>
            </Link>
          );
        })}
        </div>
      </section>

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
