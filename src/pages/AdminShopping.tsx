import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Search, X, CheckSquare, Square, FolderInput, Users, Package, ChevronDown, ChevronRight, ArrowDownAZ } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";

type Category = { id: string; name: string; sort_order: number };
type Template = { id: string; name: string; category: string | null; sort_order: number };
type ClientItem = { id: string; user_id: string; name: string; category: string | null; quantity: string | null; checked: boolean };
type Profile = { id: string; display_name: string | null };

const UNCAT = "__uncat__";
type Tab = "templates" | "clients";

export default function AdminShopping() {
  const [tab, setTab] = useState<Tab>("templates");

  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Template[]>([]);
  const [clientItems, setClientItems] = useState<ClientItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const [catForm, setCatForm] = useState<{ id?: string; name: string; sort_order: number; _origName?: string }>({ name: "", sort_order: 0 });
  const [itemForm, setItemForm] = useState<{ id?: string; name: string; category: string; sort_order: number }>({ name: "", category: "", sort_order: 0 });

  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Client items panel state
  const [cQuery, setCQuery] = useState("");
  const [cFilterCat, setCFilterCat] = useState<string>("all");
  const [cFilterUser, setCFilterUser] = useState<string>("all");
  const [cSelected, setCSelected] = useState<Set<string>>(new Set());
  const [cBulkTarget, setCBulkTarget] = useState<string>("");

  // Expandable categories (templates inside)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [catQuery, setCatQuery] = useState<Record<string, string>>({});
  const [catSortAlpha, setCatSortAlpha] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) =>
    setExpandedCats((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const moveTemplateInCat = async (catName: string, id: string, dir: -1 | 1) => {
    const list = items
      .filter((i) => i.category === catName)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "es"));
    const idx = list.findIndex((i) => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= list.length) return;
    const a = list[idx], b = list[j];
    await (supabase as any).from("shopping_templates").update({ sort_order: b.sort_order ?? 0 }).eq("id", a.id);
    await (supabase as any).from("shopping_templates").update({ sort_order: a.sort_order ?? 0 }).eq("id", b.id);
    load();
  };

  const sortCatAlphabetically = async (catName: string) => {
    const list = items
      .filter((i) => i.category === catName)
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    for (let i = 0; i < list.length; i++) {
      await (supabase as any).from("shopping_templates").update({ sort_order: i }).eq("id", list[i].id);
    }
    toast.success("Ordenado alfabéticamente");
    load();
  };

  const load = async () => {
    const [{ data: c }, { data: t }, { data: items }, { data: profs }] = await Promise.all([
      (supabase as any).from("shopping_categories").select("*").order("sort_order").order("name"),
      (supabase as any).from("shopping_templates").select("*").order("name", { ascending: true }),
      (supabase as any).from("shopping_list_items").select("id,user_id,name,category,quantity,checked").order("name", { ascending: true }),
      (supabase as any).from("profiles").select("id,display_name"),
    ]);
    setCats(c ?? []);
    setItems(t ?? []);
    setClientItems(items ?? []);
    const p: Record<string, string> = {};
    (profs ?? []).forEach((x: Profile) => { p[x.id] = x.display_name || "Sin nombre"; });
    setProfiles(p);
  };
  useEffect(() => { load(); }, []);

  // ---- Counts (templates) ----
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: items.length, [UNCAT]: 0 };
    cats.forEach((c) => (m[c.name] = 0));
    items.forEach((it) => {
      const k = it.category ?? UNCAT;
      m[k] = (m[k] ?? 0) + 1;
    });
    return m;
  }, [items, cats]);

  // ---- Counts (client items) ----
  const cCounts = useMemo(() => {
    const m: Record<string, number> = { all: clientItems.length, [UNCAT]: 0 };
    cats.forEach((c) => (m[c.name] = 0));
    const known = new Set(cats.map((c) => c.name));
    clientItems.forEach((it) => {
      const k = it.category && known.has(it.category) ? it.category : UNCAT;
      m[k] = (m[k] ?? 0) + 1;
    });
    return m;
  }, [clientItems, cats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => {
        if (filterCat === "all") return true;
        if (filterCat === UNCAT) return !it.category;
        return it.category === filterCat;
      })
      .filter((it) => (q ? it.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [items, query, filterCat]);

  const cFiltered = useMemo(() => {
    const q = cQuery.trim().toLowerCase();
    const known = new Set(cats.map((c) => c.name));
    return clientItems
      .filter((it) => {
        if (cFilterCat === "all") return true;
        if (cFilterCat === UNCAT) return !it.category || !known.has(it.category);
        return it.category === cFilterCat;
      })
      .filter((it) => cFilterUser === "all" || it.user_id === cFilterUser)
      .filter((it) => (q ? it.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [clientItems, cQuery, cFilterCat, cFilterUser, cats]);

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
      const { error } = await (supabase as any).from("shopping_categories").update({ name: newName, sort_order: catForm.sort_order }).eq("id", catForm.id);
      if (error) return toast.error(error.message);
      // Propagate rename to items and templates
      if (oldName && oldName !== newName) {
        await (supabase as any).from("shopping_templates").update({ category: newName }).eq("category", oldName);
        await (supabase as any).from("shopping_list_items").update({ category: newName }).eq("category", oldName);
      }
    } else {
      const { error } = await (supabase as any).from("shopping_categories").insert({ name: newName, sort_order: catForm.sort_order });
      if (error) return toast.error(error.message);
    }
    toast.success("Categoría guardada");
    resetCat();
    load();
  };

  const delCat = async (c: Category) => {
    const tplUsage = items.filter((i) => i.category === c.name).length;
    const itemUsage = clientItems.filter((i) => i.category === c.name).length;
    if (tplUsage + itemUsage > 0) {
      toast.error(`No se puede borrar: ${tplUsage} plantilla(s) y ${itemUsage} producto(s) de clientas usan esta categoría. Reasígnalos primero.`);
      return;
    }
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    const { error } = await (supabase as any).from("shopping_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
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
      ? await (supabase as any).from("shopping_templates").update(payload).eq("id", id)
      : await (supabase as any).from("shopping_templates").insert(payload);
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

  // ---- Drag & drop (templates) ----
  const onDragStart = (id: string) => setDragId(id);
  const onDrop = async (catName: string | null) => {
    if (!dragId) return;
    setDropTarget(null);
    const moving = selected.has(dragId) && selected.size > 1 ? Array.from(selected) : [dragId];
    const { error } = await (supabase as any).from("shopping_templates").update({ category: catName }).in("id", moving);
    setDragId(null);
    if (error) return toast.error(error.message);
    toast.success(`${moving.length} movido(s) a "${catName ?? "Sin categoría"}"`);
    load();
  };

  const filterChips: { key: string; label: string }[] = [
    { key: "all", label: "Todos" },
    ...cats.map((c) => ({ key: c.name, label: c.name })),
    { key: UNCAT, label: "Sin categoría" },
  ];

  return (
    <div className="pb-28 max-w-5xl mx-auto">
      <AdminPageHeader title="Lista de compra" subtitle="Gestiona categorías, plantillas y los productos de tus clientas." />

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab("clients")}
          className={`text-sm px-3 py-2 rounded-full border transition flex items-center gap-2 ${tab === "clients" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
        >
          <Users className="h-4 w-4" /> Productos de clientas ({clientItems.length})
        </button>
        <button
          onClick={() => setTab("templates")}
          className={`text-sm px-3 py-2 rounded-full border transition flex items-center gap-2 ${tab === "templates" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
        >
          <Package className="h-4 w-4" /> Plantillas ({items.length})
        </button>
      </div>

      {/* Categories — shared, always visible */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-serif text-xl">Categorías</h2>
          <span className="text-xs muted">{cats.length} en total</span>
        </div>
        {!catForm.id && (
          <form onSubmit={saveCat} className="card-soft p-4 space-y-3 mb-4">
            <div className="font-medium text-sm">Nueva categoría</div>
            <div className="flex gap-2 flex-wrap">
              <input className="field flex-1 min-w-[180px]" placeholder="Nombre" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
              <input className="field w-28" type="number" placeholder="Orden" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: Number(e.target.value) || 0 })} />
              <button className="btn-primary"><Plus className="h-4 w-4" /> Añadir</button>
            </div>
          </form>
        )}
        <div className="space-y-2">
          {cats.map((c) => {
            const usage = (counts[c.name] ?? 0) + (cCounts[c.name] ?? 0);
            const isEditing = catForm.id === c.id;
            if (isEditing) {
              return (
                <form key={c.id} onSubmit={saveCat} className="card-soft p-3 space-y-2 border-primary/40">
                  <div className="text-xs muted">Editando categoría: <span className="font-medium text-foreground">{catForm._origName}</span></div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <input autoFocus className="field flex-1 min-w-[180px]" placeholder="Nombre" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
                    <input className="field w-24" type="number" placeholder="Orden" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: Number(e.target.value) || 0 })} />
                    <button type="submit" className="btn-primary">Guardar</button>
                    <button type="button" className="btn-secondary" onClick={resetCat}>Cancelar</button>
                  </div>
                  {catForm._origName && catForm._origName !== catForm.name && (
                    <p className="text-xs muted">Al guardar, los {usage} producto(s)/plantilla(s) con "{catForm._origName}" pasarán a "{catForm.name}".</p>
                  )}
                </form>
              );
            }
            return (
              <div key={c.id} className="space-y-2">
                <div className="card-soft p-3 flex items-center gap-2">
                  <button type="button" onClick={() => toggleExpand(c.id)} className="p-1 shrink-0" aria-label={expandedCats.has(c.id) ? "Contraer" : "Expandir"}>
                    {expandedCats.has(c.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => toggleExpand(c.id)} className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-left">
                    <span className="font-medium text-sm truncate">{c.name}</span>
                    <span className="text-xs muted">{counts[c.name] ?? 0} ingredientes</span>
                  </button>
                  <button type="button" onClick={() => moveCat(c, -1)} className="p-1" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => moveCat(c, 1)} className="p-1" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={(e) => { e.preventDefault(); setCatForm({ id: c.id, name: c.name, sort_order: c.sort_order, _origName: c.name }); }} className="p-1 text-primary" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => delCat(c)} className={`p-1 ${usage > 0 ? "text-muted-foreground/40 cursor-not-allowed" : "text-destructive"}`} title={usage > 0 ? "Reasigna los productos antes de borrar" : "Eliminar"}><Trash2 className="h-4 w-4" /></button>
                </div>
                {expandedCats.has(c.id) && (() => {
                  const q = (catQuery[c.id] || "").trim().toLowerCase();
                  const alpha = !!catSortAlpha[c.id];
                  const list = items
                    .filter((i) => i.category === c.name)
                    .filter((i) => q ? i.name.toLowerCase().includes(q) : true)
                    .sort((a, b) => alpha
                      ? a.name.localeCompare(b.name, "es", { sensitivity: "base" })
                      : ((a.sort_order ?? 0) - (b.sort_order ?? 0)) || a.name.localeCompare(b.name, "es"));
                  return (
                    <div className="ml-6 space-y-2 border-l-2 border-border pl-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative flex-1 min-w-[180px]">
                          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 muted" />
                          <input className="field pl-8 text-sm" placeholder={`Buscar en ${c.name}…`} value={catQuery[c.id] || ""} onChange={(e) => setCatQuery((s) => ({ ...s, [c.id]: e.target.value }))} />
                        </div>
                        <button type="button" onClick={() => setCatSortAlpha((s) => ({ ...s, [c.id]: !s[c.id] }))} className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 ${alpha ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`} title="Vista alfabética">
                          <ArrowDownAZ className="h-3.5 w-3.5" /> A-Z
                        </button>
                        <button type="button" onClick={() => sortCatAlphabetically(c.name)} className="text-xs px-2.5 py-1 rounded-full border bg-card border-border" title="Reordenar permanentemente A-Z">
                          Guardar A-Z
                        </button>
                      </div>
                      {list.length === 0 && (
                        <div className="text-xs muted py-2">{q ? "Sin resultados." : "Sin ingredientes en esta categoría."}</div>
                      )}
                      {list.map((it) => (
                        <div key={it.id} className="card-soft p-2.5 flex items-center gap-2">
                          <div className="flex-1 min-w-0 text-sm truncate">{it.name}</div>
                          {!alpha && (
                            <>
                              <button type="button" onClick={() => moveTemplateInCat(c.name, it.id, -1)} className="p-1" aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => moveTemplateInCat(c.name, it.id, 1)} className="p-1" aria-label="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                          <select
                            className="field text-xs w-36"
                            value={it.category ?? ""}
                            onChange={async (e) => {
                              const v = e.target.value || null;
                              const { error } = await (supabase as any).from("shopping_templates").update({ category: v }).eq("id", it.id);
                              if (error) return toast.error(error.message);
                              setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, category: v } : x));
                            }}
                          >
                            <option value="">Sin categoría</option>
                            {cats.map((cc) => <option key={cc.id} value={cc.name}>{cc.name}</option>)}
                          </select>
                          <button type="button" onClick={() => { setTab("templates"); setItemForm({ id: it.id, name: it.name, category: it.category ?? "", sort_order: it.sort_order }); setTimeout(() => document.getElementById("tpl-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }} className="p-1 text-primary" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => delItem(it.id)} className="p-1 text-destructive" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </section>

      {/* === CLIENT ITEMS TAB === */}
      {tab === "clients" && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-serif text-xl">Productos de clientas</h2>
            <span className="text-xs muted">{clientItems.length} en total</span>
          </div>

          {/* Search + filters */}
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

            <div className="flex flex-wrap gap-1.5 mt-3">
              {[{ key: "all", label: "Todas" }, ...cats.map((c) => ({ key: c.name, label: c.name })), { key: UNCAT, label: "Sin categoría" }].map((ch) => (
                <button
                  key={ch.key}
                  onClick={() => setCFilterCat(ch.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${cFilterCat === ch.key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"}`}
                >
                  {ch.label} <span className="opacity-70">· {cCounts[ch.key] ?? 0}</span>
                </button>
              ))}
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
              {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value={UNCAT}>Sin categoría</option>
            </select>
            <button onClick={cBulkMove} disabled={cSelected.size === 0 || !cBulkTarget} className="btn-primary disabled:opacity-50">
              Mover
            </button>
            <button onClick={cBulkDelete} disabled={cSelected.size === 0} className="text-xs px-3 py-2 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40 flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {cFiltered.map((it) => {
              const known = cats.some((c) => c.name === it.category);
              const displayCat = it.category && known ? it.category : "";
              return (
                <div key={it.id} className="card-soft p-3 flex items-center gap-2">
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
                      {!known && it.category ? ` · ⚠ "${it.category}" (categoría desconocida)` : ""}
                    </div>
                  </div>
                  <select
                    className="field w-44 text-sm"
                    value={displayCat}
                    onChange={(e) => cSetCategory(it.id, e.target.value || null)}
                  >
                    <option value="">Sin categoría</option>
                    {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <button onClick={() => cDelete(it.id, it.name)} className="p-1 text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
            {cFiltered.length === 0 && (
              <div className="card-soft p-6 text-center muted text-sm">
                {cQuery || cFilterCat !== "all" || cFilterUser !== "all" ? "Sin resultados con estos filtros." : "Aún no hay productos."}
              </div>
            )}
          </div>
        </section>
      )}

      {/* === TEMPLATES TAB === */}
      {tab === "templates" && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-serif text-xl">Plantillas de ingredientes</h2>
            <span className="text-xs muted">{items.length} en total</span>
          </div>

          <form id="tpl-form" onSubmit={saveItem} className="card-soft p-4 space-y-3 mb-4">
            <div className="font-medium text-sm">{itemForm.id ? "Editar ingrediente" : "Nuevo ingrediente"}</div>
            <div className="flex gap-2 flex-wrap">
              <input className="field flex-1 min-w-[180px]" placeholder="Nombre" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
              <select className="field w-48" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>
                <option value="">Sin categoría</option>
                {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
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

            <div className="flex flex-wrap gap-1.5 mt-3">
              {filterChips.map((ch) => (
                <button
                  key={ch.key}
                  onClick={() => setFilterCat(ch.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${filterCat === ch.key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"}`}
                >
                  {ch.label} <span className="opacity-70">· {counts[ch.key] ?? 0}</span>
                </button>
              ))}
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
              {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value={UNCAT}>Sin categoría</option>
            </select>
            <button onClick={bulkMove} disabled={selected.size === 0 || !bulkTarget} className="btn-primary disabled:opacity-50">
              Mover
            </button>
          </div>

          <div className="space-y-2">
            {filtered.map((it) => (
              <div
                key={it.id}
                draggable
                onDragStart={() => onDragStart(it.id)}
                onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                className={`card-soft p-3 flex items-center gap-2 cursor-grab active:cursor-grabbing ${dragId === it.id ? "opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(it.id)}
                  onChange={() => toggle(it.id)}
                  className="h-4 w-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{it.name}</div>
                  <div className="text-xs muted truncate">{it.category ?? "Sin categoría"}</div>
                </div>
                <button onClick={() => { setItemForm({ id: it.id, name: it.name, category: it.category ?? "", sort_order: it.sort_order }); document.getElementById("tpl-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="p-1 text-primary" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => delItem(it.id)} className="p-1 text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="card-soft p-6 text-center muted text-sm">
                {query || filterCat !== "all" ? "Sin resultados con estos filtros." : "Aún no hay ingredientes."}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
