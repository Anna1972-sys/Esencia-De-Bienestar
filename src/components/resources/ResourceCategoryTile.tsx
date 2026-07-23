import WellnessCategoryTile from "@/components/WellnessCategoryTile";

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
    <WellnessCategoryTile
      onClick={onClick}
      disabled={disabled}
      image={image}
      title={title}
      subtitle={subtitle}
      badge={badge}
    />
  );
}
