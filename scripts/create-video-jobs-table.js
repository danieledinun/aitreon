const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

// Use REST API directly to execute DDL
async function createTable() {
  try {
    console.log('📊 Creating video_processing_jobs table via REST API...\n')

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sql: `
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
        `
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Failed to create table:', error)

      // Alternative: Create via PostgREST schema endpoint
      console.log('\n🔄 Trying alternative method...\n')
      console.log('Please run this in Supabase SQL Editor (https://supabase.com/dashboard/project/gyuhljkilispdhetwalj/sql):\n')
      console.log(`
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

      process.exit(1)
    }

    console.log('✅ Table created successfully!\n')

    // Verify
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase
      .from('video_processing_jobs')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Verification failed:', error)
    } else {
      console.log('✅ Table verified and accessible!')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

createTable()
