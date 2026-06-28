import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, ShoppingBag, Check, ArrowLeft } from "lucide-react";

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
  const [name, setName] = useState("");
  const [newCat, setNewCat] = useState<string | "auto">("auto");
  const [filter, setFilter] = useState<string>("all");

  const loadCats = async () => {
    const { data } = await (supabase as any)
      .from("shopping_categories")
      .select("*")
      .order("sort_order")
      .order("name");
    setCats(data ?? []);
  };

  const loadTemplates = async () => {
    // 1) Plantillas explícitas creadas desde el panel
    const { data: tpl } = await (supabase as any)
      .from("shopping_templates")
      .select("*")
      .order("sort_order")
      .order("name");

    // 2) Productos creados por administradoras en shopping_list_items.
    //    RLS permite leer solo los de usuarias con rol admin.
    //    Para la propia administradora excluimos sus filas para no duplicar
    //    (las verá como personales en loadItems).
    let q = (supabase as any)
      .from("shopping_list_items")
      .select("id,name,category")
      .order("name");
    if (user) q = q.neq("user_id", user.id);
    const { data: adminItems } = await q;

    const merged: Template[] = [
      ...((tpl as Template[]) ?? []),
      ...((adminItems ?? []) as any[]).map((it) => ({
        id: `sli-${it.id}`,
        name: it.name,
        category: it.category,
        sort_order: 0,
      })),
    ];
    setTemplates(merged);
  };

  const loadItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("shopping_list_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
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

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    let cat: string | null;
    if (newCat === "auto") {
      cat = filter !== "all" && filter !== UNCATEGORIZED ? filter : (cats[0]?.name ?? null);
    } else {
      cat = newCat || null;
    }
    const { data } = await supabase
      .from("shopping_list_items")
      .insert({ user_id: user.id, name: name.trim(), category: cat })
      .select()
      .single();
    if (data) { setItems([data as any, ...items]); setName(""); }
  };

  const togglePersonal = async (id: string, checked: boolean) => {
    await supabase.from("shopping_list_items").update({ checked: !checked }).eq("id", id);
    setItems(items.map(i => i.id === id ? { ...i, checked: !checked } : i));
  };

  const toggleTemplate = async (t: Template, currentlyChecked: boolean) => {
    if (!user) return;
    const key = `${t.name.toLowerCase()}|${t.category ?? ""}`;
    const existing = personalByKey.get(key);
    if (currentlyChecked && existing) {
      // uncheck → remove the personal "checked marker"
      await supabase.from("shopping_list_items").delete().eq("id", existing.id);
      setItems(items.filter(i => i.id !== existing.id));
    } else if (!currentlyChecked) {
      const { data } = await supabase
        .from("shopping_list_items")
        .insert({ user_id: user.id, name: t.name, category: t.category, checked: true })
        .select()
        .single();
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
    if (filter === "all") return allRows;
    if (filter === UNCATEGORIZED) return allRows.filter(r => !r.category || !catNames.has(r.category));
    return allRows.filter(r => r.category === filter);
  }, [allRows, filter, catNames]);

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
    <div className="pb-28">
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <h1 className="heading-lg mb-1">Lista de compra</h1>
      <p className="muted text-sm mb-4">Organiza tus productos por categorías.</p>

      <form onSubmit={add} className="card-soft p-3 mb-4 space-y-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="field flex-1"
            placeholder="Añadir producto personal…"
          />
          <button className="btn-primary px-4" aria-label="Añadir"><Plus className="h-4 w-4" /></button>
        </div>
        <select
          className="field"
          value={newCat}
          onChange={e => setNewCat(e.target.value as any)}
        >
          <option value="auto">Categoría automática</option>
          {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </form>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 mb-3">
        <button onClick={() => setFilter("all")}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${filter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/70"}`}>
          Todas
        </button>
        {cats.map(c => (
          <button key={c.id} onClick={() => setFilter(c.name)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${filter === c.name ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/70"}`}>
            {c.name}
          </button>
        ))}
        {hasUncategorized && (
          <button onClick={() => setFilter(UNCATEGORIZED)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${filter === UNCATEGORIZED ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/70"}`}>
            Sin categoría
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="card-soft p-4 mb-4">
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

      {total === 0 ? (
        <div className="card-soft p-8 text-center">
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
                <div className="card-soft divide-y divide-border/60 overflow-hidden">
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
    </div>
  );
}
