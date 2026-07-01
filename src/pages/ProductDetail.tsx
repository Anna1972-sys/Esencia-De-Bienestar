import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink, FileText, MousePointerClick } from "lucide-react";

type ProductMeasure = {
  id: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  is_default: boolean;
  sort_order: number;
};

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  image_url: string | null;
  gallery_urls: string[];
  video_urls: string[];
  pdf_urls: string[];
  external_urls: string[];
  description: string | null;
  benefits: string | null;
  usage: string | null;
  ingredients_text: string | null;
  observations: string | null;
  free_text: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat: number;
  fiber: number;
  sugars: number;
  salt: number;
  serving_size: string | null;
  serving_grams: number;
  serving_calories: number;
  serving_protein: number;
  serving_carbs: number;
  serving_sugars: number;
  serving_fat: number;
  serving_saturated_fat: number;
  serving_fiber: number;
  serving_salt: number;
  nutrition_verified_at: string | null;
  label_file_url: string | null;
  micronutrients: Record<string, unknown>;
  source: string | null;
  verification_status: "verificado" | "pendiente";
  spoon_image_url: string | null;
  product_measures: ProductMeasure[];
};

function isEmbeddable(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url);
}

function toEmbed(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

const asArray = (value: unknown): string[] => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
const toNumber = (value: unknown) => Number(value) || 0;

type ProductBlockId =
  | "main_image"
  | "spoon_image"
  | "gallery"
  | "videos"
  | "pdfs"
  | "external_urls"
  | "description"
  | "benefits"
  | "usage"
  | "ingredients"
  | "observations"
  | "free_text"
  | "nutrition"
  | "measures";

const PRODUCT_BLOCK_ORDER_KEY = "__product_block_order";

const DEFAULT_PRODUCT_BLOCK_ORDER: ProductBlockId[] = [
  "main_image",
  "description",
  "nutrition",
  "benefits",
  "usage",
  "ingredients",
  "observations",
  "free_text",
  "measures",
  "spoon_image",
  "gallery",
  "videos",
  "pdfs",
  "external_urls",
];

function readProductBlockOrder(micronutrients: Record<string, unknown> | null | undefined): ProductBlockId[] {
  const rawOrder = micronutrients?.[PRODUCT_BLOCK_ORDER_KEY];
  const validIds = new Set(DEFAULT_PRODUCT_BLOCK_ORDER);
  const saved = Array.isArray(rawOrder) ? rawOrder.filter((id): id is ProductBlockId => typeof id === "string" && validIds.has(id as ProductBlockId)) : [];
  return [...saved, ...DEFAULT_PRODUCT_BLOCK_ORDER.filter(id => !saved.includes(id))];
}

function micronutrientsForDisplay(micronutrients: Record<string, unknown> | null | undefined) {
  const next = { ...(micronutrients ?? {}) };
  delete next[PRODUCT_BLOCK_ORDER_KEY];
  return next;
}

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("products")
        .select("*, product_measures(*)")
        .eq("id", id)
        .eq("is_active", true)
        .eq("visible_to_clients", true)
        .maybeSingle();
      const normalized = data ? normalizeProduct(data) : null;
      setProduct(normalized);
      setLoading(false);
      if (normalized?.category_id) {
        const { data: cat } = await (supabase as any).from("product_categories").select("name").eq("id", normalized.category_id).maybeSingle();
        setCategory(cat as any);
      }
    })();
  }, [id]);

  if (loading) return <div className="muted">Cargando…</div>;
  if (!product) return (
    <div>
      <BackButton fallbackTo="/app/productos" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <div className="card-soft p-6 text-center muted">Producto no encontrado o no visible.</div>
    </div>
  );

  const micronutrients = Object.entries(micronutrientsForDisplay(product.micronutrients)).filter(([, value]) => value !== null && value !== undefined && value !== "");
  const hasNutrition = Boolean(product.calories || product.protein || product.carbs || product.fat || product.fiber);
  const blockOrder = readProductBlockOrder(product.micronutrients);

  const renderBlock = (blockId: ProductBlockId) => {
    switch (blockId) {
      case "main_image":
        return (
          <header className="product-detail-hero">
            <div className="product-detail-hero-image">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/20 via-white to-fuchsia-100" />
              )}
            </div>
            <div className="product-detail-hero-copy">
              {category?.name && <div className="product-detail-category">{category.name}</div>}
              <h1>{product.name}</h1>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={product.verification_status === "verificado" ? "chip-lavender" : "chip"}>{product.verification_status}</span>
                {product.label_file_url && (
                  <a href={product.label_file_url} target="_blank" rel="noreferrer" className="product-detail-label-link">
                    <FileText className="h-3.5 w-3.5" /> Etiqueta
                  </a>
                )}
              </div>
            </div>
          </header>
        );
      case "description":
        return <ContentBlock title="Descripción" value={product.description} />;
      case "nutrition":
        return (
          <>
            {hasNutrition ? (
              <section className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <Stat label="Kcal/100g" value={product.calories} />
                <Stat label="Proteínas" value={`${product.protein}g`} />
                <Stat label="Hidratos" value={`${product.carbs}g`} />
                <Stat label="Grasas" value={`${product.fat}g`} />
                <Stat label="Fibra" value={`${product.fiber}g`} />
              </section>
            ) : (
              <section className="card-soft p-4">
                <div className="font-medium">Información nutricional pendiente</div>
                <p className="text-sm muted mt-1">Este producto está creado en la base, pero falta completar sus valores desde etiqueta oficial.</p>
              </section>
            )}
            {(product.serving_calories || product.serving_protein || product.serving_carbs || product.serving_fat || product.serving_fiber) ? (
              <section className="card-soft p-4 mt-5">
                <h2 className="font-serif text-xl mb-3">Valores por ración</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <Stat label="Kcal" value={product.serving_calories || "—"} />
                  <Stat label="Proteínas" value={product.serving_protein ? `${product.serving_protein}g` : "—"} />
                  <Stat label="Hidratos" value={product.serving_carbs ? `${product.serving_carbs}g` : "—"} />
                  <Stat label="Grasas" value={product.serving_fat ? `${product.serving_fat}g` : "—"} />
                  <Stat label="Fibra" value={product.serving_fiber ? `${product.serving_fiber}g` : "—"} />
                </div>
              </section>
            ) : null}
            {(product.serving_size || product.serving_grams > 0 || product.sugars > 0 || product.saturated_fat > 0 || product.salt > 0 || micronutrients.length > 0 || product.source) && (
              <section className="card-soft p-4 mt-5">
                <h2 className="font-serif text-xl mb-3">Información nutricional ampliada</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {product.serving_size && <Info label="Ración oficial" value={product.serving_size} />}
                  {product.serving_grams > 0 && <Info label="Gramos/ración" value={`${product.serving_grams} g`} />}
                  {product.sugars > 0 && <Info label="Azúcares" value={`${product.sugars} g`} />}
                  {product.saturated_fat > 0 && <Info label="Grasas saturadas" value={`${product.saturated_fat} g`} />}
                  {product.salt > 0 && <Info label="Sal" value={`${product.salt} g`} />}
                  <Info label="Estado" value={product.verification_status} />
                  {product.nutrition_verified_at && <Info label="Verificado el" value={new Date(product.nutrition_verified_at).toLocaleDateString("es-ES")} />}
                  {product.source && <Info label="Fuente" value={product.source} />}
                  {micronutrients.map(([key, value]) => <Info key={key} label={key.replace(/_/g, " ")} value={String(value)} />)}
                </div>
                {product.label_file_url && (
                  <a href={product.label_file_url} target="_blank" rel="noreferrer" className="btn-secondary mt-3 w-max">
                    <FileText className="h-4 w-4" /> Ver etiqueta oficial
                  </a>
                )}
              </section>
            )}
          </>
        );
      case "benefits":
        return <ContentBlock title="Beneficios" value={product.benefits} />;
      case "usage":
        return <ContentBlock title="Modo de empleo" value={product.usage} />;
      case "ingredients":
        return <ContentBlock title="Ingredientes" value={product.ingredients_text} />;
      case "observations":
        return <ContentBlock title="Observaciones" value={product.observations} />;
      case "free_text":
        return <ContentBlock title="Información adicional" value={product.free_text} />;
      case "measures":
        return product.product_measures.length > 0 ? (
          <section className="card-soft p-4">
            <h2 className="font-serif text-xl mb-3">Medidas habituales</h2>
            <div className="space-y-2">
              {product.product_measures
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map(measure => (
                  <div key={measure.id} className="rounded-2xl bg-secondary p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="font-medium">{measure.name}</div>
                      <div className="text-xs muted">{measure.grams} g {measure.is_default ? "· principal" : ""}</div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-[11px] text-center">
                      <Stat label="Kcal" value={measure.calories} />
                      <Stat label="Prot" value={`${measure.protein}g`} />
                      <Stat label="Hidr" value={`${measure.carbs}g`} />
                      <Stat label="Grasa" value={`${measure.fat}g`} />
                      <Stat label="Fibra" value={`${measure.fiber}g`} />
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null;
      case "spoon_image":
        return product.spoon_image_url ? (
          <section className="card-soft p-4">
            <h2 className="font-serif text-xl mb-3">Cuchara oficial Herbalife</h2>
            <div className="mb-3 rounded-2xl border border-primary bg-white/90 p-3 text-sm font-medium text-foreground flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-primary shrink-0" />
              <span>Pulsa aquí para comprobar la medida de la cuchara oficial.</span>
            </div>
            <a href={product.spoon_image_url} target="_blank" rel="noreferrer" className="block">
              <img src={product.spoon_image_url} alt="Equivalencia cuchara Herbalife" className="w-full rounded-2xl" />
            </a>
          </section>
        ) : null;
      case "gallery":
        return product.gallery_urls.length > 0 ? (
          <section>
            <h2 className="font-serif text-xl mb-3">Galería</h2>
            <div className="grid grid-cols-2 gap-3">
              {product.gallery_urls.map((url, index) => (
                <img key={`${url}-${index}`} src={url} alt="" className="w-full h-40 object-cover rounded-2xl shadow-sm" />
              ))}
            </div>
          </section>
        ) : null;
      case "videos":
        return product.video_urls.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-serif text-xl">Vídeos</h2>
            {product.video_urls.map((url, index) => (
              <div key={`${url}-${index}`} className="overflow-hidden rounded-2xl bg-black">
                {isEmbeddable(url) ? (
                  <div className="aspect-video">
                    <iframe src={toEmbed(url)} className="h-full w-full" allowFullScreen />
                  </div>
                ) : (
                  <video src={url} controls className="w-full" />
                )}
              </div>
            ))}
          </section>
        ) : null;
      case "pdfs":
        return product.pdf_urls.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-serif text-xl">PDFs</h2>
            {product.pdf_urls.map((url, index) => (
              <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="card-soft p-4 flex items-center gap-3 hover:shadow-glow transition">
                <div className="h-10 w-10 rounded-xl bg-gradient-rosa text-white grid place-items-center"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">Abrir PDF {index + 1}</div>
                  <div className="text-xs muted truncate">{url}</div>
                </div>
              </a>
            ))}
          </section>
        ) : null;
      case "external_urls":
        return product.external_urls.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-serif text-xl">Enlaces</h2>
            {product.external_urls.map((url, index) => (
              <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="card-soft p-4 flex items-center gap-3 hover:shadow-glow transition">
                <ExternalLink className="h-5 w-5 text-primary" />
                <span className="text-sm truncate">{url}</span>
              </a>
            ))}
          </section>
        ) : null;
    }
  };

  return (
    <article className="pb-8 space-y-5">
      <BackButton fallbackTo="/app/productos" className="text-sm muted inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      {blockOrder.map(blockId => {
        const block = renderBlock(blockId);
        return block ? <div key={blockId}>{block}</div> : null;
      })}

    </article>
  );
}

