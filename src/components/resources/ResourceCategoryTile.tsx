type ResourceCategoryTileProps = {
  image: string;
  title: string;
  subtitle?: string | null;
  badge?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export default function ResourceCategoryTile({
  image,
  title,
  subtitle,
  badge,
  disabled = false,
  onClick,
}: ResourceCategoryTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`wellness-tile app-category-card group overflow-hidden rounded-[28px] p-0 text-center transition-all duration-300 hover:-translate-y-1 ${
        disabled ? "app-category-card--disabled" : ""
      }`}
    >
      <div className="app-photo-cover-frame w-full overflow-hidden bg-black" aria-hidden="true">
        <img
          src={image}
          alt=""
          className="app-photo-cover-image transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="app-category-card__body relative flex min-h-[92px] flex-col items-center justify-center px-3 py-3.5">
        {badge ? <span className="app-category-card__badge">{badge}</span> : null}
        <div className="app-category-card__title font-sans text-base font-bold leading-tight text-foreground">
          {title}
        </div>
        {subtitle ? (
          <p className="app-category-card__subtitle mt-1.5 text-[10.5px] tracking-wide text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </button>
  );
}
