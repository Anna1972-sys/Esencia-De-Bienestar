import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Image as ImageIcon, Video, FileText, Type, ArrowUp, ArrowDown, Upload, Pencil, Pin, FolderTree, GripVertical, Eye, EyeOff, CheckSquare, Square, X, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { ResourceBlock } from "@/lib/resourceCategories";
import { useFormDraft } from "@/hooks/useFormDraft";
import DraftBanner from "@/components/DraftBanner";
import imgImprescindibles from "@/assets/resource-imprescindibles.png";
import imgVideos from "@/assets/resource-videos.png";
import imgGuias from "@/assets/resource-guias.png";
import imgGuideWelcome from "@/assets/resources/guide-welcome-final.svg";
import imgSkincare from "@/assets/resources/guide-skincare-final.svg";
import imgMenopause from "@/assets/resources/guide-menopause-final.svg";
import imgProteinGuide from "@/assets/resources/guide-protein-final.svg";
import { cleanGuideTitle, guideCardMatchesCategory, resolveCategoryCoverImage, resolveGuideCardCoverImage } from "@/components/resources/GuideCardsGrid";

const CONFIRM_DELETE = "¿Estás segura de que deseas eliminar este elemento? Esta acción no se puede deshacer.";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days; resign on read for longer access

const ADMIN_RESOURCE_ENTRY_CARDS = [
  { key: "imprescindibles", title: "Imprescindibles", image: imgImprescindibles, subtitle: "Empieza por aquí." },
  { key: "videos", title: "Vídeos", image: imgVideos, subtitle: "Aprende en pocos minutos." },
  { key: "guias", title: "Guías y recursos", image: imgGuias, subtitle: "Herramientas para avanzar." },
] as const;

type AdminResourceSectionKey = (typeof ADMIN_RESOURCE_ENTRY_CARDS)[number]["key"];

const GUIDE_RESOURCE_SUBCATEGORY_CARDS = [
  {
    slug: "guia-bienvenida",
    title: "Guía de bienvenida",
    image: imgGuideWelcome,
    subtitle: "Descubre cómo aprovechar todas las funciones de Esencia de Bienestar.",
  },
  {
    slug: "guia-cuidado-piel",
    title: "Guía de cuidado de la piel",
    image: imgSkincare,
    subtitle: "Recursos para cuidar tu piel con hábitos sencillos.",
  },
  {
    slug: "guia-menopausia",
    title: "Guía de menopausia",
    image: imgMenopause,
    subtitle: "Información práctica para acompañar esta etapa.",
  },
  {
    slug: "ebook-alimentos-ricos-en-proteina",
    title: "Ebook: Alimentos ricos en proteína",
    image: imgProteinGuide,
    subtitle: "Más de 300 alimentos organizados por categorías.",
  },
] as const;

