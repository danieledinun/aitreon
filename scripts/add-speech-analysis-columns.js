#!/usr/bin/env node
/**
 * Add speech analysis columns to ai_config table
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addSpeechAnalysisColumns() {
  console.log('🔧 Adding speech analysis columns to ai_config table...')

  try {
    // Add style_profile column (JSONB)
    const { error: error1 } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS style_profile JSONB;'
    })

    if (error1) {
      console.error('❌ Error adding style_profile column:', error1)
      return false
    }

    // Add style_card column (TEXT)
    const { error: error2 } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS style_card TEXT;'
    })

    if (error2) {
      console.error('❌ Error adding style_card column:', error2)
      return false
    }

    console.log('✅ Successfully added speech analysis columns')
    return true

  } catch (error) {
    console.error('❌ Failed to add columns:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Starting speech analysis database setup...')

  const success = await addSpeechAnalysisColumns()

  if (success) {
    console.log('🎉 Speech analysis database setup complete!')
  } else {
    console.log('❌ Speech analysis database setup failed!')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { addSpeechAnalysisColumns }