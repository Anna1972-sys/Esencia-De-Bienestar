import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronRight, Dumbbell, Heart, PlayCircle } from "lucide-react";
import BackButton from "@/components/BackButton";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { useFavorites, type FavoriteContentType, type FavoriteRow } from "@/contexts/FavoritesContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRecipeImageUrl } from "@/lib/recipeImages";
import { mediaUrl } from "@/lib/mediaStorage";

type FavoriteFilter = "all" | FavoriteContentType;
type FavoriteItem = FavoriteRow & {
  title: string;
  image: string | null;
  description: string;
  href: string;
};

const filters: Array<{ value: FavoriteFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "recipe", label: "Recetas" },
  { value: "video", label: "Vídeos" },
  { value: "guide", label: "Guías" },
  { value: "exercise", label: "Ejercicios" },
];

const typeLabel: Record<FavoriteContentType, string> = {
  recipe: "Receta",
  video: "Vídeo",
  guide: "Guía",
  exercise: "Ejercicio",
};

export default function Favorites() {
  const { favorites, loading, markOpened } = useFavorites();
  const [filter, setFilter] = useState<FavoriteFilter>("all");
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setContentLoading(true);
      const recipeIds = favorites.filter(row => row.content_type === "recipe").map(row => row.content_id);
      const resourceIds = favorites.filter(row => row.content_type === "video" || row.content_type === "guide").map(row => row.content_id);
      const exerciseIds = favorites.filter(row => row.content_type === "exercise").map(row => row.content_id);
      const [recipesResult, resourcesResult, exercisesResult] = await Promise.all([
        recipeIds.length ? supabase.from("recipes").select("id,title,description,image_url").in("id", recipeIds) : Promise.resolve({ data: [] }),
        resourceIds.length ? supabase.from("resources").select("id,title,body,cover_image").in("id", resourceIds) : Promise.resolve({ data: [] }),
        exerciseIds.length ? (supabase as any).from("movement_items").select("id,title,cover_image,blocks").in("id", exerciseIds) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      const recipes = new Map(((recipesResult.data ?? []) as any[]).map(row => [row.id, row]));
      const resources = new Map(((resourcesResult.data ?? []) as any[]).map(row => [row.id, row]));
      const exercises = new Map(((exercisesResult.data ?? []) as any[]).map(row => [row.id, row]));
      const resolved = favorites.flatMap(row => {
        const source = row.content_type === "recipe"
          ? recipes.get(row.content_id)
          : row.content_type === "exercise"
            ? exercises.get(row.content_id)
            : resources.get(row.content_id);
        if (!source) return [];
        const image = row.content_type === "recipe"
          ? normalizeRecipeImageUrl(source.image_url)
          : mediaUrl(source.cover_image || "");
        return [{
          ...row,
          title: source.title || "Contenido",
          image: image || null,
          description: source.description || source.body || typeLabel[row.content_type],
          href: row.content_type === "recipe"
            ? `/app/biblioteca/${row.content_id}`
            : row.content_type === "exercise"
              ? `/app/movimiento/${row.content_id}`
              : `/app/recursos/${row.content_id}`,
        }];
      });
      setItems(resolved);
      setContentLoading(false);
    })();
    return () => { cancelled = true; };
  }, [favorites]);

  const visible = useMemo(
    () => items
      .filter(item => filter === "all" || item.content_type === filter)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [items, filter],
  );

  return (
    <div className="pb-28">
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <div className="flex items-center gap-2 mb-1">
        <Heart className="h-5 w-5 text-primary fill-primary" />
        <h1 className="heading-lg">Mis favoritos</h1>
      </div>
      <p className="text-sm muted mb-4">Todo lo que quieres volver a consultar.</p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {filters.map(item => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === item.value ? "bg-primary text-white" : "bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading || contentLoading ? (
        <div className="card-soft p-6 text-center muted">Cargando favoritos…</div>
      ) : visible.length === 0 ? (
        <div className="card-soft favorites-empty-card p-7 text-center">
          <Heart className="h-8 w-8 text-primary fill-primary mx-auto mb-2" />
          <div className="font-medium">Todavía no hay favoritos</div>
          <p className="text-sm muted mt-1">Pulsa el corazón de una receta, guía, vídeo o ejercicio para guardarlo aquí.</p>
          <div className="grid gap-2 mt-5 text-left">
            <Link to="/app/biblioteca" className="btn-ghost justify-start px-4 py-3">
              <BookOpen className="h-4 w-4 text-primary" />
              Explorar recetas
            </Link>
            <Link to="/app/recursos" className="btn-ghost justify-start px-4 py-3">
              <PlayCircle className="h-4 w-4 text-primary" />
              Explorar vídeos y guías
            </Link>
            <Link to="/app/movimiento" className="btn-ghost justify-start px-4 py-3">
              <Dumbbell className="h-4 w-4 text-primary" />
              Explorar ejercicios
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <div key={item.id} className="relative">
              <Link
                to={item.href}
                onClick={() => void markOpened(item.content_type, item.content_id)}
                className="card-soft overflow-hidden flex min-h-[116px] hover:shadow-glow transition"
              >
                {item.image ? (
                  <img src={item.image} alt="" className="w-[38%] object-cover" />
                ) : (
                  <div className="w-[38%] bg-secondary grid place-items-center text-primary"><Heart className="h-6 w-6" /></div>
                )}
                <div className="min-w-0 flex-1 p-3 pr-11 flex flex-col justify-center">
                  <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">{typeLabel[item.content_type]}</div>
                  <div className="font-medium leading-tight mt-1">{item.title}</div>
                  <div className="text-[11px] muted mt-1">
                    {item.open_count === 0 ? "Todavía no consultado desde Favoritos" : `${item.open_count} ${item.open_count === 1 ? "apertura" : "aperturas"}`}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 muted absolute bottom-3 right-3" />
              </Link>
              <FavoriteButton contentType={item.content_type} contentId={item.content_id} className="absolute right-2 top-2" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
