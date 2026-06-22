import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, BookOpen, Pin, Search } from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string | null;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
};

export default function Resources() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [activeTop, setActiveTop] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase.from("resource_categories").select("*").order("sort_order").then(({ data }) => setCats((data ?? []) as Category[]));
    supabase.from("resources")
      .select("*")
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));
  }, []);

  const tops = cats.filter(c => !c.parent_id);
  const subsOf = (id: string) => cats.filter(c => c.parent_id === id);

  // Map descendant ids for a top-level cat (itself + its subs)
  const descIds = (id: string) => new Set<string>([id, ...subsOf(id).map(s => s.id)]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tops) {
      const ids = descIds(t.id);
      m[t.id] = items.filter(i => i.category_id && ids.has(i.category_id)).length;
    }
    return m;
  }, [items, cats]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeSub) list = list.filter(i => i.category_id === activeSub);
    else if (activeTop) {
      const ids = descIds(activeTop);
      list = list.filter(i => i.category_id && ids.has(i.category_id));
    }
    if (q) {
      list = list.filter(i => {
        const cat = cats.find(c => c.id === i.category_id);
        const parent = cat?.parent_id ? cats.find(c => c.id === cat.parent_id) : null;
        const haystack = [i.title, cat?.name, parent?.name].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [items, activeTop, activeSub, q, cats]);

  const currentTop = activeTop ? cats.find(c => c.id === activeTop) : null;
  const currentSub = activeSub ? cats.find(c => c.id === activeSub) : null;
  const inside = !!activeTop || searching;

  return (
    <div className="pb-8">
      {inside ? (
        <>
          <button onClick={() => { if (activeSub) setActiveSub(null); else { setActiveTop(null); setQuery(""); } }} className="text-sm muted inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> {activeSub ? currentTop?.name : "Categorías"}
          </button>

          <h1 className="heading-lg mb-1">
            {searching && !activeTop ? `Resultados${q ? `: "${query}"` : ""}` : (
              <>
                {currentSub ? `${currentSub.icon ?? ""} ${currentSub.name}` : `${currentTop?.icon ?? ""} ${currentTop?.name}`}
              </>
            )}
          </h1>
          <p className="text-sm muted mb-4">{filteredItems.length} publicación{filteredItems.length === 1 ? "" : "es"}</p>

          {/* Subcategory chips */}
          {currentTop && subsOf(currentTop.id).length > 0 && !searching && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
              <button onClick={() => setActiveSub(null)} className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${!activeSub ? "bg-primary text-white" : "bg-muted"}`}>Todo</button>
              {subsOf(currentTop.id).map(s => (
                <button key={s.id} onClick={() => setActiveSub(s.id)} className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${activeSub === s.id ? "bg-primary text-white" : "bg-muted"}`}>
                  {s.icon ?? ""} {s.name}
                </button>
              ))}
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="card-soft p-6 text-center muted">No hay publicaciones que coincidan.</div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(it => {
                const cat = cats.find(c => c.id === it.category_id);
                return (
                  <Link key={it.id} to={`/app/recursos/${it.id}`} className="card-soft overflow-hidden block hover:shadow-glow transition">
                    {it.cover_image && <img src={it.cover_image} alt="" className="w-full h-40 object-cover" />}
                    <div className="p-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          {it.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />}
                          {it.title}
                        </div>
                        <div className="text-xs muted truncate">{cat?.icon} {cat?.name ?? "Sin categoría"}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 muted shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <Link to="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <h1 className="heading-lg mb-1">Vídeos y guías</h1>
          <p className="text-sm muted mb-4">Explora los recursos por categoría.</p>

          <div className="relative mb-4">
            <Search className="h-4 w-4 muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="field pl-9"
              placeholder="Buscar por nombre o categoría…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {tops.map(c => (
              <button key={c.id} onClick={() => setActiveTop(c.id)} className="card-soft p-4 text-left hover:shadow-glow transition">
                <div className="text-2xl mb-1">{c.icon ?? "📁"}</div>
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs muted mt-1 inline-flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> {counts[c.id] ?? 0}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
