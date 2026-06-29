import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import LibraryAdminPage from "@/components/library/LibraryAdminPage";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { NUTRITION_CATEGORIES } from "@/lib/nutritionCategories";
import hidratacionImage from "@/assets/nutrition/hidratacion.png";
import proteinasImage from "@/assets/nutrition/proteinas.png";
import recuperacionImage from "@/assets/nutrition/recuperacion-realimentacion.png";
import postEntrenoImage from "@/assets/nutrition/post-entreno.png";
import suplementacionImage from "@/assets/nutrition/suplementacion.png";
import alimentacionImage from "@/assets/nutrition/alimentacion-deportiva.png";
import planesImage from "@/assets/nutrition/planes-guias.png";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { AdminNumberValue } from "@/lib/adminNumberInput";
import { numberInputValue, numberOrFallback } from "@/lib/adminNumberInput";

const SIGNED_TTL = 60 * 60 * 24 * 7;

type Category = {
  id: string;
  key: string;
  label: string;
  emoji?: string | null;
  subtitle?: string | null;
  image_url?: string | null;
  visible?: boolean | null;
  sort_order: number | null;
};

type CategoryForm = {
  id?: string;
  label: string;
  subtitle: string;
  emoji: string;
  image_url: string;
  visible: boolean;
  sort_order: AdminNumberValue;
};

const emptyCategory: CategoryForm = {
  label: "",
  subtitle: "",
  emoji: "",
  image_url: "",
  visible: true,
  sort_order: 0,
};

const QUICK_SECTIONS = [
  "Descripción",
  "Beneficios",
  "Modo de uso",
  "Ingredientes",
  "Observaciones",
  "Texto libre",
];

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

