import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import LibraryAdminPage from "@/components/library/LibraryAdminPage";
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

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("nutrition_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    else setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const categoryProps = useMemo(
    () =>
      categories.map((c) => ({
        key: c.key,
        label: c.label,
        emoji: c.emoji,
        subtitle: c.subtitle,
        image: c.image_url ?? undefined,
        visible: c.visible,
      })),
    [categories]
  );

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
      <div className="card-soft admin-nutrition-panel p-4 mb-6">
        <h2 className="font-serif text-xl mb-1">Categorías de Nutrición deportiva</h2>
        <p className="text-sm muted mb-4">
          Crea categorías visuales, cambia portadas, ocúltalas sin borrarlas y decide el orden en el que aparecen a las clientas.
        </p>

        <form onSubmit={save} className="admin-nutrition-form rounded-2xl border border-[#FF2D95] p-3 space-y-3 mb-5">
          <div className="font-medium">{form.id ? "Editar categoría" : "Nueva categoría"}</div>
          {form.image_url && <img src={form.image_url} alt="" className="h-32 w-full rounded-2xl object-cover" />}
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

        {loading ? (
          <div className="text-sm muted">Cargando categorías…</div>
        ) : (
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div key={category.id} className="admin-nutrition-category-row rounded-2xl border border-[#FF2D95] p-3 flex items-center gap-3">
                {category.image_url ? (
                  <img src={category.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-black text-[#FF2D95] grid place-items-center text-xl">
                    {category.emoji || "★"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{category.label}</div>
                  <div className="text-xs muted truncate">
                    {category.subtitle || category.key}
                    {category.visible === false ? " · Oculta" : ""}
                  </div>
                </div>
                <button type="button" onClick={() => move(category, -1)} disabled={index === 0} className="p-1" aria-label="Subir categoría"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(category, 1)} disabled={index === categories.length - 1} className="p-1" aria-label="Bajar categoría"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => toggleVisible(category)} className="p-1 text-primary" aria-label="Mostrar u ocultar">
                  {category.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => edit(category)} className="p-1 text-primary" aria-label="Editar categoría"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(category)} className="p-1 text-destructive" aria-label="Eliminar categoría"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {categories.length > 0 && (
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
        />
      )}
    </div>
  );
}
