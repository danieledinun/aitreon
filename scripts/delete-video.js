/**
 * Delete video and all its chunks
 */

const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function deleteVideo(videoId) {
  try {
    console.log(`🗑️ Deleting video: ${videoId}`)

    // First delete all chunks
    const { error: chunksError } = await supabase
      .from('content_chunks')
      .delete()
      .eq('video_id', videoId)

    if (chunksError) {
      console.error('❌ Error deleting chunks:', chunksError)
      return false
    }

    console.log('✅ Deleted all content chunks')

    // Then delete the video
    const { error: videoError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)

    if (videoError) {
      console.error('❌ Error deleting video:', videoError)
      return false
    }

    console.log('✅ Deleted video')
    return true

  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

// Command line interface
const videoId = process.argv[2]

if (!videoId) {
  console.error('❌ Please provide a video ID: node delete-video.js VIDEO_ID')
  process.exit(1)
}

deleteVideo(videoId)