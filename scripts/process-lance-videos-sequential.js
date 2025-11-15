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

async function processVideoSequential(creatorId, videoId, index, total) {
  try {
    console.log(`\n📹 [${index + 1}/${total}] Processing video: ${videoId}`)

    const baseUrl = process.env.VERCEL_URL || 'https://aitreon.vercel.app'

    const response = await fetch(`${baseUrl}/api/youtube/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoIds: [videoId],  // Process ONE video at a time
        creatorId: creatorId
      })
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`✅ [${index + 1}/${total}] Video ${videoId} processed successfully`)
      console.log(`   New videos: ${result.data?.sync?.newVideos || 0}, Processed: ${result.data?.sync?.processedVideos || 0}`)
      return true
    } else {
      const error = await response.json()
      console.error(`❌ [${index + 1}/${total}] Failed to process ${videoId}:`, error)
      return false
    }
  } catch (error) {
    console.error(`❌ [${index + 1}/${total}] Error processing ${videoId}:`, error.message)
    return false
  }
}

async function processAllVideos() {
  try {
    console.log('🎬 Processing Lance Hedrick videos sequentially...\n')

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
    console.log(`📹 Processing ${videoIds.length} videos sequentially...\n`)

    let successCount = 0
    let failCount = 0

    // Process each video one at a time
    for (let i = 0; i < videoIds.length; i++) {
      const success = await processVideoSequential(creator.id, videoIds[i], i, videoIds.length)
      if (success) {
        successCount++
      } else {
        failCount++
      }

      // Small delay between videos
      if (i < videoIds.length - 1) {
        console.log('   ⏳ Waiting 2 seconds before next video...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`\n✅ Processing complete!`)
    console.log(`   Success: ${successCount}/${videoIds.length}`)
    console.log(`   Failed: ${failCount}/${videoIds.length}`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

processAllVideos()
