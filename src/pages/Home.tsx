import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

const HOME_SCROLL_POSITION_KEY = "esencia:home-dashboard-scroll";
import { loadCardOrder, orderCards } from "@/lib/cardOrderSettings";
import WellnessCategoryTile from "@/components/WellnessCategoryTile";

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
  { key: "admin", to: "/app/admin", image: imgAdmin, title: "Administración", subtitle: "Gestiona tu app", adminOnly: true },
];

const DEFAULT_HOME_CARD_ORDER = HOME_TILES.map(tile => tile.key);

export default function Home() {
  const { user, isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_HOME_CARD_ORDER);
  const [welcomeTitle, setWelcomeTitle] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");

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

  const visibleTiles = HOME_TILES.filter(tile => !tile.adminOnly || isAdmin);
  const orderedTiles = orderCards(visibleTiles, cardOrder);
  const displayedWelcomeTitle = welcomeTitle || `Hola, ${name || "ANNA MARI"}`;
  const displayedWelcomeMessage = welcomeMessage || HOME_SUBTITLE;

  return (
    <div className="space-y-8" onClickCapture={rememberHomePosition}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-primary mb-1">Bienestar</p>
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

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-sans font-bold text-xl">Tu espacio</h3>
        </div>
        <div className="divider-soft mb-5" />

        <div className="grid grid-cols-2 gap-5">
          {orderedTiles.map(tile => (
            <div key={tile.key} className="home-card-unified">
              <Tile {...tile} />
            </div>
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
}: {
  to: string;
  image: string;
  title: string;
  subtitle?: string;
  scale?: string;
  variant?: "default" | "dark";
}) {
  return (
    <WellnessCategoryTile
      to={to}
      image={image}
      title={title}
      subtitle={subtitle}
      scale={scale}
      variant={variant}
    />
  );
}
