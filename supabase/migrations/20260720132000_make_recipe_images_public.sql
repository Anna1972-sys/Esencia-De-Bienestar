INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Recipe images viewable by authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Recipe images viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Recipe images public read" ON storage.objects;

CREATE POLICY "Recipe images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');
