import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type FavoriteContentType = "recipe" | "video" | "guide" | "exercise";

export type FavoriteRow = {
  id: string;
  user_id: string;
  content_type: FavoriteContentType;
  content_id: string;
  created_at: string;
  last_opened_at: string | null;
  open_count: number;
};

type FavoritesContextValue = {
  favorites: FavoriteRow[];
  loading: boolean;
  busyKey: string | null;
  isFavorite: (contentType: FavoriteContentType, contentId: string) => boolean;
  toggleFavorite: (contentType: FavoriteContentType, contentId: string) => Promise<void>;
  markOpened: (contentType: FavoriteContentType, contentId: string) => Promise<void>;
  reload: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const favoriteKey = (contentType: FavoriteContentType, contentId: string) => `${contentType}:${contentId}`;

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_favorites")
      .select("id,user_id,content_type,content_id,created_at,last_opened_at,open_count")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setFavorites((data ?? []) as FavoriteRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const favoriteKeys = useMemo(
    () => new Set(favorites.map(row => favoriteKey(row.content_type, row.content_id))),
    [favorites],
  );

  const isFavorite = useCallback(
    (contentType: FavoriteContentType, contentId: string) => favoriteKeys.has(favoriteKey(contentType, contentId)),
    [favoriteKeys],
  );

  const toggleFavorite = useCallback(async (contentType: FavoriteContentType, contentId: string) => {
    if (!user) return;
    const key = favoriteKey(contentType, contentId);
    if (busyKey === key) return;
    setBusyKey(key);
    const current = favorites.find(row => row.content_type === contentType && row.content_id === contentId);
    if (current) {
      const { error } = await (supabase as any)
        .from("user_favorites")
        .delete()
        .eq("id", current.id)
        .eq("user_id", user.id);
      if (!error) setFavorites(rows => rows.filter(row => row.id !== current.id));
    } else {
      const { data, error } = await (supabase as any)
        .from("user_favorites")
        .insert({ user_id: user.id, content_type: contentType, content_id: contentId })
        .select("id,user_id,content_type,content_id,created_at,last_opened_at,open_count")
        .single();
      if (!error && data) setFavorites(rows => [data as FavoriteRow, ...rows]);
    }
    setBusyKey(null);
  }, [user, busyKey, favorites]);

  const markOpened = useCallback(async (contentType: FavoriteContentType, contentId: string) => {
    await (supabase as any).rpc("mark_favorite_opened", {
      p_content_type: contentType,
      p_content_id: contentId,
    });
    const now = new Date().toISOString();
    setFavorites(rows => rows.map(row => (
      row.content_type === contentType && row.content_id === contentId
        ? { ...row, open_count: row.open_count + 1, last_opened_at: now }
        : row
    )));
  }, []);

  return (
    <FavoritesContext.Provider value={{ favorites, loading, busyKey, isFavorite, toggleFavorite, markOpened, reload }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used within FavoritesProvider");
  return value;
}
