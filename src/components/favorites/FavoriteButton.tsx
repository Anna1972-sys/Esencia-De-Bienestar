import { Heart } from "lucide-react";
import { useFavorites, type FavoriteContentType } from "@/contexts/FavoritesContext";

export default function FavoriteButton({
  contentType,
  contentId,
  className = "",
}: {
  contentType: FavoriteContentType;
  contentId: string;
  className?: string;
}) {
  const { isFavorite, toggleFavorite, busyKey } = useFavorites();
  const saved = isFavorite(contentType, contentId);
  const busy = busyKey === `${contentType}:${contentId}`;

  return (
    <button
      type="button"
      disabled={busy}
      className={`favorite-heart-button ${saved ? "favorite-heart-button-saved" : ""} ${className}`}
      aria-label={saved ? "Eliminar de Mis favoritos" : "Guardar en Mis favoritos"}
      title={saved ? "Eliminar de Mis favoritos" : "Guardar en Mis favoritos"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggleFavorite(contentType, contentId);
      }}
    >
      <Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
