import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingBag, Check, ArrowLeft, Search, X } from "lucide-react";
import { toast } from "sonner";
import imgCompra from "@/assets/home-compra.png";

type Item = {
  id: string;
  name: string;
  quantity: string | null;
  checked: boolean;
  category: string | null;
};

type Template = { id: string; name: string; category: string | null; sort_order: number };
type Category = { id: string; name: string; sort_order: number };

type Row = {
  key: string;
  name: string;
  quantity: string | null;
  checked: boolean;
  category: string | null;
  source: "template" | "personal";
  personalId?: string;
  templateId?: string;
};

const UNCATEGORIZED = "__uncat__";

export default function ShoppingList() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const loadCats = async () => {
    const { data, error } = await (supabase as any)
      .from("shopping_categories")
      .select("*")
      .order("sort_order")
      .order("name");
    if (error) {
      console.error("[shopping_categories]", error);
      toast.error(`No se pudieron cargar las categorías: ${error.message}`);
      setCats([]);
      return;
    }
    setCats(data ?? []);
  };

  const loadTemplates = async () => {
    const { data: tpl, error: tplError } = await (supabase as any)
      .from("shopping_templates")
      .select("*")
      .order("sort_order")
      .order("name");
    if (tplError) {
      console.error("[shopping_templates]", tplError);
      toast.error(`No se pudieron cargar los ingredientes: ${tplError.message}`);
    }

    setTemplates(tplError ? [] : ((tpl as Template[]) ?? []));
  };

  const loadItems = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[shopping_list_items own]", error);
      toast.error(`No se pudo cargar tu lista: ${error.message}`);
      setItems([]);
      return;
    }
    setItems((data as any) ?? []);
  };

  useEffect(() => { loadCats(); }, []);
  useEffect(() => { loadTemplates(); loadItems(); }, [user]);

  // Map of personal items keyed by "name|category" for matching templates
  const personalByKey = useMemo(() => {
    const m = new Map<string, Item>();
    for (const i of items) m.set(`${i.name.toLowerCase()}|${i.category ?? ""}`, i);
    return m;
  }, [items]);

  const togglePersonal = async (id: string, checked: boolean) => {
    const { error } = await supabase.from("shopping_list_items").update({ checked: !checked }).eq("id", id);
    if (error) return toast.error(error.message);
    setItems(items.map(i => i.id === id ? { ...i, checked: !checked } : i));
  };

  const toggleTemplate = async (t: Template, currentlyChecked: boolean) => {
    if (!user) return;
    const key = `${t.name.toLowerCase()}|${t.category ?? ""}`;
    const existing = personalByKey.get(key);
    if (currentlyChecked && existing) {
      // uncheck → remove the personal "checked marker"
      const { error } = await supabase.from("shopping_list_items").delete().eq("id", existing.id);
      if (error) return toast.error(error.message);
      setItems(items.filter(i => i.id !== existing.id));
    } else if (!currentlyChecked) {
      const { data, error } = await supabase
        .from("shopping_list_items")
        .insert({ user_id: user.id, name: t.name, category: t.category, checked: true })
        .select()
        .single();
      if (error) return toast.error(error.message);
      if (data) setItems([data as any, ...items]);
    }
  };

  const catNames = useMemo(() => new Set(cats.map(c => c.name)), [cats]);

  // Build unified rows: templates + personal items that aren't already mirroring a template
  const allRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    const usedPersonalIds = new Set<string>();

    for (const t of templates) {
      const key = `${t.name.toLowerCase()}|${t.category ?? ""}`;
      const personal = personalByKey.get(key);
      if (personal) usedPersonalIds.add(personal.id);
      rows.push({
        key: `tpl-${t.id}`,
        name: t.name,
        quantity: null,
        checked: !!personal?.checked,
        category: t.category,
        source: "template",
        templateId: t.id,
        personalId: personal?.id,
      });
    }

    for (const i of items) {
      if (usedPersonalIds.has(i.id)) continue;
      rows.push({
        key: `own-${i.id}`,
        name: i.name,
        quantity: i.quantity,
        checked: i.checked,
        category: i.category,
        source: "personal",
        personalId: i.id,
      });
    }
    return rows;
  }, [templates, items, personalByKey]);

  const filtered = useMemo(() => {
    const byCategory =
      filter === "all" ? allRows
      : filter === UNCATEGORIZED ? allRows.filter(r => !r.category || !catNames.has(r.category))
      : allRows.filter(r => r.category === filter);
    const q = query.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter(r => r.name.toLowerCase().includes(q));
  }, [allRows, filter, catNames, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const c of cats) m.set(c.name, []);
    m.set(UNCATEGORIZED, []);
    for (const r of filtered) {
      const key = r.category && catNames.has(r.category) ? r.category : UNCATEGORIZED;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return m;
  }, [filtered, cats, catNames]);

  const hasUncategorized = (grouped.get(UNCATEGORIZED)?.length ?? 0) > 0;

  const total = filtered.length;
  const done = filtered.filter(r => r.checked).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const activeLabel =
    filter === "all" ? "Todas las categorías"
    : filter === UNCATEGORIZED ? "Sin categoría"
    : filter;

  return (
    <div className="shopping-list-page pb-28">
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      <section className="shopping-hero-card card-soft mb-5">
        <img src={imgCompra} alt="" className="shopping-hero-image" />
        <div className="shopping-hero-copy">
          <h1>Lista de compra</h1>
          <p>Organiza tus ingredientes de forma sencilla.</p>
        </div>
      </section>

      <section className="shopping-category-hero card-soft mb-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">Elige tu categoría</h2>
              <p className="text-sm muted">Filtra y marca solo los ingredientes de tu lista personal.</p>
            </div>
            <div className="rounded-full border border-primary/35 bg-white px-3 py-1.5 text-xs font-semibold text-foreground">
              {total} visible(s)
            </div>
          </div>

          <div className="shopping-category-scroll" role="tablist" aria-label="Categorías de lista de compra">
            <button onClick={() => setFilter("all")} className={`shopping-filter-chip ${filter === "all" ? "is-active" : ""}`} role="tab" aria-selected={filter === "all"}>
              Todas
            </button>
            {cats.map(c => (
              <button key={c.id} onClick={() => setFilter(c.name)} className={`shopping-filter-chip ${filter === c.name ? "is-active" : ""}`} role="tab" aria-selected={filter === c.name}>
                {c.name}
              </button>
            ))}
            {hasUncategorized && (
              <button onClick={() => setFilter(UNCATEGORIZED)} className={`shopping-filter-chip ${filter === UNCATEGORIZED ? "is-active" : ""}`} role="tab" aria-selected={filter === UNCATEGORIZED}>
                Sin categoría
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 muted" />
            <input className="field pl-9 pr-9" placeholder="Buscar ingrediente…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 muted" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {total === 0 ? (
        <div className="card-soft shopping-card p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3">
            <ShoppingBag className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div className="font-medium mb-1">
            {filter === "all" ? "Tu lista está vacía" : `Sin productos en "${activeLabel}"`}
          </div>
          <p className="text-sm muted">
            {filter === "all" ? "Añade tu primer producto para empezar." : "Añade un producto o cambia de categoría."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries())
            .sort((a, b) => {
              if (a[0] === UNCATEGORIZED) return 1;
              if (b[0] === UNCATEGORIZED) return -1;
              return 0;
            })
            .map(([key, list]) => {
            if (!list || list.length === 0) return null;
            const catDone = list.filter(r => r.checked).length;
            const label = key === UNCATEGORIZED ? "Sin categoría" : key;
            return (
              <section key={key}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="font-serif text-lg">{label}</h2>
                  <span className="text-[11px] muted">{catDone}/{list.length}</span>
                </div>
                <div className="card-soft shopping-inner-card divide-y divide-border/60 overflow-hidden">
                  {list.map(r => (
                    <div key={r.key} className={`flex items-center gap-3 px-4 py-3 transition ${r.checked ? "bg-muted/40" : ""}`}>
                      <button
                        onClick={() =>
                          r.source === "template"
                            ? toggleTemplate(
                                { id: r.templateId!, name: r.name, category: r.category, sort_order: 0 },
                                r.checked
                              )
                            : togglePersonal(r.personalId!, r.checked)
                        }
                        className={`h-6 w-6 rounded-full border-2 grid place-items-center shrink-0 transition ${r.checked ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card"}`}
                        aria-label={r.checked ? "Desmarcar" : "Marcar"}
                      >
                        {r.checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${r.checked ? "line-through text-muted-foreground" : ""}`}>{r.name}</div>
                        {r.quantity && <div className="text-xs muted truncate">{r.quantity}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="card-soft shopping-card p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShoppingBag className="h-4 w-4 text-primary" />
              {activeLabel}
            </div>
            <div className="text-xs muted">{done} / {total}</div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundImage: "linear-gradient(135deg, hsl(330 80% 60%), hsl(285 65% 55%))" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