async function uploadCategoryImage(file: File) {
  const path = `nutrition/categories/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("resource-media").upload(path, file);
  if (error) throw error;
  const { data, error: signedError } = await supabase.storage.from("resource-media").createSignedUrl(path, SIGNED_TTL);
  if (signedError) throw signedError;
  return data.signedUrl;
}

export default function AdminNutrition() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyCategory);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
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
          emoji: category.emoji,
          subtitle: category.subtitle,
          image_url: categoryImages[category.key] ?? null,
          visible: true,
          sort_order: index + 1,
        }))
      );
    } else setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].key);
    }
  }, [activeCategory, categories]);

  const categoryProps = useMemo(
    () =>
      categories.map((c) => ({
        key: c.key,
        label: c.label,
        emoji: c.emoji,
        subtitle: c.subtitle,
        image: c.image_url || categoryImages[c.key],
        visible: c.visible,
      })),
    [categories]
  );

  const activeCategoryData = categories.find((category) => category.key === activeCategory) ?? categories[0];

  const reset = () => setForm(emptyCategory);

  const edit = (category: Category) => {
    setForm({
      id: category.id,
      label: category.label ?? "",
      subtitle: category.subtitle ?? "",
      emoji: category.emoji ?? "",
      image_url: category.image_url ?? "",
      visible: category.visible !== false,
      sort_order: category.sort_order ?? 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const label = form.label.trim();
    if (!label) return;

    setBusy(true);
    const payload: any = {
      label,
      subtitle: form.subtitle.trim() || null,
      emoji: form.emoji.trim() || null,
      image_url: form.image_url || null,
      visible: form.visible,
      sort_order: numberOrFallback(form.sort_order),
    };

    const result = form.id
      ? await (supabase as any).from("nutrition_categories").update(payload).eq("id", form.id)
      : await (supabase as any)
          .from("nutrition_categories")
          .insert({ ...payload, key: slugify(label) || `categoria-${Date.now()}` });

    setBusy(false);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(form.id ? "Categoría actualizada" : "Categoría creada");
      reset();
      load();
    }
  };

  const toggleVisible = async (category: Category) => {
    const { error } = await (supabase as any)
      .from("nutrition_categories")
      .update({ visible: category.visible === false })
      .eq("id", category.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (category: Category) => {
    if (!confirm("¿Eliminar esta categoría? Los contenidos no se borrarán, pero quedarán sin esta categoría.")) return;
    const { error } = await (supabase as any).from("nutrition_categories").delete().eq("id", category.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Categoría eliminada");
      if (form.id === category.id) reset();
      load();
    }
  };

  const move = async (category: Category, dir: -1 | 1) => {
    const index = categories.findIndex((c) => c.id === category.id);
    const swapIndex = index + dir;
    if (index < 0 || swapIndex < 0 || swapIndex >= categories.length) return;
    const other = categories[swapIndex];
    const categoryOrder = category.sort_order ?? 0;
    const otherOrder = other.sort_order ?? 0;
    await (supabase as any).from("nutrition_categories").update({ sort_order: otherOrder }).eq("id", category.id);
    await (supabase as any).from("nutrition_categories").update({ sort_order: categoryOrder }).eq("id", other.id);
    load();
  };

  const onCategoryImage = async (file: File) => {
    try {
      setBusy(true);
      const url = await uploadCategoryImage(file);
      setForm((current) => ({ ...current, image_url: url }));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-28 admin-nutrition-page">
      <AdminPageHeader title="Nutrición deportiva" backTo="/app/admin" />

      <div className="card-soft admin-nutrition-panel p-4 mb-6">
        <h2 className="font-serif text-xl mb-1">Categorías de Nutrición deportiva</h2>
        <p className="text-sm muted mb-4">
          Crea categorías visuales, cambia portadas, ocúltalas sin borrarlas y decide el orden en el que aparecen a las clientas.
        </p>

        {loading ? (
          <div className="text-sm muted">Cargando categorías…</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {categories.map((category) => {
              const image = category.image_url || categoryImages[category.key];
              const selected = activeCategory === category.key;
              return (
                <div
                  key={category.id}
                  className={`admin-nutrition-category-row rounded-2xl border border-[#FF2D95] overflow-hidden h-[142px] ${selected ? "is-active" : ""}`}
                >
                  <button type="button" onClick={() => setActiveCategory(category.key)} className="admin-nutrition-category-open h-full w-full text-left flex flex-col">
                    {image ? (
                      <div className="p-2 pb-0 bg-black">
                        <img src={image} alt="" className="h-14 w-full rounded-xl object-cover admin-nutrition-category-image" />
                      </div>
                    ) : (
                      <div className="h-20 w-full bg-black text-[#FF2D95] grid place-items-center text-xl">
                        {category.emoji || "★"}
                      </div>
                    )}
                    <div className="flex-1 px-2 py-2 text-center bg-black">
                      <div className="font-medium text-[12px] leading-tight line-clamp-2">{category.label}</div>
                      <div className="text-[10px] muted leading-tight line-clamp-2 mt-1">
                        {category.subtitle || category.key}
                        {category.visible === false ? " · Oculta" : ""}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {categories.length > 0 && activeCategoryData && (
        <>
          <div className="card-soft admin-nutrition-panel p-4 mb-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#FF2D95] font-bold">Categoría seleccionada</div>
            <h2 className="font-serif text-xl mt-1">{activeCategoryData.label}</h2>
            <p className="text-sm muted mt-1">Gestiona aquí sus tarjetas con texto, URLs, vídeos, imágenes y PDFs.</p>
            <div className="grid grid-cols-5 gap-2 mt-3">
              <button type="button" onClick={() => move(activeCategoryData, -1)} className="btn-secondary px-2 text-xs" aria-label="Subir categoría">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(activeCategoryData, 1)} className="btn-secondary px-2 text-xs" aria-label="Bajar categoría">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => toggleVisible(activeCategoryData)} className="btn-secondary px-2 text-xs" aria-label="Mostrar u ocultar categoría">
                {activeCategoryData.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => edit(activeCategoryData)} className="btn-secondary px-2 text-xs" aria-label="Editar categoría">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove(activeCategoryData)} className="btn-secondary px-2 text-xs text-destructive" aria-label="Eliminar categoría">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {form.id && (
            <form onSubmit={save} className="admin-nutrition-form rounded-2xl border border-[#FF2D95] p-3 space-y-3 mt-4">
              <div className="font-medium">{form.id ? "Editar categoría" : "Nueva categoría"}</div>
              {form.image_url && <img src={form.image_url} alt="" className="h-28 w-full rounded-2xl object-cover" />}
              <label className="btn-primary inline-flex cursor-pointer">
                <Upload className="h-4 w-4" /> {form.image_url ? "Cambiar portada" : "Subir portada"}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onCategoryImage(event.target.files[0])} />
              </label>
              <input className="field" placeholder="Nombre de categoría" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required />
              <input className="field" placeholder="Subtítulo breve" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="field" placeholder="Icono opcional" value={form.emoji} onChange={(event) => setForm({ ...form, emoji: event.target.value })} />
                <input className="field" type="number" placeholder="Orden" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: numberInputValue(event.target.value) })} />
              </div>
              <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
                <span>Visible para clientes</span>
                <input type="checkbox" checked={form.visible} onChange={(event) => setForm({ ...form, visible: event.target.checked })} />
              </label>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={busy}>
                  <Save className="h-4 w-4" /> {form.id ? "Guardar categoría" : "Crear categoría"}
                </button>
                {form.id && (
                  <button type="button" className="btn-secondary" onClick={reset}>
                    <X className="h-4 w-4" /> Cancelar
                  </button>
                )}
              </div>
            </form>
            )}
          </div>
          <LibraryAdminPage
            table="nutrition_items"
            storageFolder="nutrition"
            backTo="/app/admin"
            title="Nutrición deportiva"
            categories={categoryProps}
            className="admin-nutrition-content"
            enableVisibility
            enableSubtitle
            quickSections={QUICK_SECTIONS}
            showHeader={false}
            categoryFilter={activeCategory}
          />
          {!form.id && (
            <div className="card-soft admin-nutrition-panel p-4 mt-4">
              <form onSubmit={save} className="admin-nutrition-form rounded-2xl border border-[#FF2D95] p-3 space-y-3">
                <div className="font-medium">Nueva categoría</div>
                {form.image_url && <img src={form.image_url} alt="" className="h-28 w-full rounded-2xl object-cover" />}
                <label className="btn-primary inline-flex cursor-pointer">
                  <Upload className="h-4 w-4" /> {form.image_url ? "Cambiar portada" : "Subir portada"}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onCategoryImage(event.target.files[0])} />
                </label>
                <input className="field" placeholder="Nombre de categoría" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required />
                <input className="field" placeholder="Subtítulo breve" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="field" placeholder="Icono opcional" value={form.emoji} onChange={(event) => setForm({ ...form, emoji: event.target.value })} />
                  <input className="field" type="number" placeholder="Orden" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: numberInputValue(event.target.value) })} />
                </div>
                <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
                  <span>Visible para clientes</span>
                  <input type="checkbox" checked={form.visible} onChange={(event) => setForm({ ...form, visible: event.target.checked })} />
                </label>
                <button className="btn-primary w-full" disabled={busy}>
                  <Save className="h-4 w-4" /> Crear categoría
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
