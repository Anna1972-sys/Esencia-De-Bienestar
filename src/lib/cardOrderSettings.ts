import type { SupabaseClient } from "@supabase/supabase-js";

type CardOrderSetting = "home_card_order" | "admin_card_order";

const STORAGE_PREFIX = "esencia.cardOrder.";

function readLocalOrder(key: CardOrderSetting) {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${key}`) || "null");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : null;
  } catch {
    return null;
  }
}

function writeLocalOrder(key: CardOrderSetting, order: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(order));
}

export function orderCards<T extends { key: string }>(items: T[], order?: string[] | null) {
  if (!order?.length) return items;
  const byKey = new Map(items.map(item => [item.key, item]));
  const ordered = order.map(key => byKey.get(key)).filter(Boolean) as T[];
  const used = new Set(ordered.map(item => item.key));
  return [...ordered, ...items.filter(item => !used.has(item.key))];
}

export function moveCardKey(order: string[], key: string, direction: -1 | 1) {
  const index = order.indexOf(key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export async function loadCardOrder(settingKey: CardOrderSetting, defaultOrder: string[], supabase?: SupabaseClient) {
  if (supabase) {
    try {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select(settingKey)
        .eq("id", true)
        .maybeSingle();

      const remoteOrder = data?.[settingKey];
      if (!error && Array.isArray(remoteOrder)) {
        const cleanOrder = remoteOrder.map(String).filter(Boolean);
        writeLocalOrder(settingKey, cleanOrder);
        return cleanOrder.length ? cleanOrder : defaultOrder;
      }
    } catch {
      // Si la columna aún no existe, usamos el respaldo local.
    }
  }

  return readLocalOrder(settingKey) ?? defaultOrder;
}

export async function saveCardOrder(settingKey: CardOrderSetting, order: string[], supabase?: SupabaseClient) {
  const cleanOrder = order.map(String).filter(Boolean);
  writeLocalOrder(settingKey, cleanOrder);

  if (!supabase) return { savedRemotely: false, order: cleanOrder };

  try {
    const { error } = await (supabase as any)
      .from("app_settings")
      .update({ [settingKey]: cleanOrder, updated_at: new Date().toISOString() })
      .eq("id", true);
    return { savedRemotely: !error, order: cleanOrder, error };
  } catch (error) {
    return { savedRemotely: false, order: cleanOrder, error };
  }
}
