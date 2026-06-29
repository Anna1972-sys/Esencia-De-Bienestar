import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import {
  DEFAULT_RECIPE_GENERATOR_CATEGORIES,
  loadRecipeGeneratorCategories,
  saveRecipeGeneratorCategories,
  slugifyRecipeCategory,
  type RecipeGeneratorCategory,
} from "@/lib/recipeGeneratorCategories";

type Settings = {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  welcome_title: string;
  welcome_message: string;
};

const empty: Settings = {
  app_name: "Esencia de Bienestar",
  logo_url: "",
  primary_color: "#D9A6B3",
  secondary_color: "#F4E7E1",
  accent_color: "#C8B6E2",
  welcome_title: "",
  welcome_message: "",
};

export default function AdminSettings() {
  const [s, setS] = useState<Settings>(empty);
  const [recipeTypes, setRecipeTypes] = useState<RecipeGeneratorCategory[]>(DEFAULT_RECIPE_GENERATOR_CATEGORIES);
  const [busy, setBusy] = useState(false);
  const [recipeTypesBusy, setRecipeTypesBusy] = useState(false);
  const [refreshingMedia, setRefreshingMedia] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from("app_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }: any) => data && setS({ ...empty, ...data }));
    loadRecipeGeneratorCategories(supabase as any).then(setRecipeTypes);
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await (supabase as any)
      .from("app_settings")
      .update({ ...s, updated_at: new Date().toISOString() })
      .eq("id", true);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Configuración guardada");
  };

  const updateRecipeType = (index: number, patch: Partial<RecipeGeneratorCategory>) => {
    setRecipeTypes(items => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const addRecipeType = () => {
    setRecipeTypes(items => [
      ...items,
      {
        id: `tipo_${items.length + 1}`,
        label: "Nuevo tipo",
        description: "Describe aquí cuándo debe usarse este tipo de receta.",
      },
    ]);
  };

  const removeRecipeType = (index: number) => {
    setRecipeTypes(items => items.length <= 1 ? items : items.filter((_, i) => i !== index));
  };

  const saveRecipeTypes = async () => {
    setRecipeTypesBusy(true);
    const { categories, savedRemotely, error } = await saveRecipeGeneratorCategories(recipeTypes, supabase as any);
    setRecipeTypes(categories);
    setRecipeTypesBusy(false);

    if (savedRemotely) {
      toast.success("Tipos de receta guardados");
    } else {
      toast.warning("Guardado localmente. Aplica la migración de app_settings para guardarlo en Supabase.");
      if (error) console.warn("[recipe-generator-categories]", error);
    }
  };

  const refreshMediaLinks = async () => {
    if (refreshingMedia) return;
    setRefreshingMedia(true);
    try {
      const { data, error } = await supabase.functions.invoke("refresh-media-urls");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const recipes =
        data?.recipesUpdated ??
        data?.recipes_updated ??
        data?.updatedRecipes ??
        data?.recipes ??
        0;
      const resources =
        data?.resourcesUpdated ??
        data?.resources_updated ??
        data?.updatedResources ??
        data?.resources ??
        0;

      toast.success(`Enlaces actualizados: ${recipes} recetas y ${resources} recursos.`);
    } catch (err: any) {
      toast.error(err?.message || "No se pudieron refrescar los enlaces de medios");
    } finally {
      setRefreshingMedia(false);
    }
  };

  return (
    <div className="pb-28">
      <AdminPageHeader title="Ajustes generales" subtitle="Personaliza la apariencia y los textos principales." />

      <section className="card-soft admin-settings-soft-section p-4 mb-4 space-y-3">
        <div>
          <h2 className="font-serif text-lg">Mantenimiento de medios</h2>
          <p className="text-sm muted mt-1">
            Refresca las URLs de imágenes y vídeos ya existentes sin subir archivos nuevos.
          </p>
        </div>
        <button type="button" onClick={refreshMediaLinks} disabled={refreshingMedia} className="btn-secondary w-full">
          <RefreshCw className={`h-4 w-4 ${refreshingMedia ? "animate-spin" : ""}`} />
          {refreshingMedia ? "Refrescando enlaces…" : "Refrescar enlaces de medios"}
        </button>
      </section>

      <section className="card-soft admin-recipe-types-section p-4 mb-4 space-y-4">
        <div>
          <h2 className="font-serif text-lg">Tipos de receta del generador IA</h2>
          <p className="text-sm muted mt-1">
            Edita los marcadores que aparecen en “Tipo de receta”. Puedes cambiar textos, añadir más opciones o eliminar las que no uses.
          </p>
        </div>

        <div className="space-y-3">
          {recipeTypes.map((item, index) => (
            <div key={`${item.id}-${index}`} className="admin-recipe-type-card rounded-2xl border border-primary/40 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-primary">Tipo {index + 1}</div>
                <button
                  type="button"
                  onClick={() => removeRecipeType(index)}
                  disabled={recipeTypes.length <= 1}
                  className="btn-ghost text-destructive px-3 py-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs muted">Texto del marcador</label>
                  <input
                    className="field"
                    value={item.label}
                    onChange={(e) => updateRecipeType(index, {
                      label: e.target.value,
                      id: slugifyRecipeCategory(e.target.value) || item.id,
                    })}
                    placeholder="Ej. Cenas ligeras"
                  />
                </div>
                <div>
                  <label className="text-xs muted">Identificador</label>
                  <input
                    className="field"
                    value={item.id}
                    onChange={(e) => updateRecipeType(index, { id: slugifyRecipeCategory(e.target.value) || item.id })}
                    placeholder="cenas_ligeras"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs muted">Descripción</label>
                <textarea
                  className="field min-h-20"
                  value={item.description}
                  onChange={(e) => updateRecipeType(index, { description: e.target.value })}
                  placeholder="Describe el objetivo nutricional de este tipo de receta."
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={addRecipeType} className="btn-secondary w-full">
            <Plus className="h-4 w-4" /> Añadir tipo
          </button>
          <button type="button" onClick={saveRecipeTypes} disabled={recipeTypesBusy} className="btn-primary w-full">
            <Save className="h-4 w-4" /> {recipeTypesBusy ? "Guardando…" : "Guardar tipos de receta"}
          </button>
        </div>
      </section>

      <form onSubmit={save} className="card-soft admin-settings-soft-section p-4 space-y-4">
        <div>
          <label className="text-xs muted">Nombre de la aplicación</label>
          <input className="field" value={s.app_name} onChange={(e) => setS({ ...s, app_name: e.target.value })} required />
        </div>

        <div>
          <label className="text-xs muted">URL del logo</label>
          <input className="field" placeholder="https://…" value={s.logo_url ?? ""} onChange={(e) => setS({ ...s, logo_url: e.target.value })} />
          {s.logo_url && <img src={s.logo_url} alt="Logo" className="mt-2 h-16 w-16 object-contain rounded-xl border" />}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            ["primary_color", "Primario"],
            ["secondary_color", "Secundario"],
            ["accent_color", "Acento"],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <label className="text-xs muted">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="h-10 w-10 rounded border" />
                <input className="field flex-1" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs muted">Título de bienvenida</label>
          <input className="field" value={s.welcome_title} onChange={(e) => setS({ ...s, welcome_title: e.target.value })} />
        </div>

        <div>
          <label className="text-xs muted">Mensaje de bienvenida</label>
          <textarea className="field min-h-24" value={s.welcome_message} onChange={(e) => setS({ ...s, welcome_message: e.target.value })} />
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          <Save className="h-4 w-4" /> Guardar cambios
        </button>
      </form>
    </div>
  );
}
