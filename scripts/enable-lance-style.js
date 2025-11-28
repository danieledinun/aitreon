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

async function enableLanceStyle() {
  const creatorId = '7dbcb017-5e7e-48e9-a63e-d4c1bde3273b'

  console.log('🎨 Enabling AI Style for Lance Hedrick...\n')

  const { data, error } = await supabase
    .from('ai_config')
    .update({
      style_enabled: true,
      updated_at: new Date().toISOString()
    })
    .eq('creator_id', creatorId)
    .select()

  if (error) {
    console.error('❌ Error enabling style:', error)
    return
  }

  console.log('✅ Style enabled successfully!')
  console.log('\n📊 AI Config Status:')
  console.log('   • style_enabled:', data[0].style_enabled)
  console.log('   • Has style_profile:', data[0].style_profile ? 'YES' : 'NO')
  console.log('   • Has style_card:', data[0].style_card ? 'YES' : 'NO')
  console.log('   • Updated at:', data[0].updated_at)
}

enableLanceStyle()
