-- Supabase Vector Search Functions
-- These functions handle semantic search operations using pgvector

-- Function to search content chunks by semantic similarity
CREATE OR REPLACE FUNCTION search_content_chunks(
  query_embedding vector(1536),
  target_creator_id text,
  similarity_threshold float DEFAULT 0.7,
  result_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  video_id text,
  video_title text,
  video_url text,
  content text,
  start_time float,
  end_time float,
  chunk_index integer,
  metadata jsonb,
  similarity_score float
) 
LANGUAGE sql STABLE
AS $$
  SELECT 
    cc.id,
    cc.video_id,
    cc.video_title,
    cc.video_url,
    cc.content,
    cc.start_time,
    cc.end_time,
    cc.chunk_index,
    cc.metadata,
    (1 - (cc.embedding <=> query_embedding)) AS similarity_score
  FROM content_chunks cc
  WHERE cc.creator_id = target_creator_id
    AND (1 - (cc.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT result_limit;
$$;

-- Function to get creator vector database statistics
CREATE OR REPLACE FUNCTION get_creator_vector_stats(
  target_creator_id text
)
RETURNS TABLE (
  total_chunks bigint,
  total_videos bigint,
  last_updated timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    COUNT(*) as total_chunks,
    COUNT(DISTINCT video_id) as total_videos,
    MAX(updated_at) as last_updated
  FROM content_chunks
  WHERE creator_id = target_creator_id;
$$;

-- Function to find similar content chunks (for content discovery)
CREATE OR REPLACE FUNCTION find_similar_chunks(
  source_chunk_id uuid,
  similarity_threshold float DEFAULT 0.8,
  result_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  video_title text,
  content text,
  similarity_score float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    cc.id,
    cc.video_title,
    cc.content,
    (1 - (cc.embedding <=> source.embedding)) AS similarity_score
  FROM content_chunks cc
  CROSS JOIN content_chunks source
  WHERE source.id = source_chunk_id
    AND cc.id != source_chunk_id
    AND cc.creator_id = source.creator_id
    AND (1 - (cc.embedding <=> source.embedding)) >= similarity_threshold
  ORDER BY cc.embedding <=> source.embedding
  LIMIT result_limit;
$$;

-- Function to search across multiple creators (for platform-wide search)
CREATE OR REPLACE FUNCTION search_content_global(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.75,
  result_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  creator_id text,
  video_id text,
  video_title text,
  video_url text,
  content text,
  similarity_score float,
  metadata jsonb
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    cc.id,
    cc.creator_id,
    cc.video_id,
    cc.video_title,
    cc.video_url,
    cc.content,
    (1 - (cc.embedding <=> query_embedding)) AS similarity_score,
    cc.metadata
  FROM content_chunks cc
  WHERE (1 - (cc.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT result_limit;
$$;

-- Function to execute arbitrary SQL (for database initialization)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Function to batch upsert content chunks (for efficient sync operations)
CREATE OR REPLACE FUNCTION upsert_content_chunks(
  chunks_data jsonb
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  chunk_record record;
  inserted_count integer := 0;
BEGIN
  FOR chunk_record IN 
    SELECT * FROM jsonb_to_recordset(chunks_data) AS x(
      creator_id text,
      video_id text,
      video_title text,
      video_url text,
      content text,
      start_time float,
      end_time float,
      chunk_index integer,
      embedding vector(1536),
      metadata jsonb
    )
  LOOP
    INSERT INTO content_chunks (
      creator_id, video_id, video_title, video_url, content,
      start_time, end_time, chunk_index, embedding, metadata
    ) VALUES (
      chunk_record.creator_id,
      chunk_record.video_id,
      chunk_record.video_title,
      chunk_record.video_url,
      chunk_record.content,
      chunk_record.start_time,
      chunk_record.end_time,
      chunk_record.chunk_index,
      chunk_record.embedding,
      chunk_record.metadata
    )
    ON CONFLICT (creator_id, video_id, chunk_index) 
    DO UPDATE SET
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      updated_at = now();
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$$;

-- Function to clean up chunks for a specific video (for re-processing)
CREATE OR REPLACE FUNCTION delete_video_chunks(
  target_creator_id text,
  target_video_id text
)
RETURNS integer
LANGUAGE sql
AS $$
  DELETE FROM content_chunks 
  WHERE creator_id = target_creator_id 
    AND video_id = target_video_id;
  
  SELECT COALESCE(ROW_COUNT(), 0);
$$;

-- Create materialized view for content discovery and analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_content_summary AS
SELECT 
  creator_id,
  COUNT(*) as total_chunks,
  COUNT(DISTINCT video_id) as total_videos,
  AVG(COALESCE(end_time - start_time, 0)) as avg_chunk_duration,
  MAX(created_at) as last_content_added,
  -- Top keywords from metadata (if available)
  jsonb_agg(DISTINCT metadata->'keywords') FILTER (WHERE metadata->'keywords' IS NOT NULL) as all_keywords
FROM content_chunks
GROUP BY creator_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_content_summary_creator_id 
ON creator_content_summary(creator_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_creator_content_summary()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY creator_content_summary;
$$;

-- Set up automatic refresh of materialized view (optional - can be called manually)
-- CREATE OR REPLACE FUNCTION auto_refresh_content_summary()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   -- Refresh the materialized view when chunks are added/updated
--   PERFORM refresh_creator_content_summary();
--   RETURN NULL;
-- END;
-- $$;

-- Trigger for automatic refresh (commented out for performance - use manual refresh)
-- CREATE TRIGGER trigger_refresh_content_summary
--   AFTER INSERT OR UPDATE OR DELETE ON content_chunks
--   FOR EACH STATEMENT
--   EXECUTE FUNCTION auto_refresh_content_summary();