import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";

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
  fiber: number;
  sugars: number;
  salt: number;
  micronutrients: Record<string, unknown>;
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

  const micronutrients = Object.entries(product.micronutrients ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== "");

  return (
    <article className="pb-8 space-y-5">
      <BackButton fallbackTo="/app/productos" className="text-sm muted inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      <header className="challenge-premium rounded-[28px] overflow-hidden relative min-h-[280px] text-white">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-fuchsia-400 to-purple-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
        <div className="relative p-5 min-h-[280px] flex flex-col justify-end">
          <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/80">{category?.name ?? "Producto"}</div>
          <h1 className="font-serif text-4xl leading-none mt-1">{product.name}</h1>
          {product.description && <p className="text-sm text-white/82 mt-3 leading-relaxed">{product.description}</p>}
        </div>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
        <Stat label="Kcal/100g" value={product.calories} />
        <Stat label="Proteínas" value={`${product.protein}g`} />
        <Stat label="Hidratos" value={`${product.carbs}g`} />
        <Stat label="Grasas" value={`${product.fat}g`} />
        <Stat label="Fibra" value={`${product.fiber}g`} />
      </section>

      <ContentBlock title="Beneficios" value={product.benefits} />
      <ContentBlock title="Modo de empleo" value={product.usage} />
      <ContentBlock title="Ingredientes" value={product.ingredients_text} />
      <ContentBlock title="Observaciones" value={product.observations} />
      <ContentBlock title="Información adicional" value={product.free_text} />

      {(product.sugars > 0 || product.salt > 0 || micronutrients.length > 0) && (
        <section className="card-soft p-4">
          <h2 className="font-serif text-xl mb-3">Información nutricional ampliada</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {product.sugars > 0 && <Info label="Azúcares" value={`${product.sugars} g`} />}
            {product.salt > 0 && <Info label="Sal" value={`${product.salt} g`} />}
            {micronutrients.map(([key, value]) => <Info key={key} label={key.replace(/_/g, " ")} value={String(value)} />)}
          </div>
        </section>
      )}

      {product.product_measures.length > 0 && (
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
      )}

      {product.spoon_image_url && (
        <section className="card-soft p-4">
          <h2 className="font-serif text-xl mb-3">Cuchara oficial Herbalife</h2>
          <img src={product.spoon_image_url} alt="Equivalencia cuchara Herbalife" className="w-full rounded-2xl" />
        </section>
      )}

      {product.gallery_urls.length > 0 && (
        <section>
          <h2 className="font-serif text-xl mb-3">Galería</h2>
          <div className="grid grid-cols-2 gap-3">
            {product.gallery_urls.map((url, index) => (
              <img key={`${url}-${index}`} src={url} alt="" className="w-full h-40 object-cover rounded-2xl shadow-sm" />
            ))}
          </div>
        </section>
      )}

      {product.video_urls.length > 0 && (
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
      )}

      {product.pdf_urls.length > 0 && (
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
      )}

      {product.external_urls.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-serif text-xl">Enlaces</h2>
          {product.external_urls.map((url, index) => (
            <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="card-soft p-4 flex items-center gap-3 hover:shadow-glow transition">
              <ExternalLink className="h-5 w-5 text-primary" />
              <span className="text-sm truncate">{url}</span>
            </a>
          ))}
        </section>
      )}
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
    fiber: toNumber(item.fiber),
    sugars: toNumber(item.sugars),
    salt: toNumber(item.salt),
    micronutrients: item.micronutrients ?? {},
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
