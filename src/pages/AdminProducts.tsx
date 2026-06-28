import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, FileText, Image as ImageIcon, Link as LinkIcon, Plus, Save, Search, Trash2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";

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
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
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
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugars: number;
  salt: number;
  micronutrients: Record<string, unknown>;
  source: string;
  verification_status: "verificado" | "pendiente";
  nutrition_effective_from: string | null;
  is_active: boolean;
  visible_to_clients: boolean;
  available_for_recipes: boolean;
  informative_only: boolean;
  herbalife_spoon_measure_id: string | null;
  spoon_image_url: string | null;
  sort_order: number;
  product_measures?: ProductMeasure[];
};

type ProductForm = Omit<Product, "id" | "slug" | "product_measures"> & {
  id?: string;
  aliasesText: string;
  micronutrientsText: string;
  measures: ProductMeasure[];
};

const emptyMeasure: ProductMeasure = {
  name: "gramos",
  grams: 100,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
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
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugars: 0,
  salt: 0,
  micronutrients: {},
  micronutrientsText: "{}",
  source: "Pendiente de etiqueta oficial",
  verification_status: "pendiente",
  nutrition_effective_from: null,
  is_active: true,
  visible_to_clients: true,
  available_for_recipes: true,
  informative_only: false,
  herbalife_spoon_measure_id: null,
  spoon_image_url: "",
  sort_order: 0,
  measures: [emptyMeasure],
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `producto-${Date.now()}`;

const toNumber = (value: unknown) => Number(String(value ?? "").replace(",", ".")) || 0;
const asTextArray = (value: unknown): string[] => Array.isArray(value) ? value.filter(Boolean).map(String) : [];
const textToArray = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
const round1 = (value: number) => Math.round(value * 10) / 10;

function measureFromProductNutrition(measure: ProductMeasure, product: ProductForm): ProductMeasure {
  const grams = toNumber(measure.grams);
  const factor = grams / 100;
  return {
    ...measure,
    grams,
    calories: round1(toNumber(product.calories) * factor),
    protein: round1(toNumber(product.protein) * factor),
    carbs: round1(toNumber(product.carbs) * factor),
    fat: round1(toNumber(product.fat) * factor),
    fiber: round1(toNumber(product.fiber) * factor),
  };
}

function measuresFromProductNutrition(measures: ProductMeasure[], product: ProductForm) {
  return measures.map(measure => measureFromProductNutrition(measure, product));
}

async function uploadProductFile(file: File, folder: string) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("product-media").getPublicUrl(path);
  return data.publicUrl;
}

