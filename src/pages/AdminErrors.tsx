import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ErrorRow = {
  id: string;
  area: "carga" | "supabase" | "recetas" | "aplicacion";
  action: string;
  message: string;
  user_message: string | null;
  path: string | null;
  technical_detail: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
};

const areaLabel: Record<ErrorRow["area"], string> = {
  carga: "Carga de contenido",
  supabase: "Conexión y datos",
  recetas: "Generador de recetas",
  aplicacion: "Funcionamiento general",
};

const friendlyMessage = (row: ErrorRow) =>
  row.user_message ||
  (row.area === "recetas"
    ? "No se pudo completar una acción del generador de recetas."
    : row.area === "supabase"
      ? "La aplicación no pudo consultar o guardar datos."
      : row.area === "carga"
        ? "Una pantalla no pudo cargar todo su contenido."
        : "Se produjo un problema inesperado en la aplicación.");

export default function AdminErrors() {
  const [items, setItems] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyPending, setOnlyPending] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("app_error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    setItems((data ?? []) as ErrorRow[]);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(
    () => onlyPending ? items.filter(item => !item.resolved_at) : items,
    [items, onlyPending]
  );
  const pendingCount = items.filter(item => !item.resolved_at).length;

  const toggleResolved = async (row: ErrorRow) => {
    const resolvedAt = row.resolved_at ? null : new Date().toISOString();
    const { error } = await (supabase as any)
      .from("app_error_logs")
      .update({ resolved_at: resolvedAt })
      .eq("id", row.id);
    if (error) {
      toast.error("No se pudo actualizar el estado del aviso.");
      return;
    }
    setItems(current => current.map(item => item.id === row.id ? { ...item, resolved_at: resolvedAt } : item));
  };

  return (
    <div className="pb-28">
      <AdminPageHeader
        title="Control de errores"
        subtitle="Problemas recientes explicados de forma sencilla."
        backTo="/app/admin"
      />

      <div className="card-soft p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Estado de la aplicación</div>
            <div className="text-xs muted mt-1">
              {pendingCount ? `${pendingCount} ${pendingCount === 1 ? "aviso pendiente" : "avisos pendientes"}` : "No hay avisos pendientes"}
            </div>
          </div>
          <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </button>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyPending} onChange={event => setOnlyPending(event.target.checked)} />
          Mostrar solo los pendientes
        </label>
      </div>

      {unavailable ? (
        <div className="card-soft p-5 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <div className="mt-3 font-semibold">El registro todavía no está activado</div>
          <p className="mt-1 text-sm muted">Falta aplicar en Supabase la migración del control de errores.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card-soft p-6 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
          <div className="mt-3 font-semibold">Todo está en orden</div>
          <p className="mt-1 text-sm muted">No hay errores recientes que necesiten revisión.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(row => (
            <article key={row.id} className={`card-soft p-4 ${row.resolved_at ? "opacity-65" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary">{areaLabel[row.area]}</div>
                  <h2 className="mt-1 text-sm font-semibold">{friendlyMessage(row)}</h2>
                  <p className="mt-1 text-xs muted">
                    {new Date(row.created_at).toLocaleString("es-ES")} · {row.action}
                  </p>
                </div>
                <button type="button" className="btn-ghost shrink-0 px-3 py-2 text-xs" onClick={() => toggleResolved(row)}>
                  {row.resolved_at ? "Reabrir" : "Marcar revisado"}
                </button>
              </div>
              <details className="mt-3 rounded-xl border border-border/70 bg-white/60 p-3 text-xs">
                <summary className="flex cursor-pointer items-center gap-2 font-medium">
                  <ChevronDown className="h-4 w-4" /> Ver detalle técnico
                </summary>
                <div className="mt-3 space-y-1 break-words muted">
                  <p><strong>Pantalla:</strong> {row.path || "No disponible"}</p>
                  <p><strong>Mensaje:</strong> {row.message}</p>
                  {row.technical_detail && <p><strong>Referencia:</strong> {JSON.stringify(row.technical_detail)}</p>}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
