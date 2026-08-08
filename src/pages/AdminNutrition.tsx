import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { readNutritionLabel, type NutritionLabelData, type NutritionLabelTableCandidate } from "@/lib/nutritionLabelReader";
import { NUTRITION_CATEGORIES, NUTRITION_CATEGORY_SECTIONS } from "@/lib/nutritionCategories";
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
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Eye, EyeOff, FileText, Image as ImageIcon, Link as LinkIcon, Pencil, Plus, Trash2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import DraftBanner from "@/components/DraftBanner";
import ProductAccordion from "@/components/admin/ProductAccordion";

const SIGNED_TTL = 60 * 60 * 24 * 7;
const ADMIN_NUTRITION_DRAFT_KEY = "admin-nutrition-content-draft-v1";
const nutritionDraftKey = (category: string) => `${ADMIN_NUTRITION_DRAFT_KEY}:${category}`;
const OFFICIAL_LABEL_ACCEPT = "application/pdf,image/jpeg,image/jpg,image/png,image/webp";
const SPOON_MEDIA_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,application/pdf,.pdf";

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
  video_urls: string[];
  pdf_urls: string[];
  video_url: string;
  pdf_url: string;
  external_url: string;
  label_file_url: string;
  spoon_image_url: string;
  nutrition_label: NutritionLabelData | null;
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
  video_urls: [],
  pdf_urls: [],
  video_url: "",
  pdf_url: "",
  external_url: "",
  label_file_url: "",
  spoon_image_url: "",
  nutrition_label: null,
  sections: [],
  visible: true,
};

function contentHasDraft(form: ContentForm) {
  return Boolean(
    form.title.trim()
    || form.subtitle.trim()
    || form.cover_image
    || form.description.trim()
    || form.benefits.trim()
    || form.usage.trim()
    || form.ingredients.trim()
    || form.observations.trim()
    || form.free_text.trim()
    || form.gallery.length
    || form.video_urls.length
    || form.pdf_urls.length
    || form.video_url.trim()
    || form.pdf_url.trim()
    || form.external_url.trim()
    || form.label_file_url
    || form.spoon_image_url
    || form.nutrition_label
    || form.sections.length
  );
}

function uploadedFileLabel(url: string, kind: "Vídeo" | "PDF", index: number) {
  try {
    const pathname = new URL(url).pathname;
    const rawName = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
    const cleanName = rawName
      .replace(/^\d{10,}[-_]?/, "")
      .replace(/[_-]+/g, " ")
      .trim();
    return cleanName || `${kind} ${index + 1}`;
  } catch {
    return `${kind} ${index + 1}`;
  }
}

function labelFileName(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "etiqueta");
  } catch {
    return "etiqueta";
  }
}

function labelMimeType(url: string) {
  const cleanUrl = url.toLowerCase().split("?")[0];
  if (cleanUrl.endsWith(".pdf")) return "application/pdf";
  if (cleanUrl.endsWith(".png")) return "image/png";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

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

async function prepareOfficialProductMedia(file: File) {
  const lowerName = file.name.toLowerCase();
  const isHeic = file.type === "image/heic" || file.type === "image/heif" || lowerName.endsWith(".heic") || lowerName.endsWith(".heif");
  if (!isHeic) return file;
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
  return new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg", lastModified: file.lastModified });
}

async function uploadOfficialProductMedia(file: File, folder: "labels" | "spoon") {
  const preparedFile = folder === "spoon" ? await prepareOfficialProductMedia(file) : file;
  const safeName = preparedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("product-media").upload(path, preparedFile, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("product-media").getPublicUrl(path);
  return data.publicUrl;
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
  if (form.label_file_url) blocks.push({ type: "official_label", url: form.label_file_url });
  if (form.nutrition_label) blocks.push({ type: "nutrition_label", data: form.nutrition_label });
  if (form.spoon_image_url) blocks.push({ type: "official_spoon", url: form.spoon_image_url });
  form.gallery.forEach((url) => url && blocks.push({ type: "image", url }));
  form.video_urls.forEach((url) => url && blocks.push({ type: "video", url }));
  form.pdf_urls.forEach((url) => url && blocks.push({ type: "pdf", url, name: "Documento" }));
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
    if (block?.type === "video" && block.url) next.video_urls.push(block.url);
    if (block?.type === "pdf" && block.url) next.pdf_urls.push(block.url);
    if (block?.type === "link" && block.url) next.external_url = block.url;
    if (block?.type === "official_label" && block.url) next.label_file_url = block.url;
    if (block?.type === "nutrition_label" && block.data && typeof block.data === "object") next.nutrition_label = block.data;
    if (block?.type === "official_spoon" && block.url) next.spoon_image_url = block.url;
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
  const [contentFormOpen, setContentFormOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openEditorBlocks, setOpenEditorBlocks] = useState<Set<string>>(() => new Set());
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readingLabel, setReadingLabel] = useState(false);
  const [nutritionTableCandidates, setNutritionTableCandidates] = useState<NutritionLabelTableCandidate[]>([]);

  const editorAccordionProps = (title: string) => ({
    indicator: "plus" as const,
    open: openEditorBlocks.has(title),
    onOpenChange: (nextOpen: boolean) => {
      setOpenEditorBlocks(current => {
        const next = new Set(current);
        if (nextOpen) next.add(title);
        else next.delete(title);
        return next;
      });
    },
  });

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
    const loadedCategories = data ?? [];
    const supplementation = loadedCategories.find((category: Category) => (
      category.key === "suplementacion" || category.key === "suplementacion-deportiva"
    ));
    if (
      supplementation
      && (
        supplementation.label !== "Suplementación deportiva"
        || supplementation.subtitle !== "Guía esencial para comenzar"
      )
    ) {
      const { error: copyError } = await (supabase as any)
        .from("nutrition_categories")
        .update({
          label: "Suplementación deportiva",
          subtitle: "Guía esencial para comenzar",
        })
        .eq("id", supplementation.id);
      if (!copyError) {
        supplementation.label = "Suplementación deportiva";
        supplementation.subtitle = "Guía esencial para comenzar";
      }
    }
    setCategories(loadedCategories);
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

  useEffect(() => {
    if (contentForm.id || !activeCategory || !contentHasDraft(contentForm)) return;
    const persistDraft = () => {
      try {
        window.localStorage.setItem(nutritionDraftKey(activeCategory), JSON.stringify({
          category: activeCategory,
          form: contentForm,
          savedAt: new Date().toISOString(),
        }));
      } catch {
        // El borrador es una ayuda local y nunca debe bloquear la edición.
      }
    };
    const timer = window.setTimeout(() => {
      persistDraft();
    }, 400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeCategory, contentForm]);

  useEffect(() => {
    if (contentForm.id || !contentHasDraft(contentForm)) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [contentForm]);

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

  const categorySections = useMemo(() => NUTRITION_CATEGORY_SECTIONS.map((section) => ({
    ...section,
    categories: categories.filter((category) => section.categoryKeys.includes(category.key as never)),
  })).filter((section) => section.categories.length > 0), [categories]);

  const moveCategory = async (category: Category, direction: -1 | 1) => {
    const section = categorySections.find((candidate) => candidate.categories.some((item) => item.id === category.id));
    if (!section) return;
    const index = section.categories.findIndex((item) => item.id === category.id);
    const target = section.categories[index + direction];
    if (!target) return;

    const currentOrder = category.sort_order ?? categories.findIndex((item) => item.id === category.id) + 1;
    const targetOrder = target.sort_order ?? categories.findIndex((item) => item.id === target.id) + 1;
    setBusy(true);
    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      (supabase as any).from("nutrition_categories").update({ sort_order: targetOrder }).eq("id", category.id),
      (supabase as any).from("nutrition_categories").update({ sort_order: currentOrder }).eq("id", target.id),
    ]);
    setBusy(false);
    if (currentError || targetError) {
      toast.error((currentError || targetError).message);
      await loadCategories();
      return;
    }
    setCategories((current) => current
      .map((item) => item.id === category.id
        ? { ...item, sort_order: targetOrder }
        : item.id === target.id
          ? { ...item, sort_order: currentOrder }
          : item)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    toast.success("Orden guardado");
  };

  const clearContentDraft = (category = activeCategory) => {
    if (!category) return;
    try {
      window.localStorage.removeItem(nutritionDraftKey(category));
    } catch {
      // No bloquea el formulario si el navegador impide usar almacenamiento local.
    }
    setDraftRecovered(false);
  };

  const readContentDraft = (category: string) => {
    try {
      const raw = window.localStorage.getItem(nutritionDraftKey(category));
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved?.category !== category || !saved?.form || !contentHasDraft(saved.form)) return null;
      const categoryData = categories.find((item) => item.key === category);
      const alreadyPublished = items.some((item) => (
        itemBelongsToCategory(item, categoryData)
        && normalizeCategoryKey(item.title) === normalizeCategoryKey(saved.form.title)
      ));
      if (alreadyPublished) {
        window.localStorage.removeItem(nutritionDraftKey(category));
        return null;
      }
      return { ...emptyContent, ...saved.form, id: undefined } as ContentForm;
    } catch {
      return null;
    }
  };

  const resetContent = () => {
    setContentForm(emptyContent);
    setDraftRecovered(false);
  };

  const openNewContent = (category: string) => {
    const draft = readContentDraft(category);
    setContentForm(draft ?? emptyContent);
    setDraftRecovered(Boolean(draft));
    setOpenEditorBlocks(new Set());
    setContentFormOpen(true);
  };

  const openCategory = (key: string) => {
    const shouldOpen = activeCategory !== key;
    setActiveCategory(shouldOpen ? key : null);
    if (shouldOpen) {
      const draft = readContentDraft(key);
      setContentForm(draft ?? emptyContent);
      setDraftRecovered(Boolean(draft));
      setContentFormOpen(Boolean(draft));
    } else {
      resetContent();
      setContentFormOpen(false);
    }
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
    if (!confirm(`¿Seguro que deseas eliminar la categoría "${category.label}"? Los productos que contiene se conservarán.`)) return;
    setBusy(true);
    const { error } = await (supabase as any).from("nutrition_categories").delete().eq("id", category.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Categoría eliminada. Sus productos se han conservado.");
    if (activeCategory === category.key) {
      setActiveCategory(null);
      resetContent();
      setContentFormOpen(false);
    }
    clearCategoryEdit();
    loadCategories();
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
      if (!contentForm.id) clearContentDraft();
      resetContent();
      setContentFormOpen(false);
      loadItems();
    }
  };

  const removeContent = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este producto? La categoría no se eliminará.")) return;
    const { error } = await (supabase as any).from("nutrition_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setItems((current) => current.filter((item) => item.id !== id));
      if (contentForm.id === id) {
        resetContent();
        setContentFormOpen(false);
      }
      toast.success("Producto eliminado. La categoría se conserva.");
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

  const onUploadMany = async (files: FileList | null, folder: string, setter: (urls: string[]) => void) => {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    try {
      setBusy(true);
      const urls: string[] = [];
      for (const file of selectedFiles) urls.push(await uploadFile(file, folder));
      setter(urls);
      toast.success(`${selectedFiles.length} ${selectedFiles.length === 1 ? "archivo añadido" : "archivos añadidos"}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const onOfficialMediaUpload = async (file: File, folder: "labels" | "spoon", key: "label_file_url" | "spoon_image_url") => {
    try {
      setBusy(true);
      const url = await uploadOfficialProductMedia(file, folder);
      if (key === "label_file_url") setNutritionTableCandidates([]);
      setContentForm((current) => ({ ...current, [key]: url, ...(key === "label_file_url" ? { nutrition_label: null } : {}) }));
      toast.success("Archivo subido. Guarda los cambios para publicarlo.");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo subir el archivo");
    } finally {
      setBusy(false);
    }
  };

  const applyNutritionLabel = (data: NutritionLabelData) => {
    setContentForm((current) => ({
      ...current,
      description: typeof data.description === "string" && data.description.trim() ? data.description : current.description,
      ingredients: typeof data.ingredients_text === "string" && data.ingredients_text.trim() ? data.ingredients_text : current.ingredients,
      nutrition_label: data,
    }));
    setNutritionTableCandidates([]);
  };

  const readSavedNutritionLabel = async () => {
    if (!contentForm.label_file_url) {
      toast.error("Primero sube la etiqueta oficial del producto");
      return;
    }
    try {
      setReadingLabel(true);
      const payload = await readNutritionLabel(
        labelFileName(contentForm.label_file_url),
        labelMimeType(contentForm.label_file_url),
        contentForm.label_file_url,
      );
      const candidates = Array.isArray(payload.nutrition_tables) ? payload.nutrition_tables : [];
      if (payload.requires_admin_selection && candidates.length > 1) {
        setNutritionTableCandidates(candidates);
        toast.message("Se han detectado varias tablas. Elige cuál corresponde al producto.");
        return;
      }
      applyNutritionLabel(payload);
      toast.success("Etiqueta nutricional leída. Revisa los datos y pulsa Publicar para guardarlos.");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo leer la etiqueta nutricional");
    } finally {
      setReadingLabel(false);
    }
  };

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
          {categorySections.map((section) => {
            const isOpen = openSections[section.key] === true;
            return (
            <section key={section.key} className="rounded-2xl border border-[#FF2D95]/45 bg-white overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 p-3 text-left"
                onClick={() => setOpenSections((current) => ({ ...current, [section.key]: !isOpen }))}
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF2D95]">{section.label}</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {isOpen && (
              <div className="px-3 pb-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {section.categories.map((category, categoryIndex) => {
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
                      <div className="grid grid-cols-2 gap-1 p-1.5 bg-white">
                        <button
                          type="button"
                          className="admin-nutrition-category-action justify-center px-1"
                          disabled={busy || categoryIndex === 0}
                          onClick={() => moveCategory(category, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" /> Subir
                        </button>
                        <button
                          type="button"
                          className="admin-nutrition-category-action justify-center px-1"
                          disabled={busy || categoryIndex === section.categories.length - 1}
                          onClick={() => moveCategory(category, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" /> Bajar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeCategoryData && section.categories.some((category) => category.key === activeCategory) && (
                <section id={`nutrition-panel-${activeCategoryData.key}`} className="card-soft admin-nutrition-panel admin-nutrition-content-panel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#FF2D95] font-bold mb-1">{activeCategoryData.label}</div>
                      <p className="text-xs muted">Gestiona esta categoría y su contenido.</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="admin-nutrition-category-action"
                        onClick={() => {
                          setActiveCategory(null);
                          setContentForm(emptyContent);
                          setContentFormOpen(false);
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Cerrar categoría
                      </button>
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
                      {contentFormOpen && contentForm.id && (
                        <button type="button" className="admin-nutrition-category-action is-delete" onClick={() => removeContent(contentForm.id!)}>
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar producto
                        </button>
                      )}
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
                            <button
                              type="button"
                              className="text-primary"
                              onClick={() => {
                                setContentForm(formFromItem(item));
                                setDraftRecovered(false);
                                setOpenEditorBlocks(new Set());
                                setContentFormOpen(true);
                              }}
                              aria-label="Editar contenido"
                            >
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
                  {!contentFormOpen && (
                    <button type="button" className="btn-primary w-full" onClick={() => openNewContent(activeCategoryData.key)}>
                      <Plus className="h-4 w-4" /> Nueva publicación
                    </button>
                  )}
                  {contentFormOpen && (
                  <>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-serif text-xl">{contentForm.id ? "Editar publicación" : "Nueva publicación"}</h3>
                    <button type="button" className="admin-nutrition-category-action" onClick={() => setContentFormOpen(false)}>
                      <X className="h-3.5 w-3.5" /> Cerrar
                    </button>
                  </div>
                  <p className="text-sm muted mb-3">Completa los campos que necesites y publica el contenido dentro de esta categoría.</p>
                  {draftRecovered && !contentForm.id && (
                    <DraftBanner
                      onDiscard={() => {
                        clearContentDraft();
                        setContentForm(emptyContent);
                      }}
                    />
                  )}
                  <form onSubmit={saveContent} className="admin-nutrition-form rounded-2xl border border-[#FF2D95] p-3 space-y-3">
                    <div className="sticky top-2 z-10 rounded-2xl border border-[#FF2D95]/40 bg-white/95 p-3 shadow-sm backdrop-blur space-y-2">
                      <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
                        <span>Visible para clientes</span>
                        <input type="checkbox" checked={contentForm.visible} onChange={(event) => setContentForm({ ...contentForm, visible: event.target.checked })} />
                      </label>
                      <button className="btn-primary w-full" disabled={busy}>{contentForm.id ? "Guardar cambios" : "Publicar"}</button>
                    </div>

                    <ProductAccordion title="Imagen principal y datos básicos" {...editorAccordionProps("Imagen principal y datos básicos")}>
                    <div className="space-y-3">
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
                    </div>
                    </ProductAccordion>

                    <ProductAccordion title="Etiqueta nutricional oficial" {...editorAccordionProps("Etiqueta nutricional oficial")}>
                    <div className="rounded-[22px] bg-secondary/70 p-3">
                      <div className="space-y-2 mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium leading-tight"><FileText className="h-4 w-4" />Etiqueta nutricional oficial</div>
                        {contentForm.label_file_url && (
                          <button type="button" className="btn-primary admin-product-clear-button" onClick={() => {
                            setNutritionTableCandidates([]);
                            setContentForm((current) => ({ ...current, label_file_url: "", nutrition_label: null }));
                          }}>
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar etiqueta
                          </button>
                        )}
                      </div>
                      {contentForm.label_file_url && (
                        <div className="admin-product-media-preview mb-2">
                          <a href={contentForm.label_file_url} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center">
                            <FileText className="h-4 w-4" /> Abrir etiqueta guardada
                          </a>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <label className="btn-primary cursor-pointer justify-center">
                          <Upload className="h-4 w-4" /> Subir
                          <input type="file" className="hidden" accept={OFFICIAL_LABEL_ACCEPT} onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void onOfficialMediaUpload(file, "labels", "label_file_url");
                            event.currentTarget.value = "";
                          }} />
                        </label>
                        <input className="field flex-1" placeholder="O pegar URL" value={contentForm.label_file_url} onChange={(event) => setContentForm((current) => ({ ...current, label_file_url: event.target.value }))} />
                      </div>
                      {contentForm.label_file_url && (
                        <button type="button" className="btn-primary mt-2" disabled={readingLabel} onClick={readSavedNutritionLabel}>
                          <FileText className="h-4 w-4" /> {readingLabel ? "Leyendo…" : "Leer etiqueta nutricional"}
                        </button>
                      )}
                      {nutritionTableCandidates.length > 1 && (
                        <div className="mt-3 rounded-2xl border border-primary/30 bg-white/90 p-3">
                          <p className="font-medium text-sm">Hemos encontrado varias tablas nutricionales</p>
                          <p className="mt-1 text-xs muted">Elige la tabla que corresponde a este producto antes de rellenar los datos.</p>
                          <div className="mt-3 grid gap-2">
                            {nutritionTableCandidates.map((candidate, index) => (
                              <button
                                key={candidate.id || index}
                                type="button"
                                className="rounded-xl border border-primary/25 bg-white p-3 text-left hover:border-primary"
                                onClick={() => {
                                  applyNutritionLabel(candidate.data);
                                  toast.success(`${candidate.title || `Tabla ${index + 1}`} aplicada. Pulsa Publicar para guardarla.`);
                                }}
                              >
                                <span className="block text-xs font-bold uppercase tracking-wide text-primary">Tabla {index + 1}</span>
                                <span className="block font-medium">{candidate.title || `Tabla ${index + 1}`}</span>
                                {candidate.context && <span className="block text-xs muted mt-1">{candidate.context}</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    </ProductAccordion>

                    <ProductAccordion title="Cuchara oficial Herbalife" {...editorAccordionProps("Cuchara oficial Herbalife")}>
                    <div className="rounded-[22px] bg-secondary/70 p-3">
                      <div className="space-y-2 mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium leading-tight"><ImageIcon className="h-4 w-4" />Imagen cuchara oficial Herbalife</div>
                        {contentForm.spoon_image_url && (
                          <button type="button" className="btn-primary admin-product-clear-button" onClick={() => setContentForm((current) => ({ ...current, spoon_image_url: "" }))}>
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar cuchara
                          </button>
                        )}
                      </div>
                      {contentForm.spoon_image_url && (
                        <div className="admin-product-media-preview mb-2">
                          {contentForm.spoon_image_url.toLowerCase().split("?")[0].endsWith(".pdf") ? (
                            <a href={contentForm.spoon_image_url} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center">
                              <FileText className="h-4 w-4" /> Abrir PDF guardado
                            </a>
                          ) : (
                            <img src={contentForm.spoon_image_url} alt="" />
                          )}
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <label className="btn-primary cursor-pointer justify-center">
                          <Upload className="h-4 w-4" /> Subir
                          <input type="file" className="hidden" accept={SPOON_MEDIA_ACCEPT} onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void onOfficialMediaUpload(file, "spoon", "spoon_image_url");
                            event.currentTarget.value = "";
                          }} />
                        </label>
                        <input className="field flex-1" placeholder="O pegar URL" value={contentForm.spoon_image_url} onChange={(event) => setContentForm((current) => ({ ...current, spoon_image_url: event.target.value }))} />
                      </div>
                      <p className="mt-3 rounded-2xl border border-primary bg-white/90 p-3 text-sm font-medium text-foreground flex items-center gap-2">
                        Pulsa aquí para comprobar la medida de la cuchara oficial.
                      </p>
                    </div>
                    </ProductAccordion>
                    <ProductAccordion title="Descripción" {...editorAccordionProps("Descripción")}>
                    <label className="block">
                      <span className="text-xs muted">Descripción</span>
                      <textarea className="field min-h-24 mt-1" placeholder="Descripción" value={contentForm.description} onChange={(event) => setContentForm({ ...contentForm, description: event.target.value })} />
                    </label>
                    </ProductAccordion>
                    <ProductAccordion title="Beneficios" {...editorAccordionProps("Beneficios")}>
                    <label className="block">
                      <span className="text-xs muted">Beneficios</span>
                      <textarea className="field min-h-20 mt-1" placeholder="Beneficios" value={contentForm.benefits} onChange={(event) => setContentForm({ ...contentForm, benefits: event.target.value })} />
                    </label>
                    </ProductAccordion>
                    <ProductAccordion title="Modo de uso" {...editorAccordionProps("Modo de uso")}>
                    <label className="block">
                      <span className="text-xs muted">Modo de uso</span>
                      <textarea className="field min-h-20 mt-1" placeholder="Modo de uso" value={contentForm.usage} onChange={(event) => setContentForm({ ...contentForm, usage: event.target.value })} />
                    </label>
                    </ProductAccordion>
                    <ProductAccordion title="Ingredientes" {...editorAccordionProps("Ingredientes")}>
                    <label className="block">
                      <span className="text-xs muted">Ingredientes (opcional)</span>
                      <textarea className="field min-h-20 mt-1" placeholder="Ingredientes (opcional)" value={contentForm.ingredients} onChange={(event) => setContentForm({ ...contentForm, ingredients: event.target.value })} />
                    </label>
                    </ProductAccordion>
                    <ProductAccordion title="Observaciones" {...editorAccordionProps("Observaciones")}>
                    <label className="block">
                      <span className="text-xs muted">Observaciones</span>
                      <textarea className="field min-h-20 mt-1" placeholder="Observaciones" value={contentForm.observations} onChange={(event) => setContentForm({ ...contentForm, observations: event.target.value })} />
                    </label>
                    </ProductAccordion>
                    <ProductAccordion title="Texto libre" {...editorAccordionProps("Texto libre")}>
                    <label className="block">
                      <span className="text-xs muted">Texto libre</span>
                      <textarea className="field min-h-24 mt-1" placeholder="Texto libre" value={contentForm.free_text} onChange={(event) => setContentForm({ ...contentForm, free_text: event.target.value })} />
                    </label>
                    </ProductAccordion>

                    <ProductAccordion title="Secciones personalizadas" {...editorAccordionProps("Secciones personalizadas")}>
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
                    </ProductAccordion>

                    <ProductAccordion title="Galería de imágenes" {...editorAccordionProps("Galería de imágenes")}>
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
                          <ImageIcon className="h-4 w-4" /> Añadir imágenes
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void onUploadMany(event.target.files, "gallery", (urls) => setContentForm((current) => ({ ...current, gallery: [...current.gallery, ...urls] })))} />
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
                    </ProductAccordion>

                    <ProductAccordion title="Vídeos" {...editorAccordionProps("Vídeos")}>
                    <div className="grid gap-2">
                      <label className="block">
                        <span className="text-xs muted">Añadir vídeo mediante URL</span>
                        <div className="flex gap-2 mt-1">
                          <input className="field" placeholder="URL del vídeo" value={contentForm.video_url} onChange={(event) => setContentForm({ ...contentForm, video_url: event.target.value })} />
                          <button
                            type="button"
                            className="btn-secondary shrink-0"
                            disabled={!contentForm.video_url.trim()}
                            onClick={() => setContentForm((current) => ({
                              ...current,
                              video_urls: [...current.video_urls, current.video_url.trim()],
                              video_url: "",
                            }))}
                          >
                            <Plus className="h-4 w-4" /> Añadir
                          </button>
                        </div>
                      </label>
                      {contentForm.video_urls.map((url, index) => (
                        <div key={`${url}-${index}`} className="rounded-xl border border-primary/30 bg-white p-2 flex items-center gap-2 text-xs">
                          <Video className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate flex-1 font-medium">{uploadedFileLabel(url, "Vídeo", index)}</span>
                          <button type="button" className="admin-nutrition-delete-icon" aria-label="Borrar vídeo" onClick={() => setContentForm((current) => ({ ...current, video_urls: current.video_urls.filter((_, itemIndex) => itemIndex !== index) }))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-secondary cursor-pointer">
                          <Video className="h-4 w-4" /> Subir vídeos
                          <input type="file" accept="video/*" multiple className="hidden" onChange={(event) => void onUploadMany(event.target.files, "videos", (urls) => setContentForm((current) => ({ ...current, video_urls: [...current.video_urls, ...urls] })))} />
                        </label>
                        <button
                          type="button"
                          className="admin-nutrition-delete-button"
                          disabled={contentForm.video_urls.length === 0}
                          onClick={() => setContentForm((current) => ({ ...current, video_urls: [], video_url: "" }))}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Borrar vídeos
                        </button>
                      </div>
                    </div>
                    </ProductAccordion>

                    <ProductAccordion title="PDFs" {...editorAccordionProps("PDFs")}>
                    <div className="grid gap-2">
                      <label className="block">
                        <span className="text-xs muted">Añadir PDF mediante URL</span>
                        <div className="flex gap-2 mt-1">
                          <input className="field" placeholder="URL del PDF" value={contentForm.pdf_url} onChange={(event) => setContentForm({ ...contentForm, pdf_url: event.target.value })} />
                          <button
                            type="button"
                            className="btn-secondary shrink-0"
                            disabled={!contentForm.pdf_url.trim()}
                            onClick={() => setContentForm((current) => ({
                              ...current,
                              pdf_urls: [...current.pdf_urls, current.pdf_url.trim()],
                              pdf_url: "",
                            }))}
                          >
                            <Plus className="h-4 w-4" /> Añadir
                          </button>
                        </div>
                      </label>
                      {contentForm.pdf_urls.map((url, index) => (
                        <div key={`${url}-${index}`} className="rounded-xl border border-primary/30 bg-white p-2 flex items-center gap-2 text-xs">
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate flex-1 font-medium">{uploadedFileLabel(url, "PDF", index)}</span>
                          <button type="button" className="admin-nutrition-delete-icon" aria-label="Borrar PDF" onClick={() => setContentForm((current) => ({ ...current, pdf_urls: current.pdf_urls.filter((_, itemIndex) => itemIndex !== index) }))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-secondary cursor-pointer">
                          <FileText className="h-4 w-4" /> Subir PDFs
                          <input type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => void onUploadMany(event.target.files, "pdfs", (urls) => setContentForm((current) => ({ ...current, pdf_urls: [...current.pdf_urls, ...urls] })))} />
                        </label>
                        <button
                          type="button"
                          className="admin-nutrition-delete-button"
                          disabled={contentForm.pdf_urls.length === 0}
                          onClick={() => setContentForm((current) => ({ ...current, pdf_urls: [], pdf_url: "" }))}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Borrar PDFs
                        </button>
                      </div>
                    </div>
                    </ProductAccordion>

                    <ProductAccordion title="Enlaces/URLs" {...editorAccordionProps("Enlaces/URLs")}>
                    <div className="space-y-2">
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
                    </div>
                    </ProductAccordion>
                  </form>
                  </>
                  )}
                </section>
              )}
              </div>
              )}
            </section>
          )})}
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
                <Trash2 className="h-3.5 w-3.5" /> Borrar imagen
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
              <Trash2 className="h-3.5 w-3.5" /> Borrar imagen
            </button>
          </div>
          <input className="field" placeholder="Nombre" value={categoryForm.label} onChange={(event) => setCategoryForm({ ...categoryForm, label: event.target.value })} required />
          <input className="field" placeholder="Subtítulo" value={categoryForm.subtitle} onChange={(event) => setCategoryForm({ ...categoryForm, subtitle: event.target.value })} />
          <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
            <span>Visible para clientes</span>
            <input type="checkbox" checked={categoryForm.visible} onChange={(event) => setCategoryForm({ ...categoryForm, visible: event.target.checked })} />
          </label>
          <button className="btn-primary w-full" disabled={busy}>{editingCategory ? "Guardar categoría" : "Crear categoría"}</button>
          {editingCategory && (
            <button
              type="button"
              className="admin-nutrition-delete-button w-full justify-center"
              disabled={busy}
              onClick={() => removeCategory(editingCategory)}
            >
              <Trash2 className="h-4 w-4" /> Eliminar categoría
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
