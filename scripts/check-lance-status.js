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

async function checkLanceStatus() {
  const creatorId = '7dbcb017-5e7e-48e9-a63e-d4c1bde3273b'

  console.log('🔍 Checking Lance\'s current status...\n')

  // Check jobs
  const { data: jobs } = await supabase
    .from('video_processing_jobs')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  console.log('📋 Jobs:', jobs?.length || 0)
  jobs?.forEach(job => {
    console.log(`   - Job ${job.id.substring(0, 8)}: ${job.status}`)
    console.log(`     Videos: ${job.videos_processed}/${job.video_ids?.length}`)
    console.log(`     Progress: ${job.progress}%`)
    console.log(`     Created: ${job.created_at}`)
    if (job.started_at) console.log(`     Started: ${job.started_at}`)
    if (job.completed_at) console.log(`     Completed: ${job.completed_at}`)
    if (job.error_message) console.log(`     Error: ${job.error_message}`)
    console.log()
  })

  // Check videos
  const { count } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', creatorId)

  console.log('🎬 Videos in database:', count)

  // Get actual video details
  const { data: videos } = await supabase
    .from('videos')
    .select('id, youtube_id, title, created_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('\n📹 Recent videos:')
  videos?.forEach((v, i) => {
    console.log(`   ${i + 1}. ${v.title?.substring(0, 50) || 'No title'}`)
    console.log(`      YouTube ID: ${v.youtube_id}`)
    console.log()
  })
}

checkLanceStatus()
