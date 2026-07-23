import { Link } from "react-router-dom";

type WellnessCategoryTileProps = {
  image: string;
  title: string;
  subtitle?: string | null;
  scale?: string;
  variant?: "default" | "dark";
  badge?: string | null;
  to?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export default function WellnessCategoryTile({
  image,
  title,
  subtitle,
  scale = "scale-100",
  variant = "default",
  badge,
  to,
  disabled = false,
  onClick,
}: WellnessCategoryTileProps) {
  const className = `${variant === "dark" ? "wellness-nutrition-tile" : "wellness-tile"} relative w-full appearance-none rounded-[26px] transition-all duration-300 hover:-translate-y-1 group overflow-hidden flex flex-col items-center text-center font-sans ${
    disabled ? "opacity-60 cursor-not-allowed hover:translate-y-0" : ""
  }`;

  const content = (
    <>
      <div className="relative h-[176px] w-full overflow-hidden">
        <div className={`home-card-image-frame ${variant === "dark" ? "home-card-image-frame-dark" : ""}`}>
          <img
            src={image}
            alt={title}
            loading="lazy"
            className={`${variant === "dark" ? "h-full w-full object-cover" : "home-card-image"} ${scale} transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-2`}
          />
        </div>
      </div>
      <div className="home-card-text relative w-full">
        {badge ? <span className="resource-card-badge">{badge}</span> : null}
        <div className={`home-card-title font-sans text-lg font-bold leading-tight ${variant === "dark" ? "text-[#FF2D95]" : "text-foreground"}`}>
          {title}
        </div>
        {subtitle ? <p className="home-card-subtitle line-clamp-2">{subtitle}</p> : null}
      </div>
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}
