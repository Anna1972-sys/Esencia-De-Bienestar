import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { NUTRITION_CATEGORIES } from "@/lib/nutritionCategories";
import hidratacionImage from "@/assets/nutrition/hidratacion.png";
import proteinasImage from "@/assets/nutrition/proteinas.png";
import recuperacionImage from "@/assets/nutrition/recuperacion-realimentacion.png";
import postEntrenoImage from "@/assets/nutrition/post-entreno.png";
import suplementacionImage from "@/assets/nutrition/suplementacion.png";
import alimentacionImage from "@/assets/nutrition/alimentacion-deportiva.png";
import planesImage from "@/assets/nutrition/planes-guias.png";
import { FileText, Image as ImageIcon, Link as LinkIcon, Pencil, Trash2, Upload, Video } from "lucide-react";
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
  visible: true,
};

const categoryImages: Record<string, string> = {
  proteinas: proteinasImage,
  "pre-entreno": recuperacionImage,
  entrenamiento: alimentacionImage,
  "post-entreno": postEntrenoImage,
  "ganancia-masa-muscular": proteinasImage,
  "perdida-grasa": alimentacionImage,
  resistencia: recuperacionImage,
  hidratacion: hidratacionImage,
  suplementacion: suplementacionImage,
  recetas: alimentacionImage,
  planes: planesImage,
  protocolos: planesImage,
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
  return blocks;
}

function formFromItem(item: any): ContentForm {
  const next = { ...emptyContent };
  next.id = item.id;
  next.title = item.title ?? "";
  next.subtitle = item.subtitle ?? "";
  next.cover_image = item.cover_image ?? "";
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
  }
  return next;
}

