const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: { schema: 'public' }
})

async function applyMigration() {
  try {
    console.log('📊 Creating video_processing_jobs table...\n')

    // First, check if table already exists
    const { data: existingCheck, error: checkError } = await supabase
      .from('video_processing_jobs')
      .select('id')
      .limit(1)

    if (!checkError) {
      console.log('✅ Table already exists!')
      return
    }

    console.log('Table doesn\'t exist, need to create it via Supabase Dashboard SQL Editor')
    console.log('\n📝 Please run this SQL in Supabase Dashboard > SQL Editor:\n')
    console.log(`
-- Create video_processing_jobs table for async video processing
CREATE TABLE IF NOT EXISTS video_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  video_ids TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  videos_processed INTEGER DEFAULT 0,
  videos_failed INTEGER DEFAULT 0,
  error_message TEXT,
  result JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_status_created
  ON video_processing_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_creator
  ON video_processing_jobs(creator_id, created_at DESC);

ALTER TABLE video_processing_jobs ENABLE ROW LEVEL SECURITY;
    `)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

applyMigration()
