import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_WINDOW_MS = 60_000;
const TICK_MS = 5_000;
const FLUSH_MS = 15_000;

const categoryForPath = (path: string) => {
  if (path === "/app") return "Inicio";
  if (path.startsWith("/app/generar")) return "Generador de recetas";
  if (path.startsWith("/app/mis-recetas")) return "Mis recetas creadas";
  if (path.startsWith("/app/biblioteca")) return "Biblioteca de recetas";
  if (path.startsWith("/app/productos")) return "Salud y Bienestar";
  if (path.startsWith("/app/lista-compra")) return "Lista de compra";
  if (path.startsWith("/app/retos")) return "Retos de 5 días";
  if (path.startsWith("/app/recursos")) return "Vídeos y guías";
  if (path.startsWith("/app/movimiento")) return "Movimiento y ejercicio";
  if (path.startsWith("/app/nutricion")) return "Nutrición deportiva";
  if (path.startsWith("/app/diario")) return "Diario";
  if (path.startsWith("/app/progreso")) return "Mi progreso";
  if (path.startsWith("/app/perfil")) return "Perfil";
  return "Otra sección";
};

const pageLabel = () => {
  const heading = document.querySelector("h1");
  return heading?.textContent?.trim() || document.title || "";
};

const refinedCategory = (path: string, label: string) => {
  if (!path.startsWith("/app/recursos")) return categoryForPath(path);
  const normalized = label.toLowerCase();
  if (normalized.includes("vídeo") || normalized.includes("video")) return "Vídeos";
  if (normalized.includes("guía") || normalized.includes("guia")) return "Guías";
  return "Vídeos y guías";
};

export function useActivityTracking(path: string, enabled: boolean) {
  const lastInteractionRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled || path.startsWith("/app/admin")) return;

    const sessionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    let label = "";
    let activeSeconds = 0;
    let lastTickAt = Date.now();
    let lastFlushedSeconds = -1;

    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    const tick = () => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, Math.min(TICK_MS / 1000, (now - lastTickAt) / 1000));
      lastTickAt = now;
      if (document.visibilityState === "visible" && now - lastInteractionRef.current <= ACTIVE_WINDOW_MS) {
        activeSeconds += Math.round(elapsedSeconds);
      }
    };

    const flush = () => {
      if (activeSeconds === lastFlushedSeconds) return;
      lastFlushedSeconds = activeSeconds;
      label = pageLabel() || label;
      void (supabase as any).rpc("record_user_activity", {
        p_session_id: sessionId,
        p_path: path,
        p_category: refinedCategory(path, label),
        p_label: label,
        p_active_seconds: activeSeconds,
        p_started_at: startedAt,
      });
    };

    const handleVisibility = () => {
      lastTickAt = Date.now();
      if (document.visibilityState === "hidden") flush();
      else markInteraction();
    };

    const interactionEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    interactionEvents.forEach(event => window.addEventListener(event, markInteraction, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);
    markInteraction();
    flush();

    const tickTimer = window.setInterval(tick, TICK_MS);
    const flushTimer = window.setInterval(flush, FLUSH_MS);
    const labelTimer = window.setTimeout(() => {
      label = pageLabel();
      lastFlushedSeconds = -1;
      flush();
    }, 900);

    return () => {
      tick();
      flush();
      window.clearInterval(tickTimer);
      window.clearInterval(flushTimer);
      window.clearTimeout(labelTimer);
      interactionEvents.forEach(event => window.removeEventListener(event, markInteraction));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, path]);
}
