const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addUpdatedAtColumn() {
  console.log('🔧 Adding updated_at column to video_processing_jobs table...')

  try {
    // Add updated_at column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE video_processing_jobs
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      `
    })

    if (alterError) {
      console.error('❌ Error adding column:', alterError)

      // Try direct SQL execution instead
      console.log('🔄 Trying direct SQL execution...')
      const { error: directError } = await supabase
        .from('video_processing_jobs')
        .select('id')
        .limit(1)

      if (!directError) {
        console.log('✅ Table accessible, applying migration via raw SQL...')

        // Execute the migration
        const migration = `
          -- Add updated_at column to video_processing_jobs table
          ALTER TABLE video_processing_jobs
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

          -- Create a trigger to automatically update updated_at on row changes
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
          END;
          $$ language 'plpgsql';

          DROP TRIGGER IF EXISTS update_video_processing_jobs_updated_at ON video_processing_jobs;

          CREATE TRIGGER update_video_processing_jobs_updated_at
              BEFORE UPDATE ON video_processing_jobs
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column();
        `

        console.log('📝 Migration SQL:')
        console.log(migration)
        console.log('\n⚠️  Please run this SQL in Supabase SQL Editor manually')
        console.log('🔗 https://supabase.com/dashboard/project/gyuhljkilispdhetwalj/sql/new')
      }

      return
    }

    console.log('✅ Column added successfully!')

    // Create trigger function
    const { error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `
    })

    if (funcError) {
      console.error('❌ Error creating function:', funcError)
      return
    }

    console.log('✅ Trigger function created!')

    // Create trigger
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql: `
        DROP TRIGGER IF EXISTS update_video_processing_jobs_updated_at ON video_processing_jobs;

        CREATE TRIGGER update_video_processing_jobs_updated_at
            BEFORE UPDATE ON video_processing_jobs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
      `
    })

    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError)
      return
    }

    console.log('✅ Trigger created!')
    console.log('✅ Migration complete!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

addUpdatedAtColumn()
