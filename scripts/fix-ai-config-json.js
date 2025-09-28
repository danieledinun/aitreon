const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to convert comma-separated string to JSON array
function csvToJsonArray(csvString) {
  if (!csvString || typeof csvString !== 'string') return '[]'
  
  // Split by comma and clean up each item
  const items = csvString.split(',').map(item => item.trim()).filter(item => item.length > 0)
  return JSON.stringify(items)
}

async function fixAiConfigJson() {
  console.log('🔧 Fixing AI config JSON data...')
  
  try {
    // Get the existing AI config
    const { data: aiConfig, error: fetchError } = await supabase
      .from('ai_config')
      .select('*')
      .single()
    
    if (fetchError) {
      console.error('❌ Error fetching AI config:', fetchError)
      return
    }

    console.log('📋 Found AI config for creator:', aiConfig.creator_id)

    // Convert all CSV fields to proper JSON arrays
    const fixedData = {
      primary_audiences: csvToJsonArray(aiConfig.primary_audiences),
      top_outcomes: csvToJsonArray(aiConfig.top_outcomes), 
      cta_preferences: csvToJsonArray(aiConfig.cta_preferences),
      go_to_verbs: csvToJsonArray(aiConfig.go_to_verbs),
      catchphrases: csvToJsonArray(aiConfig.catchphrases),
      avoid_words: csvToJsonArray(aiConfig.avoid_words),
      open_patterns: csvToJsonArray(aiConfig.open_patterns),
      close_patterns: csvToJsonArray(aiConfig.close_patterns),
      sensitive_domains: csvToJsonArray(aiConfig.sensitive_domains),
      red_lines: csvToJsonArray(aiConfig.red_lines),
      supported_languages: aiConfig.supported_languages === 'en' ? '["en"]' : csvToJsonArray(aiConfig.supported_languages)
    }

    console.log('🔄 Converting CSV data to JSON arrays...')
    
    // Show what we're converting
    Object.entries(fixedData).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`)
    })

    // Update the database with fixed JSON data
    const { error: updateError } = await supabase
      .from('ai_config')
      .update(fixedData)
      .eq('id', aiConfig.id)
    
    if (updateError) {
      console.error('❌ Error updating AI config:', updateError)
      return
    }

    console.log('✅ Successfully fixed AI config JSON data!')
    console.log('🧪 Testing JSON parsing...')
    
    // Test that all fields now parse correctly
    Object.entries(fixedData).forEach(([key, value]) => {
      try {
        const parsed = JSON.parse(value)
        console.log(`  ✅ ${key}: ${parsed.length} items`)
      } catch (e) {
        console.log(`  ❌ ${key}: Still invalid - ${e.message}`)
      }
    })

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixAiConfigJson()