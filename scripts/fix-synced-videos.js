const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixSyncedVideos() {
  console.log('🔧 Fixing synced_at timestamps for processed videos...')

  try {
    // Update all processed videos that don't have synced_at set
    const { data, error } = await supabase
      .from('videos')
      .update({ synced_at: new Date().toISOString() })
      .is('synced_at', null)
      .eq('is_processed', true)
      .select('id, title, youtube_id')

    if (error) {
      console.error('❌ Error updating videos:', error)
      return
    }

    console.log(`✅ Updated ${data.length} videos with synced_at timestamps`)
    data.forEach(video => {
      console.log(`  - ${video.title} (${video.youtube_id})`)
    })

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

fixSyncedVideos()