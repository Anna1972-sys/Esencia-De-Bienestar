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
import imgMovimiento from "@/assets/home-movimiento.png";
import imgDiario from "@/assets/home-diario.png";
import imgProgreso from "@/assets/home-progreso.png";
import imgAdmin from "@/assets/home-admin.png";
import imgRecipeGenerator from "@/assets/home-recipe-generator.png";
import imgNutritionPremium from "@/assets/nutrition/home-tortitas-h24.png";
import imgProducts from "@/assets/home-nutrition-premium-light.png";

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
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-primary mb-1">Bienestar</p>
          <h1 className="heading-lg">Hola, {name || "ANNA MARI"}</h1>
          <p className="muted text-sm mt-2 leading-relaxed pr-2">{quote}</p>
        </div>
        <Link
          to="/app/perfil"
          className="wellness-avatar shrink-0 h-12 w-12 rounded-full text-white grid place-items-center font-semibold ring-2 ring-white"
        >
          {(name || "E").charAt(0).toUpperCase()}
        </Link>
      </header>

      <Link
        to="/app/generar"
        className="wellness-hero block rounded-[28px] p-7 overflow-hidden relative group"
      >
        <img src={imgRecipeGenerator} alt="Plato saludable" className="absolute inset-y-0 right-0 h-full w-[42%] rounded-r-[28px] object-cover scale-[1.18] origin-center opacity-95 pointer-events-none" />
        <div className="relative max-w-[68%]">
          <span className="chip mb-3 bg-primary text-white"><Sparkles className="h-3 w-3" /> Generador IA</span>
          <h2 className="heading-md text-white">Crea una receta con lo que tienes en casa</h2>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">Alta en proteína, según tus preferencias o un plan mensual completo.</p>
          <div className="btn-primary mt-5 w-max group-hover:scale-[1.02] transition-transform">Crear receta</div>
        </div>
      </Link>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-sans font-bold text-xl">Tu espacio</h3>
          <span className="chip-lavender"><Flower2 className="h-3.5 w-3.5" /> bienestar</span>
        </div>
        <div className="divider-soft mb-5" />

        <div className="grid grid-cols-2 gap-5">
          <Tile to="/app/mis-recetas" image={imgRecetas} title="Recetas" subtitle="Tus creaciones" />
          <Tile to="/app/biblioteca" image={imgRecetario} title="Tu recetario" subtitle="Tus desayunos, comidas y cenas favoritas" scale="scale-[.82]" />
          <Tile to="/app/retos" image={imgRetos} title="Retos 5 días" subtitle="Acepta el reto" />
          <Tile to="/app/recursos" image={imgVideos} title="Vídeos y guías" subtitle="Aprende" />
          <Tile to="/app/productos" image={imgProducts} title="Productos" subtitle="Herbalife y nutrición" />
          <Tile to="/app/lista-compra" image={imgCompra} title="Lista de compra" subtitle="Todo lo necesario" />
          <NutritionTile />
          <MovementTile />
          <Tile to="/app/diario" image={imgDiario} title="Diario" subtitle="Tu jornada" />
          <Tile to="/app/progreso" image={imgProgreso} title="Mi progreso" subtitle="Evolución" scale="scale-110" />
          {isAdmin && (
            <Tile to="/app/admin" image={imgAdmin} title="Administración" subtitle="Gestiona" />
          )}
        </div>
      </section>
    </div>
  );
}

function Tile({
  to, image, title, subtitle, scale = "scale-100",
}: {
  to: string; image: string; title: string; subtitle?: string; scale?: string;
}) {
  return (
    <Link
      to={to}
      className="wellness-tile relative rounded-[28px] transition-all duration-300 hover:-translate-y-1 group overflow-hidden flex flex-col items-center text-center pt-5 pb-5 px-4 min-h-[240px]"
    >
      <div className="relative grid place-items-center h-36 w-full">
        <img
          src={image}
          alt={title}
          loading="lazy"
          className={`h-36 w-36 object-contain ${scale} group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-500 drop-shadow-[0_4px_12px_hsl(315_55%_60%/0.15)]`}
        />
      </div>
      <div className="relative mt-4">
        <div className="font-sans font-bold text-lg leading-tight text-foreground">{title}</div>
        {subtitle && <p className="text-[10.5px] mt-1.5 tracking-wide text-muted-foreground">{subtitle}</p>}
      </div>
    </Link>
  );
}

function NutritionTile() {
  return (
    <Link
      to="/app/nutricion"
      className="wellness-nutrition-tile relative rounded-[28px] transition-all duration-300 hover:-translate-y-1 group overflow-hidden flex flex-col items-center text-center pt-5 pb-5 px-4 min-h-[240px]"
    >
      <div className="relative grid place-items-center h-[152px] w-full" aria-hidden="true">
        <div className="h-[152px] w-[152px] overflow-hidden rounded-2xl border border-[#FF2D95]">
          <img src={imgNutritionPremium} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-2" />
        </div>
      </div>
      <div className="relative mt-4">
        <div className="font-sans font-bold text-lg leading-tight text-[#FF2D95]">Nutrición deportiva</div>
        <p className="text-[10.5px] mt-1.5 tracking-wide text-white/75">Rendimiento y energía</p>
      </div>
    </Link>
  );
}

function MovementTile() {
  return (
    <Link
      to="/app/movimiento"
      className="wellness-nutrition-tile relative rounded-[28px] transition-all duration-300 hover:-translate-y-1 group overflow-hidden flex flex-col items-center text-center pt-5 pb-5 px-4 min-h-[240px]"
    >
      <div className="relative grid place-items-center h-[152px] w-full" aria-hidden="true">
        <div className="h-[152px] w-[152px] overflow-hidden rounded-2xl border border-[#FF2D95] bg-black/30">
          <img src={imgMovimiento} alt="" className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-2" />
        </div>
      </div>
      <div className="relative mt-4">
        <div className="font-sans font-bold text-lg leading-tight text-[#FF2D95]">Movimiento y ejercicio</div>
        <p className="text-[10.5px] mt-1.5 tracking-wide text-white/75">Actívate cada día</p>
      </div>
    </Link>
  );
}