function normalizeProduct(item: any): Product {
  return {
    ...item,
    gallery_urls: asArray(item.gallery_urls),
    video_urls: asArray(item.video_urls),
    pdf_urls: asArray(item.pdf_urls),
    external_urls: asArray(item.external_urls),
    calories: toNumber(item.calories),
    protein: toNumber(item.protein),
    carbs: toNumber(item.carbs),
    fat: toNumber(item.fat),
    saturated_fat: toNumber(item.saturated_fat),
    fiber: toNumber(item.fiber),
    sugars: toNumber(item.sugars),
    salt: toNumber(item.salt),
    serving_size: item.serving_size ?? null,
    serving_grams: toNumber(item.serving_grams),
    serving_calories: toNumber(item.serving_calories),
    serving_protein: toNumber(item.serving_protein),
    serving_carbs: toNumber(item.serving_carbs),
    serving_sugars: toNumber(item.serving_sugars),
    serving_fat: toNumber(item.serving_fat),
    serving_saturated_fat: toNumber(item.serving_saturated_fat),
    serving_fiber: toNumber(item.serving_fiber),
    serving_salt: toNumber(item.serving_salt),
    nutrition_verified_at: item.nutrition_verified_at ?? null,
    label_file_url: item.label_file_url ?? null,
    micronutrients: item.micronutrients ?? {},
    source: item.source ?? null,
    verification_status: item.verification_status === "verificado" ? "verificado" : "pendiente",
    product_measures: Array.isArray(item.product_measures)
      ? item.product_measures.map((measure: any) => ({
        ...measure,
        grams: toNumber(measure.grams),
        calories: toNumber(measure.calories),
        protein: toNumber(measure.protein),
        carbs: toNumber(measure.carbs),
        fat: toNumber(measure.fat),
        fiber: toNumber(measure.fiber),
        sort_order: toNumber(measure.sort_order),
      }))
      : [],
  };
}

function ContentBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <section className="card-soft p-4">
      <h2 className="font-serif text-xl mb-2">{title}</h2>
      <p className="whitespace-pre-wrap leading-relaxed text-sm">{value}</p>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-3">
      <div className="text-[10px] muted uppercase tracking-wide">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="nutrition-stat">
      <div className="font-semibold">{value ?? "—"}</div>
      <div className="muted text-[9px] uppercase tracking-wide">{label}</div>
    </div>
  );
}
