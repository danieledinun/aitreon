-- Create video_processing_jobs table for async video processing
CREATE TABLE IF NOT EXISTS video_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  video_ids TEXT[] NOT NULL,  -- Array of YouTube video IDs to process
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  progress INTEGER NOT NULL DEFAULT 0,  -- 0-100
  videos_processed INTEGER DEFAULT 0,  -- Count of successfully processed videos
  videos_failed INTEGER DEFAULT 0,  -- Count of failed videos
  error_message TEXT,
  result JSONB,  -- Final result with summary
  metadata JSONB,  -- Processing metadata and progress details
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for efficient job polling
CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_status_created
  ON video_processing_jobs(status, created_at);

-- Index for creator lookups
CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_creator
  ON video_processing_jobs(creator_id, created_at DESC);

-- Row Level Security
ALTER TABLE video_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own jobs
CREATE POLICY video_processing_jobs_read_own
  ON video_processing_jobs FOR SELECT
  USING (
    creator_id IN (
      SELECT id FROM creators WHERE user_id = auth.uid()
    )
  );

-- Policy: Service role can do everything (for Railway worker)
CREATE POLICY video_processing_jobs_service_all
  ON video_processing_jobs FOR ALL
  USING (auth.role() = 'service_role');
