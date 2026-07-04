import { useEffect, useMemo, useRef, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { selectInitialZero, type AdminNumberValue } from "@/lib/adminNumberInput";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileText, Image as ImageIcon, Link as LinkIcon, MousePointerClick, Plus, Save, Search, Trash2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import imgNutritionInternal from "@/assets/product-admin/nutricion-interna.jpg";
import imgNutritionObjective from "@/assets/product-admin/nutricion-objetiva-soft.jpg";
import imgNutritionExternal from "@/assets/product-admin/nutricion-externa-beige.png";

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
  observations: "Observaciones",
  free_text: "Texto libre",
  nutrition: "Información nutricional",
  measures: "Medidas habituales",
};

const PRODUCT_ADMIN_ACCESS_SECTIONS = [
  { id: "nutricion-interna", title: "Nutrición interna", image: imgNutritionInternal },
  { id: "nutricion-objetiva", title: "Nutrición objetiva", image: imgNutritionObjective },
  { id: "nutricion-externa", title: "Nutrición externa", image: imgNutritionExternal },
] as const;

const emptyMeasure: ProductMeasure = {
  name: "gramos",
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

const toNumber = (value: unknown) => Number(String(value ?? "").replace(",", ".")) || 0;
const toNullableNumber = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const toFormNumber = (value: unknown): AdminNumberValue => value === null || value === undefined ? "" : toNumber(value);
const asTextArray = (value: unknown): string[] => Array.isArray(value) ? value.filter(Boolean).map(String) : [];
const textToArray = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
const round1 = (value: number) => Math.round(value * 10) / 10;
const round4 = (value: number | null) => value === null ? "" : Math.round(value * 10000) / 10000;

function readProductBlockOrder(micronutrients: Record<string, unknown> | null | undefined): ProductBlockId[] {
  const rawOrder = micronutrients?.[PRODUCT_BLOCK_ORDER_KEY];
  const validIds = new Set(DEFAULT_PRODUCT_BLOCK_ORDER);
  const saved = Array.isArray(rawOrder) ? rawOrder.filter((id): id is ProductBlockId => typeof id === "string" && validIds.has(id as ProductBlockId)) : [];
  return [...saved, ...DEFAULT_PRODUCT_BLOCK_ORDER.filter(id => !saved.includes(id))];
}

function micronutrientsForEditor(micronutrients: Record<string, unknown> | null | undefined) {
  const next = { ...(micronutrients ?? {}) };
  delete next[PRODUCT_BLOCK_ORDER_KEY];
  return next;
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
    return parsed === null ? "" : round1(parsed * factor);
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

function nutritionFromServing(form: ProductForm) {
  const servingGrams = toNullableNumber(form.serving_grams);
  if (!servingGrams || servingGrams <= 0) return form;
  const scale = (value: AdminNumberValue) => {
    const parsed = toNullableNumber(value);
    return parsed === null ? "" : round1((parsed / servingGrams) * 100);
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readingLabel, setReadingLabel] = useState(false);

  const load = async () => {
    setLoading(true);
    const [catRes, prodRes] = await Promise.all([
      (supabase as any).from("product_categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      (supabase as any).from("products").select("*, product_measures(*)").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    ]);
    setLoading(false);
    if (catRes.error) toast.error(catRes.error.message);
    if (prodRes.error) toast.error(prodRes.error.message);
    setCategories((catRes.data ?? []) as ProductCategory[]);
    setProducts((prodRes.data ?? []).map(normalizeProduct));
  };

  useEffect(() => {
    load();
  }, []);

  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const categoryOptionLabel = (category: ProductCategory) => `${category.name}${category.is_active ? "" : " (oculta)"}`;

  const filteredProducts = useMemo(() => {
    const normalized = String(query ?? "").trim().toLowerCase();
    return products.filter(product => {
      if (filterCategory && product.category_id !== filterCategory) return false;
      if (!normalized) return true;
      const category = product.category_id ? categoryById.get(product.category_id) : null;
      const haystack = [
        product.name,
        category?.name,
        product.description,
        product.benefits,
        product.ingredients_text,
        product.observations,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, query, filterCategory, categoryById]);

  const resetProduct = () => setForm(emptyProduct);
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
    const preparedForm = nutritionFromServing(form);
    const kcalPerGram = perGram(preparedForm.calories, preparedForm.serving_calories, preparedForm.serving_grams);
    const proteinPerGram = perGram(preparedForm.protein, preparedForm.serving_protein, preparedForm.serving_grams);
    const carbsPerGram = perGram(preparedForm.carbs, preparedForm.serving_carbs, preparedForm.serving_grams);
    const fatPerGram = perGram(preparedForm.fat, preparedForm.serving_fat, preparedForm.serving_grams);
    const fiberPerGram = perGram(preparedForm.fiber, preparedForm.serving_fiber, preparedForm.serving_grams);
    const payload = {
      category_id: preparedForm.category_id || null,
      name: preparedForm.name.trim(),
      slug: preparedForm.id ? undefined : slugify(preparedForm.name),
      aliases: textToArray(preparedForm.aliasesText),
      line: preparedForm.line || null,
      image_url: preparedForm.image_url || null,
      gallery_urls: preparedForm.gallery_urls,
      video_urls: preparedForm.video_urls,
      pdf_urls: preparedForm.pdf_urls,
      external_urls: preparedForm.external_urls,
      description: preparedForm.description || null,
      benefits: preparedForm.benefits || null,
      usage: preparedForm.usage || null,
      ingredients_text: preparedForm.ingredients_text || null,
      observations: preparedForm.observations || null,
      free_text: preparedForm.free_text || null,
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
      micronutrients: { ...micronutrients, [PRODUCT_BLOCK_ORDER_KEY]: form.blockOrder },
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
    const calculatedMeasures = measuresFromProductNutrition(preparedForm.measures, preparedForm);
    const measures = calculatedMeasures
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
    setSaving(false);
    toast.success(form.id ? "Producto actualizado" : "Producto creado");
    resetProduct();
    load();
  };

  const editProduct = (product: Product) => {
    const measures = (product.product_measures ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
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
      observations: product.observations ?? "",
      free_text: product.free_text ?? "",
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
      measures: measures.length ? measures.map(normalizeMeasure) : [emptyMeasure],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const measures = (product.product_measures ?? []).map((measure, index) => ({ ...measure, id: undefined, product_id: data.id, sort_order: index }));
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

  const removeUrl = (key: "external_urls" | "video_urls" | "pdf_urls" | "gallery_urls", index: number) => {
    const nextUrls = form[key].filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
    if (form.id) {
      (supabase as any)
        .from("products")
        .update({ [key]: nextUrls, updated_at: new Date().toISOString() })
        .eq("id", form.id)
        .then(({ error }: any) => {
          if (error) toast.error(error.message);
          else toast.success("Contenido eliminado del producto");
        });
    }
  };

  const clearProductMedia = (key: "image_url" | "spoon_image_url" | "label_file_url") => {
    setForm(prev => ({ ...prev, [key]: "" }));
    if (form.id) {
      (supabase as any)
        .from("products")
        .update({ [key]: null, updated_at: new Date().toISOString() })
        .eq("id", form.id)
        .then(({ error }: any) => {
          if (error) toast.error(error.message);
          else toast.success("Archivo eliminado del producto");
        });
    }
  };

  const updateMeasure = (index: number, patch: Partial<ProductMeasure>) => {
    setForm(prev => ({
      ...prev,
      measures: prev.measures.map((measure, i) => i === index ? measureFromProductNutrition({ ...measure, ...patch }, prev) : measure),
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

  const readNutritionLabel = async (file: File) => {
    try {
      setReadingLabel(true);
      const labelUrl = await uploadProductFile(file, "labels");
      const dataUrl = await fileToDataUrl(file);
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/read-nutrition-label", {
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
      if (!response.ok) throw new Error(payload?.error || "No se pudo leer la etiqueta");
      setForm(prev => {
        const next: ProductForm = {
          ...prev,
          label_file_url: labelUrl,
          serving_size: payload.serving_size ?? prev.serving_size ?? "",
          serving_grams: payload.serving_grams ?? prev.serving_grams,
          serving_calories: payload.serving_calories ?? prev.serving_calories,
          serving_protein: payload.serving_protein ?? prev.serving_protein,
          serving_carbs: payload.serving_carbs ?? prev.serving_carbs,
          serving_sugars: payload.serving_sugars ?? prev.serving_sugars,
          serving_fat: payload.serving_fat ?? prev.serving_fat,
          serving_saturated_fat: payload.serving_saturated_fat ?? prev.serving_saturated_fat,
          serving_fiber: payload.serving_fiber ?? prev.serving_fiber,
          serving_salt: payload.serving_salt ?? prev.serving_salt,
          calories: payload.calories ?? prev.calories,
          protein: payload.protein ?? prev.protein,
          carbs: payload.carbs ?? prev.carbs,
          sugars: payload.sugars ?? prev.sugars,
          fat: payload.fat ?? prev.fat,
          saturated_fat: payload.saturated_fat ?? prev.saturated_fat,
          fiber: payload.fiber ?? prev.fiber,
          salt: payload.salt ?? prev.salt,
          source: payload.source || prev.source || `Etiqueta nutricional: ${file.name}`,
          verification_status: "pendiente",
          nutrition_verified_at: null,
        };
        return nutritionFromServing(next);
      });
      toast.success("Etiqueta leída. Revisa los datos antes de verificar.");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo leer la etiqueta nutricional");
    } finally {
      setReadingLabel(false);
    }
  };

  const markDefaultMeasure = (index: number) => {
    setForm(prev => ({
      ...prev,
      measures: prev.measures.map((measure, i) => ({ ...measure, is_default: i === index })),
    }));
  };

  return (
    <div className="admin-products pb-28 max-w-5xl mx-auto">
      <AdminPageHeader
        title="Herbalife Nutrición"
        subtitle="Base oficial de productos para clientes, recetas y cálculos nutricionales."
      />

      <section className="admin-products-access-list space-y-3 mb-5">
        {PRODUCT_ADMIN_ACCESS_SECTIONS.map(section => {
          const isOpen = openAccessSection === section.id;
          return (
            <article key={section.id} data-section={section.id} className={`admin-products-access-card card-soft ${isOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="admin-products-access-trigger"
                onClick={() => setOpenAccessSection(isOpen ? null : section.id)}
                aria-expanded={isOpen}
              >
                <span className="admin-products-access-image-wrap">
                  <img src={section.image} alt={section.title} />
                </span>
                <span className="admin-products-access-title">{section.title}</span>
                <ArrowDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="admin-products-access-body">
                  <section className="grid grid-cols-1 gap-5 mb-5">
        <form onSubmit={saveCategory} className="card-soft admin-products-panel p-4 space-y-4">
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
                <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && uploadCategoryImage(e.target.files[0])} />
              </label>
              <input className="field flex-1" placeholder="O pegar URL de imagen" value={categoryImageUrl} onChange={e => setCategoryImageUrl(e.target.value)} />
              {categoryImageUrl && <button type="button" className="btn-primary" onClick={() => setCategoryImageUrl("")}><Trash2 className="h-4 w-4" /> Borrar</button>}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving}><Save className="h-4 w-4" /> Guardar categoría</button>
            {editingCategory && <button type="button" className="btn-secondary" onClick={resetCategory}><X className="h-4 w-4" /> Cancelar</button>}
          </div>
          <div className="space-y-2 pt-2">
            {categories.map(category => (
              <div key={category.id} className="rounded-2xl bg-secondary/70 p-3 grid grid-cols-[64px_1fr_auto_auto] items-center gap-3">
                <div className="h-16 w-16 rounded-2xl overflow-hidden border border-primary/20 bg-white">
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center bg-gradient-rosa/20"><ImageIcon className="h-5 w-5 text-primary" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{category.name}</div>
                  <div className="text-[11px] muted line-clamp-2">{category.description || "Sin descripción"}</div>
                  <div className="text-[11px] text-primary font-bold mt-1">{category.is_active ? "Activa" : "Oculta"}</div>
                </div>
                <button type="button" className="btn-primary text-xs py-2" onClick={() => deleteCategory(category)}>
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
                <details className="relative">
                  <summary className="list-none cursor-pointer rounded-full border border-primary bg-white px-3 py-2 text-primary font-black">⋮</summary>
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-primary bg-white p-2 shadow-xl space-y-1">
                    <button type="button" className="w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-[#FFF7FA]" onClick={() => editCategory(category)}>Editar categoría</button>
                    <label className="block w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-[#FFF7FA] cursor-pointer">
                      Cambiar imagen
                      <input type="file" className="hidden" accept="image/*" onChange={e => {
                        if (e.target.files?.[0]) {
                          uploadCategoryImage(e.target.files[0], category);
                        }
                      }} />
                    </label>
                    <button type="button" className="w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-[#FFF7FA]" onClick={() => toggleCategory(category)}>{category.is_active ? "Ocultar" : "Mostrar"}</button>
                    <button type="button" className="w-full text-left rounded-xl px-3 py-2 text-sm text-destructive hover:bg-[#FFF7FA]" onClick={() => deleteCategory(category)}>Eliminar categoría</button>
                  </div>
                </details>
              </div>
            ))}
          </div>
        </form>

        <div className="card-soft admin-products-panel p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="h-4 w-4 muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="field pl-9" placeholder="Buscar producto…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <select className="field sm:max-w-56" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map(category => <option key={category.id} value={category.id}>{categoryOptionLabel(category)}</option>)}
            </select>
          </div>
          {loading ? <div className="muted text-sm">Cargando productos…</div> : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className="admin-product-row admin-product-list-card rounded-[26px] bg-white/90 border border-primary/10 shadow-sm overflow-hidden">
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
                      <div className="text-sm muted mt-1">{product.category_id ? categoryById.get(product.category_id)?.name ?? "Sin categoría" : "Sin categoría"}</div>
                      <div className="admin-product-list-tags text-[10px]">
                        <span className="chip">{product.is_active ? "Activo" : "Inactivo"}</span>
                        <span className={product.verification_status === "verificado" ? "chip-lavender" : "chip"}>{product.verification_status}</span>
                        {product.visible_to_clients && <span className="chip-lavender">Clientes</span>}
                        {product.available_for_recipes && <span className="chip-lavender">Recetas</span>}
                        {product.informative_only && <span className="chip">Solo informativo</span>}
                      </div>
                    </div>
                  </div>
                  <div className="admin-product-list-actions">
                    <button type="button" className="admin-product-action-button" onClick={() => editProduct(product)}>Editar</button>
                    <button type="button" className="admin-product-action-button" onClick={() => duplicateProduct(product)}>Duplicar</button>
                    <button type="button" className="admin-product-action-button" onClick={() => toggleProduct(product)}>{product.is_active ? "Desactivar" : "Activar"}</button>
                    <button type="button" className="admin-product-action-button text-destructive" onClick={() => deleteProduct(product)}>Eliminar</button>
                  </div>
                </div>
              ))}
              {!filteredProducts.length && <div className="text-sm muted text-center p-6">No hay productos que coincidan.</div>}
            </div>
          )}
        </div>
                  </section>

      <form onSubmit={saveProduct} className="space-y-5">
        <section className="card-soft p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">{form.id ? "Editar producto" : "Nuevo producto"}</h2>
            <p className="text-xs muted">Información visible, materiales, nutrición por 100 g y medidas habituales.</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" className="btn-primary text-xs py-2" onClick={clearProductBasics}>
              <Trash2 className="h-3.5 w-3.5" /> Borrar
            </button>
            {form.id && <button type="button" className="btn-secondary" onClick={resetProduct}><Plus className="h-4 w-4" /> Nuevo</button>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="field" placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <select className="field" value={form.category_id ?? ""} onChange={e => setForm({ ...form, category_id: e.target.value })}>
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
          <input className="field" placeholder="Línea / categoría comercial" value={form.line ?? ""} onChange={e => setForm({ ...form, line: e.target.value })} />
          <select className="field" value={form.verification_status} onChange={e => setForm({ ...form, verification_status: e.target.value as ProductForm["verification_status"] })}>
            <option value="pendiente">Pendiente</option>
            <option value="verificado">Verificado</option>
          </select>
          <input
            className="field"
            type="datetime-local"
            value={form.nutrition_verified_at ? form.nutrition_verified_at.slice(0, 16) : ""}
            onChange={e => setForm({ ...form, nutrition_verified_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            aria-label="Fecha de verificación"
          />
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
        </section>

        <section className="rounded-[22px] bg-secondary/60 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-serif text-xl leading-none">Etiqueta nutricional oficial</h3>
              <p className="text-xs muted mt-1">Lee una etiqueta como ayuda. El producto seguirá en Pendiente hasta que lo revises y lo marques como Verificado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="btn-primary cursor-pointer justify-center">
                <FileText className="h-4 w-4" /> {readingLabel ? "Leyendo…" : "Leer etiqueta nutricional"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  disabled={readingLabel}
                  onChange={e => e.target.files?.[0] && readNutritionLabel(e.target.files[0])}
                />
              </label>
              <button type="button" className="btn-primary" onClick={() => clearProductMedia("label_file_url")}>
                <Trash2 className="h-4 w-4" /> Borrar
              </button>
            </div>
          </div>
          {form.label_file_url && (
            <a href={form.label_file_url} target="_blank" rel="noreferrer" className="text-xs text-primary font-bold underline">
              Ver etiqueta guardada
            </a>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <input className="field md:col-span-2" placeholder="Tamaño de ración oficial (ej. 2 cucharas rasas / 26 g)" value={form.serving_size ?? ""} onChange={e => setForm({ ...form, serving_size: e.target.value })} />
            <NumberField label="Gramos por ración" value={form.serving_grams} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_grams: value }))} />
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MediaUploader
            title="Imagen principal"
            url={form.image_url ?? ""}
            accept="image/*"
            icon={<ImageIcon className="h-4 w-4" />}
            onUpload={file => uploadInto(file, "main")}
            onUrl={url => setForm(prev => ({ ...prev, image_url: url }))}
            onClear={() => clearProductMedia("image_url")}
          />
          <MediaUploader
            title="Imagen cuchara oficial Herbalife"
            url={form.spoon_image_url ?? ""}
            accept="image/*"
            icon={<ImageIcon className="h-4 w-4" />}
            onUpload={file => uploadInto(file, "spoon")}
            onUrl={url => setForm(prev => ({ ...prev, spoon_image_url: url }))}
            onClear={() => clearProductMedia("spoon_image_url")}
            hint="Pulsa aquí para comprobar la medida de la cuchara oficial."
            highlightHint
          />
        </div>

        <section className="rounded-[22px] bg-secondary/60 p-3">
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
        </section>

        <MultiUrlEditor title="Galería de imágenes" icon={<ImageIcon className="h-4 w-4" />} urls={form.gallery_urls} onAdd={url => addUrl("gallery_urls", url)} onRemove={index => removeUrl("gallery_urls", index)} onClear={() => setForm(prev => ({ ...prev, gallery_urls: [] }))} uploadLabel="Subir imagen" accept="image/*" onUpload={file => uploadInto(file, "gallery")} />
        <MultiUrlEditor title="Vídeos" icon={<Video className="h-4 w-4" />} urls={form.video_urls} onAdd={url => addUrl("video_urls", url)} onRemove={index => removeUrl("video_urls", index)} onClear={() => setForm(prev => ({ ...prev, video_urls: [] }))} uploadLabel="Subir vídeo" accept="video/*" onUpload={file => uploadInto(file, "video")} />
        <MultiUrlEditor title="PDFs" icon={<FileText className="h-4 w-4" />} urls={form.pdf_urls} onAdd={url => addUrl("pdf_urls", url)} onRemove={index => removeUrl("pdf_urls", index)} onClear={() => setForm(prev => ({ ...prev, pdf_urls: [] }))} uploadLabel="Subir PDF" accept="application/pdf" onUpload={file => uploadInto(file, "pdf")} />
        <MultiUrlEditor title="URLs externas" icon={<LinkIcon className="h-4 w-4" />} urls={form.external_urls} onAdd={url => addUrl("external_urls", url)} onRemove={index => removeUrl("external_urls", index)} onClear={() => setForm(prev => ({ ...prev, external_urls: [] }))} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextArea label="Descripción" value={form.description ?? ""} onChange={value => setForm({ ...form, description: value })} />
          <TextArea label="Beneficios" value={form.benefits ?? ""} onChange={value => setForm({ ...form, benefits: value })} />
          <TextArea label="Modo de empleo" value={form.usage ?? ""} onChange={value => setForm({ ...form, usage: value })} />
          <TextArea label="Ingredientes" value={form.ingredients_text ?? ""} onChange={value => setForm({ ...form, ingredients_text: value })} />
          <TextArea label="Observaciones" value={form.observations ?? ""} onChange={value => setForm({ ...form, observations: value })} />
          <TextArea label="Texto libre" value={form.free_text ?? ""} onChange={value => setForm({ ...form, free_text: value })} />
        </div>

        <section className="card-soft p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="font-serif text-xl">Información nutricional por ración oficial</h3>
            <button type="button" className="btn-primary text-xs py-2" onClick={clearServingNutrition}>
              <Trash2 className="h-3.5 w-3.5" /> Borrar
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <NumberField label="Calorías/ración" value={form.serving_calories} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_calories: value }))} />
            <NumberField label="Proteínas/ración" value={form.serving_protein} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_protein: value }))} />
            <NumberField label="Hidratos/ración" value={form.serving_carbs} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_carbs: value }))} />
            <NumberField label="Azúcares/ración" value={form.serving_sugars} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_sugars: value }))} />
            <NumberField label="Grasas/ración" value={form.serving_fat} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_fat: value }))} />
            <NumberField label="Saturadas/ración" value={form.serving_saturated_fat} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_saturated_fat: value }))} />
            <NumberField label="Fibra/ración" value={form.serving_fiber} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_fiber: value }))} />
            <NumberField label="Sal/ración" value={form.serving_salt} onChange={value => setForm(prev => nutritionFromServing({ ...prev, serving_salt: value }))} />
          </div>

          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="font-serif text-xl">Información nutricional por 100 g</h3>
            <button type="button" className="btn-primary text-xs py-2" onClick={clearPer100Nutrition}>
              <Trash2 className="h-3.5 w-3.5" /> Borrar
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumberField label="Calorías" value={form.calories} onChange={value => updateNutrition({ calories: value })} />
            <NumberField label="Proteínas" value={form.protein} onChange={value => updateNutrition({ protein: value })} />
            <NumberField label="Hidratos" value={form.carbs} onChange={value => updateNutrition({ carbs: value })} />
            <NumberField label="Grasas" value={form.fat} onChange={value => updateNutrition({ fat: value })} />
            <NumberField label="Grasas saturadas" value={form.saturated_fat} onChange={value => updateNutrition({ saturated_fat: value })} />
            <NumberField label="Fibra" value={form.fiber} onChange={value => updateNutrition({ fiber: value })} />
            <NumberField label="Azúcares" value={form.sugars} onChange={value => updateNutrition({ sugars: value })} />
            <NumberField label="Sal" value={form.salt} onChange={value => updateNutrition({ salt: value })} />
          </div>
          <div className="rounded-[22px] bg-secondary/70 p-3 mt-4">
            <h4 className="font-bold text-sm mb-2">Cálculo automático por gramo</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <ReadonlyMacro label="Kcal/g" value={perGram(form.calories, form.serving_calories, form.serving_grams) || "—"} />
              <ReadonlyMacro label="Proteína/g" value={perGram(form.protein, form.serving_protein, form.serving_grams) || "—"} />
              <ReadonlyMacro label="Hidratos/g" value={perGram(form.carbs, form.serving_carbs, form.serving_grams) || "—"} />
              <ReadonlyMacro label="Grasa/g" value={perGram(form.fat, form.serving_fat, form.serving_grams) || "—"} />
              <ReadonlyMacro label="Fibra/g" value={perGram(form.fiber, form.serving_fiber, form.serving_grams) || "—"} />
            </div>
          </div>
          <label className="block text-xs muted mt-3 mb-1">Micronutrientes opcionales (JSON)</label>
          <textarea className="field min-h-24 font-mono text-xs" value={form.micronutrientsText} onChange={e => setForm({ ...form, micronutrientsText: e.target.value })} placeholder='{"calcium_mg": 120, "iron_mg": 2}' />
        </section>

        <section className="card-soft p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="font-serif text-xl">Medidas habituales</h3>
              <p className="text-xs muted">Introduce solo el nombre y los gramos. Los macros de cada medida se calculan automáticamente desde la ficha por 100 g.</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setForm(prev => ({
                ...prev,
                measures: [
                  ...prev.measures,
                  measureFromProductNutrition({ ...emptyMeasure, name: "", is_default: false, sort_order: prev.measures.length }, prev),
                ],
              }))}
            >
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </div>
          <div className="space-y-3">
            {form.measures.map((measure, index) => (
              <div key={index} className="admin-measure-row rounded-[22px] bg-secondary/70 p-3">
                <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                  <input className="field md:col-span-2" placeholder="Nombre medida" value={measure.name} onChange={e => updateMeasure(index, { name: e.target.value })} />
                  <NumberField label="Gramos" value={measure.grams} onChange={value => updateMeasure(index, { grams: value })} />
                  <ReadonlyMacro label="Kcal" value={measure.calories} />
                  <ReadonlyMacro label="Prot" value={`${measure.protein} g`} />
                  <ReadonlyMacro label="Hidr" value={`${measure.carbs} g`} />
                  <ReadonlyMacro label="Grasa" value={`${measure.fat} g`} />
                  <ReadonlyMacro label="Fibra" value={`${measure.fiber} g`} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2 mt-2">
                  <input
                    className="field"
                    placeholder="Fuente de la medida"
                    value={measure.source}
                    onChange={e => updateMeasure(index, { source: e.target.value })}
                  />
                  <select
                    className="field"
                    value={measure.verification_status}
                    onChange={e => updateMeasure(index, { verification_status: e.target.value as ProductMeasure["verification_status"] })}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="verificado">Verificado</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button type="button" className={measure.is_default ? "btn-primary text-xs py-2" : "btn-secondary text-xs py-2"} onClick={() => markDefaultMeasure(index)}>Medida principal</button>
                  <button type="button" className="btn-secondary text-xs py-2 text-destructive" onClick={() => setForm(prev => ({ ...prev, measures: prev.measures.filter((_, i) => i !== index) }))}><Trash2 className="h-3.5 w-3.5" /> Eliminar medida</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-soft p-4 sm:p-5">
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
        </section>

        <button className="btn-primary w-full" disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar producto"}
        </button>
      </form>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
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
  return {
    id: item.id,
    name: item.name ?? "",
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

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <section className="card-soft p-4">
      <label className="block">
      <span className="space-y-2 block">
        <span className="font-serif text-xl block leading-tight">{label}</span>
        <button type="button" className="btn-primary admin-product-clear-button" onClick={() => onChange("")}>
          <Trash2 className="h-3.5 w-3.5" /> Borrar
        </button>
      </span>
      <textarea className="field min-h-28 mt-1" value={value} onChange={e => onChange(e.target.value)} />
      </label>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: AdminNumberValue; onChange: (value: AdminNumberValue) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  return (
    <label className="block">
      <span className="text-[11px] muted">{label}</span>
      <input
        ref={inputRef}
        className="field admin-product-number-field mt-1"
        type="number"
        step="0.01"
        value={draft}
        onFocus={e => selectInitialZero(e.currentTarget)}
        onChange={e => {
          const next = e.target.value;
          setDraft(next);
          onChange(next);
        }}
      />
    </label>
  );
}

function ReadonlyMacro({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-[11px] muted">{label}</span>
      <div className="field mt-1 bg-white/70 text-muted-foreground">{value}</div>
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
            <Trash2 className="h-3.5 w-3.5" /> Borrar
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
  onRemove,
  onClear,
  onUpload,
}: {
  title: string;
  icon: React.ReactNode;
  urls: string[];
  uploadLabel?: string;
  accept?: string;
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  onClear?: () => void;
  onUpload?: (file: File) => void;
}) {
  const [draft, setDraft] = useState("");
  const showImagePreview = accept?.startsWith("image");
  return (
    <section className="rounded-[22px] bg-secondary/60 p-3">
      <div className="space-y-2 mb-2">
        <div className="flex items-center gap-2 font-medium text-sm leading-tight">{icon}{title}</div>
        <button type="button" className="btn-primary admin-product-clear-button" onClick={onClear}>
          <Trash2 className="h-3.5 w-3.5" /> Borrar
        </button>
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
