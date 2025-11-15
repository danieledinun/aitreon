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
  }
})

// The first 5 video IDs from the completed job (pre-selected during onboarding)
const videoIds = [
  'BFpadeBoJLs',
  'sAKpU0Mmqq8',
  '2r9tqPoyq3U',
  'ULIHvL9pOYY',
  '6n6yqaTKIIg'
]

async function processVideos() {
  try {
    console.log('🎬 Processing Lance Hedrick videos...\n')

    // Get creator ID
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('username', 'lance_hedrick')
      .single()

    if (!creator) {
      console.error('❌ Creator not found')
      process.exit(1)
    }

    console.log(`✅ Found creator: ${creator.id}`)
    console.log(`📹 Processing ${videoIds.length} videos...\n`)

    // Make a POST request to the youtube sync API (no auth required)
    const baseUrl = process.env.VERCEL_URL || 'https://aitreon.vercel.app'

    const response = await fetch(`${baseUrl}/api/youtube/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoIds: videoIds,
        creatorId: creator.id
      })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Video processing completed successfully!')
      console.log('Result:', JSON.stringify(result, null, 2))
    } else {
      console.error('❌ Failed to process videos:', result)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

processVideos()
