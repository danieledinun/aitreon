#!/usr/bin/env node

/**
 * Run Speech Analysis Migration
 *
 * This script creates the required tables for speech pattern analysis
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Running speech analysis database migration...');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '20250119_add_speech_analysis_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded, executing SQL...');

    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // Try alternative approach with direct SQL execution
      console.log('⚠️ RPC method failed, trying direct execution...');

      // Split the migration into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      console.log(`📝 Executing ${statements.length} SQL statements...`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`   ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);

        // Skip certain statements that might not work with Supabase client
        if (statement.includes('DO $$') || statement.includes('END $$')) {
          console.log('   ⏭️ Skipping complex statement (requires superuser)');
          continue;
        }

        try {
          await supabase.rpc('exec_sql', { sql: statement + ';' });
          console.log('   ✅ Success');
        } catch (stmtError) {
          console.log(`   ⚠️ Statement failed: ${stmtError.message}`);
          // Continue with other statements
        }
      }
    } else {
      console.log('✅ Migration executed successfully');
    }

    // Verify tables were created
    console.log('🔍 Verifying tables were created...');

    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['speech_analysis', 'style_cards']);

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      const tableNames = tables.map(t => t.table_name);
      console.log('📊 Found tables:', tableNames);

      if (tableNames.includes('speech_analysis')) {
        console.log('✅ speech_analysis table created');
      } else {
        console.log('❌ speech_analysis table not found');
      }

      if (tableNames.includes('style_cards')) {
        console.log('✅ style_cards table created');
      } else {
        console.log('❌ style_cards table not found');
      }
    }

    console.log('🎉 Migration process complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();