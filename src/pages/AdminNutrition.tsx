import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { NUTRITION_CATEGORIES } from "@/lib/nutritionCategories";
import nutricionCardImage from "@/assets/nutrition/sport-cards/nutricion.jpg";
import preentrenamientoCardImage from "@/assets/nutrition/sport-cards/preentrenamiento.jpg";
import entrenamientoCardImage from "@/assets/nutrition/sport-cards/entrenamiento.jpg";
import recuperacionCardImage from "@/assets/nutrition/sport-cards/recuperacion-postentrenamiento.jpg";
import gananciaCardImage from "@/assets/nutrition/sport-cards/ganancia-masa-muscular.jpg";
import perdidaCardImage from "@/assets/nutrition/sport-cards/perdida-grasa.jpg";
import resistenciaCardImage from "@/assets/nutrition/sport-cards/resistencia.jpg";
import hidratacionCardImage from "@/assets/nutrition/sport-cards/hidratacion.jpg";
import suplementacionCardImage from "@/assets/nutrition/sport-cards/suplementacion-deportiva.jpg";
import recetasCardImage from "@/assets/nutrition/sport-cards/recetas-deportivas.jpg";
import guiasCardImage from "@/assets/nutrition/sport-cards/guias-videos.jpg";
import protocolosCardImage from "@/assets/nutrition/sport-cards/protocolos.jpg";
import { Eye, EyeOff, FileText, Image as ImageIcon, Link as LinkIcon, Pencil, Trash2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";

const SIGNED_TTL = 60 * 60 * 24 * 7;

type Category = {
  id: string;
  key: string;
  label: string;
  subtitle?: string | null;
  image_url?: string | null;
  visible?: boolean | null;
  sort_order?: number | null;
};

type CategoryForm = {
  label: string;
  subtitle: string;
  image_url: string;
  visible: boolean;
};

type ManagedSection = {
  id: string;
  title: string;
  text: string;
  image_url: string;
  video_url: string;
  pdf_url: string;
  external_url: string;
};

type ContentForm = {
  id?: string;
  title: string;
  subtitle: string;
  cover_image: string;
  description: string;
  benefits: string;
  usage: string;
  ingredients: string;
  observations: string;
  free_text: string;
  gallery: string[];
  video_url: string;
  pdf_url: string;
  external_url: string;
  sections: ManagedSection[];
  visible: boolean;
};

const emptyCategory: CategoryForm = {
  label: "",
  subtitle: "",
  image_url: "",
  visible: true,
};

const emptyContent: ContentForm = {
  title: "",
  subtitle: "",
  cover_image: "",
  description: "",
  benefits: "",
  usage: "",
  ingredients: "",
  observations: "",
  free_text: "",
  gallery: [],
  video_url: "",
  pdf_url: "",
  external_url: "",
  sections: [],
  visible: true,
};

const categoryImages: Record<string, string> = {
  nutricion: nutricionCardImage,
  proteinas: nutricionCardImage,
  "pre-entreno": preentrenamientoCardImage,
  preentrenamiento: preentrenamientoCardImage,
  entrenamiento: entrenamientoCardImage,
  "post-entreno": recuperacionCardImage,
  "recuperacion-postentrenamiento": recuperacionCardImage,
  "ganancia-masa-muscular": gananciaCardImage,
  "perdida-grasa": perdidaCardImage,
  resistencia: resistenciaCardImage,
  hidratacion: hidratacionCardImage,
  suplementacion: suplementacionCardImage,
  "suplementacion-deportiva": suplementacionCardImage,
  recetas: recetasCardImage,
  "recetas-deportivas": recetasCardImage,
  planes: guiasCardImage,
  "guias-videos": guiasCardImage,
  protocolos: protocolosCardImage,
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeCategoryKey(value: unknown) {
  return slugify(String(value ?? ""));
}

function itemBelongsToCategory(item: any, category: Category | null | undefined) {
  if (!item || !category) return false;
  const itemCategoryId = String(item.category_id ?? "");
  const categoryId = String(category.id ?? "");
  if (itemCategoryId && categoryId && itemCategoryId === categoryId) return true;

  const itemCategory = normalizeCategoryKey(item.category);
  const candidates = [
    category.key,
    category.label,
    category.id,
    normalizeCategoryKey(category.key),
    normalizeCategoryKey(category.label),
  ]
    .map(normalizeCategoryKey)
    .filter(Boolean);

  return Boolean(itemCategory && candidates.includes(itemCategory));
}

async function uploadFile(file: File, folder: string) {
  const path = `nutrition/${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("resource-media").upload(path, file);
  if (error) throw error;
  const { data, error: signedError } = await supabase.storage.from("resource-media").createSignedUrl(path, SIGNED_TTL);
  if (signedError) throw signedError;
  return data.signedUrl;
}

function buildBlocks(form: ContentForm) {
  const blocks: any[] = [];
  const addSection = (title: string, value: string) => {
    if (!value.trim()) return;
    blocks.push({ type: "title", value: title });
    blocks.push({ type: "text", value: value.trim() });
  };

  addSection("Descripción", form.description);
  addSection("Beneficios", form.benefits);
  addSection("Modo de uso", form.usage);
  addSection("Ingredientes", form.ingredients);
  addSection("Observaciones", form.observations);
  addSection("Texto libre", form.free_text);
  form.gallery.forEach((url) => url && blocks.push({ type: "image", url }));
  if (form.video_url.trim()) blocks.push({ type: "video", url: form.video_url.trim() });
  if (form.pdf_url.trim()) blocks.push({ type: "pdf", url: form.pdf_url.trim(), name: "Documento" });
  if (form.external_url.trim()) blocks.push({ type: "link", label: "Enlace externo", url: form.external_url.trim() });
  form.sections.forEach((section) => {
    const hasContent = [
      section.title,
      section.text,
      section.image_url,
      section.video_url,
      section.pdf_url,
      section.external_url,
    ].some((value) => value.trim());
    if (!hasContent) return;
    blocks.push({
      type: "section",
      id: section.id,
      title: section.title.trim(),
      text: section.text.trim(),
      image_url: section.image_url.trim(),
      video_url: section.video_url.trim(),
      pdf_url: section.pdf_url.trim(),
      external_url: section.external_url.trim(),
    });
  });
  return blocks;
}

function formFromItem(item: any): ContentForm {
  const next = { ...emptyContent };
  next.id = item.id;
  next.title = item.title ?? item.name ?? item.label ?? "";
  next.subtitle = item.subtitle ?? "";
  next.cover_image = item.cover_image ?? item.cover_image_url ?? item.image_url ?? "";
  next.visible = item.visible !== false;

  const blocks = Array.isArray(item.blocks) ? item.blocks : [];
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const following = blocks[i + 1];
    if (block?.type === "title" && following?.type === "text") {
      const title = String(block.value ?? "").toLowerCase();
      if (title.includes("descripción")) next.description = following.value ?? "";
      else if (title.includes("beneficios")) next.benefits = following.value ?? "";
      else if (title.includes("modo")) next.usage = following.value ?? "";
      else if (title.includes("ingredientes")) next.ingredients = following.value ?? "";
      else if (title.includes("observaciones")) next.observations = following.value ?? "";
      else if (title.includes("texto")) next.free_text = following.value ?? "";
    }
    if (block?.type === "image" && block.url) next.gallery.push(block.url);
    if (block?.type === "video" && block.url) next.video_url = block.url;
    if (block?.type === "pdf" && block.url) next.pdf_url = block.url;
    if (block?.type === "link" && block.url) next.external_url = block.url;
    if (block?.type === "section") {
      next.sections.push({
        id: block.id || `section-${Date.now()}-${i}`,
        title: block.title ?? "",
        text: block.text ?? "",
        image_url: block.image_url ?? "",
        video_url: block.video_url ?? "",
        pdf_url: block.pdf_url ?? "",
        external_url: block.external_url ?? "",
      });
    }
  }
  return next;
}

function newManagedSection(): ManagedSection {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    text: "",
    image_url: "",
    video_url: "",
    pdf_url: "",
    external_url: "",
  };
}

function moveSection(sections: ManagedSection[], id: string, direction: -1 | 1) {
  const index = sections.findIndex((section) => section.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  const [current] = next.splice(index, 1);
  next.splice(target, 0, current);
  return next;
}

export default function AdminNutrition() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [schemaError, setSchemaError] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);
  const [contentForm, setContentForm] = useState<ContentForm>(emptyContent);
  const [busy, setBusy] = useState(false);

  const loadCategories = async () => {
    const { data, error } = await (supabase as any)
      .from("nutrition_categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[nutrition_categories]", error);
      toast.error(error.message);
      setSchemaError(error.message);
      setCategories(
        NUTRITION_CATEGORIES.map((category, index) => ({
          id: category.key,
          key: category.key,
          label: category.label,
          subtitle: category.subtitle,
          image_url: categoryImages[category.key] ?? null,
          visible: true,
          sort_order: index + 1,
        }))
      );
      return;
    }
    setSchemaError("");
    setCategories(data ?? []);
  };

  const loadItems = async () => {
    const { data, error } = await (supabase as any)
      .from("nutrition_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[nutrition_items]", error);
      toast.error(error.message);
      setSchemaError((current) => current || error.message);
    }
    else setItems(data ?? []);
  };

  useEffect(() => {
    loadCategories();
    loadItems();
  }, []);

  const activeCategoryData = useMemo(
    () => categories.find((category) => category.key === activeCategory) ?? null,
    [activeCategory, categories]
  );

  const visibleItems = useMemo(
    () => items.filter((item) => itemBelongsToCategory(item, activeCategoryData)),
    [items, activeCategoryData]
  );

  const categoryCounts = useMemo(() => {
    const next: Record<string, number> = {};
    categories.forEach((category) => {
      next[category.key] = items.filter((item) => itemBelongsToCategory(item, category)).length;
    });
    return next;
  }, [categories, items]);

  const resetContent = () => setContentForm(emptyContent);

  const openCategory = (key: string) => {
    const shouldOpen = activeCategory !== key;
    setActiveCategory(shouldOpen ? key : null);
    resetContent();
    if (shouldOpen) {
      window.setTimeout(() => {
        document.getElementById(`nutrition-panel-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  const editCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      label: category.label ?? "",
      subtitle: category.subtitle ?? "",
      image_url: category.image_url ?? "",
      visible: category.visible !== false,
    });
    window.setTimeout(() => {
      document.getElementById("nutrition-category-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const clearCategoryEdit = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategory);
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryForm.label.trim()) return;
    setBusy(true);
    const payload: any = {
      label: categoryForm.label.trim(),
      subtitle: categoryForm.subtitle.trim() || null,
      image_url: categoryForm.image_url || null,
      visible: categoryForm.visible,
    };
    const result = editingCategory
      ? await (supabase as any).from("nutrition_categories").update(payload).eq("id", editingCategory.id)
      : await (supabase as any).from("nutrition_categories").insert({
          ...payload,
          key: slugify(categoryForm.label) || `categoria-${Date.now()}`,
          sort_order: categories.length + 1,
        });
    setBusy(false);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editingCategory ? "Categoría actualizada" : "Categoría creada");
      clearCategoryEdit();
      loadCategories();
    }
  };

  const toggleCategory = async (category: Category) => {
    const { error } = await (supabase as any)
      .from("nutrition_categories")
      .update({ visible: category.visible === false })
      .eq("id", category.id);
    if (error) toast.error(error.message);
    else {
      toast.success(category.visible === false ? "Categoría activada" : "Categoría desactivada");
      loadCategories();
    }
  };

  const removeCategory = async (category: Category) => {
    if (!confirm("¿Seguro que deseas eliminar esta categoría?")) return;
    setBusy(true);
    const itemDelete = await (supabase as any).from("nutrition_items").delete().eq("category", category.key);
    if (itemDelete.error) {
      setBusy(false);
      toast.error(itemDelete.error.message);
      return;
    }
    const categoryDelete = await (supabase as any).from("nutrition_categories").delete().eq("id", category.id);
    setBusy(false);
    if (categoryDelete.error) toast.error(categoryDelete.error.message);
    else {
      toast.success("Categoría eliminada");
      if (activeCategory === category.key) setActiveCategory(null);
      if (editingCategory?.id === category.id) clearCategoryEdit();
      loadCategories();
      loadItems();
    }
  };

  const saveContent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeCategory || !contentForm.title.trim()) return;
    setBusy(true);
    const payload: any = {
      title: contentForm.title.trim(),
      subtitle: contentForm.subtitle.trim() || null,
      category: activeCategory,
      category_id: activeCategoryData?.id || null,
      cover_image: contentForm.cover_image || null,
      blocks: buildBlocks(contentForm),
      visible: contentForm.visible,
      tags: [],
      sort_order: 0,
    };
    const result = contentForm.id
      ? await (supabase as any).from("nutrition_items").update(payload).eq("id", contentForm.id)
      : await (supabase as any).from("nutrition_items").insert(payload);
    setBusy(false);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(contentForm.id ? "Contenido actualizado" : "Contenido publicado");
      resetContent();
      loadItems();
    }
  };

  const removeContent = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este contenido?")) return;
    const { error } = await (supabase as any).from("nutrition_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setItems((current) => current.filter((item) => item.id !== id));
      toast.success("Contenido eliminado");
      loadItems();
    }
  };

  const onUpload = async (file: File, folder: string, setter: (url: string) => void) => {
    try {
      setBusy(true);
      setter(await uploadFile(file, folder));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const rows: Category[][] = [];
  for (let i = 0; i < categories.length; i += 3) rows.push(categories.slice(i, i + 3));

  return (
    <div className="pb-28 admin-nutrition-page">
      <AdminPageHeader title="Nutrición deportiva" backTo="/app/admin" />

      {schemaError && (
        <div className="card-soft admin-nutrition-panel mb-4 border border-[#FF2D95] bg-white p-3 text-sm text-foreground">
          <div className="font-semibold text-[#FF2D95]">Falta aplicar la migración de Nutrición deportiva en Supabase</div>
          <p className="mt-1">
            Se muestran las categorías base para poder revisar la pantalla, pero crear categorías o publicar contenido no funcionará hasta que existan
            <span className="font-semibold"> nutrition_categories</span> y <span className="font-semibold">nutrition_items</span>.
          </p>
          <p className="mt-1 text-xs muted">{schemaError}</p>
        </div>
      )}

      <div className="card-soft admin-nutrition-panel p-4 mb-4">
        <h2 className="font-serif text-xl mb-1">Categorías de Nutrición deportiva</h2>
        <p className="text-sm muted mb-4">Pulsa una categoría para gestionar su contenido.</p>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.map((category) => category.key).join("-")} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {row.map((category) => {
                  const image = category.image_url || categoryImages[category.key];
                  const selected = activeCategory === category.key;
                  return (
                    <div
                      key={category.id}
                      className={`admin-nutrition-category-row rounded-2xl border border-[#FF2D95] overflow-hidden ${selected ? "is-active" : ""}`}
                    >
                      <button type="button" onClick={() => openCategory(category.key)} className="admin-nutrition-category-open relative w-full text-left flex flex-col">
                        {image ? (
                          <div className="admin-nutrition-category-image-frame">
                            <img src={image} alt="" className="admin-nutrition-category-image" />
                          </div>
                        ) : (
                          <div className="admin-nutrition-category-image-frame bg-[#FFF7FA]" />
                        )}
                        <span className="admin-nutrition-category-count absolute right-2 top-2">
                          {categoryCounts[category.key] ?? 0}
                        </span>
                        <div className="flex-1 px-2 py-2 text-center bg-black">
                          <div className="font-medium text-[12px] leading-tight line-clamp-2">{category.label}</div>
                          <div className="text-[10px] muted leading-tight line-clamp-2 mt-1">{category.subtitle || "Contenido"}</div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>

              {activeCategoryData && row.some((category) => category.key === activeCategory) && (
                <section id={`nutrition-panel-${activeCategoryData.key}`} className="card-soft admin-nutrition-panel admin-nutrition-content-panel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#FF2D95] font-bold mb-1">{activeCategoryData.label}</div>
                      <p className="text-xs muted">Gestiona esta categoría y su contenido.</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className="admin-nutrition-category-action" onClick={() => editCategory(activeCategoryData)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button type="button" className="admin-nutrition-category-action" onClick={() => toggleCategory(activeCategoryData)}>
                        {activeCategoryData.visible === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {activeCategoryData.visible === false ? "Activar" : "Ocultar"}
                      </button>
                      <button type="button" className="admin-nutrition-category-action" onClick={() => editCategory(activeCategoryData)}>
                        <Upload className="h-3.5 w-3.5" /> Imagen
                      </button>
                      <button type="button" className="admin-nutrition-category-action is-delete" onClick={() => removeCategory(activeCategoryData)}>
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    </div>
                  </div>
                  <div className="mb-4 rounded-2xl border border-[#FF2D95] bg-white p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h3 className="font-serif text-lg">Contenido incluido</h3>
                      <span className="admin-nutrition-category-count static">
                        {visibleItems.length}
                      </span>
                    </div>
                    {visibleItems.length > 0 ? (
                      <div className="space-y-2">
                        {visibleItems.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-[#FF2D95]/55 bg-[#FFF7FA] p-3 flex items-center gap-3">
                            {item.cover_image && (
                              <div className="admin-nutrition-list-thumb">
                                <img src={item.cover_image} alt="" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{item.title || item.name || item.label || "Contenido"}</div>
                              <div className="text-xs muted truncate">{item.subtitle || "Contenido"}</div>
                            </div>
                            <button type="button" className="text-primary" onClick={() => setContentForm(formFromItem(item))} aria-label="Editar contenido">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" className="admin-nutrition-delete-button" onClick={() => removeContent(item.id)} aria-label="Eliminar contenido">
                              <Trash2 className="h-3.5 w-3.5" /> Borrar
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[#FF2D95]/25 bg-[#FFF7FA] p-3 text-sm muted text-center">
                        Aún no hay contenido incluido en esta categoría.
                      </div>
                    )}
                  </div>
                  <h3 className="font-serif text-xl mb-2">Añadir contenido</h3>
                  <p className="text-sm muted mb-3">Completa los campos que necesites y publica el contenido dentro de esta categoría.</p>
                  <form onSubmit={saveContent} className="admin-nutrition-form rounded-2xl border border-[#FF2D95] p-3 space-y-3">
                    <div>
                      <label className="text-xs muted">Imagen principal</label>
                      {contentForm.cover_image && (
                        <div className="admin-nutrition-media-preview relative mb-2">
                          <img src={contentForm.cover_image} alt="" />
                          <button
                            type="button"
                            className="admin-nutrition-delete-button absolute right-2 top-2"
                            onClick={() => setContentForm((current) => ({ ...current, cover_image: "" }))}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Borrar
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-primary inline-flex cursor-pointer">
                          <Upload className="h-4 w-4" /> Subir imagen principal
                          <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "covers", (url) => setContentForm((current) => ({ ...current, cover_image: url })))} />
                        </label>
                        <button
                          type="button"
                          className="admin-nutrition-delete-button"
                          disabled={!contentForm.cover_image}
                          onClick={() => setContentForm((current) => ({ ...current, cover_image: "" }))}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Borrar
                        </button>
                      </div>
                    </div>
                    <label className="block">
                      <span className="text-xs muted">Título</span>
                      <input className="field mt-1" placeholder="Título" value={contentForm.title} onChange={(event) => setContentForm({ ...contentForm, title: event.target.value })} required />
                    </label>
                    <label className="block">
                      <span className="text-xs muted">Subtítulo</span>
                      <input className="field mt-1" placeholder="Subtítulo" value={contentForm.subtitle} onChange={(event) => setContentForm({ ...contentForm, subtitle: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-xs muted">Descripción</span>
                      <textarea className="field min-h-24 mt-1" placeholder="Descripción" value={contentForm.description} onChange={(event) => setContentForm({ ...contentForm, description: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-xs muted">Beneficios</span>
                      <textarea className="field min-h-20 mt-1" placeholder="Beneficios" value={contentForm.benefits} onChange={(event) => setContentForm({ ...contentForm, benefits: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-xs muted">Modo de uso</span>
                      <textarea className="field min-h-20 mt-1" placeholder="Modo de uso" value={contentForm.usage} onChange={(event) => setContentForm({ ...contentForm, usage: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-xs muted">Ingredientes (opcional)</span>
                      <textarea className="field min-h-20 mt-1" placeholder="Ingredientes (opcional)" value={contentForm.ingredients} onChange={(event) => setContentForm({ ...contentForm, ingredients: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-xs muted">Observaciones</span>
                      <textarea className="field min-h-20 mt-1" placeholder="Observaciones" value={contentForm.observations} onChange={(event) => setContentForm({ ...contentForm, observations: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-xs muted">Texto libre</span>
                      <textarea className="field min-h-24 mt-1" placeholder="Texto libre" value={contentForm.free_text} onChange={(event) => setContentForm({ ...contentForm, free_text: event.target.value })} />
                    </label>

                    <div className="rounded-2xl border border-[#FF2D95] bg-white p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">Gestionar secciones del contenido</div>
                          <p className="text-xs muted mt-1">Crea, ordena y elimina bloques propios para esta publicación.</p>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary shrink-0"
                          onClick={() => setContentForm((current) => ({ ...current, sections: [...current.sections, newManagedSection()] }))}
                        >
                          Añadir sección
                        </button>
                      </div>

                      {contentForm.sections.length === 0 ? (
                        <div className="rounded-2xl border border-[#FF2D95]/25 bg-[#FFF7FA] p-4 text-sm muted text-center">
                          Aún no hay secciones personalizadas.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {contentForm.sections.map((section, index) => (
                            <div key={section.id} className="rounded-2xl border border-[#FF2D95] bg-[#FFF7FA] p-3 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-bold text-[#FF2D95]">Sección {index + 1}</div>
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    className="admin-nutrition-card-action px-2"
                                    disabled={index === 0}
                                    onClick={() => setContentForm((current) => ({ ...current, sections: moveSection(current.sections, section.id, -1) }))}
                                  >
                                    Subir
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-nutrition-card-action px-2"
                                    disabled={index === contentForm.sections.length - 1}
                                    onClick={() => setContentForm((current) => ({ ...current, sections: moveSection(current.sections, section.id, 1) }))}
                                  >
                                    Bajar
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-nutrition-delete-button"
                                    onClick={() => setContentForm((current) => ({ ...current, sections: current.sections.filter((item) => item.id !== section.id) }))}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Borrar
                                  </button>
                                </div>
                              </div>

                              <input
                                className="field"
                                placeholder="Título de la sección"
                                value={section.title}
                                onChange={(event) => setContentForm((current) => ({
                                  ...current,
                                  sections: current.sections.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item),
                                }))}
                              />
                              <textarea
                                className="field min-h-24"
                                placeholder="Texto de la sección"
                                value={section.text}
                                onChange={(event) => setContentForm((current) => ({
                                  ...current,
                                  sections: current.sections.map((item) => item.id === section.id ? { ...item, text: event.target.value } : item),
                                }))}
                              />

                              {section.image_url && (
                                <div className="admin-nutrition-media-preview relative">
                                  <img src={section.image_url} alt="" />
                                  <button
                                    type="button"
                                    className="admin-nutrition-delete-button absolute right-2 top-2"
                                    onClick={() => setContentForm((current) => ({
                                      ...current,
                                      sections: current.sections.map((item) => item.id === section.id ? { ...item, image_url: "" } : item),
                                    }))}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Borrar
                                  </button>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">
                                <label className="btn-secondary cursor-pointer">
                                  <ImageIcon className="h-4 w-4" /> Imagen
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "sections", (url) => setContentForm((current) => ({
                                      ...current,
                                      sections: current.sections.map((item) => item.id === section.id ? { ...item, image_url: url } : item),
                                    })))}
                                  />
                                </label>
                                <label className="btn-secondary cursor-pointer">
                                  <Video className="h-4 w-4" /> Vídeo
                                  <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "sections", (url) => setContentForm((current) => ({
                                      ...current,
                                      sections: current.sections.map((item) => item.id === section.id ? { ...item, video_url: url } : item),
                                    })))}
                                  />
                                </label>
                                <label className="btn-secondary cursor-pointer">
                                  <FileText className="h-4 w-4" /> PDF
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "sections", (url) => setContentForm((current) => ({
                                      ...current,
                                      sections: current.sections.map((item) => item.id === section.id ? { ...item, pdf_url: url } : item),
                                    })))}
                                  />
                                </label>
                              </div>

                              <input
                                className="field"
                                placeholder="URL de vídeo, YouTube, Vimeo o archivo"
                                value={section.video_url}
                                onChange={(event) => setContentForm((current) => ({
                                  ...current,
                                  sections: current.sections.map((item) => item.id === section.id ? { ...item, video_url: event.target.value } : item),
                                }))}
                              />
                              <input
                                className="field"
                                placeholder="URL de PDF"
                                value={section.pdf_url}
                                onChange={(event) => setContentForm((current) => ({
                                  ...current,
                                  sections: current.sections.map((item) => item.id === section.id ? { ...item, pdf_url: event.target.value } : item),
                                }))}
                              />
                              <input
                                className="field"
                                placeholder="URL externa"
                                value={section.external_url}
                                onChange={(event) => setContentForm((current) => ({
                                  ...current,
                                  sections: current.sections.map((item) => item.id === section.id ? { ...item, external_url: event.target.value } : item),
                                }))}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#FF2D95] bg-white p-3">
                      <div className="font-medium text-sm mb-2">Galería de imágenes</div>
                      {contentForm.gallery.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {contentForm.gallery.map((url) => (
                            <div key={url} className="admin-nutrition-gallery-preview relative">
                              <img src={url} alt="" />
                              <button
                                type="button"
                                className="admin-nutrition-delete-icon absolute right-1 top-1"
                                aria-label="Borrar imagen"
                                onClick={() => setContentForm((current) => ({ ...current, gallery: current.gallery.filter((item) => item !== url) }))}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-secondary cursor-pointer">
                          <ImageIcon className="h-4 w-4" /> Añadir imagen
                          <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "gallery", (url) => setContentForm((current) => ({ ...current, gallery: [...current.gallery, url] })))} />
                        </label>
                        <button
                          type="button"
                          className="admin-nutrition-delete-button"
                          disabled={contentForm.gallery.length === 0}
                          onClick={() => setContentForm((current) => ({ ...current, gallery: [] }))}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Borrar galería
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <label className="block">
                        <span className="text-xs muted">Vídeo</span>
                        <input className="field mt-1" placeholder="Vídeo o URL de vídeo" value={contentForm.video_url} onChange={(event) => setContentForm({ ...contentForm, video_url: event.target.value })} />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-secondary cursor-pointer">
                          <Video className="h-4 w-4" /> Subir vídeo
                          <input type="file" accept="video/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "videos", (url) => setContentForm((current) => ({ ...current, video_url: url })))} />
                        </label>
                        <button
                          type="button"
                          className="admin-nutrition-delete-button"
                          disabled={!contentForm.video_url}
                          onClick={() => setContentForm((current) => ({ ...current, video_url: "" }))}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Borrar vídeo
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <label className="block">
                        <span className="text-xs muted">PDF</span>
                        <input className="field mt-1" placeholder="PDF o URL de PDF" value={contentForm.pdf_url} onChange={(event) => setContentForm({ ...contentForm, pdf_url: event.target.value })} />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-secondary cursor-pointer">
                          <FileText className="h-4 w-4" /> Subir PDF
                          <input type="file" accept="application/pdf" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "pdfs", (url) => setContentForm((current) => ({ ...current, pdf_url: url })))} />
                        </label>
                        <button
                          type="button"
                          className="admin-nutrition-delete-button"
                          disabled={!contentForm.pdf_url}
                          onClick={() => setContentForm((current) => ({ ...current, pdf_url: "" }))}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Borrar PDF
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs muted">Enlace externo</span>
                      <div className="relative mt-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted" />
                        <input className="field pl-9" placeholder="Enlace externo" value={contentForm.external_url} onChange={(event) => setContentForm({ ...contentForm, external_url: event.target.value })} />
                      </div>
                    </label>
                    <button
                      type="button"
                      className="admin-nutrition-delete-button w-max"
                      disabled={!contentForm.external_url}
                      onClick={() => setContentForm((current) => ({ ...current, external_url: "" }))}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Borrar enlace
                    </button>

                    <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
                      <span>Visible para clientes</span>
                      <input type="checkbox" checked={contentForm.visible} onChange={(event) => setContentForm({ ...contentForm, visible: event.target.checked })} />
                    </label>

                    <button className="btn-primary w-full" disabled={busy}>{contentForm.id ? "Guardar cambios" : "Publicar"}</button>
                  </form>
                </section>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card-soft admin-nutrition-panel admin-nutrition-new-category-card p-4">
        <form id="nutrition-category-form" onSubmit={saveCategory} className="admin-nutrition-form admin-nutrition-new-category-form rounded-2xl border border-[#FF2D95] p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">{editingCategory ? "Editar categoría" : "Nueva categoría"}</div>
            {editingCategory && (
              <button type="button" className="admin-nutrition-delete-button" onClick={clearCategoryEdit}>
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            )}
          </div>
          {categoryForm.image_url && (
            <div className="admin-nutrition-media-preview relative">
              <img src={categoryForm.image_url} alt="" />
              <button
                type="button"
                className="admin-nutrition-delete-button absolute right-2 top-2"
                onClick={() => setCategoryForm((current) => ({ ...current, image_url: "" }))}
              >
                <Trash2 className="h-3.5 w-3.5" /> Borrar
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="btn-primary inline-flex cursor-pointer">
              <Upload className="h-4 w-4" /> {categoryForm.image_url ? "Cambiar imagen" : "Subir imagen"}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "categories", (url) => setCategoryForm((current) => ({ ...current, image_url: url })))} />
            </label>
            <button
              type="button"
              className="admin-nutrition-delete-button"
              disabled={!categoryForm.image_url}
              onClick={() => setCategoryForm((current) => ({ ...current, image_url: "" }))}
            >
              <Trash2 className="h-3.5 w-3.5" /> Borrar
            </button>
          </div>
          <input className="field" placeholder="Nombre" value={categoryForm.label} onChange={(event) => setCategoryForm({ ...categoryForm, label: event.target.value })} required />
          <input className="field" placeholder="Subtítulo" value={categoryForm.subtitle} onChange={(event) => setCategoryForm({ ...categoryForm, subtitle: event.target.value })} />
          <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
            <span>Visible para clientes</span>
            <input type="checkbox" checked={categoryForm.visible} onChange={(event) => setCategoryForm({ ...categoryForm, visible: event.target.checked })} />
          </label>
          <button className="btn-primary w-full" disabled={busy}>{editingCategory ? "Guardar categoría" : "Crear categoría"}</button>
        </form>
      </div>
    </div>
  );
}
