import { Outlet, NavLink } from "react-router-dom";
import { Home, Sparkles, BookHeart, ShoppingBag, User } from "lucide-react";

const items = [
  { to: "/app", icon: Home, label: "Inicio", end: true },
  { to: "/app/generar", icon: Sparkles, label: "Crear" },
  { to: "/app/mis-recetas", icon: BookHeart, label: "Recetas" },
  { to: "/app/lista-compra", icon: ShoppingBag, label: "Compra" },
  { to: "/app/perfil", icon: User, label: "Yo" },
];

export default function Layout() {
  return (
    <div className="app-shell relative">
      <main className="px-5 pt-6 animate-fade-in">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-5 pt-2 z-40">
        <div
          className="backdrop-blur-2xl border border-white/70 rounded-full flex items-center justify-around py-2.5 px-2 ring-1 ring-primary/10"
          style={{
            background: "linear-gradient(135deg, hsl(0 0% 100% / 0.92), hsl(320 60% 97% / 0.92))",
            boxShadow: "0 18px 50px -12px hsl(310 60% 40% / 0.30), 0 4px 16px -4px hsl(320 50% 50% / 0.18)",
          }}
        >
          {items.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end as any}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3.5 py-2 rounded-full text-[10px] font-semibold tracking-wide transition-all duration-300 ${
                  isActive ? "text-primary-foreground scale-105" : "text-foreground/60 hover:text-foreground"
                }`
              }
              style={({ isActive }) => isActive ? {
                backgroundImage: "var(--gradient-primary)",
                boxShadow: "0 10px 22px -6px hsl(320 75% 50% / 0.55)",
              } : undefined}
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