function getCategoryKey(category: Category) {
  const value = (category.slug || category.name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (value.includes("imprescindible")) return "imprescindibles";
  if (value.includes("guia")) return "guias";
  if (value.includes("video")) return "videos";
  return value;
}

type Category = {
  id: string;
  name: string;
  slug: string | null;
  icon: string | null;
  subtitle: string | null;
  cover_image: string | null;
  parent_id: string | null;
  sort_order: number;
};

type Form = {
  id?: string;
  title: string;
  category_id: string;
  cover_image: string;
  blocks: ResourceBlock[];
  is_pinned: boolean;
  is_published?: boolean;
};

const empty: Form = { title: "", category_id: "", cover_image: "", blocks: [], is_pinned: false };

async function uploadFile(file: File, folder: string) {
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("resource-media").upload(path, file);
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from("resource-media").createSignedUrl(path, SIGNED_TTL);
  if (sErr) throw sErr;
  return data.signedUrl;
}

export default function AdminResources() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const { value: f, setValue: setF, clearDraft, hasDraft } = useFormDraft<Form>("admin-resources-new", empty, true);
  const [busy, setBusy] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("");
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState<{ kind: "cat"; id: string } | { kind: "item"; id: string; pos: "before" | "after" } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQ, setSearchQ] = useState("");
  const [filterSub, setFilterSub] = useState<string>("");
  const [filterPinned, setFilterPinned] = useState<"all" | "pinned" | "unpinned">("all");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [dateField, setDateField] = useState<"created_at" | "updated_at">("created_at");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"manual" | "newest" | "oldest" | "az" | "za">("manual");
  const [showFilters, setShowFilters] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedSection, setSelectedSection] = useState<AdminResourceSectionKey | "">("");
  const [guideSubcategoriesChecked, setGuideSubcategoriesChecked] = useState(false);

  const loadCats = () => supabase.from("resource_categories").select("*").order("sort_order").then(({ data }) => setCats((data ?? []) as Category[]));
  const load = () => supabase.from("resources")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .then(({ data }) => setItems(data ?? []));

  useEffect(() => { loadCats(); load(); }, []);

  const reset = () => { setF(empty); clearDraft(); setShowEditor(false); };

  const catById = useMemo(() => {
    const m = new Map<string, Category>();
    cats.forEach(c => m.set(c.id, c));
    return m;
  }, [cats]);

  const catLabel = (id: string | null) => {
    if (!id) return "Sin categoría";
    const c = catById.get(id);
    if (!c) return "Sin categoría";
    const parent = c.parent_id ? catById.get(c.parent_id) : null;
    return parent ? `${parent.name} › ${c.name}` : c.name;
  };

  const normalizeSlug = (value?: string | null) =>
    (value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const guideSubcategoryMatchesCard = (category: Category, card: (typeof GUIDE_RESOURCE_SUBCATEGORY_CARDS)[number]) => {
    return guideCardMatchesCategory(category, card);
  };

  const itemCategory = (item: any) => {
    if (item.category_id) return catById.get(item.category_id) ?? null;
    const legacy = normalizeSlug(item.category);
    if (!legacy) return null;
    return cats.find(c => normalizeSlug(c.slug) === legacy || normalizeSlug(c.name) === legacy) ?? null;
  };

  const itemCategoryMatches = (item: any, ids: Set<string>) => {
    const cat = itemCategory(item);
    if (cat?.id && ids.has(cat.id)) return true;
    const legacy = normalizeSlug(item.category);
    if (!legacy) return false;
    return cats.some(c => ids.has(c.id) && (normalizeSlug(c.slug) === legacy || normalizeSlug(c.name) === legacy));
  };

  const itemSectionMatches = (item: any, section: AdminResourceSectionKey) => {
    const cat = itemCategory(item);
    if (cat && getCategoryKey(cat) === section) return true;
    const legacy = normalizeSlug(item.category);
    if (!legacy) return false;
    if (section === "imprescindibles") return legacy.includes("imprescindible");
    if (section === "videos") return legacy.includes("video");
    if (section === "guias") return legacy.includes("guia");
    return false;
  };

  const itemCatLabel = (item: any) => {
    const c = itemCategory(item);
    if (!c) return "Sin categoría";
    const parent = c.parent_id ? catById.get(c.parent_id) : null;
    return parent ? `${parent.name} › ${c.name}` : c.name;
  };

  // tops + subs grouped for the picker
  const tops = cats.filter(c => !c.parent_id);
  const subsOf = (id: string) => cats.filter(c => c.parent_id === id);
  const topCategoryForSection = (section: AdminResourceSectionKey | "") =>
    section ? tops.find(c => getCategoryKey(c) === section) ?? null : null;
  const guideTopCategory = topCategoryForSection("guias");
  const guideSubcategoryCandidates = guideTopCategory
    ? (() => {
        const direct = subsOf(guideTopCategory.id);
        const directIds = new Set(direct.map(c => c.id));
        const matching = cats.filter(c =>
          c.id !== guideTopCategory.id &&
          !directIds.has(c.id) &&
          GUIDE_RESOURCE_SUBCATEGORY_CARDS.some(card => guideSubcategoryMatchesCard(c, card))
        );
        const seen = new Set<string>();
        return [...direct, ...matching].filter(category => {
          if (seen.has(category.id)) return false;
          seen.add(category.id);
          return true;
        });
      })()
    : [];
  const isGuideLeafCategory = (category?: Category | null) =>
    Boolean(
      guideTopCategory &&
      category &&
      category.id !== guideTopCategory.id &&
      guideSubcategoryCandidates.some(guideCategory => guideCategory.id === category.id)
    );
  const isGuideSubcategoryOverview = Boolean(guideTopCategory && filterCat === guideTopCategory.id && !filterSub && !showEditor && !f.id);
  const sectionIsOpen = Boolean(filterCat);
  const selectedCategoryId = filterSub || filterCat || f.category_id;
  const selectedFilterCategory = filterCat ? catById.get(filterCat) ?? null : null;
  const isGuideSubcategoryView = isGuideLeafCategory(selectedFilterCategory);

  const guideSubcategoryEntries = GUIDE_RESOURCE_SUBCATEGORY_CARDS.map((card, fallbackOrder) => {
    const category = guideSubcategoryCandidates.find(c => guideSubcategoryMatchesCard(c, card)) ?? null;
    const count = category ? items.filter(item => itemCategoryMatches(item, new Set([category.id]))).length : 0;
    return {
      ...card,
      category,
      count,
      displayTitle: cleanGuideTitle(category?.name || card.title, card.slug),
      displaySubtitle: category?.subtitle || card.subtitle,
      displayImage: resolveGuideCardCoverImage(card.slug, card.image),
      fallbackOrder,
    };
  }).sort((a, b) => {
    const orderA = a.category?.sort_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.category?.sort_order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.fallbackOrder - b.fallbackOrder;
  });

  useEffect(() => {
    if (!selectedSection) return;
    const category = topCategoryForSection(selectedSection);
    if (!category) return;
    setFilterCat(category.id);
    setFilterSub("");
    setF(current => current.id ? current : { ...current, category_id: category.id });
  }, [selectedSection, cats]);

  useEffect(() => {
    if (guideSubcategoriesChecked || !guideTopCategory) return;
    const existing = guideSubcategoryCandidates;
    const missing = GUIDE_RESOURCE_SUBCATEGORY_CARDS.filter(card =>
      !existing.some(category => guideSubcategoryMatchesCard(category, card))
    );

    if (missing.length === 0) {
      setGuideSubcategoriesChecked(true);
      return;
    }

    setGuideSubcategoriesChecked(true);
    supabase
      .from("resource_categories")
      .insert(missing.map((card, index) => ({
        name: card.title,
        slug: card.slug,
        icon: "📘",
        subtitle: card.subtitle,
        parent_id: guideTopCategory.id,
        sort_order: index + 1,
      })))
      .then(({ error }) => {
        if (error) {
          toast.error(`No se pudieron preparar las categorías de Guías: ${error.message}`);
          return;
        }
        loadCats();
      });
  }, [guideSubcategoriesChecked, guideTopCategory, cats]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    if (!f.category_id) { toast.error("Selecciona una categoría"); return; }
    setBusy(true);
    const cat = catById.get(f.category_id);
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : null;
    const slug = cat?.slug ?? parent?.slug ?? null;
    const payload: any = {
      title: f.title,
      category: slug, // legacy text field kept in sync
      category_id: f.category_id,
      is_pinned: f.is_pinned,
      is_published: f.is_published !== false,
      cover_image: f.cover_image || null,
      blocks: f.blocks,
      type: f.blocks.some(b => b.type === "video") ? "video" : "article",
      body: f.blocks.filter(b => b.type === "text").map((b: any) => b.value).join("\n\n") || null,
      url: (f.blocks.find(b => b.type === "video") as any)?.url ?? null,
    };
    const res = f.id
      ? await supabase.from("resources").update(payload).eq("id", f.id)
      : await supabase.from("resources").insert(payload);
    setBusy(false);
    if (res.error) toast.error(res.error.message);
    else { reset(); load(); toast.success("Guardado"); }
  };

  const del = async (id: string) => {
    if (!confirm(CONFIRM_DELETE)) return;
    await supabase.from("resources").delete().eq("id", id);
    if (f.id === id) reset();
    load();
  };

  const edit = (it: any) => {
    setF({
      id: it.id,
      title: it.title ?? "",
      category_id: it.category_id ?? "",
      cover_image: it.cover_image ?? "",
      blocks: Array.isArray(it.blocks) ? it.blocks : [],
      is_pinned: !!it.is_pinned,
      is_published: it.is_published !== false,
    });
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const togglePin = async (it: any) => {
    await supabase.from("resources").update({ is_pinned: !it.is_pinned }).eq("id", it.id);
    load();
  };

  const moveToCategory = async (it: any, newCategoryId: string) => {
    if (!newCategoryId || newCategoryId === it.category_id) return;
    const cat = catById.get(newCategoryId);
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : null;
    const slug = cat?.slug ?? parent?.slug ?? null;
    const { error } = await supabase
      .from("resources")
      .update({ category_id: newCategoryId, category: slug, sort_order: 0 })
      .eq("id", it.id);
    if (error) return toast.error(error.message);
    toast.success(`Movido a "${cat?.name}"`);
    load();
  };

  // Drop a resource before/after another resource within the same category — reorder.
  const dropItemRelativeTo = async (draggedId: string, targetId: string, pos: "before" | "after") => {
    if (draggedId === targetId) return;
    const dragged = items.find(x => x.id === draggedId);
    const target = items.find(x => x.id === targetId);
    if (!dragged || !target) return;
    // If different category, treat as move-to-category first
    if (dragged.category_id !== target.category_id) {
      await moveToCategory(dragged, target.category_id);
    }
    const siblings = items
      .filter(x => x.category_id === target.category_id && x.id !== draggedId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(x => x.id);
    const tIdx = siblings.indexOf(targetId);
    const insertIdx = pos === "before" ? tIdx : tIdx + 1;
    siblings.splice(insertIdx, 0, draggedId);
    await Promise.all(siblings.map((id, i) =>
      supabase.from("resources").update({ sort_order: i + 1 }).eq("id", id)
    ));
    load();
  };

  const moveItem = async (it: any, dir: -1 | 1) => {
    const siblings = items
      .filter(x => x.category_id === it.category_id && x.is_pinned === it.is_pinned)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = siblings.findIndex(x => x.id === it.id);
    const j = idx + dir;
    if (j < 0 || j >= siblings.length) return;
    const other = siblings[j];
    await Promise.all([
      supabase.from("resources").update({ sort_order: other.sort_order ?? 0 }).eq("id", it.id),
      supabase.from("resources").update({ sort_order: it.sort_order ?? 0 }).eq("id", other.id),
    ]);
    load();
  };

  const onCover = async (file: File) => {
    try { setBusy(true); const url = await uploadFile(file, "covers"); setF(s => ({ ...s, cover_image: url })); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const addBlock = (b: ResourceBlock) => setF(s => ({ ...s, blocks: [...s.blocks, b] }));
  const updateBlock = (i: number, patch: any) => setF(s => ({ ...s, blocks: s.blocks.map((b, idx) => idx === i ? { ...b, ...patch } : b) }));
  const removeBlock = (i: number) => setF(s => ({ ...s, blocks: s.blocks.filter((_, idx) => idx !== i) }));
  const move = (i: number, dir: -1 | 1) => setF(s => {
    const j = i + dir; if (j < 0 || j >= s.blocks.length) return s;
    const next = [...s.blocks]; [next[i], next[j]] = [next[j], next[i]]; return { ...s, blocks: next };
  });

  const uploadBlock = async (kind: "image" | "video" | "pdf", file: File) => {
    try {
      setBusy(true);
      const url = await uploadFile(file, kind);
      if (kind === "image") addBlock({ type: "image", url });
      else if (kind === "video") addBlock({ type: "video", url });
      else addBlock({ type: "pdf", url, name: file.name });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const visible = useMemo(() => {
    const q = String(searchQ ?? "").trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    let list = items.filter(i => {
      if (filterCat) {
        const subs = subsOf(filterCat).map(s => s.id);
        const allowed = new Set<string>([filterCat, ...subs]);
        if (!itemCategoryMatches(i, allowed)) return false;
      } else if (selectedSection) {
        if (!itemSectionMatches(i, selectedSection)) return false;
      }
      if (filterSub && !itemCategoryMatches(i, new Set([filterSub]))) return false;
      if (filterPinned === "pinned" && !i.is_pinned) return false;
      if (filterPinned === "unpinned" && i.is_pinned) return false;
      if (filterVisibility === "visible" && i.is_published === false) return false;
      if (filterVisibility === "hidden" && i.is_published !== false) return false;
      const dts = i[dateField] ? new Date(i[dateField]).getTime() : 0;
      if (fromTs && dts < fromTs) return false;
      if (toTs && dts > toTs) return false;
      if (q) {
        const cat = itemCategory(i);
        const parent = cat?.parent_id ? catById.get(cat.parent_id) : null;
        const hay = `${i.title ?? ""} ${cat?.name ?? ""} ${parent?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const cmp = {
      newest: (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      oldest: (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      az: (a: any, b: any) => (a.title ?? "").localeCompare(b.title ?? "", "es"),
      za: (a: any, b: any) => (b.title ?? "").localeCompare(a.title ?? "", "es"),
      manual: (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    }[sortBy];
    list = [...list].sort((a, b) => {
      if ((b.is_pinned ? 1 : 0) !== (a.is_pinned ? 1 : 0)) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
      return cmp(a, b);
    });
    return list;
  }, [items, searchQ, filterCat, selectedSection, filterSub, filterPinned, filterVisibility, dateField, dateFrom, dateTo, sortBy, catById, cats]);

  const resetFilters = () => {
    setSearchQ(""); setFilterSub(""); setFilterPinned("all"); setFilterVisibility("all");
    setDateField("created_at"); setDateFrom(""); setDateTo(""); setSortBy("manual");
  };

  const togglePublished = async (it: any) => {
    await supabase.from("resources").update({ is_published: !it.is_published }).eq("id", it.id);
    load();
  };

  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const selectAllVisible = () => setSelected(new Set(visible.map(v => v.id)));

  const bulkIds = () => Array.from(selected);

  const bulkMove = async (newCategoryId: string) => {
    const ids = bulkIds(); if (!ids.length || !newCategoryId) return;
    const cat = catById.get(newCategoryId);
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : null;
    const slug = cat?.slug ?? parent?.slug ?? null;
    const { error } = await supabase.from("resources").update({ category_id: newCategoryId, category: slug, sort_order: 0 }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Movidos ${ids.length} a "${cat?.name}"`);
    clearSelection(); load();
  };

  const bulkDelete = async () => {
    const ids = bulkIds(); if (!ids.length) return;
    if (!confirm(`¿Eliminar ${ids.length} recurso(s)? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("resources").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Eliminados ${ids.length}`);
    clearSelection(); load();
  };

  const bulkSetPinned = async (value: boolean) => {
    const ids = bulkIds(); if (!ids.length) return;
    const { error } = await supabase.from("resources").update({ is_pinned: value }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(value ? "Fijados" : "Quitado destacado");
    clearSelection(); load();
  };

  const bulkSetPublished = async (value: boolean) => {
    const ids = bulkIds(); if (!ids.length) return;
    const { error } = await supabase.from("resources").update({ is_published: value }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(value ? "Publicados" : "Ocultos");
    clearSelection(); load();
  };


  return (
    <div className="admin-resources-page pb-28">
      <section className="mb-5">
        {isGuideSubcategoryOverview ? (
          <>
            <button
              type="button"
              onClick={() => {
                setSelectedSection("");
                setFilterCat("");
                setFilterSub("");
                setSearchQ("");
                clearSelection();
              }}
              className="text-sm muted inline-flex items-center gap-1 mb-3"
            >
              <ArrowLeft className="h-4 w-4" /> Categorías
            </button>
            <h1 className="heading-lg mb-1">Guías y recursos</h1>
            <p className="text-sm muted mb-4">Elige una guía para gestionar sus publicaciones.</p>

            <Link to="/app/admin/recursos/categorias" className="card-soft p-3 flex items-center gap-2 mb-4 hover:shadow-glow transition">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center"><FolderTree className="h-4 w-4" /></div>
              <div className="flex-1 text-sm text-left">
                <div className="font-medium">Editar tarjetas de guías</div>
                <div className="text-xs muted">Cambiar imagen, título, subtítulo y orden</div>
              </div>
            </Link>

            <div className="guide-resource-grid grid grid-cols-2 gap-5">
              {guideSubcategoryEntries.map(subcard => {
                return (
                <button
                  key={subcard.slug}
                  type="button"
                  disabled={!subcard.category}
                  onClick={() => {
                    if (!subcard.category) return;
                    setSelectedSection("");
                    setFilterCat(subcard.category.id);
                    setFilterSub("");
                    setShowEditor(false);
                    clearSelection();
                    setF(current => current.id ? current : { ...current, category_id: subcard.category!.id });
                  }}
                  className="wellness-tile app-category-card guide-resource-card group overflow-hidden rounded-[28px] p-0 text-center transition-all duration-300 hover:-translate-y-1 disabled:opacity-60"
                >
                  <div className="app-photo-cover-frame w-full overflow-hidden bg-black">
                    <img
                      src={subcard.displayImage}
                      alt=""
                      className="app-photo-cover-image guide-resource-card-image transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="guide-resource-card-copy flex flex-col items-center justify-center px-3 py-3.5">
                    <div className="guide-resource-card-title font-sans font-bold leading-tight text-foreground">{subcard.displayTitle}</div>
                    <p className="guide-resource-card-subtitle mt-1.5 tracking-wide text-muted-foreground">{subcard.count} publicación{subcard.count === 1 ? "" : "es"}</p>
                  </div>
                </button>
              )})}
            </div>
          </>
        ) : isGuideSubcategoryView ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (!guideTopCategory) return;
                setSelectedSection("guias");
                setFilterCat(guideTopCategory.id);
                setFilterSub("");
                setSearchQ("");
                setShowEditor(false);
                clearSelection();
              }}
              className="text-sm muted inline-flex items-center gap-1 mb-3"
            >
              <ArrowLeft className="h-4 w-4" /> Guías y recursos
            </button>
            <h1 className="heading-lg mb-1">
              {selectedFilterCategory?.icon ?? ""} {selectedFilterCategory?.name ?? "Guía"}
            </h1>
            <p className="text-sm muted mb-4">
              Gestiona únicamente las publicaciones de esta guía.
            </p>
          </>
        ) : (
          <>
            {sectionIsOpen && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSection("");
                  setFilterCat("");
                  setFilterSub("");
                  setSearchQ("");
                  setShowEditor(false);
                  clearSelection();
                }}
                className="text-sm muted inline-flex items-center gap-1 mb-3"
              >
                <ArrowLeft className="h-4 w-4" /> Categorías
              </button>
            )}
            <h1 className="heading-lg mb-1">Vídeos y guías</h1>
            <p className="text-sm muted mb-4">Explora los recursos por categoría.</p>

            <div className="relative mb-4">
              <Search className="h-4 w-4 muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="field pl-9"
                placeholder="Buscar por nombre o categoría…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              {ADMIN_RESOURCE_ENTRY_CARDS.map(card => {
                const category = topCategoryForSection(card.key);
                const displayTitle = category?.name || card.title;
                const displaySubtitle = category?.subtitle || card.subtitle;
                const displayImage = resolveCategoryCoverImage(category, card.image);
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => {
                      setSelectedSection(card.key);
                      setFilterCat(category?.id ?? "");
                      setFilterSub("");
                      setShowEditor(false);
                      clearSelection();
                      if (category) {
                        setF(current => current.id ? current : { ...current, category_id: category.id });
                      }
                    }}
                    className="wellness-tile app-category-card group overflow-hidden rounded-[28px] p-0 text-center transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="app-photo-cover-frame w-full overflow-hidden bg-black">
                      <img src={displayImage} alt="" className="app-photo-cover-image transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="flex min-h-[92px] flex-col items-center justify-center px-3 py-3.5">
                      <div className="font-sans text-base font-bold leading-tight text-foreground">{displayTitle}</div>
                      <p className="mt-1.5 text-[10.5px] tracking-wide text-muted-foreground">{displaySubtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {sectionIsOpen && !isGuideSubcategoryOverview && (
        <>
          <Link to="/app/admin/recursos/categorias" className="card-soft p-3 flex items-center gap-2 mb-4 hover:shadow-glow transition">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center"><FolderTree className="h-4 w-4" /></div>
            <div className="flex-1 text-sm">
              <div className="font-medium">Gestionar categorías y subcategorías</div>
              <div className="text-xs muted">Crear, renombrar, reordenar y eliminar</div>
            </div>
          </Link>

      {!f.id && hasDraft && <DraftBanner onDiscard={() => { clearDraft(); setF(empty); }} />}
      {!showEditor && !f.id && (
        <button
          type="button"
          className="btn-primary w-full mb-4"
          onClick={() => {
            setF(current => ({ ...empty, category_id: selectedCategoryId || current.category_id }));
            setShowEditor(true);
          }}
        >
          <Plus className="h-4 w-4" /> Añadir contenido
        </button>
      )}

      {(showEditor || f.id || hasDraft) && <form onSubmit={save} className="card-soft p-4 space-y-3 mb-5">
        <div className="font-medium">{f.id ? "Editar publicación" : "Nueva publicación"}</div>

        <div>
          <label className="text-xs muted">Imagen principal de portada</label>
          {f.cover_image && <img src={f.cover_image} alt="" className="w-full h-40 object-cover rounded-xl mt-1 mb-2" />}
          <label className="btn-secondary inline-flex cursor-pointer">
            <Upload className="h-4 w-4" /> {f.cover_image ? "Cambiar" : "Subir"} portada
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onCover(e.target.files[0])} />
          </label>
        </div>

        <input className="field" placeholder="Título" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required />

        <select className="field" value={f.category_id} onChange={e => setF({ ...f, category_id: e.target.value })} required>
          <option value="">— Selecciona categoría —</option>
          {tops.map(c => (
            <optgroup key={c.id} label={`${c.icon ?? ""} ${c.name}`}>
              <option value={c.id}>{c.icon ?? ""} {c.name}</option>
              {subsOf(c.id).map(s => (
                <option key={s.id} value={s.id}>&nbsp;&nbsp;↳ {s.icon ?? ""} {s.name}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.is_pinned} onChange={e => setF({ ...f, is_pinned: e.target.checked })} />
          <Pin className="h-3.5 w-3.5 text-primary" /> Fijar arriba en la categoría
        </label>

        <div>
          <div className="text-xs muted mb-2">Contenido (se mostrará en el mismo orden)</div>
          <div className="space-y-2">
            {f.blocks.map((b, i) => (
              <div key={i} className="border rounded-xl p-2 bg-background">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs muted uppercase">{b.type}</div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} className="p-1" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => move(i, 1)} className="p-1" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => removeBlock(i)} className="p-1 text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {b.type === "text" && (
                  <textarea className="field min-h-24" placeholder="Texto…" value={(b as any).value} onChange={e => updateBlock(i, { value: e.target.value })} />
                )}
                {b.type === "image" && (
                  <>
                    <img src={(b as any).url} alt="" className="w-full max-h-48 object-cover rounded-lg" />
                    <input className="field mt-2" placeholder="Pie de imagen (opcional)" value={(b as any).caption ?? ""} onChange={e => updateBlock(i, { caption: e.target.value })} />
                  </>
                )}
                {b.type === "video" && (
                  <>
                    <input className="field" placeholder="URL del vídeo" value={(b as any).url} onChange={e => updateBlock(i, { url: e.target.value })} />
                    <input className="field mt-2" placeholder="Descripción (opcional)" value={(b as any).caption ?? ""} onChange={e => updateBlock(i, { caption: e.target.value })} />
                  </>
                )}
                {b.type === "pdf" && (
                  <div className="text-sm truncate"><a className="text-primary underline" href={(b as any).url} target="_blank" rel="noreferrer">{(b as any).name ?? "PDF"}</a></div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button type="button" className="btn-secondary" onClick={() => addBlock({ type: "text", value: "" })}><Type className="h-4 w-4" /> Texto</button>
            <label className="btn-secondary cursor-pointer">
              <ImageIcon className="h-4 w-4" /> Imagen
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadBlock("image", e.target.files[0])} />
            </label>
            <label className="btn-secondary cursor-pointer">
              <Video className="h-4 w-4" /> Vídeo (archivo)
              <input type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && uploadBlock("video", e.target.files[0])} />
            </label>
            <button type="button" className="btn-secondary" onClick={() => addBlock({ type: "video", url: "" })}><Video className="h-4 w-4" /> Vídeo (URL)</button>
            <label className="btn-secondary cursor-pointer col-span-2">
              <FileText className="h-4 w-4" /> PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && uploadBlock("pdf", e.target.files[0])} />
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy}><Plus className="h-4 w-4" /> {f.id ? "Guardar cambios" : "Publicar"}</button>
          {f.id && <button type="button" className="btn-secondary" onClick={reset}>Cancelar</button>}
          {!f.id && <button type="button" className="btn-secondary" onClick={reset}>Cancelar</button>}
        </div>
      </form>}

      {/* Buscador, filtros y orden */}
      <div className="card-soft p-3 mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 muted" />
            <input
              className="field pl-8"
              placeholder="Buscar por título, categoría o subcategoría…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
          </div>
          <button type="button" onClick={() => setShowFilters(s => !s)} className={`p-2 rounded-md border ${showFilters ? "border-primary text-primary" : "border-border"}`} aria-label="Filtros">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs muted">Ordenar:</label>
          <select className="text-xs bg-muted/60 rounded-md px-2 py-1" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
            <option value="manual">Orden manual</option>
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="az">Nombre A-Z</option>
            <option value="za">Nombre Z-A</option>
          </select>
          <span className="text-xs muted ml-auto">{visible.length} resultado{visible.length === 1 ? "" : "s"}</span>
        </div>
        {showFilters && (
          <div className="border-t pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] muted">Categoría</label>
                <select className="field" value={filterCat} onChange={e => { setSelectedSection(""); setFilterCat(e.target.value); setFilterSub(""); }}>
                  <option value="">Todas</option>
                  {tops.map(c => <option key={c.id} value={c.id}>{c.icon ?? ""} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] muted">Subcategoría</label>
                <select className="field" value={filterSub} onChange={e => { setSelectedSection(""); setFilterSub(e.target.value); }} disabled={!filterCat || subsOf(filterCat).length === 0}>
                  <option value="">Todas</option>
                  {filterCat && subsOf(filterCat).map(s => <option key={s.id} value={s.id}>{s.icon ?? ""} {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] muted">Destacados</label>
                <select className="field" value={filterPinned} onChange={e => setFilterPinned(e.target.value as any)}>
                  <option value="all">Todos</option>
                  <option value="pinned">Solo destacados</option>
                  <option value="unpinned">Sin destacar</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] muted">Visibilidad</label>
                <select className="field" value={filterVisibility} onChange={e => setFilterVisibility(e.target.value as any)}>
                  <option value="all">Todos</option>
                  <option value="visible">Visibles</option>
                  <option value="hidden">Ocultos</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] muted">Filtrar por fecha</label>
                <select className="field" value={dateField} onChange={e => setDateField(e.target.value as any)}>
                  <option value="created_at">Fecha de creación</option>
                  <option value="updated_at">Fecha de actualización</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[11px] muted">Desde</label>
                  <input type="date" className="field" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] muted">Hasta</label>
                  <input type="date" className="field" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
            </div>
            <button type="button" onClick={resetFilters} className="text-xs muted underline">Restablecer filtros</button>
          </div>
        )}
      </div>


      {/* Carpetas (filtro + dianas de drag&drop). Arrastra una tarjeta a una carpeta para moverla. */}
      <div className="mb-3">
        <div className="text-xs muted mb-1.5">Carpetas <span className="text-[10px]">— pulsa para filtrar, arrastra aquí para mover</span></div>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: "", name: "Todas", icon: "📂" } as any, ...tops].map((c: any) => {
            const isFilter = filterCat === c.id;
            const isDrop = dropOver?.kind === "cat" && dropOver.id === c.id;
            return (
              <button
                key={c.id || "__all__"}
                type="button"
                onClick={() => { setSelectedSection(""); setFilterCat(c.id); setFilterSub(""); }}
                onDragOver={(e) => { if (!dragItemId || !c.id) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropOver({ kind: "cat", id: c.id }); }}
                onDragLeave={() => { if (isDrop) setDropOver(null); }}
                onDrop={(e) => {
                  if (!dragItemId || !c.id) return;
                  e.preventDefault();
                  const it = items.find(x => x.id === dragItemId);
                  if (it) moveToCategory(it, c.id);
                  setDragItemId(null); setDropOver(null);
                }}
                className={`admin-resource-category-chip text-xs px-3 py-1.5 rounded-full transition border ${
                  isDrop ? "border-primary bg-primary/15 text-primary scale-105"
                  : isFilter ? "border-primary bg-primary text-white"
                  : "border-border bg-muted"
                }`}
              >
                {c.icon ?? "📁"} {c.name}
              </button>
            );
          })}
        </div>
        {/* Subcategorías de la categoría filtrada */}
        {filterCat && subsOf(filterCat).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 ml-3">
            {subsOf(filterCat).map(s => {
              const isFilter = filterCat === s.id;
              const isDrop = dropOver?.kind === "cat" && dropOver.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelectedSection(""); setFilterCat(s.id); setFilterSub(""); }}
                  onDragOver={(e) => { if (!dragItemId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropOver({ kind: "cat", id: s.id }); }}
                  onDragLeave={() => { if (isDrop) setDropOver(null); }}
                  onDrop={(e) => {
                    if (!dragItemId) return;
                    e.preventDefault();
                    const it = items.find(x => x.id === dragItemId);
                    if (it) moveToCategory(it, s.id);
                    setDragItemId(null); setDropOver(null);
                  }}
                  className={`admin-resource-category-chip text-[11px] px-2.5 py-1 rounded-full transition border ${
                    isDrop ? "border-primary bg-primary/15 text-primary scale-105"
                    : isFilter ? "border-primary bg-primary text-white"
                    : "border-border bg-background"
                  }`}
                >
                  ↳ {s.icon ?? ""} {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selección masiva toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button type="button" onClick={selected.size === visible.length && visible.length > 0 ? clearSelection : selectAllVisible} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted">
          {selected.size === visible.length && visible.length > 0 ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          {selected.size === visible.length && visible.length > 0 ? "Deseleccionar todo" : "Seleccionar todo"}
        </button>
        {selected.size > 0 && <span className="text-xs muted">{selected.size} seleccionado(s)</span>}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-20 card-soft p-3 mb-3 border-primary/40 border-2 bg-background/95 backdrop-blur space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{selected.size} recurso(s) seleccionado(s)</div>
            <button onClick={clearSelection} className="p-1 muted" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs muted shrink-0">Mover a:</span>
            <select
              className="text-xs bg-muted/60 rounded-md px-2 py-1 flex-1 min-w-0"
              defaultValue=""
              onChange={e => { if (e.target.value) { bulkMove(e.target.value); e.target.value = ""; } }}
            >
              <option value="">— Selecciona categoría —</option>
              {tops.map(c => (
                <optgroup key={c.id} label={`${c.icon ?? ""} ${c.name}`}>
                  <option value={c.id}>{c.icon ?? ""} {c.name}</option>
                  {subsOf(c.id).map(s => (
                    <option key={s.id} value={s.id}>&nbsp;&nbsp;↳ {s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => bulkSetPinned(true)} className="text-xs px-2 py-1 rounded-md bg-muted inline-flex items-center gap-1"><Pin className="h-3.5 w-3.5" /> Destacar</button>
            <button onClick={() => bulkSetPinned(false)} className="text-xs px-2 py-1 rounded-md bg-muted inline-flex items-center gap-1"><Pin className="h-3.5 w-3.5" /> Quitar destacado</button>
            <button onClick={() => bulkSetPublished(true)} className="text-xs px-2 py-1 rounded-md bg-muted inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Publicar</button>
            <button onClick={() => bulkSetPublished(false)} className="text-xs px-2 py-1 rounded-md bg-muted inline-flex items-center gap-1"><EyeOff className="h-3.5 w-3.5" /> Ocultar</button>
            <button onClick={bulkDelete} className="text-xs px-2 py-1 rounded-md bg-destructive text-destructive-foreground inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Eliminar</button>
          </div>
        </div>
      )}

      <div className="space-y-2">{visible.map(i => {
        const isDragging = dragItemId === i.id;
        const showBefore = dropOver?.kind === "item" && dropOver.id === i.id && dropOver.pos === "before";
        const showAfter = dropOver?.kind === "item" && dropOver.id === i.id && dropOver.pos === "after";
        return (
          <div key={i.id}>
            {showBefore && <div className="h-1 my-1 rounded bg-primary" />}
            <div
              draggable
              onDragStart={(e) => { setDragItemId(i.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", i.id); }}
              onDragEnd={() => { setDragItemId(null); setDropOver(null); }}
              onDragOver={(e) => {
                if (!dragItemId || dragItemId === i.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const pos: "before" | "after" = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
                setDropOver({ kind: "item", id: i.id, pos });
              }}
              onDragLeave={() => { if (dropOver?.kind === "item" && dropOver.id === i.id) setDropOver(null); }}
              onDrop={(e) => {
                if (!dragItemId || dragItemId === i.id) return;
                e.preventDefault();
                const pos = (dropOver?.kind === "item" && dropOver.id === i.id) ? dropOver.pos : "after";
                dropItemRelativeTo(dragItemId, i.id, pos);
                setDragItemId(null); setDropOver(null);
              }}
              className={`card-soft p-3 space-y-2 transition ${isDragging ? "opacity-40" : ""} ${selected.has(i.id) ? "ring-2 ring-primary" : ""} ${i.is_published === false ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => toggleSelect(i.id)}
                  onClick={e => e.stopPropagation()}
                  className="h-4 w-4 shrink-0 accent-primary"
                  aria-label="Seleccionar"
                />
                <GripVertical className="h-4 w-4 muted cursor-grab shrink-0" />
                {i.cover_image && <img src={i.cover_image} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate flex items-center gap-1">
                    {i.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
                    {i.is_published === false && <EyeOff className="h-3 w-3 muted" />}
                    {i.title}
                  </div>
                  <div className="text-xs muted truncate">{itemCatLabel(i)}</div>
                </div>
                <button onClick={() => moveItem(i, -1)} className="p-1" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => moveItem(i, 1)} className="p-1" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
                <button onClick={() => togglePin(i)} className={`p-1 ${i.is_pinned ? "text-primary" : "muted"}`} aria-label="Fijar"><Pin className="h-4 w-4" /></button>
                <button onClick={() => togglePublished(i)} className={`p-1 ${i.is_published === false ? "muted" : "text-primary"}`} aria-label="Visibilidad">{i.is_published === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                <button onClick={() => edit(i)} className="text-primary shrink-0 p-1" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del(i.id)} className="text-destructive shrink-0 p-1" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] muted shrink-0">Mover a:</span>
                <select
                  className="text-xs bg-muted/60 rounded-md px-2 py-1 flex-1 min-w-0"
                  value={i.category_id ?? ""}
                  onChange={e => moveToCategory(i, e.target.value)}
                >
                  <option value="">— Sin categoría —</option>
                  {tops.map(c => (
                    <optgroup key={c.id} label={`${c.icon ?? ""} ${c.name}`}>
                      <option value={c.id}>{c.icon ?? ""} {c.name}</option>
                      {subsOf(c.id).map(s => (
                        <option key={s.id} value={s.id}>&nbsp;&nbsp;↳ {s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            {showAfter && <div className="h-1 my-1 rounded bg-primary" />}
          </div>
        );
      })}</div>
        </>
      )}
    </div>
  );
}
