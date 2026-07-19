import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Flower2, RotateCcw, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadCardOrder, moveCardKey, orderCards, saveCardOrder } from "@/lib/cardOrderSettings";
import { toast } from "sonner";

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
import imgProducts from "@/assets/home-productos-te-jardin.png";

const HOME_SUBTITLE = "Hoy es un buen día para cuidar de ti";

type HomeTileItem = {
  key: string;
  to: string;
  image: string;
  title: string;
  subtitle: string;
  scale?: string;
  variant?: "default" | "dark";
  adminOnly?: boolean;
};

const HOME_TILES: HomeTileItem[] = [
  { key: "mis-recetas", to: "/app/mis-recetas", image: imgRecetas, title: "Recetas", subtitle: "Tus creaciones" },
  { key: "biblioteca", to: "/app/biblioteca", image: imgRecetario, title: "Tu recetario", subtitle: "Tus favoritos" },
  { key: "retos", to: "/app/retos", image: imgRetos, title: "Retos 5 días", subtitle: "Acepta el reto" },
  { key: "recursos", to: "/app/recursos", image: imgVideos, title: "Vídeos y guías", subtitle: "Aprende" },
  { key: "productos", to: "/app/productos", image: imgProducts, title: "Salud y Bienestar", subtitle: "Suplementación inteligente" },
  { key: "lista-compra", to: "/app/lista-compra", image: imgCompra, title: "Lista de compra", subtitle: "Todo lo necesario" },
  { key: "diario", to: "/app/diario", image: imgDiario, title: "Diario", subtitle: "Tu jornada" },
  { key: "progreso", to: "/app/progreso", image: imgProgreso, title: "Mi progreso", subtitle: "Tu evolución" },
  { key: "nutricion", to: "/app/nutricion", image: imgNutritionPremium, title: "Nutrición deportiva", subtitle: "Rendimiento y energía", variant: "dark" },
  { key: "movimiento", to: "/app/movimiento", image: imgMovimiento, title: "Movimiento y ejercicio", subtitle: "Actívate cada día", variant: "dark" },
  { key: "admin", to: "/app/admin", image: imgAdmin, title: "Administración", subtitle: "Gestiona tu app", adminOnly: true },
];

const DEFAULT_HOME_CARD_ORDER = HOME_TILES.map(tile => tile.key);

export default function Home() {
  const { user, isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_HOME_CARD_ORDER);
  const [orderingCards, setOrderingCards] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => setName(data?.display_name ?? ""));
  }, [user]);

  useEffect(() => {
    loadCardOrder("home_card_order", DEFAULT_HOME_CARD_ORDER, supabase as any).then(setCardOrder);
  }, []);

  const visibleTiles = HOME_TILES.filter(tile => !tile.adminOnly || isAdmin);
  const orderedTiles = orderCards(visibleTiles, cardOrder);
  const orderedKeys = orderedTiles.map(tile => tile.key);

  const moveHomeTile = (key: string, direction: -1 | 1) => {
    setCardOrder(moveCardKey(orderedKeys, key, direction));
  };

  const saveHomeOrder = async () => {
    setSavingOrder(true);
    const result = await saveCardOrder("home_card_order", orderedKeys, supabase as any);
    setCardOrder(result.order);
    setSavingOrder(false);
    if (result.savedRemotely) toast.success("Orden del panel principal guardado");
    else toast.warning("Orden guardado en este navegador. Falta aplicar la migración para guardarlo globalmente.");
  };

  const resetHomeOrder = () => {
    setCardOrder(DEFAULT_HOME_CARD_ORDER);
    toast.info("Orden restaurado. Pulsa Guardar orden para conservarlo.");
  };

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-primary mb-1">Bienestar</p>
          <h1 className="heading-lg">Hola, {name || "ANNA MARI"}</h1>
          <p className="muted text-sm mt-2 leading-relaxed pr-2">{HOME_SUBTITLE}</p>
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
        <img src={imgRecipeGenerator} alt="Plato saludable" className="absolute inset-y-0 right-0 h-full w-[34%] rounded-r-[28px] object-cover scale-105 origin-center opacity-95 pointer-events-none" />
        <div className="relative max-w-[68%]">
          <h2 className="heading-md text-white">Crea una receta con lo que tienes en casa</h2>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">Alta en proteína, según tus preferencias o un plan mensual completo.</p>
          <div className="btn-primary mt-5 w-max group-hover:scale-[1.02] transition-transform">Crear receta</div>
        </div>
      </Link>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-sans font-bold text-xl">Tu espacio</h3>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button type="button" className="btn-secondary compact" onClick={() => setOrderingCards(value => !value)}>
                {orderingCards ? "Terminar" : "Ordenar"}
              </button>
            )}
            <span className="chip-lavender"><Flower2 className="h-3.5 w-3.5" /> bienestar</span>
          </div>
        </div>
        <div className="divider-soft mb-5" />

        {isAdmin && orderingCards && (
          <div className="card-soft p-3 mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="muted flex-1 min-w-[180px]">Usa las flechas de cada tarjeta y guarda el orden.</span>
            <button type="button" className="btn-secondary compact" onClick={resetHomeOrder}>
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar
            </button>
            <button type="button" className="btn-primary compact" onClick={saveHomeOrder} disabled={savingOrder}>
              <Save className="h-3.5 w-3.5" /> {savingOrder ? "Guardando…" : "Guardar orden"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-5">
          {orderedTiles.map((tile, index) => (
            <Tile
              key={tile.key}
              {...tile}
              disabled={orderingCards}
              orderControls={orderingCards ? (
                <div className="absolute right-2 top-2 z-10 flex gap-1">
                  <button type="button" className="h-8 w-8 rounded-full bg-white/95 border border-primary/30 text-primary grid place-items-center disabled:opacity-35" disabled={index === 0} onClick={() => moveHomeTile(tile.key, -1)} aria-label={`Subir ${tile.title}`}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="h-8 w-8 rounded-full bg-white/95 border border-primary/30 text-primary grid place-items-center disabled:opacity-35" disabled={index === orderedTiles.length - 1} onClick={() => moveHomeTile(tile.key, 1)} aria-label={`Bajar ${tile.title}`}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Tile({
  to,
  image,
  title,
  subtitle,
  scale = "scale-100",
  variant = "default",
  disabled = false,
  orderControls,
}: {
  to: string;
  image: string;
  title: string;
  subtitle?: string;
  scale?: string;
  variant?: "default" | "dark";
  disabled?: boolean;
  orderControls?: ReactNode;
}) {
  const className = `${variant === "dark" ? "wellness-nutrition-tile" : "wellness-tile"} relative rounded-[26px] transition-all duration-300 ${disabled ? "cursor-default ring-2 ring-primary/20" : "hover:-translate-y-1"} group overflow-hidden flex flex-col items-center text-center p-3`;
  const content = (
    <>
      {orderControls}
      <div className="relative grid place-items-center h-[170px] w-full">
        <div className={`home-card-image-frame ${variant === "dark" ? "home-card-image-frame-dark" : ""}`}>
          <img
            src={image}
            alt={title}
            loading="lazy"
            className={`${variant === "dark" ? "h-full w-full object-cover" : "home-card-image"} ${scale} group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-500`}
          />
        </div>
      </div>
      <div className="home-card-text relative mt-3 w-full">
        <div className={`font-sans font-bold text-lg leading-tight ${variant === "dark" ? "text-[#FF2D95]" : "text-foreground"}`}>{title}</div>
        {subtitle && <p className="home-card-subtitle">{subtitle}</p>}
      </div>
    </>
  );

  if (disabled) return <div className={className}>{content}</div>;
  return <Link to={to} className={className}>{content}</Link>;
}
