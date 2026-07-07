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
const formatGrams = (value: number) => Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
const formatNumeric = (value: number) => Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
const formatKcalValue = (value: number) => `${formatNumeric(value)}`;
const formatGramValue = (value: number) => `${formatNumeric(value)}g`;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isGenericGramMeasure(name: string) {
  const normalized = normalizeText(name);
  return /^(gramos?|100\s*(g|gr|gramos?))$/.test(normalized);
}

function isAloeMaxProduct(product: Pick<Product, "name">) {
  const normalized = normalizeText(product.name);
  return normalized.includes("aloe") && normalized.includes("max");
}

function measureHasNutrition(measure: ProductMeasure) {
  return [measure.calories, measure.protein, measure.carbs, measure.fat, measure.fiber].some(value => Number(value) > 0);
}

function shouldShowMeasure(measure: ProductMeasure) {
  if (measureHasNutrition(measure)) return true;
  return !isGenericGramMeasure(measure.name);
}

function officialAloeMaxMeasures(): ProductMeasure[] {
  return [
    {
      id: "aloe-max-100ml",
      name: "100 ml",
      grams: 100,
      calories: 13,
      protein: 0,
      carbs: 2.9,
      fat: 0,
      fiber: 0,
      is_default: true,
      sort_order: 0,
    },
    {
      id: "aloe-max-15ml",
      name: "15 ml / ración",
      grams: 15,
      calories: 2,
      protein: 0,
      carbs: 0.4,
      fat: 0,
      fiber: 0,
      is_default: false,
      sort_order: 1,
    },
  ];
}

