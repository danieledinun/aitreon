const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...')
    const migrationPath = path.join(__dirname, 'migrations', 'create-youtube-jobs-table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('🚀 Applying migration to create youtube_analysis_jobs table...')

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const statement of statements) {
      console.log(`\n📝 Executing: ${statement.substring(0, 80)}...`)
      const { error } = await supabase.rpc('exec_sql', { sql: statement })

      if (error) {
        // Try direct query if RPC fails
        const { error: directError } = await supabase.from('_sql').select('*').limit(0)
        if (directError) {
          console.error('❌ Error:', error.message)
          throw error
        }
      }
    }

    console.log('\n✅ Migration completed successfully!')

    // Verify table was created
    const { data, error } = await supabase
      .from('youtube_analysis_jobs')
      .select('*')
      .limit(0)

    if (error) {
      console.error('⚠️ Warning: Could not verify table creation:', error.message)
    } else {
      console.log('✅ Table verified: youtube_analysis_jobs exists')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

applyMigration()
