import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { selectInitialZero, type AdminNumberValue } from "@/lib/adminNumberInput";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileText, Image as ImageIcon, Link as LinkIcon, MousePointerClick, Pencil, Plus, Save, Search, Trash2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import imgNutritionInternal from "@/assets/product-admin/nutricion-interna.jpg";
import imgNutritionObjective from "@/assets/product-admin/nutricion-objetiva-soft.jpg";
import imgNutritionExternal from "@/assets/product-admin/nutricion-externa-beige.png";
import imgInternalEssentials from "@/assets/product-admin/nutricion-interna-esenciales.jpg";
import imgInternalWeightControl from "@/assets/product-admin/nutricion-interna-control-peso.jpg";

type ProductCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type ProductMeasure = {
  id?: string;
  name: string;
  grams: AdminNumberValue;
  calories: AdminNumberValue;
  protein: AdminNumberValue;
  carbs: AdminNumberValue;
  fat: AdminNumberValue;
  saturated_fat?: AdminNumberValue;
  fiber: AdminNumberValue;
  sugars?: AdminNumberValue;
  salt?: AdminNumberValue;
  source: string;
  verification_status: "verificado" | "pendiente";
  is_default: boolean;
  sort_order: number;
};

type Product = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  category_id: string | null;
  name: string;
  slug: string;
  aliases: string[];
  line: string | null;
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
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  saturated_fat: number | null;
  fiber: number | null;
  sugars: number | null;
  salt: number | null;
  serving_size: string | null;
  serving_grams: number | null;
  serving_calories: number | null;
  serving_protein: number | null;
  serving_carbs: number | null;
  serving_sugars: number | null;
  serving_fat: number | null;
  serving_saturated_fat: number | null;
  serving_fiber: number | null;
  serving_salt: number | null;
  kcal_per_gram: number | null;
  protein_per_gram: number | null;
  carbs_per_gram: number | null;
  fat_per_gram: number | null;
  fiber_per_gram: number | null;
  micronutrients: Record<string, unknown>;
  source: string;
  verification_status: "verificado" | "pendiente";
  nutrition_effective_from: string | null;
  nutrition_verified_at: string | null;
  label_file_url: string | null;
  is_active: boolean;
  visible_to_clients: boolean;
  available_for_recipes: boolean;
  informative_only: boolean;
  herbalife_spoon_measure_id: string | null;
  spoon_image_url: string | null;
  sort_order: number;
  product_measures?: ProductMeasure[];
};

type ProductForm = Omit<Product, "id" | "slug" | "product_measures" | "calories" | "protein" | "carbs" | "fat" | "saturated_fat" | "fiber" | "sugars" | "salt" | "serving_grams" | "serving_calories" | "serving_protein" | "serving_carbs" | "serving_sugars" | "serving_fat" | "serving_saturated_fat" | "serving_fiber" | "serving_salt" | "kcal_per_gram" | "protein_per_gram" | "carbs_per_gram" | "fat_per_gram" | "fiber_per_gram" | "sort_order"> & {
  id?: string;
  calories: AdminNumberValue;
  protein: AdminNumberValue;
  carbs: AdminNumberValue;
  fat: AdminNumberValue;
  saturated_fat: AdminNumberValue;
  fiber: AdminNumberValue;
  sugars: AdminNumberValue;
  salt: AdminNumberValue;
  serving_grams: AdminNumberValue;
  serving_calories: AdminNumberValue;
  serving_protein: AdminNumberValue;
  serving_carbs: AdminNumberValue;
  serving_sugars: AdminNumberValue;
  serving_fat: AdminNumberValue;
  serving_saturated_fat: AdminNumberValue;
  serving_fiber: AdminNumberValue;
  serving_salt: AdminNumberValue;
  kcal_per_gram: AdminNumberValue;
  protein_per_gram: AdminNumberValue;
  carbs_per_gram: AdminNumberValue;
  fat_per_gram: AdminNumberValue;
  fiber_per_gram: AdminNumberValue;
  sort_order: AdminNumberValue;
  aliasesText: string;
  micronutrientsText: string;
  blockOrder: ProductBlockId[];
  measures: ProductMeasure[];
};

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
const DELETE_ELEMENT_CONFIRMATION = "¿Seguro que deseas eliminar este elemento?";
const IMAGE_FILE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
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

const PRODUCT_BLOCK_LABELS: Record<ProductBlockId, string> = {
  main_image: "Imagen principal",
  spoon_image: "Imagen cuchara oficial",
  gallery: "Galería de imágenes",
  videos: "Vídeos",
  pdfs: "PDFs",
  external_urls: "URLs externas",
  description: "Descripción",
  benefits: "Beneficios",
  usage: "Modo de empleo",
  ingredients: "Ingredientes",
  free_text: "Información importante",
  nutrition: "Información nutricional",
  measures: "Medidas habituales",
};

const PRODUCT_MEASURE_NAME_OPTIONS = [
  { label: "100 g", grams: 100 },
  { label: "50 g", grams: 50 },
  { label: "25 g", grams: 25 },
  { label: "100 ml", grams: 100 },
  { label: "50 ml", grams: 50 },
  { label: "25 ml", grams: 25 },
  { label: "1 ración", grams: null },
];

const MAX_PRODUCT_MEASURES = 2;
const NUTRIENT_QUICK_STEPS = [-50, -10, -1, 1, 10, 50];

const PRODUCT_ADMIN_ACCESS_SECTIONS = [
  { id: "nutricion-interna", title: "Nutrición interna", image: imgNutritionInternal },
  { id: "nutricion-objetiva", title: "Nutrición y Salud", image: imgNutritionObjective },
  { id: "nutricion-externa", title: "Nutrición externa", image: imgNutritionExternal },
] as const;

const INTERNAL_NUTRITION_SECTION_ID = "nutricion-interna";
const INTERNAL_NUTRITION_SUBCATEGORIES = [
  { id: "esenciales", title: "Esenciales", image: imgInternalEssentials },
  { id: "control-de-peso", title: "Control de peso", image: imgInternalWeightControl },
] as const;

