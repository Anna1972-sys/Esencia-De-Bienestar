import { Link } from "react-router-dom";
import { Sparkles, Flower2, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import imgRecetas from "@/assets/home-recetas.png";
import imgRecetario from "@/assets/home-recetario.png";
import imgRetos from "@/assets/home-retos.png";
import imgVideos from "@/assets/home-videos.png";
import imgCompra from "@/assets/home-compra.png";
import imgNutricion from "@/assets/home-nutricion.png";
import imgMovimiento from "@/assets/home-movimiento.png";
import imgDiario from "@/assets/home-diario.png";
import imgProgreso from "@/assets/home-progreso.png";
import imgAdmin from "@/assets/home-admin.png";

const QUOTES = [
  "Cuidarte es el primer acto de amor.",
  "Cada bocado consciente es un paso hacia tu bienestar.",
  "Tu cuerpo escucha todo lo que tu mente le dice.",
  "El equilibrio no se encuentra, se cultiva cada día.",
  "Pequeños hábitos, grandes transformaciones.",
  "Nutrir tu cuerpo es honrar tu esencia.",
  "Respira, sonríe y vuelve a tu centro.",
];

export default function Home() {
  const { user, isAdmin } = useAuth();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => setName(data?.display_name ?? ""));
  }, [user]);

  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="heading-lg">{name ? `Hola, ${name}` : "Bienvenida"}</h1>
          <p className="muted text-sm italic mt-2 leading-relaxed pr-2">"{quote}"</p>
        </div>
        <Link
          to="/app/perfil"
          className="shrink-0 h-12 w-12 rounded-full text-white grid place-items-center font-semibold shadow-soft ring-2 ring-white"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          {(name || "E").charAt(0).toUpperCase()}
        </Link>
      </header>

      <Link
        to="/app/generar"
        className="block card-elegant p-7 overflow-hidden relative group"
        style={{ background: "linear-gradient(135deg, hsl(335 80% 97%), hsl(295 70% 96%) 55%, hsl(275 65% 96%))" }}
      >
        <div className="absolute -top-10 -right-10 h-44 w-44 rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(circle, hsl(320 90% 80%), transparent 70%)" }} />
        <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full opacity-45 blur-3xl"
             style={{ background: "radial-gradient(circle, hsl(280 70% 82%), transparent 70%)" }} />
        <div className="relative">
          <span className="chip mb-3"><Sparkles className="h-3 w-3" /> Generador IA</span>
          <h2 className="heading-md">Crea una receta con lo que tienes en casa</h2>
          <p className="text-sm muted mt-2 leading-relaxed">Alta en proteína, según tus preferencias o un plan mensual completo.</p>
          <div className="btn-primary mt-5 w-max group-hover:scale-[1.02] transition-transform">Crear receta</div>
        </div>
      </Link>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl">Tu espacio</h3>
          <span className="chip-lavender"><Flower2 className="h-3.5 w-3.5" /> bienestar</span>
        </div>
        <div className="divider-soft mb-5" />

        <div className="grid grid-cols-2 gap-5">
          <Tile to="/app/mis-recetas" image={imgRecetas} title="Recetas" subtitle="Tus creaciones" tint="hsl(330 75% 96%)" />
          <Tile to="/app/biblioteca" image={imgRecetario} title="Tu recetario" subtitle="Tus desayunos, comidas y cenas favoritas" tint="hsl(310 70% 97%)" imageScale={0.82} />
          <Tile to="/app/retos" image={imgRetos} title="Retos 5 días" subtitle="Acepta el reto" tint="hsl(290 65% 96%)" />
          <Tile to="/app/recursos" image={imgVideos} title="Vídeos y guías" subtitle="Aprende" tint="hsl(275 60% 96%)" />
          <Tile to="/app/lista-compra" image={imgCompra} title="Lista de compra" subtitle="Todo lo necesario" tint="hsl(335 70% 97%)" />
          <Tile to="/app/nutricion" image={imgNutricion} title="Nutrición deportiva" subtitle="Rendimiento y energía" tint="hsl(335 70% 97%)" imageScale={1.15} />
          <Tile to="/app/movimiento" image={imgMovimiento} title="Movimiento y ejercicio" subtitle="Actívate cada día" tint="hsl(300 60% 96%)" imageScale={1.1} />
          <Tile to="/app/diario" image={imgDiario} title="Diario" subtitle="Tu jornada" tint="hsl(285 65% 96%)" />
          <Tile to="/app/progreso" image={imgProgreso} title="Mi progreso" subtitle="Evolución" tint="hsl(320 70% 96%)" imageScale={1.18} />
          {isAdmin && (
            <Tile to="/app/admin" image={imgAdmin} title="Administración" subtitle="Gestiona" tint="hsl(300 50% 96%)" />
          )}
        </div>
      </section>
    </div>
  );
}

function Tile({
  to, image, title, subtitle, tint, imageScale = 1,
}: {
  to: string; image: string; title: string; subtitle?: string; tint?: string; imageScale?: number;
}) {
  return (
    <Link
      to={to}
      className="relative rounded-[28px] border border-white/80 transition-all duration-300 hover:-translate-y-1 group overflow-hidden flex flex-col items-center text-center pt-5 pb-5 px-4 min-h-[240px]"
      style={{
        background: `linear-gradient(160deg, hsl(0 0% 100% / 0.96), ${tint ?? "hsl(320 60% 98%)"} 100%)`,
        boxShadow: "0 12px 36px -16px hsl(315 55% 45% / 0.22), inset 0 1px 0 hsl(0 0% 100% / 0.85)",
      }}
    >
      <div
        className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-30 blur-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${tint ?? "hsl(320 80% 90%)"}, transparent 70%)` }}
      />
      <div className="relative grid place-items-center h-36 w-full">
        <img
          src={image}
          alt={title}
          loading="lazy"
          style={{ transform: `scale(${imageScale})` }}
          className="h-36 w-36 object-contain group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-500 drop-shadow-[0_4px_12px_hsl(315_55%_60%/0.15)]"
        />
      </div>
      <div className="relative mt-4">
        <div className="font-serif text-lg leading-tight" style={{ color: "hsl(var(--plum))" }}>{title}</div>
        {subtitle && <p className="text-[10.5px] mt-1.5 tracking-wide" style={{ color: "hsl(285 25% 65%)" }}>{subtitle}</p>}
      </div>
    </Link>
  );
}
