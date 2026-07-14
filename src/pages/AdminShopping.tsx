import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Search, X, CheckSquare, Square, FolderInput, Package, ArrowLeft } from "lucide-react";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";
import { numberInputValue, numberOrFallback, type AdminNumberValue } from "@/lib/adminNumberInput";
import imgCompra from "@/assets/home-compra.png";

type Category = { id: string; name: string; sort_order: number };
type Template = { id: string; name: string; category: string | null; sort_order: number };
type ClientItem = { id: string; user_id: string; name: string; category: string | null; quantity: string | null; checked: boolean };
type Profile = { id: string; display_name: string | null };

const UNCAT = "__uncat__";
type Tab = "templates" | "clients";

const normalizeCategoryName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const isUncategorizedCategoryName = (value: unknown) =>
  normalizeCategoryName(value) === "sin categoria";

export default function AdminShopping() {
  const [tab, setTab] = useState<Tab>("templates");
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);

  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Template[]>([]);
  const [clientItems, setClientItems] = useState<ClientItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const [catForm, setCatForm] = useState<{ id?: string; name: string; sort_order: AdminNumberValue; _origName?: string }>({ name: "", sort_order: 0 });
  const [itemForm, setItemForm] = useState<{ id?: string; name: string; category: string; sort_order: number }>({ name: "", category: "", sort_order: 0 });

  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<string>("");

  // Client items panel state
  const [cQuery, setCQuery] = useState("");
  const [cFilterCat, setCFilterCat] = useState<string>("all");
  const [cFilterUser, setCFilterUser] = useState<string>("all");
  const [cSelected, setCSelected] = useState<Set<string>>(new Set());
  const [cBulkTarget, setCBulkTarget] = useState<string>("");
  const visibleCats = useMemo(() => cats.filter((c) => !isUncategorizedCategoryName(c.name)), [cats]);

  const load = async () => {
    const [{ data: c, error: cError }, { data: t, error: tError }, { data: items, error: itemsError }, { data: profs, error: profsError }] = await Promise.all([
      (supabase as any).from("shopping_categories").select("*").order("sort_order").order("name"),
      (supabase as any).from("shopping_templates").select("*").order("name", { ascending: true }),
      (supabase as any).from("shopping_list_items").select("id,user_id,name,category,quantity,checked").order("name", { ascending: true }),
      (supabase as any).from("profiles").select("id,display_name"),
    ]);
    if (cError) {
      console.error("[admin shopping_categories]", cError);
      toast.error(`No se pudieron cargar las categorías: ${cError.message}`);
    }
    if (tError) {
      console.error("[admin shopping_templates]", tError);
      toast.error(`No se pudieron cargar los ingredientes: ${tError.message}`);
    }
    if (itemsError) {
      console.error("[admin shopping_list_items]", itemsError);
      toast.error(`No se pudieron cargar productos de clientas: ${itemsError.message}`);
    }
    if (profsError) {
      console.error("[admin shopping profiles]", profsError);
    }
    setCats(c ?? []);
    setItems(t ?? []);
    setClientItems(items ?? []);
    const p: Record<string, string> = {};
    (profs ?? []).forEach((x: Profile) => { p[x.id] = x.display_name || "Sin nombre"; });
    setProfiles(p);
  };
  useEffect(() => { load(); }, []);

  const categoryByKey = useMemo(() => {
    const map = new Map<string, string>();
    cats.forEach((category) => {
      if (isUncategorizedCategoryName(category.name)) return;
      map.set(normalizeCategoryName(category.name), category.name);
    });
    return map;
  }, [cats]);

  const resolveCategory = (category?: string | null) => {
    const key = normalizeCategoryName(category);
    if (key === "sin categoria") return null;
    return key ? categoryByKey.get(key) ?? null : null;
  };

  // ---- Counts (templates) ----
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: items.length, [UNCAT]: 0 };
    visibleCats.forEach((c) => (m[c.name] = 0));
    items.forEach((it) => {
      const k = resolveCategory(it.category) ?? UNCAT;
      m[k] = (m[k] ?? 0) + 1;
    });
    return m;
  }, [items, visibleCats, categoryByKey]);

  // ---- Counts (client items) ----
  const cCounts = useMemo(() => {
    const m: Record<string, number> = { all: clientItems.length, [UNCAT]: 0 };
    visibleCats.forEach((c) => (m[c.name] = 0));
    clientItems.forEach((it) => {
      const k = resolveCategory(it.category) ?? UNCAT;
      m[k] = (m[k] ?? 0) + 1;
    });
    return m;
  }, [clientItems, visibleCats, categoryByKey]);

  const filtered = useMemo(() => {
    const q = normalizeCategoryName(query);
    return items
      .filter((it) => {
        if (filterCat === "all") return true;
        const category = resolveCategory(it.category);
        if (filterCat === UNCAT) return !category;
        return category === filterCat;
      })
      .filter((it) => (q ? normalizeCategoryName(it.name).includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [items, query, filterCat, categoryByKey]);

  const cFiltered = useMemo(() => {
    const q = normalizeCategoryName(cQuery);
    return clientItems
      .filter((it) => {
        if (cFilterCat === "all") return true;
        const category = resolveCategory(it.category);
        if (cFilterCat === UNCAT) return !category;
        return category === cFilterCat;
      })
      .filter((it) => cFilterUser === "all" || it.user_id === cFilterUser)
      .filter((it) => (q ? normalizeCategoryName(it.name).includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [clientItems, cQuery, cFilterCat, cFilterUser, categoryByKey]);

  const clientUsers = useMemo(() => {
    const ids = Array.from(new Set(clientItems.map((i) => i.user_id)));
    return ids.map((id) => ({ id, name: profiles[id] || id.slice(0, 6) }));
  }, [clientItems, profiles]);

  // ---- Categories CRUD ----
  const resetCat = () => setCatForm({ name: "", sort_order: 0 });
  const saveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    const newName = catForm.name.trim();
    if (!newName) return;
    if (catForm.id) {
      const oldName = catForm._origName;
      const { error } = await (supabase as any).from("shopping_categories").update({ name: newName, sort_order: numberOrFallback(catForm.sort_order) }).eq("id", catForm.id);
      if (error) return toast.error(error.message);
      // Propagate rename to items and templates
      if (oldName && oldName !== newName) {
        await (supabase as any).from("shopping_templates").update({ category: newName }).eq("category", oldName);
        await (supabase as any).from("shopping_list_items").update({ category: newName }).eq("category", oldName);
      }
    } else {
      const { error } = await (supabase as any).from("shopping_categories").insert({ name: newName, sort_order: numberOrFallback(catForm.sort_order) });
      if (error) return toast.error(error.message);
    }
    toast.success("Categoría guardada");
    resetCat();
    load();
  };

  const delCat = async (c: Category) => {
    const [{ count: tplCount, error: tplError }, { count: clientCount, error: clientError }] = await Promise.all([
      (supabase as any).from("shopping_templates").select("id", { count: "exact", head: true }).eq("category", c.name),
      (supabase as any).from("shopping_list_items").select("id", { count: "exact", head: true }).eq("category", c.name),
    ]);
    if (tplError || clientError) {
      const message = tplError?.message || clientError?.message || "No se pudo comprobar la categoría";
      toast.error(message);
      return;
    }
    const tplUsage = tplCount ?? items.filter((i) => i.category === c.name).length;
    const itemUsage = clientCount ?? clientItems.filter((i) => i.category === c.name).length;
    if (tplUsage + itemUsage > 0) {
      toast.error("Esta categoría contiene ingredientes asociados. Primero elimínalos o reasígnalos a otra categoría.");
      return;
    }
    if (!confirm("¿Seguro que deseas eliminar esta categoría?")) return;
    const { error } = await (supabase as any).from("shopping_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categoría eliminada");
    if (filterCat === c.name) setFilterCat("all");
    if (cFilterCat === c.name) setCFilterCat("all");
    if (catForm.id === c.id) resetCat();
    load();
  };

  const moveCat = async (c: Category, dir: -1 | 1) => {
    const idx = cats.findIndex((x) => x.id === c.id);
    const j = idx + dir;
    if (j < 0 || j >= cats.length) return;
    const a = cats[idx], b = cats[j];
    await (supabase as any).from("shopping_categories").update({ sort_order: b.sort_order }).eq("id", a.id);
    await (supabase as any).from("shopping_categories").update({ sort_order: a.sort_order }).eq("id", b.id);
    load();
  };

  // ---- Templates CRUD ----
  const resetItem = () => setItemForm({ name: "", category: "", sort_order: 0 });
  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) return;
    const { id, ...rest } = itemForm;
    const payload = { ...rest, category: rest.category || null };
    const res = id
      ? await (supabase as any).from("shopping_templates").update(payload).eq("id", id).select().single()
      : await (supabase as any).from("shopping_templates").insert(payload).select().single();
    if (res.error) return toast.error(res.error.message);
    toast.success("Ingrediente guardado");
    resetItem();
    load();
  };
  const delItem = async (id: string) => {
    if (!confirm("¿Eliminar este ingrediente?")) return;
    await (supabase as any).from("shopping_templates").delete().eq("id", id);
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    load();
  };

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFilteredSelected = filtered.length > 0 && filtered.every((it) => selected.has(it.id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((s) => { const n = new Set(s); filtered.forEach((it) => n.delete(it.id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); filtered.forEach((it) => n.add(it.id)); return n; });
    }
  };

  const bulkMove = async () => {
    if (selected.size === 0) return toast.error("Selecciona al menos un ingrediente");
    const target = bulkTarget === UNCAT ? null : (bulkTarget || null);
    const ids = Array.from(selected);
    const { error } = await (supabase as any).from("shopping_templates").update({ category: target }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} ingrediente(s) movidos`);
    setSelected(new Set());
    load();
  };

  // ---- Client items bulk ----
  const cToggle = (id: string) =>
    setCSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const cAllSelected = cFiltered.length > 0 && cFiltered.every((it) => cSelected.has(it.id));
  const cToggleAll = () => {
    if (cAllSelected) {
      setCSelected((s) => { const n = new Set(s); cFiltered.forEach((it) => n.delete(it.id)); return n; });
    } else {
      setCSelected((s) => { const n = new Set(s); cFiltered.forEach((it) => n.add(it.id)); return n; });
    }
  };
  const cBulkMove = async () => {
    if (cSelected.size === 0) return toast.error("Selecciona al menos un producto");
    if (!cBulkTarget) return toast.error("Elige una categoría destino");
    const target = cBulkTarget === UNCAT ? null : cBulkTarget;
    const ids = Array.from(cSelected);
    const { error } = await (supabase as any).from("shopping_list_items").update({ category: target }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} producto(s) movidos`);
    setCSelected(new Set());
    load();
  };
  const cSetCategory = async (id: string, category: string | null) => {
    const { error } = await (supabase as any).from("shopping_list_items").update({ category }).eq("id", id);
    if (error) return toast.error(error.message);
    setClientItems((arr) => arr.map((i) => i.id === id ? { ...i, category } : i));
  };
  const cDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}" de la lista de la clienta?`)) return;
    const { error } = await (supabase as any).from("shopping_list_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Producto eliminado");
    setCSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    setClientItems((arr) => arr.filter((i) => i.id !== id));
  };
  const cBulkDelete = async () => {
    if (cSelected.size === 0) return toast.error("Selecciona al menos un producto");
    const ids = Array.from(cSelected);
    if (!confirm(`¿Eliminar ${ids.length} producto(s) seleccionado(s)? Esta acción no se puede deshacer.`)) return;
    const { error } = await (supabase as any).from("shopping_list_items").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} producto(s) eliminado(s)`);
    setCSelected(new Set());
    setClientItems((arr) => arr.filter((i) => !ids.includes(i.id)));
  };

  const templateFilterChips: { key: string; label: string }[] = useMemo(() => {
    const ordered = visibleCats.map((c) => c.name);
    return [
      { key: "all", label: "Todas" },
      ...ordered.map((name) => ({ key: name, label: name })),
      { key: UNCAT, label: "Sin categoría" },
    ];
  }, [visibleCats]);

  const clientFilterChips: { key: string; label: string }[] = useMemo(() => {
    const ordered = visibleCats.map((c) => c.name);
    return [
      { key: "all", label: "Todas" },
      ...ordered.map((name) => ({ key: name, label: name })),
      { key: UNCAT, label: "Sin categoría" },
    ];
  }, [visibleCats]);

  const activeCategory = tab === "templates" ? filterCat : cFilterCat;
  const activeCategoryRecord = activeCategory !== "all" && activeCategory !== UNCAT ? cats.find((c) => c.name === activeCategory) ?? null : null;
  const activeVisibleCount = tab === "templates" ? filtered.length : cFiltered.length;
  const activeChips = tab === "templates"
    ? templateFilterChips.map((ch) => ({ ...ch, total: counts[ch.key] ?? 0, active: filterCat === ch.key, onClick: () => setFilterCat(ch.key) }))
    : clientFilterChips.map((ch) => ({ ...ch, total: cCounts[ch.key] ?? 0, active: cFilterCat === ch.key, onClick: () => setCFilterCat(ch.key) }));
  const scrollCategoryBar = (direction: -1 | 1) => {
    categoryScrollRef.current?.scrollBy({ left: direction * 190, behavior: "smooth" });
  };
  const handleCategoryWheel = (event: any) => {
    const element = categoryScrollRef.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    element.scrollLeft += event.deltaY;
  };

  const filteredIngredientGroups = useMemo(() => {
    const grouped = new Map<string, Template[]>();
    filtered.forEach((it) => {
      const key = resolveCategory(it.category) ?? UNCAT;
      grouped.set(key, [...(grouped.get(key) ?? []), it]);
    });

    const orderedCategoryNames = visibleCats.map((c) => c.name);

    const order = filterCat === "all"
      ? [...orderedCategoryNames, UNCAT]
      : [filterCat];

    return order
      .map((key) => ({ key, label: key === UNCAT ? "Sin categoría" : key, items: grouped.get(key) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [filtered, visibleCats, filterCat, categoryByKey]);

  const clientItemsList = (
    <section className="mb-5">
      <div className="space-y-2">
        {cFiltered.map((it) => {
          const displayCat = resolveCategory(it.category) ?? "";
          return (
            <div key={it.id} className="card-soft shopping-inner-card p-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={cSelected.has(it.id)}
                onChange={() => cToggle(it.id)}
                className="h-4 w-4 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{it.name}</div>
                <div className="text-xs muted truncate">
                  {profiles[it.user_id] || "Clienta"}
                  {it.quantity ? ` · ${it.quantity}` : ""}
                  {!displayCat && it.category ? ` · Sin categoría` : ""}
                </div>
              </div>
              <select
                className="field w-44 text-sm"
                value={displayCat}
                onChange={(e) => cSetCategory(it.id, e.target.value || null)}
              >
                <option value="">Sin categoría</option>
                {visibleCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button onClick={() => cDelete(it.id, it.name)} className="p-1 text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
        {cFiltered.length === 0 && (
          <div className="card-soft shopping-card p-6 text-center muted text-sm">
            {cQuery || cFilterCat !== "all" || cFilterUser !== "all" ? "Sin resultados con estos filtros." : "Aún no hay productos."}
          </div>
        )}
      </div>
    </section>
  );

  const templateItemsList = (
    <section className="mb-5">
      <div className="space-y-4">
        {filteredIngredientGroups.map((group) => (
          <section key={group.key}>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="font-serif text-lg">{group.label}</h3>
              <span className="text-[11px] muted">{group.items.length}</span>
            </div>
            <div className="space-y-2">
              {group.items.map((it) => (
                <div
                  key={it.id}
                  className="card-soft shopping-inner-card p-3 flex items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(it.id)}
                    onChange={() => toggle(it.id)}
                    className="h-4 w-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{it.name}</div>
                    <div className="text-xs muted truncate">{resolveCategory(it.category) ?? "Sin categoría"}</div>
                  </div>
                  <button onClick={() => { setItemForm({ id: it.id, name: it.name, category: resolveCategory(it.category) ?? "", sort_order: it.sort_order }); document.getElementById("tpl-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="p-1 text-primary" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => delItem(it.id)} className="p-1 text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <div className="card-soft shopping-card p-6 text-center muted text-sm">
            {query || filterCat !== "all" ? "Sin resultados con estos filtros." : "Aún no hay ingredientes."}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="admin-shopping-page pb-28 max-w-5xl mx-auto">
      <BackButton fallbackTo="/app/admin" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      <section className="shopping-hero-card card-soft mb-5">
        <img src={imgCompra} alt="" className="shopping-hero-image" />
        <div className="shopping-hero-copy">
          <h1>Lista de compra</h1>
          <p>Organiza tus ingredientes de forma sencilla.</p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-5">
        <button
          onClick={() => setTab("templates")}
          className={`text-sm px-3 py-2 rounded-full border transition flex items-center gap-2 ${tab === "templates" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
        >
          <Package className="h-4 w-4" /> Ingredientes ({items.length})
        </button>
      </div>

      {/* Categories — horizontal quick filter */}
      <section className="shopping-category-hero card-soft mb-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">Categorías</h2>
              <p className="text-sm muted">Desliza la barra y pulsa una categoría para filtrar los ingredientes.</p>
            </div>
            <div className="rounded-full border border-primary/35 bg-white px-3 py-1.5 text-xs font-semibold text-foreground">
              {activeVisibleCount} visible(s)
            </div>
          </div>

          <div className="shopping-category-scroll-wrap">
            <button type="button" className="shopping-category-scroll-button" onClick={() => scrollCategoryBar(-1)} aria-label="Ver categorías anteriores">
              ‹
            </button>
            <div ref={categoryScrollRef} className="shopping-category-scroll" role="tablist" aria-label="Categorías de lista de compra" onWheel={handleCategoryWheel}>
              {activeChips.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={ch.onClick}
                  className={`shopping-filter-chip ${ch.active ? "is-active" : ""}`}
                  role="tab"
                  aria-selected={ch.active}
                >
                  {ch.label} <span className="opacity-70">· {ch.total}</span>
                </button>
              ))}
            </div>
            <button type="button" className="shopping-category-scroll-button" onClick={() => scrollCategoryBar(1)} aria-label="Ver más categorías">
              ›
            </button>
          </div>

          <div className="shopping-category-toolbar">
            {catForm.id ? (
              <form onSubmit={saveCat} className="shopping-category-edit-form">
                <div className="text-xs font-semibold text-foreground">Editando categoría</div>
                <input autoFocus className="field flex-1 min-w-[180px]" placeholder="Nombre" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
                <input className="field w-24" type="number" placeholder="Orden" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: numberInputValue(e.target.value) })} />
                <button type="submit" className="btn-primary">Guardar</button>
                <button type="button" className="btn-secondary" onClick={resetCat}>Cancelar</button>
              </form>
            ) : (
              <>
                <form onSubmit={saveCat} className="shopping-category-create-form">
                  <input className="field flex-1 min-w-[180px]" placeholder="Nueva categoría" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
                  <input className="field w-24" type="number" placeholder="Orden" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: numberInputValue(e.target.value) })} />
                  <button className="btn-primary"><Plus className="h-4 w-4" /> Añadir</button>
                  <button
                    type="button"
                    className="btn-secondary shopping-delete-category-button"
                    onClick={() => activeCategoryRecord ? delCat(activeCategoryRecord) : toast.error("Selecciona una categoría para borrar.")}
                    disabled={!activeCategoryRecord}
                    title={activeCategoryRecord ? "Borrar categoría seleccionada" : "Selecciona una categoría para borrar"}
                  >
                    <Trash2 className="h-4 w-4" /> Borrar categoría
                  </button>
                </form>

                {activeCategoryRecord && (() => {
                  return (
                    <div className="shopping-category-actions">
                      <span className="text-xs muted">Ordenar “{activeCategoryRecord.name}”</span>
                      <button type="button" onClick={() => moveCat(activeCategoryRecord, -1)} className="btn-secondary compact" aria-label="Subir categoría"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => moveCat(activeCategoryRecord, 1)} className="btn-secondary compact" aria-label="Bajar categoría"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setCatForm({ id: activeCategoryRecord.id, name: activeCategoryRecord.name, sort_order: activeCategoryRecord.sort_order, _origName: activeCategoryRecord.name })} className="btn-secondary compact" aria-label="Editar categoría"><Pencil className="h-4 w-4" /></button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </section>

      {/* === CLIENT ITEMS TAB === */}
      {tab === "clients" && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-serif text-xl">Productos de clientas</h2>
            <span className="text-xs muted">{clientItems.length} en total</span>
          </div>

          {/* Search */}
          <div className="card-soft p-3 mb-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 muted" />
              <input className="field pl-9 pr-9" placeholder="Buscar producto…" value={cQuery} onChange={(e) => setCQuery(e.target.value)} />
              {cQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 muted" onClick={() => setCQuery("")} aria-label="Limpiar">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {clientUsers.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button onClick={() => setCFilterUser("all")} className={`text-xs px-2.5 py-1 rounded-full border ${cFilterUser === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                  Todas las clientas
                </button>
                {clientUsers.map((u) => (
                  <button key={u.id} onClick={() => setCFilterUser(u.id)} className={`text-xs px-2.5 py-1 rounded-full border ${cFilterUser === u.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk */}
          <div className="card-soft p-3 mb-3 flex flex-wrap items-center gap-2">
            <button onClick={cToggleAll} className="text-xs flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted">
              {cAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {cAllSelected ? "Quitar selección" : "Seleccionar todos"}
            </button>
            <span className="text-xs muted">{cSelected.size} seleccionado(s)</span>
            <div className="flex-1" />
            <FolderInput className="h-4 w-4 muted" />
            <select className="field w-48" value={cBulkTarget} onChange={(e) => setCBulkTarget(e.target.value)}>
              <option value="">Mover a…</option>
              {visibleCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value={UNCAT}>Sin categoría</option>
            </select>
            <button onClick={cBulkMove} disabled={cSelected.size === 0 || !cBulkTarget} className="btn-primary disabled:opacity-50">
              Mover
            </button>
            <button onClick={cBulkDelete} disabled={cSelected.size === 0} className="text-xs px-3 py-2 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40 flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </div>

          {clientItemsList}
        </section>
      )}

      {/* === TEMPLATES TAB === */}
      {tab === "templates" && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-serif text-xl">Ingredientes</h2>
            <span className="text-xs muted">{items.length} en total</span>
          </div>

          <form id="tpl-form" onSubmit={saveItem} className="card-soft p-4 space-y-3 mb-4">
            <div className="font-medium text-sm">{itemForm.id ? "Editar ingrediente" : "Nuevo ingrediente"}</div>
            <div className="flex gap-2 flex-wrap">
              <input className="field flex-1 min-w-[180px]" placeholder="Nombre" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
              <select className="field w-48" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>
                <option value="">Sin categoría</option>
                {visibleCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button className="btn-primary"><Plus className="h-4 w-4" /> {itemForm.id ? "Guardar" : "Añadir"}</button>
              {itemForm.id && <button type="button" className="btn-secondary" onClick={resetItem}>Cancelar</button>}
            </div>
          </form>

          <div className="card-soft p-3 mb-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 muted" />
              <input className="field pl-9 pr-9" placeholder="Buscar ingrediente…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 muted" onClick={() => setQuery("")} aria-label="Limpiar">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

          </div>

          <div className="card-soft p-3 mb-3 flex flex-wrap items-center gap-2">
            <button onClick={toggleAll} className="text-xs flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted">
              {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allFilteredSelected ? "Quitar selección" : "Seleccionar todos"}
            </button>
            <span className="text-xs muted">{selected.size} seleccionado(s)</span>
            <div className="flex-1" />
            <FolderInput className="h-4 w-4 muted" />
            <select className="field w-48" value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)}>
              <option value="">Elegir categoría…</option>
              {visibleCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value={UNCAT}>Sin categoría</option>
            </select>
            <button onClick={bulkMove} disabled={selected.size === 0 || !bulkTarget} className="btn-primary disabled:opacity-50">
              Mover
            </button>
          </div>

          {templateItemsList}
        </section>
      )}
    </div>
  );
}