const ensureAdminAccessCategories = async (loadedCategories: ProductCategory[]) => {
  const existingSlugs = new Set(loadedCategories.map(category => category.slug));
  const missingCategories = PRODUCT_ADMIN_ACCESS_SECTIONS
    .filter(section => !existingSlugs.has(section.id))
    .map((section, index) => ({
      name: section.title,
      slug: section.id,
      description: `Categoría principal de ${section.title}.`,
      sort_order: (index + 1) * 10,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

  if (!missingCategories.length) return loadedCategories;

  const { error } = await (supabase as any)
    .from("product_categories")
    .upsert(missingCategories, { onConflict: "slug" });

  if (error) {
    toast.error(error.message);
    return loadedCategories;
  }

  const { data, error: refreshError } = await (supabase as any)
    .from("product_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (refreshError) {
    toast.error(refreshError.message);
    return loadedCategories;
  }

  return (data ?? []) as ProductCategory[];
};

const emptyMeasure: ProductMeasure = {
  name: "100 g",
  grams: 100,
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  saturated_fat: "",
  fiber: "",
  sugars: "",
  salt: "",
  source: "Pendiente de etiqueta oficial",
  verification_status: "pendiente",
  is_default: true,
  sort_order: 0,
};

const emptyProduct: ProductForm = {
  category_id: "",
  name: "",
  aliases: [],
  aliasesText: "",
  line: "",
  image_url: "",
  gallery_urls: [],
  video_urls: [],
  pdf_urls: [],
  external_urls: [],
  description: "",
  benefits: "",
  usage: "",
  ingredients_text: "",
  observations: "",
  free_text: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  saturated_fat: "",
  fiber: "",
  sugars: "",
  salt: "",
  serving_size: "",
  serving_grams: "",
  serving_calories: "",
  serving_protein: "",
  serving_carbs: "",
  serving_sugars: "",
  serving_fat: "",
  serving_saturated_fat: "",
  serving_fiber: "",
  serving_salt: "",
  kcal_per_gram: "",
  protein_per_gram: "",
  carbs_per_gram: "",
  fat_per_gram: "",
  fiber_per_gram: "",
  micronutrients: {},
  micronutrientsText: "{}",
  blockOrder: DEFAULT_PRODUCT_BLOCK_ORDER,
  source: "Pendiente de etiqueta oficial",
  verification_status: "pendiente",
  nutrition_effective_from: null,
  nutrition_verified_at: null,
  label_file_url: "",
  is_active: true,
  visible_to_clients: true,
  available_for_recipes: true,
  informative_only: false,
  herbalife_spoon_measure_id: null,
  spoon_image_url: "",
  sort_order: 0,
  measures: [emptyMeasure],
};

const slugify = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `producto-${Date.now()}`;

const sectionSlug = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const toNumber = (value: unknown) => Number(String(value ?? "").replace(",", ".")) || 0;
const toNullableNumber = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const toFormNumber = (value: unknown): AdminNumberValue => value === null || value === undefined ? "" : toNumber(value);
const asTextArray = (value: unknown): string[] => Array.isArray(value) ? value.filter(Boolean).map(String) : [];
const textToArray = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
const round4 = (value: number | null) => value === null ? "" : Math.round(value * 10000) / 10000;

function readProductBlockOrder(micronutrients: Record<string, unknown> | null | undefined): ProductBlockId[] {
  const rawOrder = micronutrients?.[PRODUCT_BLOCK_ORDER_KEY];
  const validIds = new Set(DEFAULT_PRODUCT_BLOCK_ORDER);
  const saved = Array.isArray(rawOrder) ? rawOrder.filter((id): id is ProductBlockId => typeof id === "string" && validIds.has(id as ProductBlockId)) : [];
  return [...saved, ...DEFAULT_PRODUCT_BLOCK_ORDER.filter(id => !saved.includes(id))];
}

function micronutrientsForEditor(micronutrients: Record<string, unknown> | null | undefined) {
  const next = { ...(micronutrients ?? {}) };
  INTERNAL_PRODUCT_META_KEYS.forEach(key => delete next[key]);
  return next;
}

function hiddenProductMeta(micronutrients: Record<string, unknown> | null | undefined) {
  const hidden: Record<string, unknown> = {};
  INTERNAL_PRODUCT_META_KEYS.forEach(key => {
    const value = micronutrients?.[key];
    if (value !== undefined && value !== null && value !== "") hidden[key] = value;
  });
  return hidden;
}

function getProductMetaUrl(micronutrients: Record<string, unknown> | null | undefined, key: string) {
  const value = micronutrients?.[key];
  return typeof value === "string" ? value : "";
}

function getProductMetaText(micronutrients: Record<string, unknown> | null | undefined, key: string) {
  const value = micronutrients?.[key];
  return typeof value === "string" ? value : "";
}

function setProductMetaText(micronutrients: Record<string, unknown> | null | undefined, key: string, value: string) {
  const next = { ...(micronutrients ?? {}) };
  const clean = value.trim();
  if (clean) next[key] = clean;
  else delete next[key];
  return next;
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

function splitContentItems(value?: string | null) {
  return String(value ?? "")
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function moveBlockOrder(order: ProductBlockId[], blockId: ProductBlockId, direction: -1 | 1) {
  const index = order.indexOf(blockId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function measureFromProductNutrition(measure: ProductMeasure, product: ProductForm): ProductMeasure {
  const grams = toNumber(measure.grams);
  const factor = grams / 100;
  const scale = (value: AdminNumberValue) => {
    const parsed = toNullableNumber(value);
    return parsed === null ? "" : parsed * factor;
  };
  return {
    ...measure,
    calories: scale(product.calories),
    protein: scale(product.protein),
    carbs: scale(product.carbs),
    fat: scale(product.fat),
    saturated_fat: scale(product.saturated_fat),
    fiber: scale(product.fiber),
    sugars: scale(product.sugars),
    salt: scale(product.salt),
  };
}

function measuresFromProductNutrition(measures: ProductMeasure[], product: ProductForm) {
  return measures.map(measure => measureFromProductNutrition(measure, product));
}

function limitProductMeasures(measures: ProductMeasure[]) {
  return measures.slice(0, MAX_PRODUCT_MEASURES).map((measure, index) => ({ ...measure, sort_order: index }));
}

function nutritionFromServing(form: ProductForm) {
  const servingGrams = toNullableNumber(form.serving_grams);
  if (!servingGrams || servingGrams <= 0) return form;
  const scale = (value: AdminNumberValue) => {
    const parsed = toNullableNumber(value);
    return parsed === null ? "" : (parsed / servingGrams) * 100;
  };
  const next = {
    ...form,
    calories: toNullableNumber(form.calories) === null ? scale(form.serving_calories) : form.calories,
    protein: toNullableNumber(form.protein) === null ? scale(form.serving_protein) : form.protein,
    carbs: toNullableNumber(form.carbs) === null ? scale(form.serving_carbs) : form.carbs,
    sugars: toNullableNumber(form.sugars) === null ? scale(form.serving_sugars) : form.sugars,
    fat: toNullableNumber(form.fat) === null ? scale(form.serving_fat) : form.fat,
    saturated_fat: toNullableNumber(form.saturated_fat) === null ? scale(form.serving_saturated_fat) : form.saturated_fat,
    fiber: toNullableNumber(form.fiber) === null ? scale(form.serving_fiber) : form.fiber,
    salt: toNullableNumber(form.salt) === null ? scale(form.serving_salt) : form.salt,
  };
  return { ...next, measures: measuresFromProductNutrition(next.measures, next) };
}

function perGram(value: AdminNumberValue, servingValue?: AdminNumberValue, servingGrams?: AdminNumberValue) {
  const per100 = toNullableNumber(value);
  if (per100 !== null) return round4(per100 / 100);
  const portion = toNullableNumber(servingValue);
  const grams = toNullableNumber(servingGrams);
  if (portion !== null && grams && grams > 0) return round4(portion / grams);
  return "";
}

async function uploadProductFile(file: File, folder: string) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("product-media").getPublicUrl(path);
  return data.publicUrl;
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileNameFromUrl(url: string) {
  const clean = url.split("?")[0] ?? "";
  const raw = clean.split("/").pop() || "etiqueta.pdf";
  return decodeURIComponent(raw.replace(/^[a-f0-9-]{36}-/i, ""));
}

function mimeTypeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

const OFFICIAL_LABEL_ACCEPT = "application/pdf,image/jpeg,image/jpg,image/png,image/webp";
const OFFICIAL_LABEL_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

function isOfficialLabelFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const acceptedByType = !file.type || file.type === "application/pdf" || file.type.startsWith("image/");
  const acceptedByName = OFFICIAL_LABEL_EXTENSIONS.some(extension => lowerName.endsWith(extension));
  return acceptedByType && acceptedByName;
}

export default function AdminProducts() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState("");
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [openAccessSection, setOpenAccessSection] = useState<string | null>(null);
  const [activeInternalSubcategory, setActiveInternalSubcategory] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInstanceKey, setEditorInstanceKey] = useState(0);
  const [openEditorBlock, setOpenEditorBlock] = useState("Información general");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState(false);
  const [readingLabel, setReadingLabel] = useState(false);
  const [readingDescriptionPdf, setReadingDescriptionPdf] = useState(false);
  const [readingIngredientsLabel, setReadingIngredientsLabel] = useState(false);
  const keepEditingAfterSave = useRef(false);
  const selectedWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionShortTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const load = async () => {
    setLoading(true);
    const [catRes, prodRes] = await Promise.all([
      (supabase as any).from("product_categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      (supabase as any).from("products").select("*, product_measures(*)").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    ]);
    setLoading(false);
    if (catRes.error) toast.error(catRes.error.message);
    if (prodRes.error) toast.error(prodRes.error.message);
    const safeCategories = catRes.error
      ? ((catRes.data ?? []) as ProductCategory[])
      : await ensureAdminAccessCategories((catRes.data ?? []) as ProductCategory[]);
    setCategories(safeCategories);
    setProducts((prodRes.data ?? []).map(normalizeProduct));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!openAccessSection) return;
    const timer = window.setTimeout(() => {
      const workspace = selectedWorkspaceRef.current;
      if (!workspace) return;
      const rect = workspace.getBoundingClientRect();
      const top = rect.top + window.scrollY - (window.innerWidth < 768 ? 150 : 120);
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [openAccessSection]);

  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const categoryDisplayName = (category?: ProductCategory | null) => {
    if (!category) return "Sin categoría";
    if (category.slug === "nutricion-objetiva" || sectionSlug(category.name) === "nutricion-objetiva" || sectionSlug(category.name) === "nutricion-y-salud") {
      return "Nutrición y Salud";
    }
    return category.name;
  };
  const categoryOptionLabel = (category: ProductCategory) => `${categoryDisplayName(category)}${category.is_active ? "" : " (oculta)"}`;
  const activeAccessSection = PRODUCT_ADMIN_ACCESS_SECTIONS.find(section => section.id === openAccessSection) ?? null;
  const activeAccessCategory = useMemo(() => {
    if (!activeAccessSection) return null;
    return categories.find(category => category.slug === activeAccessSection.id || slugify(category.name) === activeAccessSection.id) ?? null;
  }, [activeAccessSection, categories]);
  const isInternalNutritionCategoryId = (categoryId?: string | null) => {
    const category = categoryId ? categoryById.get(categoryId) : null;
    if (!category) return false;
    return category.slug === INTERNAL_NUTRITION_SECTION_ID || sectionSlug(category.name) === INTERNAL_NUTRITION_SECTION_ID;
  };
  const isInternalNutritionForm = isInternalNutritionCategoryId(form.category_id || activeAccessCategory?.id || "");
  const activeInternalSubcategoryData = INTERNAL_NUTRITION_SUBCATEGORIES.find(subcategory => subcategory.id === activeInternalSubcategory) ?? null;
  const shouldShowProductManagement = openAccessSection !== INTERNAL_NUTRITION_SECTION_ID || Boolean(activeInternalSubcategory);
  const isInternalNutritionLine = (value: unknown) => INTERNAL_NUTRITION_SUBCATEGORIES.some(subcategory => subcategory.id === sectionSlug(value));
  const handleProductCategoryChange = (categoryId: string) => {
    const nextIsInternal = isInternalNutritionCategoryId(categoryId);
    setForm(prev => ({
      ...prev,
      category_id: categoryId,
      line: nextIsInternal ? (isInternalNutritionLine(prev.line) ? prev.line : "") : (isInternalNutritionLine(prev.line) ? "" : prev.line),
    }));
  };

  const filteredProducts = useMemo(() => {
    const normalized = String(query ?? "").trim().toLowerCase();
    return products.filter(product => {
      if (filterCategory && product.category_id !== filterCategory) return false;
      if (openAccessSection === INTERNAL_NUTRITION_SECTION_ID && activeInternalSubcategory) {
        const productSubcategory = sectionSlug(product.line);
        if (productSubcategory !== activeInternalSubcategory) return false;
      }
      if (!normalized) return true;
      const category = product.category_id ? categoryById.get(product.category_id) : null;
      const haystack = [
        product.name,
        category?.name,
        product.line,
        product.description,
        product.benefits,
        product.ingredients_text,
        product.observations,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, query, filterCategory, openAccessSection, activeInternalSubcategory, categoryById]);

  const resetProduct = () => {
    setForm(emptyProduct);
    setEditorOpen(false);
  };
  const scrollToProductEditor = () => {
    window.setTimeout(() => {
      const panel = document.querySelector(".admin-products-new-product-panel");
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const top = rect.top + window.scrollY - (window.innerWidth < 768 ? 14 : 24);
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }, 90);
  };
  const startNewProduct = (categoryId = activeAccessCategory?.id ?? "", scrollToEditor = true) => {
    const internalLine = isInternalNutritionCategoryId(categoryId) && activeInternalSubcategoryData ? activeInternalSubcategoryData.title : "";
    setForm({ ...emptyProduct, category_id: categoryId, line: internalLine });
    if (categoryId) setFilterCategory(categoryId);
    setEditorInstanceKey(key => key + 1);
    setOpenEditorBlock("Información general");
    setEditorOpen(true);
    if (scrollToEditor) scrollToProductEditor();
  };
  const focusProductSearch = () => {
    productSearchInputRef.current?.focus();
    productSearchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const toggleAccessSection = (sectionId: string) => {
    const next = openAccessSection === sectionId ? null : sectionId;
    setOpenAccessSection(next);
    setActiveInternalSubcategory("");
    if (next) {
      const sectionCategory = categories.find(category => category.slug === next || slugify(category.name) === next);
      setFilterCategory(sectionCategory?.id ?? "");
    }
  };
  const resetCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryImageUrl("");
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return toast.error("Escribe el nombre de la categoría");
    const payload = {
      name,
      slug: editingCategory?.slug || slugify(name),
      description: categoryDescription.trim() || null,
      image_url: categoryImageUrl.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const result = editingCategory
      ? await (supabase as any).from("product_categories").update(payload).eq("id", editingCategory.id).select("*").maybeSingle()
      : await (supabase as any).from("product_categories").insert(payload).select("*").maybeSingle();
    if (result.error) return toast.error(result.error.message);
    const savedCategory = result.data as ProductCategory | null;
    if (savedCategory?.id) {
      setCategories(prev => {
        const withoutSaved = prev.filter(category => category.id !== savedCategory.id);
        return [...withoutSaved, savedCategory].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
      });
      if (!editingCategory) {
        setForm(prev => ({ ...prev, category_id: savedCategory.id }));
        setFilterCategory(savedCategory.id);
      }
    }
    toast.success(editingCategory ? "Categoría actualizada" : "Categoría creada");
    resetCategory();
    await load();
  };

  const editCategory = (category: ProductCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description ?? "");
    setCategoryImageUrl(category.image_url ?? "");
  };

  const uploadCategoryImage = async (file: File, category?: ProductCategory) => {
    try {
      setSaving(true);
      const url = await uploadProductFile(file, "categories");
      const targetCategory = category ?? editingCategory;
      if (targetCategory) {
        const { error } = await (supabase as any).from("product_categories").update({ image_url: url, updated_at: new Date().toISOString() }).eq("id", targetCategory.id);
        if (error) throw error;
        toast.success("Imagen de categoría actualizada");
        load();
      }
      setCategoryImageUrl(url);
    } catch (err: any) {
      toast.error(err?.message || "No se pudo subir la imagen");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (category: ProductCategory) => {
    const { error } = await (supabase as any).from("product_categories").update({ is_active: !category.is_active }).eq("id", category.id);
    if (error) toast.error(error.message);
    else load();
  };

  const deleteCategory = async (category: ProductCategory) => {
    if (!confirm(`¿Eliminar la categoría "${category.name}"? Los productos quedarán sin categoría, no se borrarán.`)) return;
    const { error } = await (supabase as any).from("product_categories").delete().eq("id", category.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Categoría eliminada");
      load();
    }
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error("Escribe el nombre del producto");
    let micronutrients: Record<string, unknown> = {};
    try {
      micronutrients = form.micronutrientsText.trim() ? JSON.parse(form.micronutrientsText) : {};
    } catch {
      return toast.error("Los micronutrientes deben estar en formato JSON válido");
    }

    setSaving(true);
    const preparedForm = nutritionFromServing({
      ...form,
      category_id: form.category_id || activeAccessCategory?.id || "",
    });
    const wasEditingProduct = Boolean(form.id);
    const nextProductCategoryId = preparedForm.category_id || activeAccessCategory?.id || "";
    const isInternalProduct = isInternalNutritionCategoryId(nextProductCategoryId);
    if (isInternalProduct && !isInternalNutritionLine(preparedForm.line)) {
      setSaving(false);
      return toast.error("Selecciona la subcategoría de Nutrición interna");
    }
    const kcalPerGram = perGram(preparedForm.calories, preparedForm.serving_calories, preparedForm.serving_grams);
    const proteinPerGram = perGram(preparedForm.protein, preparedForm.serving_protein, preparedForm.serving_grams);
    const carbsPerGram = perGram(preparedForm.carbs, preparedForm.serving_carbs, preparedForm.serving_grams);
    const fatPerGram = perGram(preparedForm.fat, preparedForm.serving_fat, preparedForm.serving_grams);
    const fiberPerGram = perGram(preparedForm.fiber, preparedForm.serving_fiber, preparedForm.serving_grams);
    const payload = {
      category_id: nextProductCategoryId || null,
      name: preparedForm.name.trim(),
      slug: preparedForm.id ? undefined : slugify(preparedForm.name),
      aliases: textToArray(preparedForm.aliasesText),
      line: isInternalProduct ? preparedForm.line : (preparedForm.line || null),
      image_url: preparedForm.image_url || null,
      gallery_urls: preparedForm.gallery_urls,
      video_urls: preparedForm.video_urls,
      pdf_urls: preparedForm.pdf_urls,
      external_urls: preparedForm.external_urls,
      description: preparedForm.description || null,
      benefits: preparedForm.benefits || null,
      usage: preparedForm.usage || null,
      ingredients_text: preparedForm.ingredients_text || null,
      observations: null,
      free_text: mergeImportantText(preparedForm.free_text, preparedForm.observations) || null,
      serving_size: preparedForm.serving_size || null,
      serving_grams: toNullableNumber(preparedForm.serving_grams),
      serving_calories: toNullableNumber(preparedForm.serving_calories),
      serving_protein: toNullableNumber(preparedForm.serving_protein),
      serving_carbs: toNullableNumber(preparedForm.serving_carbs),
      serving_sugars: toNullableNumber(preparedForm.serving_sugars),
      serving_fat: toNullableNumber(preparedForm.serving_fat),
      serving_saturated_fat: toNullableNumber(preparedForm.serving_saturated_fat),
      serving_fiber: toNullableNumber(preparedForm.serving_fiber),
      serving_salt: toNullableNumber(preparedForm.serving_salt),
      calories: toNullableNumber(preparedForm.calories),
      protein: toNullableNumber(preparedForm.protein),
      carbs: toNullableNumber(preparedForm.carbs),
      fat: toNullableNumber(preparedForm.fat),
      saturated_fat: toNullableNumber(preparedForm.saturated_fat),
      fiber: toNullableNumber(preparedForm.fiber),
      sugars: toNullableNumber(preparedForm.sugars),
      salt: toNullableNumber(preparedForm.salt),
      kcal_per_gram: toNullableNumber(kcalPerGram),
      protein_per_gram: toNullableNumber(proteinPerGram),
      carbs_per_gram: toNullableNumber(carbsPerGram),
      fat_per_gram: toNullableNumber(fatPerGram),
      fiber_per_gram: toNullableNumber(fiberPerGram),
      micronutrients: { ...hiddenProductMeta(form.micronutrients), ...micronutrients, [PRODUCT_BLOCK_ORDER_KEY]: form.blockOrder },
      source: preparedForm.source || "Pendiente de etiqueta oficial",
      verification_status: preparedForm.verification_status,
      nutrition_effective_from: preparedForm.nutrition_effective_from || new Date().toISOString(),
      nutrition_verified_at: preparedForm.verification_status === "verificado" ? (preparedForm.nutrition_verified_at || new Date().toISOString()) : null,
      label_file_url: preparedForm.label_file_url || null,
      is_active: preparedForm.is_active,
      visible_to_clients: preparedForm.visible_to_clients,
      available_for_recipes: preparedForm.available_for_recipes,
      informative_only: preparedForm.informative_only,
      spoon_image_url: preparedForm.spoon_image_url || null,
      sort_order: toNumber(preparedForm.sort_order),
      updated_at: new Date().toISOString(),
    };
    const cleanedPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
    const productResult = form.id
      ? await (supabase as any).from("products").update(cleanedPayload).eq("id", form.id).select("id").maybeSingle()
      : await (supabase as any).from("products").insert(cleanedPayload).select("id").maybeSingle();

    if (productResult.error || !productResult.data?.id) {
      setSaving(false);
      return toast.error(productResult.error?.message || "No se pudo guardar el producto");
    }

    const productId = productResult.data.id;
    await (supabase as any).from("product_measures").delete().eq("product_id", productId);
    const measures = limitProductMeasures(preparedForm.measures)
      .filter(measure => measure.name.trim())
      .map((measure, index) => ({
        product_id: productId,
        name: measure.name.trim(),
        grams: toNullableNumber(measure.grams),
        calories: toNullableNumber(measure.calories),
        protein: toNullableNumber(measure.protein),
        carbs: toNullableNumber(measure.carbs),
        fat: toNullableNumber(measure.fat),
        saturated_fat: toNullableNumber(measure.saturated_fat),
        fiber: toNullableNumber(measure.fiber),
        sugars: toNullableNumber(measure.sugars),
        salt: toNullableNumber(measure.salt),
        source: measure.source || preparedForm.source || "Pendiente de etiqueta oficial",
        verification_status: measure.verification_status,
        is_default: Boolean(measure.is_default),
        sort_order: index,
      }));
    if (measures.length) {
      const { error } = await (supabase as any).from("product_measures").insert(measures);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    const keepEditorOpen = keepEditingAfterSave.current;
    keepEditingAfterSave.current = false;
    setSaving(false);
    toast.success(form.id ? "Producto actualizado" : "Producto creado");
    if (keepEditorOpen) {
      setForm(prev => ({ ...prev, id: productId }));
      setEditorOpen(true);
    } else if (!wasEditingProduct) {
      const nextLine = isInternalProduct && activeInternalSubcategoryData ? activeInternalSubcategoryData.title : "";
      setForm({ ...emptyProduct, category_id: nextProductCategoryId, line: nextLine });
      setEditorInstanceKey(key => key + 1);
      setOpenEditorBlock("Información general");
      setEditorOpen(true);
    } else {
      resetProduct();
    }
    load();
  };

  const editProduct = (product: Product) => {
    const measures = (product.product_measures ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (isInternalNutritionCategoryId(product.category_id)) {
      setActiveInternalSubcategory(isInternalNutritionLine(product.line) ? sectionSlug(product.line) : "");
    }
    setForm({
      ...product,
      category_id: product.category_id ?? "",
      aliasesText: (product.aliases ?? []).join(", "),
      line: product.line ?? "",
      image_url: product.image_url ?? "",
      gallery_urls: asTextArray(product.gallery_urls),
      video_urls: asTextArray(product.video_urls),
      pdf_urls: asTextArray(product.pdf_urls),
      external_urls: asTextArray(product.external_urls),
      description: product.description ?? "",
      benefits: product.benefits ?? "",
      usage: product.usage ?? "",
      ingredients_text: product.ingredients_text ?? "",
      observations: "",
      free_text: mergeImportantText(product.free_text, product.observations),
      serving_size: product.serving_size ?? "",
      serving_grams: toFormNumber(product.serving_grams),
      serving_calories: toFormNumber(product.serving_calories),
      serving_protein: toFormNumber(product.serving_protein),
      serving_carbs: toFormNumber(product.serving_carbs),
      serving_sugars: toFormNumber(product.serving_sugars),
      serving_fat: toFormNumber(product.serving_fat),
      serving_saturated_fat: toFormNumber(product.serving_saturated_fat),
      serving_fiber: toFormNumber(product.serving_fiber),
      serving_salt: toFormNumber(product.serving_salt),
      calories: toFormNumber(product.calories),
      protein: toFormNumber(product.protein),
      carbs: toFormNumber(product.carbs),
      fat: toFormNumber(product.fat),
      saturated_fat: toFormNumber(product.saturated_fat),
      fiber: toFormNumber(product.fiber),
      sugars: toFormNumber(product.sugars),
      salt: toFormNumber(product.salt),
      kcal_per_gram: toFormNumber(product.kcal_per_gram),
      protein_per_gram: toFormNumber(product.protein_per_gram),
      carbs_per_gram: toFormNumber(product.carbs_per_gram),
      fat_per_gram: toFormNumber(product.fat_per_gram),
      fiber_per_gram: toFormNumber(product.fiber_per_gram),
      spoon_image_url: product.spoon_image_url ?? "",
      label_file_url: product.label_file_url ?? "",
      micronutrientsText: JSON.stringify(micronutrientsForEditor(product.micronutrients), null, 2),
      blockOrder: readProductBlockOrder(product.micronutrients),
      source: product.source ?? "Pendiente de etiqueta oficial",
      verification_status: product.verification_status ?? "pendiente",
      nutrition_effective_from: product.nutrition_effective_from ?? null,
      nutrition_verified_at: product.nutrition_verified_at ?? null,
      measures: measures.length ? limitProductMeasures(measures.map(normalizeMeasure)) : [emptyMeasure],
    });
    setEditorInstanceKey(key => key + 1);
    setOpenEditorBlock("Información general");
    setEditorOpen(true);
    scrollToProductEditor();
  };

  const duplicateProduct = async (product: Product) => {
    const copy = normalizeProduct({ ...product, name: `${product.name} copia`, slug: `${slugify(product.name)}-copia-${Date.now()}` });
    const duplicatePayload: any = { ...copy };
    delete duplicatePayload.id;
    delete duplicatePayload.product_measures;
    const { data, error } = await (supabase as any).from("products").insert({
      ...duplicatePayload,
      name: `${product.name} copia`,
      slug: `${slugify(product.name)}-copia-${Date.now()}`,
    }).select("id").maybeSingle();
    if (error || !data?.id) return toast.error(error?.message || "No se pudo duplicar");
    const measures = limitProductMeasures(product.product_measures ?? []).map((measure, index) => ({ ...measure, id: undefined, product_id: data.id, sort_order: index }));
    if (measures.length) await (supabase as any).from("product_measures").insert(measures);
    toast.success("Producto duplicado");
    load();
  };

  const deleteProduct = async (product: Product) => {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    const { error } = await (supabase as any).from("products").delete().eq("id", product.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Producto eliminado");
      if (form.id === product.id) resetProduct();
      load();
    }
  };

  const toggleProduct = async (product: Product) => {
    const { error } = await (supabase as any).from("products").update({ is_active: !product.is_active }).eq("id", product.id);
    if (error) toast.error(error.message);
    else load();
  };

  const previewProduct = (productId?: string | null) => {
    if (!productId) return toast.error("Guarda el producto antes de abrir la vista previa");
    window.open(`/app/productos/${productId}`, "_blank", "noopener,noreferrer");
  };

  const duplicateCurrentProduct = () => {
    const current = form.id ? products.find(product => product.id === form.id) : null;
    if (!current) return toast.error("Guarda el producto antes de duplicarlo");
    duplicateProduct(current);
  };

  const deleteCurrentProduct = () => {
    const current = form.id ? products.find(product => product.id === form.id) : null;
    if (current) deleteProduct(current);
    else resetProduct();
  };

  const confirmElementDelete = () => window.confirm(DELETE_ELEMENT_CONFIRMATION);

  const persistProductFields = async (patch: Record<string, unknown>, successMessage = "Elemento eliminado") => {
    if (!form.id) {
      toast.success(successMessage);
      return true;
    }

    const { error } = await (supabase as any)
      .from("products")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", form.id);

    if (error) {
      toast.error(error.message);
      return false;
    }

    setProducts(prev => prev.map(product => (
      product.id === form.id ? ({ ...product, ...patch } as Product) : product
    )));
    toast.success(successMessage);
    return true;
  };

  const clearDescription = async () => {
    if (!confirmElementDelete()) return;
    const nextMicronutrients = setProductMetaText(form.micronutrients, PRODUCT_SHORT_DESCRIPTION_KEY, "");
    setForm(prev => ({ ...prev, description: "", micronutrients: nextMicronutrients }));
    await persistProductFields({
      description: null,
      micronutrients: { ...nextMicronutrients, [PRODUCT_BLOCK_ORDER_KEY]: form.blockOrder },
    }, "Descripción eliminada");
  };

  const clearTextField = async (
    key: "benefits" | "usage" | "ingredients_text" | "free_text",
    successMessage: string,
  ) => {
    if (!confirmElementDelete()) return;
    setForm(prev => ({ ...prev, [key]: "" }));
    await persistProductFields({ [key]: null }, successMessage);
  };

  const updateBenefitsText = async (nextBenefits: string, successMessage: string) => {
    setForm(prev => ({ ...prev, benefits: nextBenefits }));
    await persistProductFields({ benefits: nextBenefits || null }, successMessage);
  };

  const editBenefitItem = async (index: number) => {
    const items = splitContentItems(form.benefits);
    const current = items[index] ?? "";
    const edited = window.prompt("Editar beneficio", current);
    if (edited === null) return;
    const clean = edited.trim();
    if (!clean) return toast.error("El beneficio no puede quedar vacío");
    const nextItems = items.map((item, itemIndex) => itemIndex === index ? clean : item);
    await updateBenefitsText(nextItems.join("\n"), "Beneficio actualizado");
  };

  const deleteBenefitItem = async (index: number) => {
    if (!confirmElementDelete()) return;
    const nextItems = splitContentItems(form.benefits).filter((_, itemIndex) => itemIndex !== index);
    await updateBenefitsText(nextItems.join("\n"), "Beneficio eliminado");
  };

  const uploadInto = async (file: File, kind: "main" | "gallery" | "video" | "pdf" | "spoon") => {
    try {
      setSaving(true);
      const url = await uploadProductFile(file, kind);
      const patch: Partial<Product> = {};
      if (kind === "main") {
        patch.image_url = url;
        setForm(prev => ({ ...prev, image_url: url }));
      }
      if (kind === "gallery") {
        const gallery_urls = [...form.gallery_urls, url];
        patch.gallery_urls = gallery_urls;
        setForm(prev => ({ ...prev, gallery_urls: [...prev.gallery_urls, url] }));
      }
      if (kind === "video") {
        const video_urls = [...form.video_urls, url];
        patch.video_urls = video_urls;
        setForm(prev => ({ ...prev, video_urls: [...prev.video_urls, url] }));
      }
      if (kind === "pdf") {
        const pdf_urls = [...form.pdf_urls, url];
        patch.pdf_urls = pdf_urls;
        setForm(prev => ({ ...prev, pdf_urls: [...prev.pdf_urls, url] }));
      }
      if (kind === "spoon") {
        patch.spoon_image_url = url;
        setForm(prev => ({ ...prev, spoon_image_url: url }));
      }
      if (form.id) {
        const { error } = await (supabase as any)
          .from("products")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Archivo subido y guardado en el producto");
        load();
      } else {
        toast.success("Archivo subido. Pulsa Guardar producto para publicarlo.");
      }
    } catch (err: any) {
      toast.error(err?.message || "No se pudo subir el archivo");
    } finally {
      setSaving(false);
    }
  };

  const addUrl = (key: "external_urls" | "video_urls" | "pdf_urls" | "gallery_urls", value: string) => {
    const clean = value.trim();
    if (!clean) return;
    const nextUrls = [...form[key], clean];
    setForm(prev => ({ ...prev, [key]: [...prev[key], clean] }));
    if (form.id) {
      (supabase as any)
        .from("products")
        .update({ [key]: nextUrls, updated_at: new Date().toISOString() })
        .eq("id", form.id)
        .then(({ error }: any) => {
          if (error) toast.error(error.message);
          else toast.success("Contenido guardado en el producto");
        });
    }
  };

  const updateUrl = async (key: "external_urls" | "video_urls" | "pdf_urls" | "gallery_urls", index: number, value: string) => {
    const clean = value.trim();
    if (!clean) return toast.error("La URL no puede quedar vacía");
    const nextUrls = form[key].map((url, i) => i === index ? clean : url);
    setForm(prev => ({ ...prev, [key]: prev[key].map((url, i) => i === index ? clean : url) }));
    if (form.id) await persistProductFields({ [key]: nextUrls }, "Elemento actualizado");
  };

  const removeUrl = async (key: "external_urls" | "video_urls" | "pdf_urls" | "gallery_urls", index: number) => {
    if (!confirmElementDelete()) return;
    const nextUrls = form[key].filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
    if (form.id) await persistProductFields({ [key]: nextUrls }, "Elemento eliminado");
  };

  const persistProductMeta = async (nextMicronutrients: Record<string, unknown>, successMessage: string) => {
    setForm(prev => ({ ...prev, micronutrients: nextMicronutrients }));
    if (form.id) {
      const { error } = await (supabase as any)
        .from("products")
        .update({ micronutrients: { ...nextMicronutrients, [PRODUCT_BLOCK_ORDER_KEY]: form.blockOrder }, updated_at: new Date().toISOString() })
        .eq("id", form.id);
      if (error) throw error;
      toast.success(successMessage);
      setProducts(prev => prev.map(product => (
        product.id === form.id ? ({ ...product, micronutrients: nextMicronutrients } as Product) : product
      )));
    }
  };

  const uploadSectionPdf = async (file: File, key: typeof PRODUCT_BENEFITS_PDF_KEY | typeof PRODUCT_IMPORTANT_PDF_KEY) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return toast.error("Sube un PDF");
    }
    try {
      setSaving(true);
      const url = await uploadProductFile(file, "pdf");
      const nextMicronutrients = { ...form.micronutrients, [key]: url };
      await persistProductMeta(nextMicronutrients, "PDF guardado");
      if (!form.id) toast.success("PDF subido. Pulsa Guardar producto para publicarlo.");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo subir el PDF");
    } finally {
      setSaving(false);
    }
  };

  const clearSectionPdf = async (key: typeof PRODUCT_BENEFITS_PDF_KEY | typeof PRODUCT_IMPORTANT_PDF_KEY) => {
    if (!confirmElementDelete()) return;
    const nextMicronutrients = { ...form.micronutrients };
    delete nextMicronutrients[key];
    try {
      await persistProductMeta(nextMicronutrients, "PDF eliminado");
      if (!form.id) toast.success("PDF eliminado");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo eliminar el PDF");
    }
  };

  const clearProductMedia = async (key: "image_url" | "spoon_image_url" | "label_file_url") => {
    if (!confirmElementDelete()) return;
    setForm(prev => ({ ...prev, [key]: "" }));
    await persistProductFields({ [key]: null }, "Archivo eliminado");
  };

  const updateMeasure = (index: number, patch: Partial<ProductMeasure>) => {
    const shouldRecalculate = "grams" in patch && !("calories" in patch || "protein" in patch || "carbs" in patch || "fat" in patch || "fiber" in patch);
    setForm(prev => ({
      ...prev,
      measures: prev.measures.map((measure, i) => {
        if (i !== index) return measure;
        const nextMeasure = { ...measure, ...patch };
        return shouldRecalculate ? measureFromProductNutrition(nextMeasure, prev) : nextMeasure;
      }),
    }));
  };

  const updateNutrition = (patch: Partial<Pick<ProductForm, "calories" | "protein" | "carbs" | "fat" | "saturated_fat" | "fiber" | "sugars" | "salt">>) => {
    setForm(prev => {
      const next = { ...prev, ...patch };
      return { ...next, measures: measuresFromProductNutrition(next.measures, next) };
    });
  };

  const clearServingNutrition = () => {
    setForm(prev => nutritionFromServing({
      ...prev,
      serving_size: "",
      serving_grams: "",
      serving_calories: "",
      serving_protein: "",
      serving_carbs: "",
      serving_sugars: "",
      serving_fat: "",
      serving_saturated_fat: "",
      serving_fiber: "",
      serving_salt: "",
    }));
  };

  const clearPer100Nutrition = () => {
    setForm(prev => {
      const next = {
        ...prev,
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
        saturated_fat: "",
        fiber: "",
        sugars: "",
        salt: "",
      };
      return { ...next, measures: measuresFromProductNutrition(next.measures, next) };
    });
  };

  const clearProductBasics = () => {
    setForm(prev => ({
      ...prev,
      name: "",
      category_id: "",
      line: "",
      verification_status: "pendiente",
      nutrition_verified_at: null,
      aliasesText: "",
      source: "Pendiente de etiqueta oficial",
    }));
  };

  const persistProductPatch = async (patch: Record<string, unknown>) => {
    if (!form.id) return;
    const { error } = await (supabase as any)
      .from("products")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", form.id);
    if (error) throw error;
  };

  const markNutritionLabelPending = async (labelUrl: string, fileName: string) => {
    const pendingSource = `Pendiente de analizar: ${fileName}`;
    setForm(prev => ({
      ...prev,
      label_file_url: labelUrl,
      source: pendingSource,
      verification_status: "pendiente",
      nutrition_verified_at: null,
    }));
    await persistProductPatch({
      label_file_url: labelUrl,
      source: pendingSource,
      verification_status: "pendiente",
      nutrition_verified_at: null,
    });
  };

  const applyNutritionLabelPayload = async (payload: any, labelUrl: string, fileName: string) => {
    const verifiedAt = new Date().toISOString();
    const nextShortDescription = String(payload.short_description ?? "").trim() || buildShortDescription(payload.description);
    let nextFormForSave: ProductForm | null = null;
    setForm(prev => {
      const next: ProductForm = nutritionFromServing({
        ...prev,
        label_file_url: labelUrl,
        micronutrients: setProductMetaText(prev.micronutrients, PRODUCT_SHORT_DESCRIPTION_KEY, nextShortDescription),
        description: payload.description ?? "",
        ingredients_text: payload.ingredients_text ?? "",
        serving_size: payload.serving_size ?? "",
        serving_grams: payload.serving_grams ?? "",
        serving_calories: payload.serving_calories ?? "",
        serving_protein: payload.serving_protein ?? "",
        serving_carbs: payload.serving_carbs ?? "",
        serving_sugars: payload.serving_sugars ?? "",
        serving_fat: payload.serving_fat ?? "",
        serving_saturated_fat: payload.serving_saturated_fat ?? "",
        serving_fiber: payload.serving_fiber ?? "",
        serving_salt: payload.serving_salt ?? "",
        calories: payload.calories ?? "",
        protein: payload.protein ?? "",
        carbs: payload.carbs ?? "",
        sugars: payload.sugars ?? "",
        fat: payload.fat ?? "",
        saturated_fat: payload.saturated_fat ?? "",
        fiber: payload.fiber ?? "",
        salt: payload.salt ?? "",
        source: payload.source || `Etiqueta nutricional verificada: ${fileName}`,
        verification_status: "verificado",
        nutrition_verified_at: verifiedAt,
      });
      nextFormForSave = next;
      return next;
    });

    const next = nextFormForSave;
    if (!next) return;
    await persistProductPatch({
      label_file_url: labelUrl,
      micronutrients: next.micronutrients,
      description: next.description || null,
      ingredients_text: next.ingredients_text || null,
      serving_size: next.serving_size || null,
      serving_grams: toNullableNumber(next.serving_grams),
      serving_calories: toNullableNumber(next.serving_calories),
      serving_protein: toNullableNumber(next.serving_protein),
      serving_carbs: toNullableNumber(next.serving_carbs),
      serving_sugars: toNullableNumber(next.serving_sugars),
      serving_fat: toNullableNumber(next.serving_fat),
      serving_saturated_fat: toNullableNumber(next.serving_saturated_fat),
      serving_fiber: toNullableNumber(next.serving_fiber),
      serving_salt: toNullableNumber(next.serving_salt),
      calories: toNullableNumber(next.calories),
      protein: toNullableNumber(next.protein),
      carbs: toNullableNumber(next.carbs),
      sugars: toNullableNumber(next.sugars),
      fat: toNullableNumber(next.fat),
      saturated_fat: toNullableNumber(next.saturated_fat),
      fiber: toNullableNumber(next.fiber),
      salt: toNullableNumber(next.salt),
      kcal_per_gram: toNullableNumber(perGram(next.calories, next.serving_calories, next.serving_grams)),
      protein_per_gram: toNullableNumber(perGram(next.protein, next.serving_protein, next.serving_grams)),
      carbs_per_gram: toNullableNumber(perGram(next.carbs, next.serving_carbs, next.serving_grams)),
      fat_per_gram: toNullableNumber(perGram(next.fat, next.serving_fat, next.serving_grams)),
      fiber_per_gram: toNullableNumber(perGram(next.fiber, next.serving_fiber, next.serving_grams)),
      source: next.source,
      verification_status: "verificado",
      nutrition_verified_at: verifiedAt,
    });
  };

  const analyzeNutritionLabelData = async (fileName: string, mimeType: string, labelUrl: string, dataUrl?: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/read-nutrition-label", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify({ fileName, mimeType, dataUrl, fileUrl: labelUrl }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload?.detail ? ` · ${payload.detail}` : "";
      throw new Error(`${payload?.error || "No se pudo leer la etiqueta"}${detail}`);
    }
    await applyNutritionLabelPayload(payload, labelUrl, fileName);
  };

  const uploadOfficialNutritionLabel = async (file: File) => {
    if (!isOfficialLabelFile(file)) {
      return toast.error("Formato no soportado. Sube una etiqueta oficial en PDF, JPG, JPEG, PNG o WEBP.");
    }
    try {
      setUploadingLabel(true);
      const labelUrl = await uploadProductFile(file, "labels");
      await markNutritionLabelPending(labelUrl, file.name);
      toast.success("Etiqueta oficial guardada. Puedes leer la etiqueta nutricional cuando la IA esté disponible.");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar la etiqueta oficial");
    } finally {
      setUploadingLabel(false);
    }
  };

  const readSavedNutritionLabel = async () => {
    if (!form.label_file_url) {
      return toast.error("Primero sube la etiqueta oficial del producto");
    }
    const fileName = fileNameFromUrl(form.label_file_url);
    try {
      setReadingLabel(true);
      await markNutritionLabelPending(form.label_file_url, fileName);
      await analyzeNutritionLabelData(fileName, mimeTypeFromFileName(fileName), form.label_file_url);
      toast.success("Etiqueta nutricional verificada. Revisa y ajusta cualquier dato antes de guardar.");
    } catch (err: any) {
      toast.error(`${err?.message || "No se pudo leer la etiqueta nutricional"}. La etiqueta queda guardada y el producto queda Pendiente de analizar.`);
    } finally {
      setReadingLabel(false);
    }
  };

  const readDescriptionPdf = async (file: File) => {
    if (file.type !== "application/pdf") {
      return toast.error("Sube un PDF para leer la descripción");
    }

    try {
      setReadingDescriptionPdf(true);
      const pdfUrl = await uploadProductFile(file, "pdf");
      const dataUrl = await fileToDataUrl(file);
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/read-product-pdf-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataUrl,
          productName: form.name,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo leer el PDF");

      const description = String(payload?.description ?? "").trim();
      if (!description) throw new Error("El PDF no contiene una descripción clara");
      const shortDescription = String(payload?.short_description ?? "").trim() || buildShortDescription(description);
      const nextMicronutrients = setProductMetaText(form.micronutrients, PRODUCT_SHORT_DESCRIPTION_KEY, shortDescription);

      const nextPdfUrls = form.pdf_urls.includes(pdfUrl) ? form.pdf_urls : [...form.pdf_urls, pdfUrl];
      setForm(prev => ({
        ...prev,
        description,
        micronutrients: setProductMetaText(prev.micronutrients, PRODUCT_SHORT_DESCRIPTION_KEY, shortDescription),
        pdf_urls: prev.pdf_urls.includes(pdfUrl) ? prev.pdf_urls : [...prev.pdf_urls, pdfUrl],
      }));

      if (form.id) {
        const { error } = await (supabase as any)
          .from("products")
          .update({
            description,
            micronutrients: nextMicronutrients,
            pdf_urls: nextPdfUrls,
            updated_at: new Date().toISOString(),
          })
          .eq("id", form.id);
        if (error) throw error;
        load();
        toast.success("PDF leído y descripción guardada");
      } else {
        toast.success("PDF leído. Pulsa Guardar producto para publicarlo.");
      }
    } catch (err: any) {
      toast.error(err?.message || "No se pudo leer la descripción del PDF");
    } finally {
      setReadingDescriptionPdf(false);
    }
  };

  const readIngredientsLabel = async (file: File) => {
    try {
      setReadingIngredientsLabel(true);
      const dataUrl = await fileToDataUrl(file);
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/read-product-ingredients-label", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataUrl,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo leer la etiqueta de ingredientes");

      const ingredientsText = String(payload?.ingredients_text ?? "").trim();
      if (!ingredientsText) throw new Error("La etiqueta no contiene ingredientes claros");

      setForm(prev => ({ ...prev, ingredients_text: ingredientsText }));

      if (form.id) {
        const { error } = await (supabase as any)
          .from("products")
          .update({
            ingredients_text: ingredientsText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", form.id);
        if (error) throw error;
        load();
        toast.success("Ingredientes leídos y guardados");
      } else {
        toast.success("Ingredientes leídos. Pulsa Guardar producto para publicarlo.");
      }
    } catch (err: any) {
      toast.error(err?.message || "No se pudo leer la etiqueta de ingredientes");
    } finally {
      setReadingIngredientsLabel(false);
    }
  };

  const markDefaultMeasure = (index: number) => {
    setForm(prev => ({
      ...prev,
      measures: prev.measures.map((measure, i) => ({ ...measure, is_default: i === index })),
    }));
  };
  const editorAccordionProps = (title: string) => ({
    open: openEditorBlock === title,
    onOpenChange: (nextOpen: boolean) => setOpenEditorBlock(nextOpen ? title : ""),
  });

  return (
    <div className="admin-products pb-28 max-w-5xl mx-auto">
      <AdminPageHeader
        title="Herbalife Nutrición"
        subtitle="Base oficial de productos para clientes, recetas y cálculos nutricionales."
      />

      <section className="admin-products-access-list admin-products-access-list-static mb-5" aria-label="Áreas de productos Herbalife">
        {PRODUCT_ADMIN_ACCESS_SECTIONS.map(section => {
          const isOpen = openAccessSection === section.id;

          return (
            <Fragment key={section.id}>
            <article className={`card-soft admin-products-access-card ${isOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="admin-products-access-trigger"
                aria-label={section.title}
                aria-expanded={isOpen}
                onClick={() => toggleAccessSection(section.id)}
              >
                <span className="admin-products-access-image-wrap">
                  <img src={section.image} alt={section.title} />
                </span>
                <span className="admin-products-access-title">{section.title}</span>
                <ArrowDown className={`admin-products-access-arrow ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </article>
            {isOpen && (
        <div ref={selectedWorkspaceRef} className="admin-products-access-body admin-products-selected-workspace space-y-5">
          {section.id === INTERNAL_NUTRITION_SECTION_ID && (
            <section className="card-soft admin-products-panel admin-products-internal-subcategories p-4 sm:p-5 space-y-3">
              <h2 className="font-serif text-2xl">Subcategorías</h2>
              <div className="admin-products-internal-subcategory-grid" aria-label="Subcategorías de Nutrición interna">
                {INTERNAL_NUTRITION_SUBCATEGORIES.map(subcategory => {
                  const isActive = activeInternalSubcategory === subcategory.id;

                  return (
                    <button
                      key={subcategory.id}
                      type="button"
                      className={`admin-products-access-card admin-products-internal-subcategory-card ${isActive ? "is-open" : ""}`}
                      onClick={() => {
                        setActiveInternalSubcategory(isActive ? "" : subcategory.id);
                        setQuery("");
                      }}
                      aria-pressed={isActive}
                    >
                      <span className="admin-products-access-image-wrap">
                        <img src={subcategory.image} alt={subcategory.title} />
                      </span>
                      <span className="admin-products-access-title">{subcategory.title}</span>
                      <ArrowDown className={`admin-products-access-arrow ${isActive ? "rotate-180" : ""}`} />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {shouldShowProductManagement && (
          <section className="card-soft admin-products-panel admin-products-existing-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Productos existentes</h2>
          </div>
          <button type="button" className="btn-primary" onClick={focusProductSearch}>
            <Search className="h-4 w-4" /> Buscar producto
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input ref={productSearchInputRef} className="field pl-9" placeholder="Buscar producto…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select className="field sm:max-w-56" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(category => <option key={category.id} value={category.id}>{categoryOptionLabel(category)}</option>)}
          </select>
        </div>

        {loading ? <div className="muted text-sm">Cargando productos…</div> : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProducts.map(product => (
              <article key={product.id} className="admin-product-row admin-product-list-card rounded-[26px] bg-white/90 border border-primary/10 shadow-sm overflow-hidden">
                <div className="admin-product-list-main">
                  <div className="admin-product-list-image">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} />
                    ) : (
                      <div className="h-full w-full bg-gradient-rosa/20 grid place-items-center">
                        <ImageIcon className="h-6 w-6 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="admin-product-list-content">
                    <div className="font-sans font-extrabold text-lg leading-tight">{product.name}</div>
                    <div className="text-sm muted mt-1">{categoryDisplayName(product.category_id ? categoryById.get(product.category_id) : null)}</div>
                    <div className="text-[11px] muted mt-1">{formatProductDate(product.created_at ?? product.updated_at)}</div>
                    <div className="admin-product-list-tags text-[10px]">
                      <span className="chip">{product.is_active ? "Activo" : "Inactivo"}</span>
                      <span className={product.verification_status === "verificado" ? "chip-lavender" : "chip"}>{product.verification_status}</span>
                    </div>
                  </div>
                </div>
                <div className="admin-product-list-actions">
                  <button type="button" className="admin-product-action-button" onClick={() => editProduct(product)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button type="button" className="admin-product-action-button" onClick={() => previewProduct(product.id)}>
                    <Eye className="h-3.5 w-3.5" /> Vista previa
                  </button>
                  <button type="button" className="admin-product-action-button text-destructive" onClick={() => deleteProduct(product)}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </article>
            ))}
            {!filteredProducts.length && <div className="text-sm muted text-center p-2">No hay productos que coincidan.</div>}
          </div>
        )}
      </section>
          )}

      <ProductAccordion title="Nueva categoría" subtitle="Crear, editar, ocultar o eliminar categorías." className="mt-5 admin-products-category-panel">
        <form onSubmit={saveCategory} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl">{editingCategory ? "Editar categoría" : "Nueva categoría"}</h2>
              <p className="text-xs muted">Crea carpetas libremente: control de peso, hidratación, deportiva…</p>
            </div>
            <button type="button" className="btn-primary text-xs py-2" onClick={resetCategory}>
              <Trash2 className="h-3.5 w-3.5" /> Borrar
            </button>
          </div>
          <input className="field" placeholder="Nombre de categoría" value={categoryName} onChange={e => setCategoryName(e.target.value)} />
          <textarea className="field min-h-20" placeholder="Descripción opcional" value={categoryDescription} onChange={e => setCategoryDescription(e.target.value)} />
          <div className="rounded-2xl bg-white/80 border border-primary/20 p-3 space-y-2">
            <div className="text-xs font-bold text-primary">Imagen de categoría</div>
            {categoryImageUrl && <img src={categoryImageUrl} alt="" className="h-28 w-full rounded-2xl object-cover" />}
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="btn-primary cursor-pointer justify-center">
                <ImageIcon className="h-4 w-4" /> Subir imagen
                <input type="file" className="hidden" accept={IMAGE_FILE_ACCEPT} onChange={e => e.target.files?.[0] && uploadCategoryImage(e.target.files[0])} />
              </label>
              <input className="field flex-1" placeholder="O pegar URL de imagen" value={categoryImageUrl} onChange={e => setCategoryImageUrl(e.target.value)} />
              {categoryImageUrl && <button type="button" className="btn-primary" onClick={() => setCategoryImageUrl("")}><Trash2 className="h-4 w-4" /> Borrar</button>}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving}><Save className="h-4 w-4" /> Guardar categoría</button>
            {editingCategory && <button type="button" className="btn-secondary" onClick={resetCategory}><X className="h-4 w-4" /> Cancelar</button>}
          </div>
        </form>
      </ProductAccordion>

      {shouldShowProductManagement && (
      <ProductAccordion
        title={form.id ? "Editar producto" : "Gestión de productos"}
        subtitle="Abre este desplegable para buscar, crear o modificar productos."
        className="mt-5 admin-products-new-product-panel"
        open={editorOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            if (!editorOpen) startNewProduct(activeAccessCategory?.id ?? "", true);
            return;
          }
          setEditorOpen(false);
        }}
      >
          {editorOpen && (
        <form key={editorInstanceKey} id="admin-product-editor-form" onSubmit={saveProduct} className="admin-products-editor mt-5 space-y-3">
          <div className="admin-products-editor-toolbar card-soft admin-products-panel p-3">
            <div className="min-w-0">
              <h2 className="font-serif text-2xl truncate">{form.id ? `Editar: ${form.name || "producto"}` : "Nuevo producto"}</h2>
            </div>
            <div className="admin-products-editor-actions">
              <button type="submit" className="btn-primary" disabled={saving} onClick={() => { keepEditingAfterSave.current = false; }}>
                <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => previewProduct(form.id)}>
                <Eye className="h-4 w-4" /> Vista previa
              </button>
              {form.id && (
                <button type="button" className="btn-secondary" onClick={duplicateCurrentProduct}>
                  <Plus className="h-4 w-4" /> Duplicar
                </button>
              )}
              <button type="button" className="btn-secondary text-destructive" onClick={deleteCurrentProduct}>
                <Trash2 className="h-4 w-4" /> Eliminar producto
              </button>
            </div>
          </div>

          <ProductAccordion title="Información general" {...editorAccordionProps("Información general")}>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl">Datos básicos</h3>
                  <p className="text-xs muted">Información visible y estado de verificación.</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button type="button" className="btn-primary text-xs py-2" onClick={clearProductBasics}>
                    <Trash2 className="h-3.5 w-3.5" /> Borrar
                  </button>
                  {form.id && <button type="button" className="btn-secondary" onClick={() => startNewProduct()}><Plus className="h-4 w-4" /> Nuevo</button>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="field" placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                <select className="field" value={form.category_id ?? ""} onChange={e => handleProductCategoryChange(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map(category => (
                    <option
                      key={category.id}
                      value={category.id}
                      disabled={!category.is_active && form.category_id !== category.id}
                    >
                      {categoryOptionLabel(category)}
                    </option>
                  ))}
                </select>
                {isInternalNutritionForm ? (
                  <select className="field" value={isInternalNutritionLine(form.line) ? form.line ?? "" : ""} onChange={e => setForm({ ...form, line: e.target.value })} required>
                    <option value="">Subcategoría</option>
                    {INTERNAL_NUTRITION_SUBCATEGORIES.map(subcategory => (
                      <option key={subcategory.id} value={subcategory.title}>{subcategory.title}</option>
                    ))}
                  </select>
                ) : (
                  <input className="field" placeholder="Línea / categoría comercial" value={form.line ?? ""} onChange={e => setForm({ ...form, line: e.target.value })} />
                )}
                <select className="field" value={form.verification_status} onChange={e => setForm({ ...form, verification_status: e.target.value as ProductForm["verification_status"] })}>
                  <option value="pendiente">Pendiente</option>
                  <option value="verificado">Verificado</option>
                </select>
                <NumberField
                  label="Orden en la categoría"
                  value={form.sort_order}
                  step="1"
                  onChange={value => setForm(prev => ({ ...prev, sort_order: value }))}
                />
                <input
                  className="field"
                  type="datetime-local"
                  value={form.nutrition_verified_at ? form.nutrition_verified_at.slice(0, 16) : ""}
                  onChange={e => setForm({ ...form, nutrition_verified_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  aria-label="Fecha de verificación"
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)] gap-4">
                <MediaUploader
                  title="Imagen principal del producto"
                  url={form.image_url ?? ""}
                  accept={IMAGE_FILE_ACCEPT}
                  icon={<ImageIcon className="h-4 w-4" />}
                  onUpload={file => uploadInto(file, "main")}
                  onUrl={url => setForm(prev => ({ ...prev, image_url: url }))}
                  onClear={() => clearProductMedia("image_url")}
                  clearLabel="Eliminar imagen"
                />
                <div className="admin-product-editor-preview-card">
                  <div className="admin-product-editor-preview-image">
                    {form.image_url ? (
                      <img src={form.image_url} alt={form.name || "Producto"} />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div className="admin-product-editor-preview-body">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Vista previa</p>
                    <h4>{form.name || "Nombre del producto"}</h4>
                    <p>{categoryDisplayName(form.category_id ? categoryById.get(form.category_id) : null)}</p>
                    <p>{getProductMetaText(form.micronutrients, PRODUCT_SHORT_DESCRIPTION_KEY) || buildShortDescription(form.description) || "Añade una descripción para verla aquí."}</p>
                    <span>{form.verification_status === "verificado" ? "Verificado" : "Pendiente"}</span>
                    <button type="button" className="btn-primary" onClick={() => previewProduct(form.id)}>
                      <Eye className="h-4 w-4" /> Ver producto
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs muted">Alias inteligentes</span>
                  <textarea
                    className="field min-h-20 mt-1"
                    value={form.aliasesText}
                    onChange={e => setForm({ ...form, aliasesText: e.target.value })}
                    placeholder="F1, Fórmula Uno, Batido Herbalife…"
                  />
                  <p className="text-[11px] muted mt-1">Separados por coma. Se usan para reconocer productos en recetas y generador IA.</p>
                </label>
                <label className="block">
                  <span className="text-xs muted">Fuente</span>
                  <textarea
                    className="field min-h-20 mt-1"
                    value={form.source}
                    onChange={e => setForm({ ...form, source: e.target.value })}
                    placeholder="Etiqueta oficial Herbalife España, imagen de cuchara, pendiente…"
                  />
                </label>
              </div>
            </div>
          </ProductAccordion>

          <ProductAccordion title="Etiqueta nutricional" {...editorAccordionProps("Etiqueta nutricional")}>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl leading-none">Etiqueta nutricional oficial</h3>
                  <p className="text-xs muted mt-1">Sube primero la etiqueta oficial. Si la IA falla, el archivo queda guardado y podrás leerlo más adelante.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="btn-primary cursor-pointer justify-center">
                    <Upload className="h-4 w-4" /> {uploadingLabel ? "Subiendo…" : form.label_file_url ? "Etiqueta guardada" : "Subir etiqueta oficial"}
                    <input
                      type="file"
                      className="hidden"
                      accept={OFFICIAL_LABEL_ACCEPT}
                      disabled={uploadingLabel}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) uploadOfficialNutritionLabel(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button type="button" className="btn-primary" disabled={readingLabel || !form.label_file_url} onClick={readSavedNutritionLabel}>
                    <FileText className="h-4 w-4" /> {readingLabel ? "Leyendo…" : "Leer etiqueta nutricional"}
                  </button>
                  {form.label_file_url && (
                    <button type="button" className="btn-primary" onClick={() => clearProductMedia("label_file_url")}>
                      <Trash2 className="h-4 w-4" /> Eliminar etiqueta
                    </button>
                  )}
                </div>
              </div>
              {form.label_file_url && (
                <div className="rounded-2xl border border-primary/20 bg-white/70 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-primary">Etiqueta guardada</p>
                    {form.verification_status === "verificado" ? (
                      <span className="rounded-full bg-primary px-3 py-1 font-bold text-white">Verificado</span>
                    ) : (
                      <span className="rounded-full border border-primary bg-primary/10 px-3 py-1 font-bold text-primary">
                        Pendiente de analizar con IA
                      </span>
                    )}
                  </div>
                  <a href={form.label_file_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-primary font-bold underline">
                    Ver etiqueta guardada
                  </a>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="field md:col-span-2" placeholder="Tamaño de ración oficial (ej. 2 cucharas rasas / 26 g)" value={form.serving_size ?? ""} onChange={e => setForm({ ...form, serving_size: e.target.value })} />
                <NumberField label="Gramos por ración" value={form.serving_grams} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_grams: value }))} />
              </div>
            </div>
          </ProductAccordion>

          <ProductAccordion title="Imágenes" {...editorAccordionProps("Imágenes")}>
            <div className="grid grid-cols-1 gap-4">
              <MediaUploader
                title="Imagen cuchara oficial Herbalife"
                url={form.spoon_image_url ?? ""}
                accept={IMAGE_FILE_ACCEPT}
                icon={<ImageIcon className="h-4 w-4" />}
                onUpload={file => uploadInto(file, "spoon")}
                onUrl={url => setForm(prev => ({ ...prev, spoon_image_url: url }))}
                onClear={() => clearProductMedia("spoon_image_url")}
                clearLabel="Eliminar cuchara"
                hint="Pulsa aquí para comprobar la medida de la cuchara oficial."
                highlightHint
              />
            </div>
          </ProductAccordion>

          <ProductAccordion title="Orden visual de la ficha" {...editorAccordionProps("Orden visual de la ficha")}>
            <div>
              <div className="flex items-start gap-2 mb-3">
                <MousePointerClick className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-serif text-xl leading-none">Orden visual de la ficha</h3>
                  <p className="text-xs muted mt-1">Mueve cada bloque para decidir cómo lo verá la clienta dentro del producto.</p>
                </div>
                <button type="button" className="btn-primary text-xs py-2" onClick={() => setForm(prev => ({ ...prev, blockOrder: DEFAULT_PRODUCT_BLOCK_ORDER }))}>
                  <Trash2 className="h-3.5 w-3.5" /> Borrar
                </button>
              </div>
              <div className="space-y-2">
                {form.blockOrder.map((blockId, index) => (
                  <div key={blockId} className="rounded-2xl bg-white/90 border border-primary/20 p-2 flex items-center gap-2">
                    <span className="admin-product-order-index h-7 w-7 rounded-full text-xs font-bold grid place-items-center">{index + 1}</span>
                    <span className="text-sm font-medium flex-1">{PRODUCT_BLOCK_LABELS[blockId]}</span>
                    <button type="button" className="admin-product-order-button p-2 rounded-xl border disabled:opacity-35" disabled={index === 0} onClick={() => setForm(prev => ({ ...prev, blockOrder: moveBlockOrder(prev.blockOrder, blockId, -1) }))} aria-label={`Subir ${PRODUCT_BLOCK_LABELS[blockId]}`}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" className="admin-product-order-button p-2 rounded-xl border disabled:opacity-35" disabled={index === form.blockOrder.length - 1} onClick={() => setForm(prev => ({ ...prev, blockOrder: moveBlockOrder(prev.blockOrder, blockId, 1) }))} aria-label={`Bajar ${PRODUCT_BLOCK_LABELS[blockId]}`}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </ProductAccordion>

          <ProductAccordion title="Galería" {...editorAccordionProps("Galería")}>
            <MultiUrlEditor title="Galería de imágenes" icon={<ImageIcon className="h-4 w-4" />} urls={form.gallery_urls} onAdd={url => addUrl("gallery_urls", url)} onUpdate={(index, url) => updateUrl("gallery_urls", index, url)} onRemove={index => removeUrl("gallery_urls", index)} uploadLabel="Subir imagen" accept={IMAGE_FILE_ACCEPT} onUpload={file => uploadInto(file, "gallery")} />
          </ProductAccordion>
          <ProductAccordion title="Vídeos" {...editorAccordionProps("Vídeos")}>
            <MultiUrlEditor title="Vídeos" icon={<Video className="h-4 w-4" />} urls={form.video_urls} onAdd={url => addUrl("video_urls", url)} onUpdate={(index, url) => updateUrl("video_urls", index, url)} onRemove={index => removeUrl("video_urls", index)} uploadLabel="Subir vídeo" accept="video/*" onUpload={file => uploadInto(file, "video")} />
          </ProductAccordion>
          <ProductAccordion title="PDFs" {...editorAccordionProps("PDFs")}>
            <MultiUrlEditor title="PDFs" icon={<FileText className="h-4 w-4" />} urls={form.pdf_urls} onAdd={url => addUrl("pdf_urls", url)} onUpdate={(index, url) => updateUrl("pdf_urls", index, url)} onRemove={index => removeUrl("pdf_urls", index)} uploadLabel="Subir PDF" accept="application/pdf" onUpload={file => uploadInto(file, "pdf")} />
          </ProductAccordion>
          <ProductAccordion title="URLs" {...editorAccordionProps("URLs")}>
            <MultiUrlEditor title="URLs externas" icon={<LinkIcon className="h-4 w-4" />} urls={form.external_urls} onAdd={url => addUrl("external_urls", url)} onUpdate={(index, url) => updateUrl("external_urls", index, url)} onRemove={index => removeUrl("external_urls", index)} />
          </ProductAccordion>

          <ProductAccordion title="Descripción" {...editorAccordionProps("Descripción")}>
            <section className="card-soft p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl leading-tight">Descripción</h3>
                  <p className="text-xs muted mt-1">La clienta verá primero la descripción corta y podrá desplegar la completa.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => descriptionShortTextareaRef.current?.focus()}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <label className="btn-primary cursor-pointer justify-center">
                    <FileText className="h-4 w-4" /> {readingDescriptionPdf ? "Leyendo…" : "Leer PDF"}
                    <input
                      type="file"
                      className="hidden"
                      accept="application/pdf"
                      disabled={readingDescriptionPdf}
                      onChange={event => event.target.files?.[0] && readDescriptionPdf(event.target.files[0])}
                    />
                  </label>
                  <button type="button" className="btn-primary admin-product-clear-button" onClick={clearDescription}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar descripción
                  </button>
                </div>
              </div>
              <label className="block">
                <span className="text-xs muted">Descripción corta</span>
                <textarea
                  ref={descriptionShortTextareaRef}
                  className="field min-h-24 mt-1"
                  placeholder="Resumen breve de 2–4 líneas para la clienta."
                  value={getProductMetaText(form.micronutrients, PRODUCT_SHORT_DESCRIPTION_KEY)}
                  onChange={event => setForm({
                    ...form,
                    micronutrients: setProductMetaText(form.micronutrients, PRODUCT_SHORT_DESCRIPTION_KEY, event.target.value),
                  })}
                />
              </label>
              <label className="block">
                <span className="text-xs muted">Descripción completa</span>
                <textarea ref={descriptionTextareaRef} className="field min-h-32 mt-1" value={form.description ?? ""} onChange={event => setForm({ ...form, description: event.target.value })} />
              </label>
            </section>
          </ProductAccordion>
          <ProductAccordion title="Beneficios" {...editorAccordionProps("Beneficios")}>
            <div className="space-y-3">
              <TextAreaWithPdf
                label="Beneficios"
                value={form.benefits ?? ""}
                pdfUrl={getProductMetaUrl(form.micronutrients, PRODUCT_BENEFITS_PDF_KEY)}
                onChange={value => setForm({ ...form, benefits: value })}
                onUploadPdf={file => uploadSectionPdf(file, PRODUCT_BENEFITS_PDF_KEY)}
                onClearPdf={() => clearSectionPdf(PRODUCT_BENEFITS_PDF_KEY)}
                onClearText={() => clearTextField("benefits", "Beneficios eliminados")}
                clearTextLabel="Eliminar beneficios"
              />
              <BenefitItemsEditor value={form.benefits ?? ""} onEdit={editBenefitItem} onDelete={deleteBenefitItem} />
            </div>
          </ProductAccordion>
          <ProductAccordion title="Modo de empleo" {...editorAccordionProps("Modo de empleo")}>
            <TextArea
              label="Modo de empleo"
              value={form.usage ?? ""}
              onChange={value => setForm({ ...form, usage: value })}
              onClear={() => clearTextField("usage", "Modo de empleo eliminado")}
              clearLabel="Eliminar modo de empleo"
            />
          </ProductAccordion>
          <ProductAccordion title="Ingredientes" {...editorAccordionProps("Ingredientes")}>
            <section className="card-soft p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl leading-tight">Ingredientes</h3>
                  <p className="text-xs muted mt-1">Puedes escribirlos a mano o leerlos desde una etiqueta de ingredientes.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="btn-primary cursor-pointer justify-center">
                    <FileText className="h-4 w-4" /> {readingIngredientsLabel ? "Leyendo…" : "Leer etiqueta"}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      disabled={readingIngredientsLabel}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) readIngredientsLabel(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button type="button" className="btn-primary admin-product-clear-button" onClick={() => clearTextField("ingredients_text", "Ingredientes eliminados")}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar ingredientes
                  </button>
                </div>
              </div>
              <textarea className="field min-h-28" value={form.ingredients_text ?? ""} onChange={event => setForm({ ...form, ingredients_text: event.target.value })} />
            </section>
          </ProductAccordion>
          <ProductAccordion title="Información importante" {...editorAccordionProps("Información importante")}>
            <TextAreaWithPdf
              label="Información importante"
              value={form.free_text ?? ""}
              pdfUrl={getProductMetaUrl(form.micronutrients, PRODUCT_IMPORTANT_PDF_KEY)}
              onChange={value => setForm({ ...form, free_text: value })}
              onUploadPdf={file => uploadSectionPdf(file, PRODUCT_IMPORTANT_PDF_KEY)}
              onClearPdf={() => clearSectionPdf(PRODUCT_IMPORTANT_PDF_KEY)}
              onClearText={() => clearTextField("free_text", "Información importante eliminada")}
              clearTextLabel="Eliminar información"
            />
          </ProductAccordion>

          <ProductAccordion title="Información nutricional" {...editorAccordionProps("Información nutricional")}>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="font-serif text-xl">Información nutricional por 100 g</h3>
                  <button type="button" className="btn-primary text-xs py-2" onClick={clearPer100Nutrition}>
                    <Trash2 className="h-3.5 w-3.5" /> Borrar
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <NumberField label="Calorías" value={form.calories} onChange={value => updateNutrition({ calories: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                  <NumberField label="Proteínas" value={form.protein} onChange={value => updateNutrition({ protein: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                  <NumberField label="Hidratos" value={form.carbs} onChange={value => updateNutrition({ carbs: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                  <NumberField label="Grasas" value={form.fat} onChange={value => updateNutrition({ fat: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                  <NumberField label="Grasas saturadas" value={form.saturated_fat} onChange={value => updateNutrition({ saturated_fat: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                  <NumberField label="Fibra" value={form.fiber} onChange={value => updateNutrition({ fiber: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                  <NumberField label="Azúcares" value={form.sugars} onChange={value => updateNutrition({ sugars: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                  <NumberField label="Sal" value={form.salt} onChange={value => updateNutrition({ salt: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                </div>
              </div>

            </div>
          </ProductAccordion>

          <ProductAccordion title="Medidas habituales" {...editorAccordionProps("Medidas habituales")}>
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-serif text-xl">Medidas habituales</h3>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={form.measures.length >= MAX_PRODUCT_MEASURES}
                  onClick={() => setForm(prev => ({
                    ...prev,
                    measures: [
                      ...limitProductMeasures(prev.measures),
                      measureFromProductNutrition({ ...emptyMeasure, name: "100 g", is_default: false, sort_order: prev.measures.length }, prev),
                    ].slice(0, MAX_PRODUCT_MEASURES),
                  }))}
                >
                  <Plus className="h-4 w-4" /> Añadir
                </button>
              </div>
              <div className="space-y-3">
                {limitProductMeasures(form.measures).map((measure, index) => (
                  <div key={index} className="admin-measure-row rounded-[22px] bg-secondary/70 p-3">
                    <div className="admin-product-measure-fields">
                      <label className="block">
                        <span className="text-[11px] muted">Nombre medida</span>
                        <select
                          className="field mt-1"
                          value={PRODUCT_MEASURE_NAME_OPTIONS.some(option => option.label === measure.name) ? measure.name : "100 g"}
                          onChange={e => {
                            const selected = PRODUCT_MEASURE_NAME_OPTIONS.find(option => option.label === e.target.value);
                            updateMeasure(index, {
                              name: e.target.value,
                              ...(selected?.grams ? { grams: selected.grams } : {}),
                            });
                          }}
                        >
                          {PRODUCT_MEASURE_NAME_OPTIONS.map(option => (
                            <option key={option.label} value={option.label}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <NumberField
                        label="Gramos"
                        value={measure.grams}
                        onChange={value => updateMeasure(index, { grams: value })}
                        quickSteps={[-50, 50]}
                        step="0.1"
                      />
                      <NumberField label="Calorías" value={measure.calories} onChange={value => updateMeasure(index, { calories: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                      <NumberField label="Proteínas" value={measure.protein} onChange={value => updateMeasure(index, { protein: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                      <NumberField label="Hidratos" value={measure.carbs} onChange={value => updateMeasure(index, { carbs: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                      <NumberField label="Grasas" value={measure.fat} onChange={value => updateMeasure(index, { fat: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                      <NumberField label="Grasas saturadas" value={measure.saturated_fat ?? ""} onChange={value => updateMeasure(index, { saturated_fat: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                      <NumberField label="Fibra" value={measure.fiber} onChange={value => updateMeasure(index, { fiber: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                      <NumberField label="Azúcares" value={measure.sugars ?? ""} onChange={value => updateMeasure(index, { sugars: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                      <NumberField label="Sal" value={measure.salt ?? ""} onChange={value => updateMeasure(index, { salt: value })} quickSteps={NUTRIENT_QUICK_STEPS} step="0.001" />
                    </div>
                    <div className="admin-product-measure-actions">
                      <select
                        className="field admin-product-measure-status"
                        value={measure.verification_status}
                        onChange={e => updateMeasure(index, { verification_status: e.target.value as ProductMeasure["verification_status"] })}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="verificado">Verificado</option>
                      </select>
                      <button type="button" className="btn-secondary text-xs py-2 text-destructive admin-product-measure-delete" onClick={() => setForm(prev => ({ ...prev, measures: prev.measures.filter((_, i) => i !== index) }))}><Trash2 className="h-3.5 w-3.5" /> Eliminar medida</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ProductAccordion>

          <ProductAccordion title="Visibilidad" {...editorAccordionProps("Visibilidad")}>
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-serif text-xl">Visibilidad y estado</h3>
                <button type="button" className="btn-primary text-xs py-2" onClick={() => setForm(prev => ({ ...prev, visible_to_clients: true, available_for_recipes: true, informative_only: false, is_active: true }))}>
                  <Trash2 className="h-3.5 w-3.5" /> Borrar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Toggle label="Visible para clientes" checked={form.visible_to_clients} onChange={checked => setForm({ ...form, visible_to_clients: checked })} />
                <Toggle label="Disponible para recetas" checked={form.available_for_recipes} onChange={checked => setForm({ ...form, available_for_recipes: checked })} />
                <Toggle label="Solo informativo" checked={form.informative_only} onChange={checked => setForm({ ...form, informative_only: checked })} />
                <Toggle label="Producto activo" checked={form.is_active} onChange={checked => setForm({ ...form, is_active: checked })} />
              </div>
            </div>
          </ProductAccordion>
        </form>
          )}
      </ProductAccordion>
      )}
        </div>
            )}
            </Fragment>
          );
        })}
      </section>
    </div>
  );
}

function ProductAccordion({
  title,
  subtitle,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const toggleOpen = () => {
    if (onOpenChange) {
      onOpenChange(!open);
      return;
    }
    setUncontrolledOpen(current => !current);
  };
  return (
    <section className={`card-soft admin-products-panel admin-products-accordion ${className}`}>
      <button type="button" className="admin-products-accordion-trigger" onClick={toggleOpen} aria-expanded={open}>
        <span>
          <span className="admin-products-accordion-title">{title}</span>
          {subtitle && <span className="admin-products-accordion-subtitle">{subtitle}</span>}
        </span>
        <ArrowDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="admin-products-accordion-body">{children}</div>}
    </section>
  );
}

function formatProductDate(value?: string | null) {
  if (!value) return "Fecha no registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no registrada";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function normalizeProduct(item: any): Product {
  return {
    ...item,
    category_id: item.category_id ?? null,
    aliases: asTextArray(item.aliases),
    line: item.line ?? null,
    image_url: item.image_url ?? null,
    gallery_urls: asTextArray(item.gallery_urls),
    video_urls: asTextArray(item.video_urls),
    pdf_urls: asTextArray(item.pdf_urls),
    external_urls: asTextArray(item.external_urls),
    serving_size: item.serving_size ?? null,
    serving_grams: toNullableNumber(item.serving_grams),
    serving_calories: toNullableNumber(item.serving_calories),
    serving_protein: toNullableNumber(item.serving_protein),
    serving_carbs: toNullableNumber(item.serving_carbs),
    serving_sugars: toNullableNumber(item.serving_sugars),
    serving_fat: toNullableNumber(item.serving_fat),
    serving_saturated_fat: toNullableNumber(item.serving_saturated_fat),
    serving_fiber: toNullableNumber(item.serving_fiber),
    serving_salt: toNullableNumber(item.serving_salt),
    calories: toNullableNumber(item.calories),
    protein: toNullableNumber(item.protein),
    carbs: toNullableNumber(item.carbs),
    fat: toNullableNumber(item.fat),
    saturated_fat: toNullableNumber(item.saturated_fat),
    fiber: toNullableNumber(item.fiber),
    sugars: toNullableNumber(item.sugars),
    salt: toNullableNumber(item.salt),
    kcal_per_gram: toNullableNumber(item.kcal_per_gram),
    protein_per_gram: toNullableNumber(item.protein_per_gram),
    carbs_per_gram: toNullableNumber(item.carbs_per_gram),
    fat_per_gram: toNullableNumber(item.fat_per_gram),
    fiber_per_gram: toNullableNumber(item.fiber_per_gram),
    micronutrients: item.micronutrients ?? {},
    source: item.source ?? "Pendiente de etiqueta oficial",
    verification_status: item.verification_status === "verificado" ? "verificado" : "pendiente",
    nutrition_effective_from: item.nutrition_effective_from ?? null,
    nutrition_verified_at: item.nutrition_verified_at ?? null,
    label_file_url: item.label_file_url ?? null,
    is_active: item.is_active !== false,
    visible_to_clients: item.visible_to_clients !== false,
    available_for_recipes: item.available_for_recipes !== false,
    informative_only: Boolean(item.informative_only),
    herbalife_spoon_measure_id: item.herbalife_spoon_measure_id ?? null,
    spoon_image_url: item.spoon_image_url ?? null,
    sort_order: toNumber(item.sort_order),
    product_measures: Array.isArray(item.product_measures) ? item.product_measures.map(normalizeMeasure) : [],
  };
}

function normalizeMeasure(item: any): ProductMeasure {
  const measureName = String(item.name ?? "").trim();
  const validMeasureName = PRODUCT_MEASURE_NAME_OPTIONS.some(option => option.label === measureName) ? measureName : "100 g";
  return {
    id: item.id,
    name: validMeasureName,
    grams: toFormNumber(item.grams),
    calories: toFormNumber(item.calories),
    protein: toFormNumber(item.protein),
    carbs: toFormNumber(item.carbs),
    fat: toFormNumber(item.fat),
    saturated_fat: toFormNumber(item.saturated_fat),
    fiber: toFormNumber(item.fiber),
    sugars: toFormNumber(item.sugars),
    salt: toFormNumber(item.salt),
    source: item.source ?? "Pendiente de etiqueta oficial",
    verification_status: item.verification_status === "verificado" ? "verificado" : "pendiente",
    is_default: Boolean(item.is_default),
    sort_order: toNumber(item.sort_order),
  };
}

function TextArea({
  label,
  value,
  onChange,
  onClear,
  clearLabel = "Eliminar texto",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <section className="card-soft p-4">
      <label className="block">
      <span className="space-y-2 block">
        <span className="font-serif text-xl block leading-tight">{label}</span>
        <button type="button" className="btn-primary admin-product-clear-button" onClick={onClear ?? (() => {
          if (window.confirm(DELETE_ELEMENT_CONFIRMATION)) onChange("");
        })}>
          <Trash2 className="h-3.5 w-3.5" /> {clearLabel}
        </button>
      </span>
      <textarea className="field min-h-28 mt-1" value={value} onChange={e => onChange(e.target.value)} />
      </label>
    </section>
  );
}

function TextAreaWithPdf({
  label,
  value,
  pdfUrl,
  onChange,
  onUploadPdf,
  onClearPdf,
  onClearText,
  clearTextLabel = "Eliminar texto",
}: {
  label: string;
  value: string;
  pdfUrl: string;
  onChange: (value: string) => void;
  onUploadPdf: (file: File) => void;
  onClearPdf: () => void;
  onClearText?: () => void;
  clearTextLabel?: string;
}) {
  return (
    <section className="card-soft p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl leading-tight">{label}</h3>
          <p className="text-xs muted mt-1">Texto editable y PDF opcional.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn-primary cursor-pointer justify-center">
            <FileText className="h-4 w-4" /> {pdfUrl ? "Sustituir PDF" : "Subir PDF"}
            <input
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) onUploadPdf(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {pdfUrl && (
            <>
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                <FileText className="h-4 w-4" /> Ver PDF
              </a>
              <button type="button" className="btn-primary admin-product-clear-button" onClick={onClearPdf}>
                <Trash2 className="h-3.5 w-3.5" /> Borrar PDF
              </button>
            </>
          )}
          <button type="button" className="btn-primary admin-product-clear-button" onClick={onClearText ?? (() => {
            if (window.confirm(DELETE_ELEMENT_CONFIRMATION)) onChange("");
          })}>
            <Trash2 className="h-3.5 w-3.5" /> {clearTextLabel}
          </button>
        </div>
      </div>
      <textarea className="field min-h-28" value={value} onChange={event => onChange(event.target.value)} />
    </section>
  );
}

function BenefitItemsEditor({
  value,
  onEdit,
  onDelete,
}: {
  value: string;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const items = splitContentItems(value);
  if (!items.length) return null;

  return (
    <section className="card-soft p-4 space-y-2">
      <h3 className="font-serif text-xl leading-tight">Beneficios individuales</h3>
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="rounded-2xl bg-white/85 border border-primary/20 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <p className="text-sm flex-1">{item}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-xs py-2" onClick={() => onEdit(index)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button type="button" className="btn-primary admin-product-clear-button" onClick={() => onDelete(index)}>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  quickSteps,
  step = "0.01",
}: {
  label: string;
  value: AdminNumberValue;
  onChange: (value: AdminNumberValue) => void;
  quickSteps?: number[];
  step?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  const quickAdjust = (delta: number) => {
    const next = Math.max(0, toNumber(draft || value) + delta);
    const cleanValue = Number(next.toFixed(3));
    setDraft(String(cleanValue));
    onChange(cleanValue);
  };

  return (
    <label className="admin-product-number-wrapper block">
      <span className="admin-product-number-label text-[11px] muted">
        <span>{label}</span>
      </span>
      <input
        ref={inputRef}
        className="field admin-product-number-field mt-1"
        type="number"
        min="0"
        step={step}
        value={draft}
        onFocus={e => selectInitialZero(e.currentTarget)}
        onChange={e => {
          const next = e.target.value;
          setDraft(next);
          onChange(next);
        }}
      />
      {quickSteps?.length ? (
        <span className="admin-product-quick-number-actions">
          {quickSteps.map(step => (
            <button
              key={step}
              type="button"
              className="admin-product-measure-fast-button admin-fast-number-button"
              onClick={() => quickAdjust(step)}
              aria-label={`${step > 0 ? "Sumar" : "Restar"} ${Math.abs(step)} ${label}`}
            >
              {step > 0 ? `+${step}` : step}
            </button>
          ))}
        </span>
      ) : null}
    </label>
  );
}

function ReadonlyMacro({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-product-readonly-macro">
      <span className="text-[11px] muted">{label}</span>
      <div className="field mt-1 bg-white/70 text-muted-foreground admin-product-readonly-macro-value">{value}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="rounded-2xl bg-secondary/80 p-3 flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-[hsl(330_80%_58%)]" />
      {label}
    </label>
  );
}

function MediaUploader({
  title,
  url,
  accept,
  icon,
  hint,
  highlightHint,
  clearLabel = "Eliminar",
  onUpload,
  onUrl,
  onClear,
}: {
  title: string;
  url: string;
  accept: string;
  icon: React.ReactNode;
  hint?: string;
  highlightHint?: boolean;
  clearLabel?: string;
  onUpload: (file: File) => void;
  onUrl: (url: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="rounded-[22px] bg-secondary/70 p-3">
      <div className="space-y-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-medium leading-tight">{icon}{title}</div>
        {onClear && (
          <button type="button" className="btn-primary admin-product-clear-button" onClick={onClear}>
            <Trash2 className="h-3.5 w-3.5" /> {clearLabel}
          </button>
        )}
      </div>
      {url && (
        <div className="admin-product-media-preview mb-2">
          <img src={url} alt="" />
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="btn-primary cursor-pointer justify-center">
          <Upload className="h-4 w-4" /> Subir
          <input type="file" className="hidden" accept={accept} onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
        <input className="field flex-1" placeholder="O pegar URL" value={url} onChange={e => onUrl(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary w-full mt-2">
        <Save className="h-4 w-4" /> Guardar producto
      </button>
      {hint && (
        <p className={highlightHint ? "mt-3 rounded-2xl border border-primary bg-white/90 p-3 text-sm font-medium text-foreground flex items-center gap-2" : "text-[11px] muted mt-2"}>
          {highlightHint && <MousePointerClick className="h-4 w-4 text-primary shrink-0" />}
          {hint}
        </p>
      )}
    </div>
  );
}

function MultiUrlEditor({
  title,
  icon,
  urls,
  uploadLabel,
  accept,
  onAdd,
  onUpdate,
  onRemove,
  onUpload,
}: {
  title: string;
  icon: React.ReactNode;
  urls: string[];
  uploadLabel?: string;
  accept?: string;
  onAdd: (url: string) => void;
  onUpdate?: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onUpload?: (file: File) => void;
}) {
  const [draft, setDraft] = useState("");
  const showImagePreview = accept?.startsWith("image");
  return (
    <section className="rounded-[22px] bg-secondary/60 p-3">
      <div className="space-y-2 mb-2">
        <div className="flex items-center gap-2 font-medium text-sm leading-tight">{icon}{title}</div>
      </div>
      <div className="space-y-2 mb-3">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className={showImagePreview ? "admin-product-gallery-item" : "rounded-xl bg-white p-2 flex items-center gap-2 text-xs"}>
            {showImagePreview && (
              <div className="admin-product-gallery-preview">
                <img src={url} alt="" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="truncate block text-xs">{url}</span>
            </div>
            {onUpdate && (
              <button type="button" className="btn-secondary text-[11px] py-1.5 px-2" onClick={() => {
                const edited = window.prompt("Editar elemento", url);
                if (edited !== null) onUpdate(index, edited);
              }}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
            <button type="button" className="btn-primary text-[11px] py-1.5 px-2" onClick={() => onRemove(index)}>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {onUpload && (
          <label className="btn-primary cursor-pointer justify-center">
            <Upload className="h-4 w-4" /> {uploadLabel}
            <input type="file" className="hidden" accept={accept} onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        )}
        <input className="field flex-1" placeholder="Pegar URL" value={draft} onChange={e => setDraft(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => { onAdd(draft); setDraft(""); }}><Plus className="h-4 w-4" /> Añadir</button>
      </div>
    </section>
  );
}
