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

async function resetLanceVideos() {
  console.log('🔄 Resetting Lance\'s videos for reprocessing...')

  const creatorId = '7dbcb017-5e7e-48e9-a63e-d4c1bde3273b'

  // Delete all videos (chunks will cascade delete)
  const { error: deleteError } = await supabase
    .from('videos')
    .delete()
    .eq('creator_id', creatorId)

  if (deleteError) {
    console.error('❌ Error deleting videos:', deleteError)
    return
  }

  console.log('✅ Deleted all videos for Lance')

  // Reset all video processing jobs to pending
  const { error: resetError } = await supabase
    .from('video_processing_jobs')
    .update({
      status: 'pending',
      progress: 0,
      videos_processed: 0,
      videos_failed: 0,
      started_at: null,
      completed_at: null,
      error_message: null,
      result: null,
      metadata: {
        reset: true,
        reset_reason: 'Reprocessing with nullable embeddings to save chunks',
        reset_at: new Date().toISOString()
      }
    })
    .eq('creator_id', creatorId)

  if (resetError) {
    console.error('❌ Error resetting jobs:', resetError)
    return
  }

  console.log('✅ Reset all jobs to pending')
  console.log('ℹ️  Railway will pick up the jobs and reprocess with chunk saving enabled')
}

resetLanceVideos()
