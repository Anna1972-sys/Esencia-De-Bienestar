import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";

export default function Challenges() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, Set<number>>>({});

  useEffect(() => {
    supabase.from("challenges").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("challenge_progress").select("challenge_id, day").eq("user_id", user.id).then(({ data }) => {
      const map: Record<string, Set<number>> = {};
      (data ?? []).forEach((r: any) => {
        if (!map[r.challenge_id]) map[r.challenge_id] = new Set();
        map[r.challenge_id].add(r.day);
      });
      setProgress(map);
    });
  }, [user]);

  return (
    <div className="space-y-5">
      <Link to="/app" className="text-sm muted inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Link>
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
              className="block rounded-[28px] p-5 border border-white/80 transition hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(160deg, hsl(0 0% 100% / 0.96), hsl(330 70% 96%) 100%)",
                boxShadow: "0 12px 36px -16px hsl(315 55% 45% / 0.22), inset 0 1px 0 hsl(0 0% 100% / 0.85)",
              }}
            >
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl grid place-items-center text-2xl shrink-0"
                  style={{ background: "linear-gradient(135deg, hsl(330 70% 94%), hsl(280 60% 94%))" }}>
                  {c.icon ?? "🌸"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-lg leading-tight" style={{ color: "hsl(var(--plum))" }}>{c.title}</div>
                      {c.description && <p className="text-xs muted mt-1 line-clamp-2">{c.description}</p>}
                    </div>
                    <ChevronRight className="h-5 w-5 muted shrink-0 mt-1" />
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundImage: "var(--gradient-primary)" }} />
                    </div>
                    <div className="flex justify-between text-[10px] muted mt-1">
                      <span>{done} de {total} días</span><span>{pct}%</span>
                    </div>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "hsl(var(--plum))" }}>
                    {done === 0 ? "Pulsa para comenzar" : done === total ? "Repasar reto" : "Continuar reto"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
