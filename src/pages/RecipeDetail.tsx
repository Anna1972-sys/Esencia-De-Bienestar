import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink, ShoppingBag, Video } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { classifyShoppingItem } from "@/lib/shoppingCategories";
import { getCategoryImage, getCategoryLabel } from "@/lib/libraryCategories";
import BackButton from "@/components/BackButton";

import { videoEmbedUrl, videoThumbnail } from "@/components/VideoField";
import { mediaUrl } from "@/lib/mediaStorage";

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  ingredients: any;
  steps: any;
  macros: any;
  image_url: string | null;
  video_url: string | null;
};

export default function RecipeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [r, setR] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [adding, setAdding] = useState(false);

  const addAllToShopping = async () => {
    if (!r || !user) return;
    const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
    const rows = ing.map((i: any) => {
      const name = typeof i === "string" ? i : i?.name ?? String(i);
      const quantity = typeof i === "string" ? null : i?.quantity ?? null;
      return { user_id: user.id, name, quantity, category: classifyShoppingItem(name), recipe_id: r.id };
    }).filter(r => r.name?.trim());
    if (!rows.length) { toast.error("Sin ingredientes"); return; }
    setAdding(true);
    const { error } = await supabase.from("shopping_list_items").insert(rows);
    setAdding(false);
    if (error) toast.error(error.message); else toast.success("Añadido a la lista de compra");
  };

  useEffect(() => {
    if (!id) return;
    supabase.from("recipes").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) setNotFound(true);
      else setR(data as any);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="muted text-sm">Cargando…</div>;
  if (notFound || !r) {
    return (
      <div className="recipe-detail-page pb-28">
        <BackButton fallbackTo="/app/biblioteca" className="text-sm muted inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="h-4 w-4" /> Volver
        </BackButton>
        <div className="card-soft p-8 text-center">
          <div className="font-medium mb-1">Receta no disponible</div>
          <p className="text-sm muted">Esta receta ya no existe.</p>
        </div>
      </div>
    );
  }

  const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps : [];
  const macros = r.macros || {};
  const hasMacros = Number(macros.protein) > 0 || Number(macros.carbs) > 0 || Number(macros.fat) > 0 || Number(macros.calories) > 0 || Number(macros.fiber) > 0;
  const videoThumb = r.video_url ? videoThumbnail(r.video_url) : null;
  const cover = r.image_url ? mediaUrl(r.image_url) : videoThumb || getCategoryImage(r.category);

  return (
    <div className="recipe-detail-page pb-28">
      <BackButton fallbackTo="/app/biblioteca" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      {r.video_url ? (
        <div className="rounded-2xl overflow-hidden mb-4 aspect-video bg-black">
          {videoEmbedUrl(r.video_url)
            ? <iframe src={videoEmbedUrl(r.video_url)!} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" />
            : <video src={mediaUrl(r.video_url)} controls preload="metadata" poster={r.image_url ? mediaUrl(r.image_url) : undefined} className="w-full h-full" />}
        </div>
      ) : cover ? (
        <div className="rounded-2xl overflow-hidden mb-4 aspect-[4/3] bg-muted">
          <img src={cover} alt={r.title} loading="lazy" className="w-full h-full object-cover" />
        </div>
      ) : null}
      <h1 className="heading-lg mb-1">{r.title}</h1>
      {r.category && (
        <div className="text-xs muted mb-2">{getCategoryLabel(r.category)}</div>
      )}
      {(macros.prep_time || macros.servings) && (
        <div className="text-xs muted mb-2 flex gap-3">
          {macros.prep_time && <span>⏱ {macros.prep_time}</span>}
          {macros.servings && <span>🍽 {macros.servings}</span>}
        </div>
      )}
      {r.description && <p className="muted text-sm mb-3">{r.description}</p>}
      {r.video_url && (
        <section className="card-soft p-4 mb-4">
          <h2 className="font-medium text-sm flex items-center gap-2 mb-3">
            <Video className="h-4 w-4 text-primary" />
            Recursos disponibles
          </h2>
          <a href={mediaUrl(r.video_url)} target="_blank" rel="noreferrer" className="btn-secondary justify-between">
            <span className="inline-flex items-center gap-2">
              <Video className="h-4 w-4" />
              Ver vídeo
            </span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
      )}
      {hasMacros && (
        <div className="card-soft p-3 mb-4 grid grid-cols-5 gap-2 text-center text-xs">
          <div className="nutrition-stat"><div className="font-semibold">{macros.calories ?? 0}</div><div className="muted">Kcal</div></div>
          <div className="nutrition-stat"><div className="font-semibold">{macros.protein ?? 0}g</div><div className="muted">Proteínas</div></div>
          <div className="nutrition-stat"><div className="font-semibold">{macros.carbs ?? 0}g</div><div className="muted">Carbohidratos</div></div>
          <div className="nutrition-stat"><div className="font-semibold">{macros.fat ?? 0}g</div><div className="muted">Grasas</div></div>
          <div className="nutrition-stat"><div className="font-semibold">{macros.fiber ?? 0}g</div><div className="muted">Fibra</div></div>
        </div>
      )}
      {ing.length > 0 && (
        <>
          <h2 className="font-semibold mb-2 flex items-center justify-between">
            <span>Ingredientes</span>
            <button onClick={addAllToShopping} disabled={adding} className="btn-ghost recipe-add-button text-xs">
              <ShoppingBag className="h-3.5 w-3.5" /> {adding ? "Añadiendo…" : "Añadir a la lista"}
            </button>
          </h2>
          <ul className="card-soft p-4 mb-4 space-y-1 text-sm list-disc list-inside">
            {ing.map((i: any, idx: number) => (
              <li key={idx}>{typeof i === "string" ? i : `${i.name ?? ""}${i.quantity ? ` — ${i.quantity}` : ""}`}</li>
            ))}
          </ul>
        </>
      )}
      {steps.length > 0 && (
        <>
          <h2 className="font-semibold mb-2">Preparación</h2>
          <ol className="card-soft p-4 space-y-2 text-sm list-decimal list-inside">
            {steps.map((s: any, idx: number) => (
              <li key={idx}>{typeof s === "string" ? s : s?.text ?? ""}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
