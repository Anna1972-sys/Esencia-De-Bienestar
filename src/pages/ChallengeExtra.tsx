import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { EXTRAS, ExtraKey, ContentBlock } from "@/lib/challengeExtras";
import ChallengeContentView from "@/components/ChallengeContentView";

export default function ChallengeExtra() {
  const { id, key } = useParams();
  const [c, setC] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("challenges").select("*").eq("id", id).maybeSingle().then(({ data }) => setC(data));
  }, [id]);

  const meta = EXTRAS.find(e => e.key === key);
  if (!meta) return <div className="muted">Sección no encontrada.</div>;
  if (!c) return <div className="muted">Cargando…</div>;

  const extras = (c.extras ?? {}) as Record<ExtraKey, ContentBlock | undefined>;
  const block: ContentBlock = extras[meta.key] ?? {};

  return (
    <div className="space-y-5 pb-10">
      <Link to={`/app/retos/${id}`} className="text-sm muted inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> {c.title}
      </Link>

      <header className="rounded-[28px] p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(335 80% 96%), hsl(295 70% 95%) 55%, hsl(275 65% 95%))" }}>
        <div className="absolute -top-10 -right-10 h-44 w-44 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(320 90% 80%), transparent 70%)" }} />
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">{meta.icon}</div>
          <div>
            <p className="muted text-xs tracking-[0.2em] uppercase">Reto</p>
            <h1 className="heading-lg mt-0.5">{block.title || meta.label}</h1>
          </div>
        </div>
      </header>

      <ChallengeContentView block={block} />
    </div>
  );
}
