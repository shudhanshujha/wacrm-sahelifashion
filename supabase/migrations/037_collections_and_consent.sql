-- ============================================================
-- 037_collections_and_consent.sql
--
-- Collection Management + Consent Tracking + Opt-out support.
--
-- New tables:
--   collections        — a batch of new-arrival products
--   collection_images  — images within a collection, ordered
--
-- Existing table changes:
--   broadcasts         — optional collection_id FK
--   contacts           — consent_status + consent_source columns
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- COLLECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_account ON collections(account_id);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(account_id, status);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'collections_select' AND tablename = 'collections') THEN
    CREATE POLICY collections_select ON collections FOR SELECT USING (is_account_member(account_id));
    CREATE POLICY collections_insert ON collections FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
    CREATE POLICY collections_update ON collections FOR UPDATE USING (is_account_member(account_id, 'agent'));
    CREATE POLICY collections_delete ON collections FOR DELETE USING (is_account_member(account_id, 'agent'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_updated_at ON collections;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COLLECTION IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS collection_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_images_collection ON collection_images(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_images_order ON collection_images(collection_id, sort_order);

ALTER TABLE collection_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'collection_images_select' AND tablename = 'collection_images') THEN
    CREATE POLICY collection_images_select ON collection_images FOR SELECT USING (
      EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_images.collection_id AND is_account_member(c.account_id))
    );
    CREATE POLICY collection_images_insert ON collection_images FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_images.collection_id AND is_account_member(c.account_id, 'agent'))
    );
    CREATE POLICY collection_images_update ON collection_images FOR UPDATE USING (
      EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_images.collection_id AND is_account_member(c.account_id, 'agent'))
    );
    CREATE POLICY collection_images_delete ON collection_images FOR DELETE USING (
      EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_images.collection_id AND is_account_member(c.account_id, 'agent'))
    );
  END IF;
END $$;

-- ============================================================
-- BROADCASTS — link to collection
-- ============================================================
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_broadcasts_collection ON broadcasts(collection_id) WHERE collection_id IS NOT NULL;

-- Add opted_out_count to broadcasts for opt-out tracking
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS opted_out_count INTEGER DEFAULT 0;

-- ============================================================
-- CONTACTS — consent tracking
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'not_confirmed'
    CHECK (consent_status IN ('opted_in', 'not_confirmed', 'opted_out')),
  ADD COLUMN IF NOT EXISTS consent_source TEXT,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_consent ON contacts(account_id, consent_status);

-- ============================================================
-- Realtime for collections
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'collections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE collections;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'collection_images'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE collection_images;
  END IF;
END $$;
