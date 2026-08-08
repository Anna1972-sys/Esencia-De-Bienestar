import { useEffect, useId, useState, type ReactNode } from "react";
import { ArrowDown, Plus } from "lucide-react";

export default function ProductAccordion({
  title,
  subtitle,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = "",
  indicator = "arrow",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  indicator?: "arrow" | "plus";
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const [renderBody, setRenderBody] = useState(open);
  const [expandedBody, setExpandedBody] = useState(open);
  const accordionId = useId();
  const triggerId = `${accordionId}-trigger`;
  const bodyId = `${accordionId}-body`;

  useEffect(() => {
    let animationFrame: number | undefined;
    let unmountTimer: number | undefined;

    if (open) {
      setRenderBody(true);
      animationFrame = window.requestAnimationFrame(() => setExpandedBody(true));
    } else {
      setExpandedBody(false);
      unmountTimer = window.setTimeout(() => setRenderBody(false), 240);
    }

    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      if (unmountTimer !== undefined) window.clearTimeout(unmountTimer);
    };
  }, [open]);

  const toggleOpen = () => {
    if (onOpenChange) onOpenChange(!open);
    else setUncontrolledOpen(current => !current);
  };

  return (
    <section className={`card-soft admin-products-panel admin-products-accordion ${className}`} data-accordion-section={title}>
      <button id={triggerId} type="button" className="admin-products-accordion-trigger" onClick={toggleOpen} aria-expanded={open} aria-controls={bodyId}>
        <span>
          <span className="admin-products-accordion-title">{title}</span>
          {subtitle && <span className="admin-products-accordion-subtitle">{subtitle}</span>}
        </span>
        {indicator === "plus" ? (
          <Plus className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`} aria-hidden="true" />
        ) : (
          <ArrowDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        )}
      </button>
      {renderBody && (
        <div id={bodyId} className={`admin-products-accordion-content ${expandedBody ? "is-open" : ""}`} role="region" aria-labelledby={triggerId} aria-hidden={!open}>
          <div className="admin-products-accordion-body">{children}</div>
        </div>
      )}
    </section>
  );
}
