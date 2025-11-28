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

async function deleteBadJob() {
  console.log('🗑️  Deleting bad video processing job...')

  const { error } = await supabase
    .from('video_processing_jobs')
    .delete()
    .eq('id', 'b0523190-4235-4eb2-bea4-f50e5974a3a1')

  if (error) {
    console.error('❌ Error:', error)
  } else {
    console.log('✅ Bad job deleted successfully!')
    console.log('ℹ️  Recovery system will create a new job with correct video IDs on next check')
  }
}

deleteBadJob()
