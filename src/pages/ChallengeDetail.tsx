import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ChevronRight } from "lucide-react";
import BackButton from "@/components/BackButton";
import { DEFAULT_CHALLENGE, DEFAULT_CHALLENGE_ID, EXTRAS } from "@/lib/challengeExtras";
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

const DAY_STAGES = [
  { name: "Despertar", subtitle: "Comienza tu cambio", accent: "#e98ab7", wash: "#fff1f7" },
  { name: "Enraizar", subtitle: "Construye el hábito", accent: "#b787d9", wash: "#f7f0ff" },
  { name: "Activar", subtitle: "Más energía", accent: "#eaa06f", wash: "#fff5ed" },
  { name: "Florecer", subtitle: "Consolidando resultados", accent: "#73a99a", wash: "#edf9f5" },
  { name: "Celebrar", subtitle: "Final del reto", accent: "#d27aa4", wash: "#fff0f6" },
];

export default function ChallengeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState<any>(null);
  const [progress, setProgress] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    supabase.from("challenges").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setC(data ?? (id === DEFAULT_CHALLENGE_ID ? DEFAULT_CHALLENGE : null));
    });
    if (user && id === DEFAULT_CHALLENGE_ID) {
      try {
        const days = JSON.parse(localStorage.getItem(`challenge-progress:${id}:${user.id}`) || "[]");
        setProgress(new Set(Array.isArray(days) ? days : []));
      } catch {
        setProgress(new Set());
      }
      return;
    }
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
      <BackButton fallbackTo="/app/retos" className="text-sm muted inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Retos</BackButton>
      <header className="challenge-premium relative min-h-[350px] overflow-hidden rounded-[30px] text-white">
        <img src={challengeHero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/5" />
        <div className="relative flex min-h-[350px] flex-col justify-end p-6">
          <p className="text-xs tracking-[0.18em] uppercase text-white/75">Reto de 5 días</p>
          <h1 className="font-serif text-4xl leading-[0.95] text-white mt-2">{c.title}</h1>
          {c.description && <p className="text-sm text-white/80 mt-2 max-w-[85%]">{c.description}</p>}
          <Link to={`/app/retos/${id}/dia/${nextDay}`} className="btn-primary mt-5 w-max px-5 py-2.5 text-sm">
            {progress.size === 0 ? "Comenzar reto" : progress.size === total ? "Repasar reto" : "Continuar reto"}
            <ChevronRight className="h-4 w-4" />
          </Link>
          <div className="mt-5 rounded-2xl border border-white/20 bg-black/20 px-3.5 py-3 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[10px] tracking-wide text-white/75">
              <span>Tu recorrido</span><span>{progress.size} de {total} días</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: "rgb(229 231 235 / 0.75)" }}>
              <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: "#FF2D95" }} />
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="px-1 mb-4">
          <div className="text-xs muted uppercase tracking-wider">Tu camino</div>
          <p className="text-sm mt-1" style={{ color: "hsl(var(--plum))" }}>Cinco pasos para volver a ti.</p>
        </div>
        <div className="space-y-3">
        {days.map((d: any) => {
          const done = progress.has(d.day);
          const stage = DAY_STAGES[d.day - 1];
          return (
            <Link key={d.day} to={`/app/retos/${id}/dia/${d.day}`} className="block">
              <div className="challenge-premium rounded-[28px] relative overflow-hidden" style={{ background: stage.wash }}>
                <div className="flex min-h-[116px] items-stretch">
                  <div className="w-[86px] shrink-0 flex flex-col items-center justify-center border-r border-white/80"
                    style={{ background: `linear-gradient(145deg, ${stage.wash}, ${stage.accent}28)` }}>
                    <span className="font-serif text-3xl leading-none" style={{ color: stage.accent }}>{d.day}</span>
                    <span className="mt-2 text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: stage.accent }}>Día</span>
                  </div>
                  <div className="min-w-0 flex-1 flex items-center gap-3 px-5 py-5">
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-xl leading-tight" style={{ color: "hsl(var(--plum))" }}>{stage.name}</div>
                      <div className="text-sm mt-1.5" style={{ color: "hsl(var(--plum) / 0.68)" }}>{stage.subtitle}</div>
                      {done && <div className="text-[10px] font-semibold mt-2" style={{ color: stage.accent }}>Completado</div>}
                    </div>
                    <div className="h-8 w-8 rounded-full grid place-items-center bg-white/70" style={{ color: stage.accent }}>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
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
              <div className="app-photo-cover-frame">
                <img src={detail.image} alt={e.label} className="app-photo-cover-image" />
              </div>
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
