const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugAiConfig() {
  console.log('🔍 Debugging AI config data...')
  
  try {
    // Check ai_config table (singular)
    const { data: aiConfigs, error: aiConfigsError } = await supabase
      .from('ai_config')
      .select('*')
    
    if (aiConfigsError) {
      console.error('❌ Error fetching AI configs:', aiConfigsError)
      return
    }

    console.log('🤖 Total AI configs:', aiConfigs?.length || 0)
    
    if (aiConfigs && aiConfigs.length > 0) {
      aiConfigs.forEach((config, index) => {
        console.log(`\n--- AI Config ${index + 1} ---`)
        console.log('Creator ID:', config.creator_id)
        console.log('Agent Name:', config.agent_name)
        
        // Check each JSON field for validity
        const jsonFields = [
          'primary_audiences', 'top_outcomes', 'cta_preferences', 'go_to_verbs',
          'catchphrases', 'avoid_words', 'open_patterns', 'close_patterns',
          'sensitive_domains', 'red_lines', 'supported_languages'
        ]
        
        jsonFields.forEach(field => {
          const value = config[field]
          if (value) {
            const preview = typeof value === 'string' ? value.substring(0, 50) : String(value).substring(0, 50)
            console.log(`${field}:`, typeof value, '->', preview)
            try {
              JSON.parse(value)
              console.log(`  ✅ ${field} is valid JSON`)
            } catch (e) {
              console.log(`  ❌ ${field} is INVALID JSON:`, e.message)
            }
          }
        })
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugAiConfig()