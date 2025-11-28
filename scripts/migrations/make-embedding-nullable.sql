-- Make embedding column nullable to allow async embedding generation
-- This allows chunks to be created immediately during video processing
-- and embeddings to be generated later as a background job

ALTER TABLE content_chunks
ALTER COLUMN embedding DROP NOT NULL;

-- Add index for chunks without embeddings so we can easily find them
CREATE INDEX IF NOT EXISTS idx_content_chunks_no_embedding
ON content_chunks(created_at)
WHERE embedding IS NULL;

-- Comment explaining the design
COMMENT ON COLUMN content_chunks.embedding IS
'Vector embedding for semantic search. Can be NULL initially and populated asynchronously after chunk creation.';
