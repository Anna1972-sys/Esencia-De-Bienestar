import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, Image as ImageIcon, Search } from "lucide-react";

type ProductCategory = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  image_url: string | null;
  description: string | null;
  benefits: string | null;
  is_active: boolean;
  visible_to_clients: boolean;
  available_for_recipes: boolean;
  informative_only: boolean;
  verification_status?: "verificado" | "pendiente";
};

export default function Products() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (supabase as any)
      .from("product_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data }: any) => setCategories((data ?? []) as ProductCategory[]));

    (supabase as any)
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq("visible_to_clients", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data }: any) => setProducts((data ?? []) as Product[]));
  }, []);

  const categoryById = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return products.filter(product => {
      if (activeCategory && product.category_id !== activeCategory) return false;
      if (!q) return true;
      const category = product.category_id ? categoryById.get(product.category_id) : null;
      const haystack = [product.name, product.description, product.benefits, category?.name].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [products, activeCategory, q, categoryById]);

  return (
    <div className="pb-8">
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      <header className="mb-5">
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-primary mb-1">Productos</p>
        <h1 className="heading-lg">Suplementación inteligente</h1>
        <p className="muted text-sm mt-2">Consulta productos, guías de uso e información nutricional.</p>
      </header>

      <div className="relative mb-4">
        <Search className="h-4 w-4 muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          className="field pl-9"
          placeholder="Buscar producto o categoría…"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        <button
          onClick={() => setActiveCategory("")}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${!activeCategory ? "bg-primary text-white" : "bg-muted"}`}
        >
          Todo
        </button>
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${activeCategory === category.id ? "bg-primary text-white" : "bg-muted"}`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card-soft p-6 text-center muted">No hay productos visibles en esta categoría.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(product => {
            const category = product.category_id ? categoryById.get(product.category_id) : null;
            return (
              <Link
                key={product.id}
                to={`/app/productos/${product.id}`}
                className="wellness-tile group overflow-hidden rounded-[28px] p-0 transition-all duration-300 hover:-translate-y-1 text-left"
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="h-44 w-full bg-gradient-to-br from-primary/20 via-white to-fuchsia-100 grid place-items-center">
                    <ImageIcon className="h-8 w-8 text-primary/70" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-primary truncate">{category?.name ?? "Producto"}</div>
                      <h2 className="font-sans font-bold text-lg leading-tight mt-1">{product.name}</h2>
                    </div>
                    <ChevronRight className="h-4 w-4 muted shrink-0 mt-1" />
                  </div>
                  {product.description && <p className="text-xs muted mt-2 line-clamp-2">{product.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {product.available_for_recipes && <span className="chip-lavender">Recetas</span>}
                    {product.informative_only && <span className="chip">Informativo</span>}
                    <span className={product.verification_status === "verificado" ? "chip-lavender" : "chip"}>{product.verification_status ?? "pendiente"}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
