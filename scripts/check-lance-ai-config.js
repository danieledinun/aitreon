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

async function checkLanceAiConfig() {
  const creatorId = '7dbcb017-5e7e-48e9-a63e-d4c1bde3273b'

  console.log('🔍 Checking Lance AI Configuration...\n')

  const { data: creator, error } = await supabase
    .from('creators')
    .select('id, username, display_name, ai_config, voice_settings, suggested_questions')
    .eq('id', creatorId)
    .single()

  if (error) {
    console.error('❌ Error fetching creator:', error)
    return
  }

  if (!creator) {
    console.error('❌ Creator not found')
    return
  }

  console.log('✅ Creator Found:')
  console.log('================')
  console.log('ID:', creator.id)
  console.log('Username:', creator.username)
  console.log('Display Name:', creator.display_name)
  console.log('\n📝 AI Config:')
  console.log('-------------')
  if (creator.ai_config) {
    console.log(JSON.stringify(creator.ai_config, null, 2))
  } else {
    console.log('❌ NULL - No AI config set!')
  }

  console.log('\n🎤 Voice Settings:')
  console.log('------------------')
  if (creator.voice_settings) {
    console.log(JSON.stringify(creator.voice_settings, null, 2))
  } else {
    console.log('❌ NULL - No voice settings!')
  }

  console.log('\n💭 Suggested Questions:')
  console.log('-----------------------')
  if (creator.suggested_questions) {
    console.log(JSON.stringify(creator.suggested_questions, null, 2))
  } else {
    console.log('❌ NULL - No suggested questions!')
  }
}

checkLanceAiConfig()
