const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTable() {
  try {
    console.log('🚀 Creating youtube_analysis_jobs table...\n')

    // Note: We can't execute DDL through Supabase JS client
    // Instead, we'll provide the SQL to run in Supabase dashboard

    console.log('📋 Please run this SQL in your Supabase SQL Editor:')
    console.log('=' .repeat(80))
    console.log(`
-- Create table for tracking YouTube channel analysis jobs
CREATE TABLE IF NOT EXISTS youtube_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_url TEXT NOT NULL,
  channel_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_youtube_jobs_user_id ON youtube_analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_youtube_jobs_status ON youtube_analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_youtube_jobs_created_at ON youtube_analysis_jobs(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_youtube_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS youtube_jobs_updated_at_trigger ON youtube_analysis_jobs;
CREATE TRIGGER youtube_jobs_updated_at_trigger
  BEFORE UPDATE ON youtube_analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_youtube_jobs_updated_at();

-- Enable RLS
ALTER TABLE youtube_analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own jobs
CREATE POLICY youtube_jobs_select_own ON youtube_analysis_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything (needed for API routes)
DROP POLICY IF EXISTS youtube_jobs_service_all ON youtube_analysis_jobs;
CREATE POLICY youtube_jobs_service_all ON youtube_analysis_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
`)
    console.log('=' .repeat(80))
    console.log('\n✅ Copy the SQL above and run it in Supabase Dashboard > SQL Editor')
    console.log('   URL: https://supabase.com/dashboard/project/gyuhljkilispdhetwalj/sql/new')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

createTable()