export default function AdminProducts() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
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
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return toast.error("Escribe el nombre de la categoría");
    const payload = {
      name,
      slug: editingCategory?.slug || slugify(name),
      description: categoryDescription.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const result = editingCategory
      ? await (supabase as any).from("product_categories").update(payload).eq("id", editingCategory.id)
      : await (supabase as any).from("product_categories").insert(payload);
    if (result.error) return toast.error(result.error.message);
    toast.success(editingCategory ? "Categoría actualizada" : "Categoría creada");
    resetCategory();
    load();
  };

  const editCategory = (category: ProductCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description ?? "");
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
    const payload = {
      category_id: form.category_id || null,
      name: form.name.trim(),
      slug: form.id ? undefined : slugify(form.name),
      aliases: textToArray(form.aliasesText),
      line: form.line || null,
      image_url: form.image_url || null,
      gallery_urls: form.gallery_urls,
      video_urls: form.video_urls,
      pdf_urls: form.pdf_urls,
      external_urls: form.external_urls,
      description: form.description || null,
      benefits: form.benefits || null,
      usage: form.usage || null,
      ingredients_text: form.ingredients_text || null,
      observations: form.observations || null,
      free_text: form.free_text || null,
      calories: toNumber(form.calories),
      protein: toNumber(form.protein),
      carbs: toNumber(form.carbs),
      fat: toNumber(form.fat),
      fiber: toNumber(form.fiber),
      sugars: toNumber(form.sugars),
      salt: toNumber(form.salt),
      micronutrients,
      source: form.source || "Pendiente de etiqueta oficial",
      verification_status: form.verification_status,
      nutrition_effective_from: form.nutrition_effective_from || new Date().toISOString(),
      is_active: form.is_active,
      visible_to_clients: form.visible_to_clients,
      available_for_recipes: form.available_for_recipes,
      informative_only: form.informative_only,
      spoon_image_url: form.spoon_image_url || null,
      sort_order: toNumber(form.sort_order),
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
    const calculatedMeasures = measuresFromProductNutrition(form.measures, form);
    const measures = calculatedMeasures
      .filter(measure => measure.name.trim())
      .map((measure, index) => ({
        product_id: productId,
        name: measure.name.trim(),
        grams: toNumber(measure.grams),
        calories: toNumber(measure.calories),
        protein: toNumber(measure.protein),
        carbs: toNumber(measure.carbs),
        fat: toNumber(measure.fat),
        fiber: toNumber(measure.fiber),
        source: measure.source || form.source || "Pendiente de etiqueta oficial",
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
      spoon_image_url: product.spoon_image_url ?? "",
      micronutrientsText: JSON.stringify(product.micronutrients ?? {}, null, 2),
      source: product.source ?? "Pendiente de etiqueta oficial",
      verification_status: product.verification_status ?? "pendiente",
      nutrition_effective_from: product.nutrition_effective_from ?? null,
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
      if (kind === "main") setForm(prev => ({ ...prev, image_url: url }));
      if (kind === "gallery") setForm(prev => ({ ...prev, gallery_urls: [...prev.gallery_urls, url] }));
      if (kind === "video") setForm(prev => ({ ...prev, video_urls: [...prev.video_urls, url] }));
      if (kind === "pdf") setForm(prev => ({ ...prev, pdf_urls: [...prev.pdf_urls, url] }));
      if (kind === "spoon") setForm(prev => ({ ...prev, spoon_image_url: url }));
    } catch (err: any) {
      toast.error(err?.message || "No se pudo subir el archivo");
    } finally {
      setSaving(false);
    }
  };

  const addUrl = (key: "external_urls" | "video_urls" | "pdf_urls" | "gallery_urls", value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setForm(prev => ({ ...prev, [key]: [...prev[key], clean] }));
  };

  const removeUrl = (key: "external_urls" | "video_urls" | "pdf_urls" | "gallery_urls", index: number) => {
    setForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };

  const updateMeasure = (index: number, patch: Partial<ProductMeasure>) => {
    setForm(prev => ({
      ...prev,
      measures: prev.measures.map((measure, i) => i === index ? measureFromProductNutrition({ ...measure, ...patch }, prev) : measure),
    }));
  };

  const updateNutrition = (patch: Partial<Pick<ProductForm, "calories" | "protein" | "carbs" | "fat" | "fiber" | "sugars" | "salt">>) => {
    setForm(prev => {
      const next = { ...prev, ...patch };
      return { ...next, measures: measuresFromProductNutrition(next.measures, next) };
    });
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
        title="Productos"
        subtitle="Base oficial de productos para clientes, recetas y cálculos nutricionales."
      />

      <section className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-4 mb-5">
        <form onSubmit={saveCategory} className="card-soft admin-products-panel p-4 space-y-4">
          <div>
            <h2 className="font-serif text-xl">{editingCategory ? "Editar categoría" : "Nueva categoría"}</h2>
            <p className="text-xs muted">Crea carpetas libremente: control de peso, hidratación, deportiva…</p>
          </div>
          <input className="field" placeholder="Nombre de categoría" value={categoryName} onChange={e => setCategoryName(e.target.value)} />
          <textarea className="field min-h-20" placeholder="Descripción opcional" value={categoryDescription} onChange={e => setCategoryDescription(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving}><Save className="h-4 w-4" /> Guardar categoría</button>
            {editingCategory && <button type="button" className="btn-secondary" onClick={resetCategory}><X className="h-4 w-4" /> Cancelar</button>}
          </div>
          <div className="space-y-2 pt-2">
            {categories.map(category => (
              <div key={category.id} className="rounded-2xl bg-secondary/70 p-3 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{category.name}</div>
                  <div className="text-[11px] muted">{category.is_active ? "Activa" : "Oculta"} · {category.slug}</div>
                </div>
                <button type="button" className="p-2 rounded-xl bg-white" onClick={() => editCategory(category)} aria-label="Editar categoría"><Save className="h-4 w-4" /></button>
                <button type="button" className="p-2 rounded-xl bg-white" onClick={() => toggleCategory(category)} aria-label="Activar o desactivar">{category.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button type="button" className="p-2 rounded-xl bg-white text-destructive" onClick={() => deleteCategory(category)} aria-label="Eliminar categoría"><Trash2 className="h-4 w-4" /></button>
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
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          {loading ? <div className="muted text-sm">Cargando productos…</div> : (
            <div className="space-y-3 max-h-[470px] overflow-auto pr-1">
              {filteredProducts.map(product => (
                <div key={product.id} className="admin-product-row rounded-[22px] bg-white/90 border border-primary/10 shadow-sm overflow-hidden">
                  <div className="flex gap-3 p-3">
                    {product.image_url ? <img src={product.image_url} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : <div className="h-20 w-20 rounded-2xl bg-gradient-rosa/20 grid place-items-center"><ImageIcon className="h-5 w-5 text-primary" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{product.name}</div>
                      <div className="text-xs muted truncate">{product.category_id ? categoryById.get(product.category_id)?.name ?? "Sin categoría" : "Sin categoría"}</div>
                      <div className="flex flex-wrap gap-1.5 mt-2 text-[10px]">
                        <span className="chip">{product.is_active ? "Activo" : "Inactivo"}</span>
                        <span className={product.verification_status === "verificado" ? "chip-lavender" : "chip"}>{product.verification_status}</span>
                        {product.visible_to_clients && <span className="chip-lavender">Clientes</span>}
                        {product.available_for_recipes && <span className="chip-lavender">Recetas</span>}
                        {product.informative_only && <span className="chip">Solo informativo</span>}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 border-t border-border/60 text-xs">
                    <button className="py-2 hover:bg-secondary" onClick={() => editProduct(product)}>Editar</button>
                    <button className="py-2 hover:bg-secondary" onClick={() => duplicateProduct(product)}>Duplicar</button>
                    <button className="py-2 hover:bg-secondary" onClick={() => toggleProduct(product)}>{product.is_active ? "Desactivar" : "Activar"}</button>
                    <button className="py-2 hover:bg-secondary text-destructive" onClick={() => deleteProduct(product)}>Eliminar</button>
                    <div className="py-2 text-center muted">{product.calories} kcal</div>
                  </div>
                </div>
              ))}
              {!filteredProducts.length && <div className="text-sm muted text-center p-6">No hay productos que coincidan.</div>}
            </div>
          )}
        </div>
      </section>

      <form onSubmit={saveProduct} className="card-soft admin-products-form p-4 sm:p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">{form.id ? "Editar producto" : "Nuevo producto"}</h2>
            <p className="text-xs muted">Información visible, materiales, nutrición por 100 g y medidas habituales.</p>
          </div>
          {form.id && <button type="button" className="btn-secondary" onClick={resetProduct}><Plus className="h-4 w-4" /> Nuevo</button>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="field" placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <select className="field" value={form.category_id ?? ""} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Sin categoría</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <input className="field" placeholder="Línea / categoría comercial" value={form.line ?? ""} onChange={e => setForm({ ...form, line: e.target.value })} />
          <select className="field" value={form.verification_status} onChange={e => setForm({ ...form, verification_status: e.target.value as ProductForm["verification_status"] })}>
            <option value="pendiente">Pendiente</option>
            <option value="verificado">Verificado</option>
          </select>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MediaUploader
            title="Imagen principal"
            url={form.image_url ?? ""}
            accept="image/*"
            icon={<ImageIcon className="h-4 w-4" />}
            onUpload={file => uploadInto(file, "main")}
            onUrl={url => setForm(prev => ({ ...prev, image_url: url }))}
          />
          <MediaUploader
            title="Imagen cuchara oficial Herbalife"
            url={form.spoon_image_url ?? ""}
            accept="image/*"
            icon={<ImageIcon className="h-4 w-4" />}
            onUpload={file => uploadInto(file, "spoon")}
            onUrl={url => setForm(prev => ({ ...prev, spoon_image_url: url }))}
            hint="Se usará solo la imagen real que suba la administradora."
          />
        </div>

        <MultiUrlEditor title="Galería de imágenes" icon={<ImageIcon className="h-4 w-4" />} urls={form.gallery_urls} onAdd={url => addUrl("gallery_urls", url)} onRemove={index => removeUrl("gallery_urls", index)} uploadLabel="Subir imagen" accept="image/*" onUpload={file => uploadInto(file, "gallery")} />
        <MultiUrlEditor title="Vídeos" icon={<Video className="h-4 w-4" />} urls={form.video_urls} onAdd={url => addUrl("video_urls", url)} onRemove={index => removeUrl("video_urls", index)} uploadLabel="Subir vídeo" accept="video/*" onUpload={file => uploadInto(file, "video")} />
        <MultiUrlEditor title="PDFs" icon={<FileText className="h-4 w-4" />} urls={form.pdf_urls} onAdd={url => addUrl("pdf_urls", url)} onRemove={index => removeUrl("pdf_urls", index)} uploadLabel="Subir PDF" accept="application/pdf" onUpload={file => uploadInto(file, "pdf")} />
        <MultiUrlEditor title="URLs externas" icon={<LinkIcon className="h-4 w-4" />} urls={form.external_urls} onAdd={url => addUrl("external_urls", url)} onRemove={index => removeUrl("external_urls", index)} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextArea label="Descripción" value={form.description ?? ""} onChange={value => setForm({ ...form, description: value })} />
          <TextArea label="Beneficios" value={form.benefits ?? ""} onChange={value => setForm({ ...form, benefits: value })} />
          <TextArea label="Modo de empleo" value={form.usage ?? ""} onChange={value => setForm({ ...form, usage: value })} />
          <TextArea label="Ingredientes" value={form.ingredients_text ?? ""} onChange={value => setForm({ ...form, ingredients_text: value })} />
          <TextArea label="Observaciones" value={form.observations ?? ""} onChange={value => setForm({ ...form, observations: value })} />
          <TextArea label="Texto libre" value={form.free_text ?? ""} onChange={value => setForm({ ...form, free_text: value })} />
        </div>

        <section>
          <h3 className="font-serif text-xl mb-2">Información nutricional por 100 g</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumberField label="Calorías" value={form.calories} onChange={value => updateNutrition({ calories: value })} />
            <NumberField label="Proteínas" value={form.protein} onChange={value => updateNutrition({ protein: value })} />
            <NumberField label="Hidratos" value={form.carbs} onChange={value => updateNutrition({ carbs: value })} />
            <NumberField label="Grasas" value={form.fat} onChange={value => updateNutrition({ fat: value })} />
            <NumberField label="Fibra" value={form.fiber} onChange={value => updateNutrition({ fiber: value })} />
            <NumberField label="Azúcares" value={form.sugars} onChange={value => updateNutrition({ sugars: value })} />
            <NumberField label="Sal" value={form.salt} onChange={value => updateNutrition({ salt: value })} />
          </div>
          <label className="block text-xs muted mt-3 mb-1">Micronutrientes opcionales (JSON)</label>
          <textarea className="field min-h-24 font-mono text-xs" value={form.micronutrientsText} onChange={e => setForm({ ...form, micronutrientsText: e.target.value })} placeholder='{"calcium_mg": 120, "iron_mg": 2}' />
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="font-serif text-xl">Medidas habituales</h3>
              <p className="text-xs muted">Introduce solo el nombre y los gramos. Los macros de cada medida se calculan automáticamente desde la ficha por 100 g.</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
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

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Toggle label="Visible para clientes" checked={form.visible_to_clients} onChange={checked => setForm({ ...form, visible_to_clients: checked })} />
          <Toggle label="Disponible para recetas" checked={form.available_for_recipes} onChange={checked => setForm({ ...form, available_for_recipes: checked })} />
          <Toggle label="Solo informativo" checked={form.informative_only} onChange={checked => setForm({ ...form, informative_only: checked })} />
          <Toggle label="Producto activo" checked={form.is_active} onChange={checked => setForm({ ...form, is_active: checked })} />
        </section>

        <button className="btn-primary w-full" disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar producto"}
        </button>
      </form>
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
    calories: toNumber(item.calories),
    protein: toNumber(item.protein),
    carbs: toNumber(item.carbs),
    fat: toNumber(item.fat),
    fiber: toNumber(item.fiber),
    sugars: toNumber(item.sugars),
    salt: toNumber(item.salt),
    micronutrients: item.micronutrients ?? {},
    source: item.source ?? "Pendiente de etiqueta oficial",
    verification_status: item.verification_status === "verificado" ? "verificado" : "pendiente",
    nutrition_effective_from: item.nutrition_effective_from ?? null,
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
    grams: toNumber(item.grams),
    calories: toNumber(item.calories),
    protein: toNumber(item.protein),
    carbs: toNumber(item.carbs),
    fat: toNumber(item.fat),
    fiber: toNumber(item.fiber),
    source: item.source ?? "Pendiente de etiqueta oficial",
    verification_status: item.verification_status === "verificado" ? "verificado" : "pendiente",
    is_default: Boolean(item.is_default),
    sort_order: toNumber(item.sort_order),
  };
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs muted">{label}</span>
      <textarea className="field min-h-28 mt-1" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] muted">{label}</span>
      <input className="field mt-1" type="number" step="0.01" value={value} onChange={e => onChange(toNumber(e.target.value))} />
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
  onUpload,
  onUrl,
}: {
  title: string;
  url: string;
  accept: string;
  icon: React.ReactNode;
  hint?: string;
  onUpload: (file: File) => void;
  onUrl: (url: string) => void;
}) {
  return (
    <div className="rounded-[22px] bg-secondary/70 p-3">
      <div className="flex items-center gap-2 text-sm font-medium mb-2">{icon}{title}</div>
      {url && <img src={url} alt="" className="w-full h-40 object-cover rounded-2xl mb-2" />}
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="btn-secondary cursor-pointer justify-center">
          <Upload className="h-4 w-4" /> Subir
          <input type="file" className="hidden" accept={accept} onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
        <input className="field flex-1" placeholder="O pegar URL" value={url} onChange={e => onUrl(e.target.value)} />
      </div>
      {hint && <p className="text-[11px] muted mt-2">{hint}</p>}
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
  onUpload,
}: {
  title: string;
  icon: React.ReactNode;
  urls: string[];
  uploadLabel?: string;
  accept?: string;
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  onUpload?: (file: File) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className="rounded-[22px] bg-secondary/60 p-3">
      <div className="flex items-center gap-2 font-medium text-sm mb-2">{icon}{title}</div>
      <div className="space-y-2 mb-3">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className="rounded-xl bg-white p-2 flex items-center gap-2 text-xs">
            <span className="truncate flex-1">{url}</span>
            <button type="button" className="p-1 text-destructive" onClick={() => onRemove(index)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {onUpload && (
          <label className="btn-secondary cursor-pointer justify-center">
            <Upload className="h-4 w-4" /> {uploadLabel}
            <input type="file" className="hidden" accept={accept} onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        )}
        <input className="field flex-1" placeholder="Pegar URL" value={draft} onChange={e => setDraft(e.target.value)} />
        <button type="button" className="btn-secondary" onClick={() => { onAdd(draft); setDraft(""); }}><Plus className="h-4 w-4" /> Añadir</button>
      </div>
    </section>
  );
}
