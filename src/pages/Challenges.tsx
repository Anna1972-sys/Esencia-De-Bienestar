import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import challengeHero from "@/assets/home-retos.png";
import { DEFAULT_CHALLENGE } from "@/lib/challengeExtras";

export default function Challenges() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, Set<number>>>({});

  useEffect(() => {
    supabase.from("challenges").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setItems(data?.length ? data : [DEFAULT_CHALLENGE]);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const storedDefaultProgress = localStorage.getItem(`challenge-progress:${DEFAULT_CHALLENGE.id}:${user.id}`);
    if (storedDefaultProgress) {
      try {
        const days = JSON.parse(storedDefaultProgress);
        if (Array.isArray(days)) setProgress(current => ({ ...current, [DEFAULT_CHALLENGE.id]: new Set(days) }));
      } catch {
        // Ignore invalid local progress.
      }
    }
    supabase.from("challenge_progress").select("challenge_id, day").eq("user_id", user.id).then(({ data }) => {
      const map: Record<string, Set<number>> = {};
      (data ?? []).forEach((r: any) => {
        if (!map[r.challenge_id]) map[r.challenge_id] = new Set();
        map[r.challenge_id].add(r.day);
      });
      setProgress(current => ({ ...current, ...map }));
    });
  }, [user]);

  return (
    <div className="space-y-5">
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Volver</BackButton>
      <header>
        <p className="muted text-xs tracking-[0.18em] uppercase">Retos</p>
        <h1 className="heading-lg mt-1">Retos de 5 días</h1>
        <p className="muted text-sm italic mt-1.5">"Cinco días para reconectar contigo."</p>
      </header>

      <div className="space-y-3">
        {items.map(c => {
          const done = progress[c.id]?.size ?? 0;
          const total = 5;
          const pct = Math.round((done / total) * 100);
          return (
            <Link key={c.id} to={`/app/retos/${c.id}`}
              className="challenge-premium block overflow-hidden rounded-[28px] bg-white/90 transition hover:-translate-y-0.5"
            >
              <div className="app-photo-cover-frame relative overflow-hidden">
                <img src={challengeHero} alt="" className="app-photo-cover-image" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-white/70">Reto de 5 días</p>
                  <div className="font-serif text-2xl leading-tight mt-1">{c.title}</div>
                  {c.description && <p className="text-xs text-white/80 mt-1 line-clamp-2">{c.description}</p>}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundImage: "var(--gradient-primary)" }} />
                    </div>
                    <div className="text-[10px] muted mt-1">{done} de {total} días completados</div>
                  </div>
                  <span className="btn-primary shrink-0 px-4 py-2 text-xs">
                    {done === 0 ? "Comenzar" : done === total ? "Repasar" : "Continuar"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
