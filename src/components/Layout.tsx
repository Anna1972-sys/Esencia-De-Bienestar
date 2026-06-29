import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, Sparkles, BookHeart, Package, ShoppingBag, User } from "lucide-react";
import { selectInitialZero } from "@/lib/adminNumberInput";
import type { FocusEvent } from "react";

const items = [
  { to: "/app", icon: Home, label: "Inicio", end: true },
  { to: "/app/generar", icon: Sparkles, label: "Crear" },
  { to: "/app/mis-recetas", icon: BookHeart, label: "Recetas" },
  { to: "/app/productos", icon: Package, label: "Productos" },
  { to: "/app/lista-compra", icon: ShoppingBag, label: "Compra" },
  { to: "/app/perfil", icon: User, label: "Yo" },
];

export default function Layout() {
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith("/app/admin");
  const handleAdminNumberFocus = (event: FocusEvent<HTMLElement>) => {
    if (!isAdminArea) return;
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === "number") {
      selectInitialZero(target);
    }
  };

  return (
    <div className="app-shell relative">
      <main className={`px-5 pt-6 animate-fade-in ${isAdminArea ? "admin-area" : ""}`} onFocusCapture={handleAdminNumberFocus}>
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-5 pt-2 z-40">
        <div className="wellness-bottom-nav backdrop-blur-2xl rounded-full flex items-center justify-around py-2.5 px-2">
          {items.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end as any}
              className={({ isActive }) =>
                `wellness-nav-link ${isActive ? "wellness-nav-link-active scale-105" : ""}`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2.2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
