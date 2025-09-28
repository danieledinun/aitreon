// Quick script to fix creator session mapping
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyuhljkilispdhetwalj.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dWhsamtpbGlzcGRoZXR3YWxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA3MzgyNiwiZXhwIjoyMDcxNjQ5ODI2fQ.Ys_bhwzEeAxRjMteMM2GKff1ikspaoYr5RQRlZJzmg4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixCreatorSession() {
  console.log('🔧 Fixing creator session mapping...')

  // Current session user ID
  const currentUserId = '673a1669-0cbc-4793-8112-79f64201f2d4'

  // Real tanner creator ID
  const realCreatorId = '5864ded5-edfa-4e63-b131-582fe844fa43'

  try {
    // Update the real creator to point to current user
    const { data, error } = await supabase
      .from('creators')
      .update({ user_id: currentUserId })
      .eq('id', realCreatorId)
      .select()

    if (error) {
      console.error('❌ Error updating creator:', error)
      return
    }

    console.log('✅ Successfully linked creator to current session:', data)

    // Verify the update
    const { data: verifyData } = await supabase
      .from('creators')
      .select('id, username, user_id, youtube_channel_url')
      .eq('id', realCreatorId)
      .single()

    console.log('🔍 Verification - Creator data:', verifyData)

    console.log('🎉 Session fix complete! Now refresh the browser and the session should point to the correct creator.')

  } catch (err) {
    console.error('❌ Script error:', err)
  }
}

fixCreatorSession()