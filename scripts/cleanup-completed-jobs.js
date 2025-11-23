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

async function cleanupCompletedJobs() {
  console.log('🧹 Cleaning up old completed jobs...')

  // Get all completed jobs older than 24 hours
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { data: oldJobs, error: fetchError } = await supabase
    .from('video_processing_jobs')
    .select('id, creator_id, status, completed_at, videos_processed')
    .eq('status', 'completed')
    .lt('completed_at', oneDayAgo.toISOString())

  if (fetchError) {
    console.error('❌ Error fetching old jobs:', fetchError)
    return
  }

  if (!oldJobs || oldJobs.length === 0) {
    console.log('✅ No old completed jobs to clean up')
    return
  }

  console.log(`📊 Found ${oldJobs.length} old completed job(s) to archive:`)
  oldJobs.forEach(job => {
    console.log(`   - Job ${job.id}: ${job.videos_processed} videos processed`)
  })

  // Delete old completed jobs
  const { error: deleteError } = await supabase
    .from('video_processing_jobs')
    .delete()
    .eq('status', 'completed')
    .lt('completed_at', oneDayAgo.toISOString())

  if (deleteError) {
    console.error('❌ Error deleting old jobs:', deleteError)
    return
  }

  console.log(`✅ Cleaned up ${oldJobs.length} old completed job(s)`)
  console.log('ℹ️  Videos remain in the database - only job records were removed')
}

cleanupCompletedJobs()
