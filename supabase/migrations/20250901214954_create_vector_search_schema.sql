-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the content_chunks table for vector search
CREATE TABLE IF NOT EXISTS content_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    video_title TEXT NOT NULL,
    video_url TEXT NOT NULL,
    content TEXT NOT NULL,
    start_time FLOAT,
    end_time FLOAT,
    chunk_index INTEGER NOT NULL,
    embedding vector(1536) NOT NULL, -- OpenAI text-embedding-ada-002 dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique chunks per creator/video
    UNIQUE(creator_id, video_id, chunk_index)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_content_chunks_creator_id ON content_chunks(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_chunks_video_id ON content_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_content_chunks_created_at ON content_chunks(created_at);

-- Create vector similarity index using HNSW algorithm for efficient similarity search
CREATE INDEX IF NOT EXISTS idx_content_chunks_embedding ON content_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

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

-- Enable Row Level Security (RLS) for production use
ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;

-- RLS policy to allow users to access content from their own creators
CREATE POLICY "Users can access content from their creators" ON content_chunks
FOR ALL USING (
  creator_id IN (
    SELECT c.id FROM creators c 
    WHERE c.user_id = auth.uid()
  )
);

-- RLS policy for service role (full access for migrations and system operations)
CREATE POLICY "Service role has full access" ON content_chunks
FOR ALL TO service_role USING (true);

-- Update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_chunks_updated_at 
    BEFORE UPDATE ON content_chunks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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