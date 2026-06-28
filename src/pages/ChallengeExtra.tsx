import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { EXTRAS, ExtraKey, ContentBlock } from "@/lib/challengeExtras";
import ChallengeContentView from "@/components/ChallengeContentView";
import BackButton from "@/components/BackButton";
import menuImage from "@/assets/challenge-menu.png";
import shoppingImage from "@/assets/challenge-shopping.png";
import videosImage from "@/assets/challenge-videos.png";
import downloadsImage from "@/assets/challenge-downloads.png";
import faqImage from "@/assets/challenge-faq.png";

const EXTRA_HERO = {
  menu: { image: menuImage, subtitle: "Plan completo para los cinco días" },
  shopping: { image: shoppingImage, subtitle: "Todo lo necesario, en un solo lugar" },
  videos: { image: videosImage, subtitle: "Aprende paso a paso" },
  downloads: { image: downloadsImage, subtitle: "Guías y recursos para acompañarte" },
  faq: { image: faqImage, subtitle: "Resuelve tus dudas con calma" },
};

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
  const hero = EXTRA_HERO[meta.key];

  return (
    <div className="space-y-5 pb-10">
      <BackButton fallbackTo={`/app/retos/${id}`} className="text-sm muted inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> {c.title}
      </BackButton>

      <header className="challenge-premium rounded-[28px] relative min-h-[250px] overflow-hidden text-white">
        <img src={hero.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="relative min-h-[250px] p-6 flex flex-col justify-end">
          <p className="text-xs tracking-[0.2em] uppercase text-white/75">Reto de 5 días</p>
          <h1 className="font-serif text-3xl leading-tight text-white mt-1">{block.title || meta.label}</h1>
          <p className="text-sm text-white/80 mt-2">{hero.subtitle}</p>
        </div>
      </header>

      <ChallengeContentView block={block} />
    </div>
  );
}
