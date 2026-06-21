import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Invite from "@/pages/Invite";
import ResetPassword from "@/pages/ResetPassword";
import Home from "@/pages/Home";
import RecipeGenerator from "@/pages/RecipeGenerator";
import SavedRecipes from "@/pages/SavedRecipes";
import Library from "@/pages/Library";
import RecipeDetail from "@/pages/RecipeDetail";
import ShoppingList from "@/pages/ShoppingList";
import Challenges from "@/pages/Challenges";
import ChallengeDetail from "@/pages/ChallengeDetail";
import ChallengeDay from "@/pages/ChallengeDay";
import ChallengeExtra from "@/pages/ChallengeExtra";
import Resources from "@/pages/Resources";
import ResourceDetail from "@/pages/ResourceDetail";
import Profile from "@/pages/Profile";
import Wellness from "@/pages/Wellness";
import WellnessProgress from "@/pages/WellnessProgress";
import AdminInvites from "@/pages/AdminInvites";
import Admin from "@/pages/Admin";
import AdminRecipes from "@/pages/AdminRecipes";
import AdminUserRecipes from "@/pages/AdminUserRecipes";
import AdminResources from "@/pages/AdminResources";
import AdminResourceCategories from "@/pages/AdminResourceCategories";
import AdminMovement from "@/pages/AdminMovement";
import Movement from "@/pages/Movement";
import MovementDetail from "@/pages/MovementDetail";
import AdminNutrition from "@/pages/AdminNutrition";
import Nutrition from "@/pages/Nutrition";
import NutritionDetail from "@/pages/NutritionDetail";
import AdminChallenges from "@/pages/AdminChallenges";
import AdminUsers from "@/pages/AdminUsers";
import AdminUserTracking from "@/pages/AdminUserTracking";
import AdminSettings from "@/pages/AdminSettings";
import AdminShopping from "@/pages/AdminShopping";
import AdminDiary from "@/pages/AdminDiary";
import AdminProgress from "@/pages/AdminProgress";
import NotFound from "@/pages/NotFound";

const qc = new QueryClient();

function Protected({ children }: { children: JSX.Element }) {
  const { user, session, loading } = useAuth();
  const loc = useLocation();
  // eslint-disable-next-line no-console
  console.log("[Protected]", { pathname: loc.pathname, loading, hasUser: !!user, hasSession: !!session });
  if (loading) return <div className="min-h-[100dvh] grid place-items-center muted">Cargando…</div>;
  if (!user) {
    // eslint-disable-next-line no-console
    console.warn("[Protected] redirect → /login because user is null", { pathname: loc.pathname });
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  return children;
}

function AdminOnly({ children }: { children: JSX.Element }) {
  const { isAdmin, loading, user } = useAuth();
  // eslint-disable-next-line no-console
  console.log("[AdminOnly]", { loading, isAdmin, hasUser: !!user });
  if (loading) return <div className="min-h-[100dvh] grid place-items-center muted">Cargando…</div>;
  if (!isAdmin) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/invite/:token" element={<Invite />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/app" element={<Protected><Layout /></Protected>}>
              <Route index element={<Home />} />
              <Route path="generar" element={<RecipeGenerator />} />
              <Route path="mis-recetas" element={<SavedRecipes />} />
              <Route path="biblioteca" element={<Library />} />
              <Route path="biblioteca/:id" element={<RecipeDetail />} />
              <Route path="lista-compra" element={<ShoppingList />} />
              <Route path="retos" element={<Challenges />} />
              <Route path="retos/:id" element={<ChallengeDetail />} />
              <Route path="retos/:id/dia/:day" element={<ChallengeDay />} />
              <Route path="retos/:id/extra/:key" element={<ChallengeExtra />} />
              <Route path="recursos" element={<Resources />} />
              <Route path="recursos/:id" element={<ResourceDetail />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="diario" element={<Wellness />} />
              <Route path="progreso" element={<WellnessProgress />} />
              <Route path="movimiento" element={<Movement />} />
              <Route path="movimiento/:id" element={<MovementDetail />} />
              <Route path="nutricion" element={<Nutrition />} />
              <Route path="nutricion/:id" element={<NutritionDetail />} />
              <Route path="admin" element={<AdminOnly><Admin /></AdminOnly>} />
              <Route path="admin/invitaciones" element={<AdminOnly><AdminInvites /></AdminOnly>} />
              <Route path="admin/recetas" element={<AdminOnly><AdminRecipes /></AdminOnly>} />
              <Route path="admin/recetas-usuarias" element={<AdminOnly><AdminUserRecipes /></AdminOnly>} />
              <Route path="admin/recursos" element={<AdminOnly><AdminResources /></AdminOnly>} />
              <Route path="admin/recursos/categorias" element={<AdminOnly><AdminResourceCategories /></AdminOnly>} />
              <Route path="admin/movimiento" element={<AdminOnly><AdminMovement /></AdminOnly>} />
              <Route path="admin/nutricion" element={<AdminOnly><AdminNutrition /></AdminOnly>} />
              <Route path="admin/retos" element={<AdminOnly><AdminChallenges /></AdminOnly>} />
              
              <Route path="admin/usuarios" element={<AdminOnly><AdminUsers /></AdminOnly>} />
              <Route path="admin/seguimiento" element={<AdminOnly><AdminUserTracking /></AdminOnly>} />
              <Route path="admin/seguimiento/:userId" element={<AdminOnly><AdminUserTracking /></AdminOnly>} />
              <Route path="admin/configuracion" element={<AdminOnly><AdminSettings /></AdminOnly>} />
              <Route path="admin/lista-compra" element={<AdminOnly><AdminShopping /></AdminOnly>} />
              <Route path="admin/diario" element={<AdminOnly><AdminDiary /></AdminOnly>} />
              <Route path="admin/progreso" element={<AdminOnly><AdminProgress /></AdminOnly>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
