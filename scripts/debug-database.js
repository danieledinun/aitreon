const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugDatabase() {
  console.log('🔍 Debugging database content...')
  
  try {
    // Check users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', '%danieledinunzioyt%')
    
    console.log('📧 Users with danieledinunzioyt email:', users?.length || 0)
    if (users && users.length > 0) {
      console.log('   User:', users[0].email, '| ID:', users[0].id)
    }

    // Check creators
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select('*')
    
    console.log('🎭 Total creators:', creators?.length || 0)
    creators?.forEach(creator => {
      console.log(`   Creator: ${creator.display_name} (${creator.username}) | User ID: ${creator.user_id}`)
    })

    // Check videos
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('*')
    
    console.log('🎬 Total videos:', videos?.length || 0)
    videos?.forEach(video => {
      console.log(`   Video: ${video.title} | Creator ID: ${video.creator_id} | YouTube ID: ${video.youtube_id}`)
    })

    // Check content chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('content_chunks')
      .select('*')
    
    console.log('📝 Total content chunks:', chunks?.length || 0)

    // Check specific Air Fryer Geek data
    if (creators && creators.length > 0) {
      const airFryerCreator = creators.find(c => c.username === 'theairfryergeekhg04')
      if (airFryerCreator) {
        console.log('🔥 Air Fryer Geek creator found!')
        
        const { data: airFryerVideos } = await supabase
          .from('videos')
          .select('*')
          .eq('creator_id', airFryerCreator.id)
        
        console.log(`   Air Fryer Geek videos: ${airFryerVideos?.length || 0}`)
        airFryerVideos?.forEach(video => {
          console.log(`     - ${video.title} (${video.youtube_id})`)
        })
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugDatabase()