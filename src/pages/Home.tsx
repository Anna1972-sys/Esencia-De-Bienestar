import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, RotateCcw, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const HOME_SCROLL_POSITION_KEY = "esencia:home-dashboard-scroll";
import { loadCardOrder, moveCardKey, orderCards, saveCardOrder } from "@/lib/cardOrderSettings";
import WellnessCategoryTile from "@/components/WellnessCategoryTile";

import imgRecetas from "@/assets/home-recetas.png";
import imgRecetario from "@/assets/home-recetario.png";
import imgRetos from "@/assets/home-retos.png";
import imgVideos from "@/assets/home-videos.png";
import imgCompra from "@/assets/home-compra.png";
import imgMovimiento from "@/assets/home-movimiento.png";
import imgDiario from "@/assets/home-diario.png";
import imgProgreso from "@/assets/home-progreso.png";
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
};

const HOME_TILES: HomeTileItem[] = [
  { key: "mis-recetas", to: "/app/mis-recetas", image: imgRecetas, title: "Mis recetas creadas", subtitle: "Generadas y guardadas" },
  { key: "biblioteca", to: "/app/biblioteca", image: imgRecetario, title: "Biblioteca de recetas", subtitle: "Todas las disponibles" },
  { key: "retos", to: "/app/retos", image: imgRetos, title: "Retos 5 días", subtitle: "Acepta el reto" },
  { key: "recursos", to: "/app/recursos", image: imgVideos, title: "Vídeos y guías", subtitle: "Aprende" },
  { key: "productos", to: "/app/productos", image: imgProducts, title: "Salud y Bienestar", subtitle: "Suplementación inteligente" },
  { key: "lista-compra", to: "/app/lista-compra", image: imgCompra, title: "Lista de compra", subtitle: "Todo lo necesario" },
  { key: "diario", to: "/app/diario", image: imgDiario, title: "Diario", subtitle: "Tu jornada" },
  { key: "progreso", to: "/app/progreso", image: imgProgreso, title: "Mi progreso", subtitle: "Tu evolución" },
  { key: "nutricion", to: "/app/nutricion", image: imgNutritionPremium, title: "Nutrición deportiva", subtitle: "Rendimiento y energía", variant: "dark" },
  { key: "movimiento", to: "/app/movimiento", image: imgMovimiento, title: "Movimiento y ejercicio", subtitle: "Actívate cada día", variant: "dark" },
  { key: "favoritos", to: "/app/favoritos", image: imgRecetario, title: "Mis favoritos", subtitle: "Todo lo que te encanta" },
];

const DEFAULT_HOME_CARD_ORDER = HOME_TILES.map(tile => tile.key);

const HOME_SECTIONS = [
  {
    key: "alimentacion",
    title: "Alimentación",
    subtitle: "Tus recetas, bienestar y planificación",
    tiles: ["mis-recetas", "biblioteca", "productos", "lista-compra"],
  },
  {
    key: "actividad",
    title: "Muévete y aprende",
    subtitle: "Retos, recursos y actividad para cuidarte",
    tiles: ["retos", "recursos", "nutricion", "movimiento"],
  },
  {
    key: "seguimiento",
    title: "Tu seguimiento",
    subtitle: "Tu evolución y todo lo que quieres conservar",
    tiles: ["diario", "progreso", "favoritos"],
  },
] as const;

export default function Home() {
  const { user, isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_HOME_CARD_ORDER);
  const [welcomeTitle, setWelcomeTitle] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [orderingCards, setOrderingCards] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => setName(data?.display_name ?? ""));
  }, [user]);

  useEffect(() => {
    loadCardOrder("home_card_order", DEFAULT_HOME_CARD_ORDER, supabase as any).then(setCardOrder);
  }, []);

  useEffect(() => {
    const savedPosition = sessionStorage.getItem(HOME_SCROLL_POSITION_KEY);
    if (!savedPosition) return;

    const scrollPosition = Number(savedPosition);
    if (!Number.isFinite(scrollPosition)) return;

    let delayedRestore: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPosition, behavior: "auto" });
      delayedRestore = window.setTimeout(() => {
        window.scrollTo({ top: scrollPosition, behavior: "auto" });
      }, 250);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (delayedRestore !== undefined) window.clearTimeout(delayedRestore);
    };
  }, []);

  const rememberHomePosition = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a[href^='/app/']")) {
      sessionStorage.setItem(HOME_SCROLL_POSITION_KEY, String(window.scrollY));
    }
  };

  useEffect(() => {
    (supabase as any)
      .from("app_settings")
      .select("welcome_title,welcome_message")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }: any) => {
        setWelcomeTitle(data?.welcome_title?.trim() ?? "");
        setWelcomeMessage(data?.welcome_message?.trim() ?? "");
      });
  }, []);

  const visibleTiles = HOME_TILES;
  const orderedTiles = orderCards(visibleTiles, cardOrder);
  const orderedKeys = orderedTiles.map(tile => tile.key);
  const displayedWelcomeTitle = welcomeTitle || `Hola, ${name || "ANNA MARI"}`;
  const displayedWelcomeMessage = welcomeMessage || HOME_SUBTITLE;

  const moveHomeTile = (key: string, direction: -1 | 1) => {
    if (!isAdmin) return;
    setCardOrder(moveCardKey(orderedKeys, key, direction));
  };

  const saveHomeOrder = async () => {
    if (!isAdmin) return;
    setSavingOrder(true);
    const result = await saveCardOrder("home_card_order", orderedKeys, supabase as any);
    setCardOrder(result.order);
    setSavingOrder(false);
    if (result.savedRemotely) toast.success("Orden del panel principal guardado");
    else toast.warning("El orden se ha guardado solamente en este navegador.");
  };

  const resetHomeOrder = () => {
    if (!isAdmin) return;
    setCardOrder(DEFAULT_HOME_CARD_ORDER);
    toast.info("Orden restaurado. Pulsa Guardar orden para conservarlo.");
  };

  return (
    <div className="space-y-8" onClickCapture={rememberHomePosition}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="heading-lg">{displayedWelcomeTitle}</h1>
          <p className="muted text-sm mt-2 leading-relaxed pr-2">{displayedWelcomeMessage}</p>
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

      <section style={{ marginTop: "0.5rem" }}>
        {isAdmin && (
          <div className="flex justify-end mb-2">
            <button type="button" className="btn-secondary compact !min-h-0 !px-2.5 !py-1 text-[11px]" onClick={() => setOrderingCards(value => !value)}>
              {orderingCards ? "Terminar" : "Ordenar"}
            </button>
          </div>
        )}

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

        {isAdmin && orderingCards ? (
          <div className="grid grid-cols-2 gap-5">
            {orderedTiles.map((tile, index) => (
              <div key={tile.key} className="home-card-unified relative">
                <div className="absolute right-2 top-2 z-20 flex gap-1">
                  <button type="button" className="h-8 w-8 rounded-full bg-white/95 border border-primary/30 text-primary grid place-items-center disabled:opacity-35" disabled={index === 0} onClick={() => moveHomeTile(tile.key, -1)} aria-label={`Subir ${tile.title}`}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="h-8 w-8 rounded-full bg-white/95 border border-primary/30 text-primary grid place-items-center disabled:opacity-35" disabled={index === orderedTiles.length - 1} onClick={() => moveHomeTile(tile.key, 1)} aria-label={`Bajar ${tile.title}`}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <Tile {...tile} disabled />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {HOME_SECTIONS.map((section) => {
              const sectionTiles = orderedTiles.filter((tile) => section.tiles.some((key) => key === tile.key));
              if (!sectionTiles.length) return null;
              return (
                <section key={section.key}>
                  <div className="mb-4">
                    <h3 className="font-sans font-bold text-lg">{section.title}</h3>
                    <p className="muted text-xs mt-1">{section.subtitle}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    {sectionTiles.map((tile) => (
                      <div key={tile.key} className="home-card-unified relative">
                        <Tile {...tile} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
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
}: {
  to: string;
  image: string;
  title: string;
  subtitle?: string;
  scale?: string;
  variant?: "default" | "dark";
  disabled?: boolean;
}) {
  return (
    <WellnessCategoryTile
      to={to}
      image={image}
      title={title}
      subtitle={subtitle}
      scale={scale}
      variant={variant}
      disabled={disabled}
    />
  );
}
