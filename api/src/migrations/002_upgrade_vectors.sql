-- Migration 002: upgrade embeddings to 768-dim nomic-embed-text
-- Clears all documents and sentences (original file content not stored, users must re-upload).

DROP INDEX IF EXISTS sentences_embedding_idx;

-- CASCADE removes sentences via FK constraint
DELETE FROM documents;

-- Table is now empty — safe to change dimension
ALTER TABLE sentences ALTER COLUMN embedding TYPE vector(768);

-- Recreate IVFFlat index for new dimension
CREATE INDEX sentences_embedding_idx
  ON sentences USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
