-- ============================================================
-- 038_collections_storage.sql
--
-- Storage bucket for collection product images.
-- Idempotent — safe to run multiple times.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'collection-images',
  'collection-images',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read any collection image
DROP POLICY IF EXISTS "Anyone can view collection images" ON storage.objects;
CREATE POLICY "Anyone can view collection images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'collection-images');

-- Allow agents+ to upload/update/delete collection images
DROP POLICY IF EXISTS "Agents can upload collection images" ON storage.objects;
CREATE POLICY "Agents can upload collection images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'collection-images'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Agents can update collection images" ON storage.objects;
CREATE POLICY "Agents can update collection images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'collection-images'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Agents can delete collection images" ON storage.objects;
CREATE POLICY "Agents can delete collection images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'collection-images'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin', 'agent')
    )
  );
