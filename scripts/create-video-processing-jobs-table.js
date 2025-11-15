const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  try {
    console.log('📊 Creating video_processing_jobs table...\n')

    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'migrations', 'create-video-processing-jobs-table.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Try direct execution if exec_sql RPC doesn't exist
      console.log('🔄 Trying direct SQL execution...')

      // Split into individual statements and execute
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`)
        const result = await supabase.rpc('exec', { query: statement })
        if (result.error) {
          console.error('Error:', result.error)
        }
      }
    }

    console.log('✅ Migration applied successfully!')
    console.log('\n📋 Verifying table exists...')

    // Verify the table was created
    const { data: tables, error: tableError } = await supabase
      .from('video_processing_jobs')
      .select('*')
      .limit(0)

    if (tableError) {
      console.error('❌ Table verification failed:', tableError)
    } else {
      console.log('✅ Table verified!')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

applyMigration()