function getDisplayMeasures(product: Product) {
  if (isAloeMaxProduct(product)) return officialAloeMaxMeasures();
  return product.product_measures
    .filter(shouldShowMeasure)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function nutritionBaseLabel(product: Product) {
  const measureNames = product.product_measures.map(measure => measure.name).join(" ");
  if (/\bml\b/i.test(`${product.serving_size ?? ""} ${measureNames}`)) return "100 ml";
  return "100 g";
}

function servingQuantityUnit(product: Product) {
  return nutritionBaseLabel(product) === "100 ml" ? "ml" : "g";
}

function formatMeasureName(measure: ProductMeasure, product: Product) {
  const measureName = String(measure.name ?? "").trim();
  const servingSize = String(product.serving_size ?? "").trim();
  const servingLabel = /raci[oó]n|serving/i.test(servingSize) ? servingSize : "1 ración";

  if (measure.is_default && isGenericGramMeasure(measureName)) return servingLabel;
  return measureName || servingLabel;
}

function formatMeasureSubtitle(measure: ProductMeasure, product: Product) {
  const measureName = String(measure.name ?? "").trim();
  const servingSize = String(product.serving_size ?? "").trim();
  const explicitUnit = measureName.match(/^\d+(?:[.,]\d+)?\s*(?:g|gr|gramos?|ml|raci[oó]n|raciones|serving)\b/i)?.[0];
  const isServingMeasure = /raci[oó]n|serving/i.test(measureName);
  const isGenericDefaultMeasure = measure.is_default && isGenericGramMeasure(measureName);

  if (measure.is_default && (isServingMeasure || isGenericDefaultMeasure)) {
    const servingLabel = /raci[oó]n|serving/i.test(servingSize) ? servingSize : explicitUnit ?? "1 ración";
    const grams = product.serving_grams > 0 ? `${formatGrams(product.serving_grams)} g` : "";
    return ["principal", grams].filter(Boolean).join(" · ");
  }

  if (measure.is_default && explicitUnit) return `${explicitUnit} · principal`;
  if (explicitUnit) return explicitUnit;

  return `${formatGrams(measure.grams)} g${measure.is_default ? " · principal" : ""}`;
}

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
  | "free_text"
  | "nutrition"
  | "measures";

const PRODUCT_BLOCK_ORDER_KEY = "__product_block_order";
const PRODUCT_BENEFITS_PDF_KEY = "__product_benefits_pdf_url";
const PRODUCT_IMPORTANT_PDF_KEY = "__product_important_pdf_url";
const PRODUCT_SHORT_DESCRIPTION_KEY = "__product_short_description";
const INTERNAL_PRODUCT_META_KEYS = new Set([
  PRODUCT_BLOCK_ORDER_KEY,
  PRODUCT_BENEFITS_PDF_KEY,
  PRODUCT_IMPORTANT_PDF_KEY,
  PRODUCT_SHORT_DESCRIPTION_KEY,
]);

const DEFAULT_PRODUCT_BLOCK_ORDER: ProductBlockId[] = [
  "main_image",
  "description",
  "nutrition",
  "benefits",
  "usage",
  "ingredients",
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
  INTERNAL_PRODUCT_META_KEYS.forEach(key => delete next[key]);
  return next;
}

function getProductMetaUrl(micronutrients: Record<string, unknown> | null | undefined, key: string) {
  const value = micronutrients?.[key];
  return typeof value === "string" ? value : "";
}

function getProductMetaText(micronutrients: Record<string, unknown> | null | undefined, key: string) {
  const value = micronutrients?.[key];
  return typeof value === "string" ? value : "";
}

function buildShortDescription(description?: string | null) {
  const clean = String(description ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= 240) return clean;
  return `${clean.slice(0, 237).trim()}…`;
}

function mergeImportantText(freeText?: string | null, observations?: string | null) {
  const important = String(freeText ?? "").trim();
  const legacyObservations = String(observations ?? "").trim();
  if (!legacyObservations) return important;
  if (!important) return legacyObservations;
  if (important.includes(legacyObservations)) return important;
  return `${important}\n\n${legacyObservations}`;
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
  const displayMeasures = getDisplayMeasures(product);
  const nutritionBase = nutritionBaseLabel(product);
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
              <div className="flex flex-wrap gap-2 mt-5">
                {product.label_file_url && (
                  <a href={product.label_file_url} target="_blank" rel="noreferrer" className="product-detail-label-link">
                    <FileText className="h-3.5 w-3.5" /> Ver etiqueta oficial
                  </a>
                )}
              </div>
            </div>
          </header>
        );
      case "description":
        return (
          <DescriptionBlock
            shortValue={getProductMetaText(product.micronutrients, PRODUCT_SHORT_DESCRIPTION_KEY) || buildShortDescription(product.description)}
            fullValue={product.description}
          />
        );
      case "nutrition":
        return (
          <>
            {hasNutrition ? (
              <section className="card-soft p-4">
                <h2 className="font-serif text-xl mb-3">Información nutricional</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <Stat label={`Kcal/${nutritionBase}`} value={formatKcalValue(product.calories)} />
                  <Stat label="Proteínas" value={formatGramValue(product.protein)} />
                  <Stat label="Hidratos" value={formatGramValue(product.carbs)} />
                  <Stat label="Grasas" value={formatGramValue(product.fat)} />
                  <Stat label="Grasas saturadas" value={formatGramValue(product.saturated_fat)} />
                  <Stat label="Fibra" value={formatGramValue(product.fiber)} />
                  <Stat label="Azúcares" value={formatGramValue(product.sugars)} />
                  <Stat label="Sal" value={formatGramValue(product.salt)} />
                </div>
              </section>
            ) : null}
            {(product.serving_size || product.serving_grams > 0 || micronutrients.length > 0 || product.label_file_url) && (
              <section className="card-soft p-4 mt-5">
                <h2 className="font-serif text-xl mb-3">Información del producto</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {product.serving_size && <Info label="Ración oficial" value={product.serving_size} />}
                  {product.serving_grams > 0 && <Info label={servingQuantityUnit(product) === "ml" ? "Cantidad/ración" : "Gramos/ración"} value={`${formatGrams(product.serving_grams)} ${servingQuantityUnit(product)}`} />}
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
        return <ContentBlock title="Beneficios" value={product.benefits} pdfUrl={getProductMetaUrl(product.micronutrients, PRODUCT_BENEFITS_PDF_KEY)} />;
      case "usage":
        return <ContentBlock title="Modo de empleo" value={product.usage} />;
      case "ingredients":
        return <ContentBlock title="Ingredientes" value={product.ingredients_text} />;
      case "free_text":
        return <ContentBlock title="Información importante" value={mergeImportantText(product.free_text, product.observations)} pdfUrl={getProductMetaUrl(product.micronutrients, PRODUCT_IMPORTANT_PDF_KEY)} />;
      case "measures":
        return displayMeasures.length > 0 ? (
          <section className="card-soft p-4">
            <h2 className="font-serif text-xl mb-3">Medidas habituales</h2>
            <div className="space-y-2">
              {displayMeasures.map(measure => (
                  <div key={measure.id} className="rounded-2xl bg-secondary p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="font-medium">{formatMeasureName(measure, product)}</div>
                      <div className="text-xs muted">{formatMeasureSubtitle(measure, product)}</div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-[11px] text-center">
                      <Stat label="Kcal" value={formatKcalValue(measure.calories)} />
                      <Stat label="Prot" value={formatGramValue(measure.protein)} />
                      <Stat label="Hidr" value={formatGramValue(measure.carbs)} />
                      <Stat label="Grasa" value={formatGramValue(measure.fat)} />
                      <Stat label="Fibra" value={formatGramValue(measure.fiber)} />
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null;
      case "spoon_image":
        return product.spoon_image_url ? <SpoonImageBlock imageUrl={product.spoon_image_url} /> : null;
      case "gallery":
        return product.gallery_urls.length > 0 ? <GalleryBlock urls={product.gallery_urls} /> : null;
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
    <article className="product-detail-page pb-8 space-y-5">
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
  const product: Product = {
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

  if (!isAloeMaxProduct(product)) return product;

  return {
    ...product,
    calories: 13,
    protein: 0,
    carbs: 2.9,
    fat: 0,
    saturated_fat: 0,
    fiber: 0,
    sugars: 2.2,
    salt: 0,
    serving_size: "15 ml / ración",
    serving_grams: 15,
    serving_calories: 2,
    serving_protein: 0,
    serving_carbs: 0.4,
    serving_sugars: 0.3,
    serving_fat: 0,
    serving_saturated_fat: 0,
    serving_fiber: 0,
    serving_salt: 0,
    verification_status: "verificado",
    source: product.label_file_url ? "Etiqueta oficial / PDF oficial" : product.source,
    product_measures: officialAloeMaxMeasures(),
  };
}

function DescriptionBlock({ shortValue, fullValue }: { shortValue: string; fullValue: string | null }) {
  const [open, setOpen] = useState(false);
  const shortText = String(shortValue ?? "").trim();
  const fullText = String(fullValue ?? "").trim();
  const textToShow = fullText || shortText;

  if (!textToShow) return null;

  return (
    <section className="card-soft p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-serif text-xl">Descripción</h2>
        <button type="button" className="btn-secondary w-max" onClick={() => setOpen(prev => !prev)}>
          {open ? "Ocultar descripción" : "Ver descripción"}
        </button>
      </div>
      {open && (
        <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
          <p className="whitespace-pre-wrap leading-relaxed text-sm">{textToShow}</p>
        </div>
      )}
    </section>
  );
}

function SpoonImageBlock({ imageUrl }: { imageUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card-soft p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-serif text-xl">Cuchara oficial Herbalife</h2>
        <button type="button" className="btn-secondary w-max" onClick={() => setOpen(prev => !prev)}>
          {open ? "Ocultar cuchara oficial" : "Ver cuchara oficial"}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <div className="mb-3 rounded-2xl border border-primary bg-white/90 p-3 text-sm font-medium text-foreground flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary shrink-0" />
            <span>Pulsa aquí para comprobar la medida de la cuchara oficial.</span>
          </div>
          <a href={imageUrl} target="_blank" rel="noreferrer" className="block">
            <img src={imageUrl} alt="Equivalencia cuchara Herbalife" className="w-full max-h-[60vh] object-contain rounded-2xl" />
          </a>
        </div>
      )}
    </section>
  );
}

function GalleryBlock({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card-soft p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-serif text-xl">Galería</h2>
        <button type="button" className="btn-secondary w-max" onClick={() => setOpen(prev => !prev)}>
          {open ? "Ocultar galería" : "Ver galería"}
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-3 mt-3 pb-4">
          {urls.map((url, index) => (
            <img key={`${url}-${index}`} src={url} alt="" className="w-full h-40 object-cover rounded-2xl shadow-sm" />
          ))}
        </div>
      )}
    </section>
  );
}

function ContentBlock({ title, value, pdfUrl }: { title: string; value: string | null; pdfUrl?: string }) {
  if (!value && !pdfUrl) return null;
  return (
    <section className="card-soft p-4">
      <h2 className="font-serif text-xl mb-2">{title}</h2>
      {value && <p className="whitespace-pre-wrap leading-relaxed text-sm">{value}</p>}
      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary mt-3 w-max">
          <FileText className="h-4 w-4" /> Ver PDF
        </a>
      )}
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
