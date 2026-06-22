import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

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
      <Link to="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <h1 className="heading-lg mb-3">Mis recetas</h1>
      <input value={q} onChange={e => setQ(e.target.value)} className="field mb-4" placeholder="Buscar…" />
      {loading ? <p className="muted">Cargando…</p> : filtered.length === 0 ? (
        <div className="card-soft p-6 text-center muted">Aún no tienes recetas. Crea una con el generador IA.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <details key={r.id} className="card-soft p-4">
              <summary className="cursor-pointer">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs muted mt-0.5">{r.macros?.protein ?? 0}g prot · {r.macros?.calories ?? 0} kcal · {r.prep_time ?? "—"} min</div>
                  </div>
                  {r.is_high_protein && <span className="chip">Alta proteína</span>}
                </div>
              </summary>
              <div className="text-sm mt-3 space-y-3">
                <p className="muted">{r.description}</p>
                <div>
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
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