export default function AdminNutrition() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);
  const [contentForm, setContentForm] = useState<ContentForm>(emptyContent);
  const [busy, setBusy] = useState(false);

  const loadCategories = async () => {
    const { data, error } = await (supabase as any)
      .from("nutrition_categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error(error.message);
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
    setCategories(data ?? []);
  };

  const loadItems = async () => {
    const { data, error } = await (supabase as any)
      .from("nutrition_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
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
    () => items.filter((item) => item.category === activeCategory),
    [items, activeCategory]
  );

  const resetContent = () => setContentForm(emptyContent);

  const openCategory = (key: string) => {
    setActiveCategory((current) => (current === key ? null : key));
    resetContent();
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryForm.label.trim()) return;
    setBusy(true);
    const payload = {
      key: slugify(categoryForm.label) || `categoria-${Date.now()}`,
      label: categoryForm.label.trim(),
      subtitle: categoryForm.subtitle.trim() || null,
      image_url: categoryForm.image_url || null,
      visible: categoryForm.visible,
      sort_order: categories.length + 1,
    };
    const { error } = await (supabase as any).from("nutrition_categories").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Categoría creada");
      setCategoryForm(emptyCategory);
      loadCategories();
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
    if (!confirm("¿Eliminar este contenido?")) return;
    const { error } = await (supabase as any).from("nutrition_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
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
                      className={`admin-nutrition-category-row rounded-2xl border border-[#FF2D95] overflow-hidden h-[142px] ${selected ? "is-active" : ""}`}
                    >
                      <button type="button" onClick={() => openCategory(category.key)} className="admin-nutrition-category-open h-full w-full text-left flex flex-col">
                        {image ? (
                          <div className="p-2 pb-0 bg-black">
                            <img src={image} alt="" className="h-14 w-full rounded-xl object-cover admin-nutrition-category-image" />
                          </div>
                        ) : (
                          <div className="h-14 w-full bg-black" />
                        )}
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
                <section className="card-soft admin-nutrition-panel p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#FF2D95] font-bold mb-1">{activeCategoryData.label}</div>
                  <form onSubmit={saveContent} className="admin-nutrition-form rounded-2xl border border-[#FF2D95] p-3 space-y-3">
                    <div>
                      <label className="text-xs muted">Imagen principal</label>
                      {contentForm.cover_image && <img src={contentForm.cover_image} alt="" className="h-32 w-full rounded-2xl object-cover mb-2" />}
                      <label className="btn-primary inline-flex cursor-pointer">
                        <Upload className="h-4 w-4" /> Subir imagen principal
                        <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "covers", (url) => setContentForm((current) => ({ ...current, cover_image: url })))} />
                      </label>
                    </div>
                    <input className="field" placeholder="Título" value={contentForm.title} onChange={(event) => setContentForm({ ...contentForm, title: event.target.value })} required />
                    <input className="field" placeholder="Subtítulo" value={contentForm.subtitle} onChange={(event) => setContentForm({ ...contentForm, subtitle: event.target.value })} />
                    <textarea className="field min-h-24" placeholder="Descripción" value={contentForm.description} onChange={(event) => setContentForm({ ...contentForm, description: event.target.value })} />
                    <textarea className="field min-h-20" placeholder="Beneficios" value={contentForm.benefits} onChange={(event) => setContentForm({ ...contentForm, benefits: event.target.value })} />
                    <textarea className="field min-h-20" placeholder="Modo de uso" value={contentForm.usage} onChange={(event) => setContentForm({ ...contentForm, usage: event.target.value })} />
                    <textarea className="field min-h-20" placeholder="Ingredientes (opcional)" value={contentForm.ingredients} onChange={(event) => setContentForm({ ...contentForm, ingredients: event.target.value })} />
                    <textarea className="field min-h-20" placeholder="Observaciones" value={contentForm.observations} onChange={(event) => setContentForm({ ...contentForm, observations: event.target.value })} />
                    <textarea className="field min-h-24" placeholder="Texto libre" value={contentForm.free_text} onChange={(event) => setContentForm({ ...contentForm, free_text: event.target.value })} />

                    <div className="rounded-2xl border border-[#FF2D95] bg-white p-3">
                      <div className="font-medium text-sm mb-2">Galería de imágenes</div>
                      {contentForm.gallery.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {contentForm.gallery.map((url) => <img key={url} src={url} alt="" className="h-20 w-full rounded-xl object-cover" />)}
                        </div>
                      )}
                      <label className="btn-secondary cursor-pointer">
                        <ImageIcon className="h-4 w-4" /> Añadir imagen
                        <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "gallery", (url) => setContentForm((current) => ({ ...current, gallery: [...current.gallery, url] })))} />
                      </label>
                    </div>

                    <div className="grid gap-2">
                      <input className="field" placeholder="Vídeo o URL de vídeo" value={contentForm.video_url} onChange={(event) => setContentForm({ ...contentForm, video_url: event.target.value })} />
                      <label className="btn-secondary cursor-pointer">
                        <Video className="h-4 w-4" /> Subir vídeo
                        <input type="file" accept="video/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "videos", (url) => setContentForm((current) => ({ ...current, video_url: url })))} />
                      </label>
                    </div>

                    <div className="grid gap-2">
                      <input className="field" placeholder="PDF o URL de PDF" value={contentForm.pdf_url} onChange={(event) => setContentForm({ ...contentForm, pdf_url: event.target.value })} />
                      <label className="btn-secondary cursor-pointer">
                        <FileText className="h-4 w-4" /> Subir PDF
                        <input type="file" accept="application/pdf" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "pdfs", (url) => setContentForm((current) => ({ ...current, pdf_url: url })))} />
                      </label>
                    </div>

                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted" />
                      <input className="field pl-9" placeholder="Enlace externo" value={contentForm.external_url} onChange={(event) => setContentForm({ ...contentForm, external_url: event.target.value })} />
                    </div>

                    <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
                      <span>Visible para clientes</span>
                      <input type="checkbox" checked={contentForm.visible} onChange={(event) => setContentForm({ ...contentForm, visible: event.target.checked })} />
                    </label>

                    <button className="btn-primary w-full" disabled={busy}>{contentForm.id ? "Guardar cambios" : "Publicar"}</button>
                  </form>

                  {visibleItems.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {visibleItems.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-[#FF2D95] bg-white p-3 flex items-center gap-3">
                          {item.cover_image && <img src={item.cover_image} alt="" className="h-12 w-12 rounded-xl object-cover" />}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{item.title}</div>
                            <div className="text-xs muted truncate">{item.subtitle || "Contenido"}</div>
                          </div>
                          <button type="button" className="text-primary" onClick={() => setContentForm(formFromItem(item))} aria-label="Editar contenido">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" className="text-destructive" onClick={() => removeContent(item.id)} aria-label="Eliminar contenido">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card-soft admin-nutrition-panel admin-nutrition-new-category-card p-4">
        <form onSubmit={saveCategory} className="admin-nutrition-form admin-nutrition-new-category-form rounded-2xl border border-[#FF2D95] p-3 space-y-3">
          <div className="font-medium">Nueva categoría</div>
          {categoryForm.image_url && <img src={categoryForm.image_url} alt="" className="h-24 w-full rounded-2xl object-cover" />}
          <label className="btn-primary inline-flex cursor-pointer">
            <Upload className="h-4 w-4" /> Subir imagen
            <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], "categories", (url) => setCategoryForm((current) => ({ ...current, image_url: url })))} />
          </label>
          <input className="field" placeholder="Nombre" value={categoryForm.label} onChange={(event) => setCategoryForm({ ...categoryForm, label: event.target.value })} required />
          <input className="field" placeholder="Subtítulo" value={categoryForm.subtitle} onChange={(event) => setCategoryForm({ ...categoryForm, subtitle: event.target.value })} />
          <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
            <span>Visible para clientes</span>
            <input type="checkbox" checked={categoryForm.visible} onChange={(event) => setCategoryForm({ ...categoryForm, visible: event.target.checked })} />
          </label>
          <button className="btn-primary w-full" disabled={busy}>Crear categoría</button>
        </form>
      </div>
    </div>
  );
}
