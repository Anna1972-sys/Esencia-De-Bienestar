import { useEffect, useState } from "react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, ShoppingBag, ArrowLeft, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { mediaUrl } from "@/lib/mediaStorage";

const macroValue = (macros: any, key: string) => Number(macros?.[key] ?? 0);
const hasNutrition = (macros: any) =>
  ["calories", "protein", "carbs", "fat", "fiber"].some(key => macroValue(macros, key) > 0);
const nutritionLabel = (macros: any) =>
  macros?.nutrition_status === "verified" ? "Valores verificados" : "Valores estimados";

export default function SavedRecipes() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("recipes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (id: string) => {
    await supabase.from("recipes").delete().eq("id", id);
    setItems(items.filter(r => r.id !== id));
  };
  const addToShopping = async (r: any) => {
    if (!user) return;
    const rows = (r.ingredients ?? []).map((i: any) => ({
      user_id: user.id,
      name: typeof i === "string" ? i : i.name ?? String(i),
      quantity: typeof i === "string" ? null : i.quantity ?? null,
      recipe_id: r.id,
    }));
    if (!rows.length) return;
    const { error } = await supabase.from("shopping_list_items").insert(rows);
    if (error) toast.error(error.message); else toast.success("Añadido a la lista");
  };

  const filtered = items.filter(r => r.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <h1 className="heading-lg mb-3">Mis recetas</h1>
      <input value={q} onChange={e => setQ(e.target.value)} className="field mb-4" placeholder="Buscar…" />
      {loading ? <p className="muted">Cargando…</p> : filtered.length === 0 ? (
        <div className="card-soft p-6 text-center muted">Aún no tienes recetas. Crea una con el generador IA.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(r => {
            const macros = r.macros ?? {};
            const nutritionAvailable = hasNutrition(macros);
            const isHighProtein = macroValue(macros, "protein") >= 25 || r.is_high_protein;
            return <details key={r.id} className="recipe-premium rounded-[24px] bg-white/90 group">
              <summary className="block cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="grid grid-cols-[42%_1fr] min-h-[142px] items-stretch">
                  <div className="recipe-premium-image relative h-full min-h-[142px] overflow-hidden bg-gradient-to-br from-white via-primary/10 to-primary/20">
                    <div className="absolute inset-0 grid place-items-center text-primary/70">
                      <div className="h-14 w-14 rounded-2xl bg-white/80 border border-primary/20 grid place-items-center shadow-sm">
                        <ChefHat className="h-7 w-7" />
                      </div>
                    </div>
                    {r.image_url && (
                      <img
                        src={mediaUrl(r.image_url)}
                        alt={r.title}
                        loading="lazy"
                        className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                  <div className="p-5 flex flex-col justify-center min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-semibold text-lg leading-tight">{r.title}</div>
                      {nutritionAvailable && isHighProtein && <span className="chip shrink-0">Alta proteína</span>}
                    </div>
                    <div className="text-[11px] leading-relaxed muted mt-2.5">
                      {r.prep_time ?? "—"} min · {nutritionAvailable ? nutritionLabel(macros) : "Nutrición no registrada"}
                    </div>
                    {nutritionAvailable && (
                      <div className="grid grid-cols-5 gap-1.5 mt-3 text-center text-[10px]">
                        <Macro label="Kcal" value={macroValue(macros, "calories")} />
                        <Macro label="Prot" value={`${macroValue(macros, "protein")}g`} />
                        <Macro label="Hidr" value={`${macroValue(macros, "carbs")}g`} />
                        <Macro label="Grasa" value={`${macroValue(macros, "fat")}g`} />
                        <Macro label="Fibra" value={`${macroValue(macros, "fiber")}g`} />
                      </div>
                    )}
                  </div>
                </div>
              </summary>
              <div className="text-sm px-4 pb-4 space-y-3">
                <p className="muted">{r.description}</p>
                <div>
                  {nutritionAvailable && (
                    <div className="mb-3">
                      <div className="font-medium mb-1">Información nutricional por ración</div>
                      <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                        <Macro label="Kcal" value={macroValue(macros, "calories")} />
                        <Macro label="Prot" value={`${macroValue(macros, "protein")}g`} />
                        <Macro label="Hidr" value={`${macroValue(macros, "carbs")}g`} />
                        <Macro label="Grasa" value={`${macroValue(macros, "fat")}g`} />
                        <Macro label="Fibra" value={`${macroValue(macros, "fiber")}g`} />
                      </div>
                    </div>
                  )}
                  <div className="font-medium mb-1">Ingredientes</div>
                  <ul className="list-disc pl-5 muted">{(r.ingredients ?? []).map((i: any, k: number) => <li key={k}>{typeof i === "string" ? i : `${i.quantity ?? ""} ${i.name ?? ""}`}</li>)}</ul>
                </div>
                <div>
                  <div className="font-medium mb-1">Pasos</div>
                  <ol className="list-decimal pl-5 space-y-1">{(r.steps ?? []).map((s: string, k: number) => <li key={k}>{s}</li>)}</ol>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => addToShopping(r)} className="btn-ghost text-xs"><ShoppingBag className="h-3 w-3" /> A la lista</button>
                  <button onClick={() => remove(r.id)} className="btn-ghost text-xs text-destructive"><Trash2 className="h-3 w-3" /> Eliminar</button>
                </div>
              </div>
            </details>;
          })}
        </div>
      )}
    </div>
  );
}

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-secondary px-1 py-2">
      <div className="font-semibold text-foreground">{value || "—"}</div>
      <div className="muted uppercase tracking-wide text-[9px] mt-0.5">{label}</div>
    </div>
  );
}
