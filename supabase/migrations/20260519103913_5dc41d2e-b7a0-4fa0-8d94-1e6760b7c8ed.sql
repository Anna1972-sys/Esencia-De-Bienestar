
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'client');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'used', 'expired');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Invitations
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Recipes
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  servings INTEGER DEFAULT 1,
  prep_time INTEGER,
  macros JSONB DEFAULT '{}'::jsonb,
  ingredients JSONB DEFAULT '[]'::jsonb,
  steps JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  is_library BOOLEAN NOT NULL DEFAULT false,
  is_high_protein BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Saved recipes
CREATE TABLE public.saved_recipes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);
ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;

-- Shopping list
CREATE TABLE public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  category TEXT DEFAULT 'Otros',
  checked BOOLEAN NOT NULL DEFAULT false,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- Challenges
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.challenge_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id, day)
);
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

-- Resources
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'video',
  url TEXT,
  category TEXT,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Meal plans
CREATE TABLE public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  recipes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- invitations: only admin manages; public token validation done via edge function
CREATE POLICY "invitations_admin_all" ON public.invitations FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- recipes
CREATE POLICY "recipes_own" ON public.recipes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_library_read" ON public.recipes FOR SELECT USING (is_library = true AND auth.role() = 'authenticated');
CREATE POLICY "recipes_admin_all" ON public.recipes FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- saved recipes
CREATE POLICY "saved_own" ON public.saved_recipes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- shopping list
CREATE POLICY "shopping_own" ON public.shopping_list_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- challenges (readable by all authenticated)
CREATE POLICY "challenges_read" ON public.challenges FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "challenges_admin" ON public.challenges FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- challenge progress
CREATE POLICY "progress_own" ON public.challenge_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- resources
CREATE POLICY "resources_read" ON public.resources FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "resources_admin" ON public.resources FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- meal plans
CREATE POLICY "mealplans_own" ON public.meal_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Profile auto-create trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed sample challenge
INSERT INTO public.challenges (title, description, days) VALUES
('Reto 5 días — Energía rosa', 'Cinco días para activar tu energía: hidratación, proteína y movimiento.', '[
  {"day":1,"title":"Hidratación consciente","tasks":["Bebe 2L de agua","Empieza el día con limón tibio","Camina 20 min"]},
  {"day":2,"title":"Proteína en cada comida","tasks":["Desayuno con 25g proteína","Comida con proteína magra","Snack proteico"]},
  {"day":3,"title":"Movimiento suave","tasks":["20 min yoga o pilates","Estira al despertar","Camina después de comer"]},
  {"day":4,"title":"Plato consciente","tasks":["1/2 plato verduras","1/4 proteína","1/4 carbohidrato bueno"]},
  {"day":5,"title":"Descanso reparador","tasks":["Apaga pantallas 1h antes","Té relajante","Diario de gratitud"]}
]'::jsonb);
