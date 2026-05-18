-- Add is_public flag so preloaded textbooks can be searched by all users.
-- Relaxes the owner_xor_guest constraint to allow rows where both owner columns are NULL.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS owner_xor_guest;

ALTER TABLE documents ADD CONSTRAINT owner_xor_guest CHECK (
  is_public = true
  OR (owner_id IS NOT NULL)::int + (guest_session_id IS NOT NULL)::int = 1
);

-- Index so the search WHERE clause can filter public docs efficiently
CREATE INDEX IF NOT EXISTS documents_is_public_idx ON documents (is_public) WHERE is_public = true;
