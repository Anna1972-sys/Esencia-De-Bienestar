import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowLeft, ChevronRight, Image as ImageIcon, Search } from "lucide-react";
import productsHeroImage from "@/assets/home-productos-te-jardin.png";
import imgNutritionInternal from "@/assets/product-admin/nutricion-interna.jpg";
import imgNutritionObjective from "@/assets/product-admin/nutricion-objetiva-soft.jpg";
import imgNutritionExternal from "@/assets/product-admin/nutricion-externa-beige.png";

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
  line?: string | null;
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

const PRODUCT_CLIENT_ACCESS_SECTIONS = [
  { id: "nutricion-interna", title: "Nutrición interna", image: imgNutritionInternal },
  { id: "nutricion-objetiva", title: "Nutrición objetiva", image: imgNutritionObjective },
  { id: "nutricion-externa", title: "Nutrición externa", image: imgNutritionExternal },
] as const;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function categorySectionId(category: ProductCategory | null) {
  if (!category) return "";
  return normalizeText(category.name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugifySection(value: unknown) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PRODUCT_CLIENT_SECTION_IDS = new Set(PRODUCT_CLIENT_ACCESS_SECTIONS.map(section => section.id));

function productSectionId(product: Product, category: ProductCategory | null) {
  const lineSection = slugifySection(product.line);
  if (PRODUCT_CLIENT_SECTION_IDS.has(lineSection)) return lineSection;

  const categorySection = categorySectionId(category);
  if (PRODUCT_CLIENT_SECTION_IDS.has(categorySection)) return categorySection;

  return "";
}

export default function Products() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeProductSection, setActiveProductSection] = useState<string>("");
  const [query, setQuery] = useState("");
  const openedSectionRef = useRef<HTMLElement | null>(null);

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
  const q = String(query ?? "").trim().toLowerCase();
  const productMatchesSection = (product: Product, sectionId: string) => {
    const category = product.category_id ? categoryById.get(product.category_id) : null;
    return productSectionId(product, category) === sectionId;
  };

  const filtered = useMemo(() => {
    return products.filter(product => {
      if (activeProductSection && !productMatchesSection(product, activeProductSection)) return false;
      if (activeCategory && product.category_id !== activeCategory) return false;
      if (!q) return true;
      const category = product.category_id ? categoryById.get(product.category_id) : null;
      const haystack = [product.name, product.description, product.benefits, category?.name].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [products, activeCategory, activeProductSection, q, categoryById]);
  const activeSection = PRODUCT_CLIENT_ACCESS_SECTIONS.find(section => section.id === activeProductSection);

  useEffect(() => {
    if (!activeProductSection) return;
    window.setTimeout(() => {
      openedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [activeProductSection]);

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

      <section className="products-client-hero-card mb-5">
        <img src={productsHeroImage} alt="" className="products-client-hero-image" />
        <div className="products-client-hero-copy">
          <h2>Salud y Bienestar</h2>
          <p>Suplementación inteligente</p>
        </div>
      </section>

      <section className="products-client-access-list mb-5" aria-label="Secciones de productos">
        {PRODUCT_CLIENT_ACCESS_SECTIONS.map(section => {
          const isActive = activeProductSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              className={`products-client-access-card ${isActive ? "is-active" : ""}`}
              onClick={() => {
                setActiveProductSection(isActive ? "" : section.id);
                setActiveCategory("");
              }}
              aria-expanded={isActive}
            >
              <span className="products-client-access-image-wrap">
                <img src={section.image} alt={section.title} />
              </span>
              <span className="products-client-access-title">{section.title}</span>
              <ArrowDown className={`products-client-access-arrow ${isActive ? "rotate-180" : ""}`} />
            </button>
          );
        })}
      </section>

      {activeProductSection && (
        <>
          <div className="products-client-search-card">
            <div className="relative">
              <Search className="h-4 w-4 muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="field pl-9"
                placeholder="Buscar producto o categoría…"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </div>
          </div>

          <section ref={openedSectionRef} className="products-client-access-panel" aria-label={`Productos de ${activeSection?.title ?? "la sección seleccionada"}`}>
            <div className="products-client-access-panel-header">
              <p>Salud y Bienestar</p>
              <h2>{activeSection?.title}</h2>
            </div>

          {filtered.length === 0 ? (
            <div className="card-soft p-6 text-center muted">No hay productos visibles en esta categoría.</div>
          ) : (
            <div className="products-client-grid">
              {filtered.map(product => {
                const category = product.category_id ? categoryById.get(product.category_id) : null;
                return (
                  <Link
                    key={product.id}
                    to={`/app/productos/${product.id}`}
                    className="product-client-list-card group overflow-hidden rounded-[28px] p-0 transition-all duration-300 hover:-translate-y-1 text-left"
                  >
                    <div className="product-client-list-image">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="transition-transform duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary/20 via-white to-fuchsia-100 grid place-items-center">
                          <ImageIcon className="h-8 w-8 text-primary/70" />
                        </div>
                      )}
                    </div>
                    <div className="product-client-list-info">
                      <div className="min-w-0">
                        <h2 className="product-client-list-title">{product.name}</h2>
                      </div>
                    </div>
                    <div className="product-client-list-footer">
                      <span className="product-client-list-button">
                        Ver producto <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          </section>
        </>
      )}
    </div>
  );
}
