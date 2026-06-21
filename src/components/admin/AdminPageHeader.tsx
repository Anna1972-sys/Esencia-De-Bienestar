import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export default function AdminPageHeader({
  title,
  subtitle,
  backTo = "/app/admin",
  backLabel = "Volver",
  actions,
}: Props) {
  return (
    <div className="mb-6">
      <Link
        to={backTo}
        className="text-sm muted inline-flex items-center gap-1 mb-3 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> {backLabel}
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="heading-lg tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="muted text-sm mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
