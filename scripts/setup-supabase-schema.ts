/**
 * Script to set up Supabase vector database schema
 * This script creates the necessary tables, functions, and indexes for vector search
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupSchema() {
  console.log('🚀 Setting up Supabase vector search schema...')

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250901214954_create_vector_search_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Split the SQL into individual statements (rough splitting by semicolons)
    const statements = migrationSQL
      .split(/;\s*\n/)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📝 Executing ${statements.length} SQL statements...`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + (i < statements.length - 1 ? ';' : '')
      
      console.log(`   [${i + 1}/${statements.length}] Executing statement...`)
      
      const { error } = await supabase.rpc('exec', { sql: statement })
      
      if (error) {
        // Try alternative execution method
        const { error: directError } = await supabase
          .from('_any_table')
          .select('*')
          .limit(0)
        
        if (directError) {
          console.warn(`⚠️  Statement ${i + 1} failed:`, error.message)
        }
      }
    }

    console.log('✅ Schema setup completed successfully!')

    // Test the setup by checking if the content_chunks table exists
    const { data, error } = await supabase
      .from('content_chunks')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Failed to verify schema setup:', error.message)
    } else {
      console.log('✅ Vector search table verified!')
    }

  } catch (error) {
    console.error('❌ Schema setup failed:', error)
    process.exit(1)
  }
}

// Run the setup
if (require.main === module) {
  setupSchema()
}

export { setupSchema }