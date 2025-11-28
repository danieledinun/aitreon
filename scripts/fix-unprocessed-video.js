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

async function fixUnprocessedVideo() {
  const videoId = 'cf52e41d-d009-4176-aef4-83619fdb0d6f'
  const youtubeId = '1pEh2UskQvk'

  console.log('🔍 Checking unprocessed video...\n')

  // Check if video has transcript
  const { data: video } = await supabase
    .from('videos')
    .select('id, youtube_id, title, transcript, is_processed')
    .eq('id', videoId)
    .single()

  if (!video) {
    console.error('❌ Video not found')
    return
  }

  console.log('📹 Video:', video.title)
  console.log('   YouTube ID:', video.youtube_id)
  console.log('   Has transcript:', video.transcript ? 'YES' : 'NO')
  console.log('   Is processed:', video.is_processed)

  // Check for content chunks
  const { count: chunkCount } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('video_id', videoId)

  console.log('   Content chunks:', chunkCount || 0)

  if (!video.transcript && chunkCount === 0) {
    console.log('\n⚠️  This video has no transcript or content chunks.')
    console.log('   This likely means transcript extraction failed.')
    console.log('\nOptions:')
    console.log('   1. Delete the video record')
    console.log('   2. Try to fetch the transcript again')
    console.log('   3. Mark as processed to hide from queue')
    console.log('\n🗑️  Deleting the video record (it can be re-synced later)...')

    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)

    if (deleteError) {
      console.error('❌ Error deleting video:', deleteError)
      return
    }

    console.log('✅ Video deleted successfully!')
    console.log('ℹ️  The video can be re-synced from YouTube if needed.')
  } else if (video.transcript && chunkCount === 0) {
    console.log('\n⚠️  Video has transcript but no chunks. Needs chunking.')
    console.log('   This should be handled by the processing pipeline.')
  } else if (chunkCount > 0 && !video.is_processed) {
    console.log('\n✅ Video has chunks but not marked as processed. Fixing...')

    const { error: updateError } = await supabase
      .from('videos')
      .update({ is_processed: true })
      .eq('id', videoId)

    if (updateError) {
      console.error('❌ Error updating video:', updateError)
      return
    }

    console.log('✅ Video marked as processed!')
  }
}

fixUnprocessedVideo()
