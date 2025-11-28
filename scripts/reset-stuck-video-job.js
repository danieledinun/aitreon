const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function resetStuckJob() {
  console.log('🔄 Resetting ALL stuck/processing video jobs...')

  // Get all jobs that are stuck in processing status
  const { data: jobs, error: fetchError } = await supabase
    .from('video_processing_jobs')
    .select('*')
    .in('status', ['processing', 'failed'])

  if (fetchError) {
    console.error('❌ Error fetching jobs:', fetchError)
    return
  }

  if (!jobs || jobs.length === 0) {
    console.log('ℹ️  No stuck jobs found')
    return
  }

  console.log(`\n📊 Found ${jobs.length} job(s) to reset:\n`)

  for (const job of jobs) {
    console.log(`   Job ${job.id}:`)
    console.log(`   - Status: ${job.status}`)
    console.log(`   - Progress: ${job.progress}%`)
    console.log(`   - Videos processed: ${job.videos_processed}`)
    console.log(`   - Videos failed: ${job.videos_failed}`)
    console.log(`   - Total videos: ${job.video_ids.length}`)
    console.log('')
  }

  // Reset all jobs to pending
  const { error } = await supabase
    .from('video_processing_jobs')
    .update({
      status: 'pending',
      progress: 0,
      videos_processed: 0,
      videos_failed: 0,
      started_at: null,
      error_message: null,
      result: null,
      metadata: {
        reset: true,
        reset_reason: 'Manual reset to retry with increased timeout',
        reset_at: new Date().toISOString()
      }
    })
    .in('status', ['processing', 'failed'])

  if (error) {
    console.error('❌ Error resetting jobs:', error)
  } else {
    console.log(`✅ Reset ${jobs.length} job(s) to pending status!`)
    console.log('ℹ️  Video processor will pick them up and retry with 5-minute timeout')
  }
}

resetStuckJob()
