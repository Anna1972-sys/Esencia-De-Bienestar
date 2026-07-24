import { Link } from "react-router-dom";
import styles from "./WellnessCategoryTile.module.css";

type WellnessCategoryTileProps = {
  image: string;
  title: string;
  subtitle?: string | null;
  scale?: string;
  variant?: "default" | "dark";
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
  to,
  disabled = false,
  onClick,
}: WellnessCategoryTileProps) {
  const className = [
    styles.tile,
    variant === "dark" ? styles.dark : styles.default,
    "group",
    disabled ? styles.disabled : "",
  ].join(" ");

  const content = (
    <>
      <div className={styles.imageWrap}>
        <div className={styles.imageFrame}>
          <img
            src={image}
            alt={title}
            loading="lazy"
            className={[
              styles.image,
              variant === "dark" ? styles.darkImage : "",
              scale,
              "group-hover:scale-105 group-hover:-rotate-2",
            ].join(" ")}
          />
        </div>
      </div>
      <div className={styles.text}>
        <div className={`${styles.title} ${variant === "dark" ? styles.darkTitle : ""}`}>
          {title}
        </div>
        {subtitle ? (
          <p className={`${styles.subtitle} ${variant === "dark" ? styles.darkSubtitle : ""}`}>{subtitle}</p>
        ) : null}
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
