UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'princesamora1972@hotmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT 'ca42a68e-62bf-4e70-b3c3-79db8acbfae0', 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = 'ca42a68e-62bf-4e70-b3c3-79db8acbfae0' AND role = 'admin'
);

INSERT INTO public.profiles (id, display_name)
VALUES ('ca42a68e-62bf-4e70-b3c3-79db8acbfae0', 'Admin')
ON CONFLICT (id) DO NOTHING;