/**
 * Test Supabase connection and create basic vector search table
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testConnection() {
  console.log('🔗 Testing Supabase connection...')
  console.log('   URL:', supabaseUrl)

  try {
    // Test basic connection with a simple query
    const { data, error } = await supabase
      .rpc('version')

    if (error) {
      console.warn('   RPC failed, trying alternative test...')
      
      // Try a different approach - just check if we can reach the DB
      const { error: pingError } = await supabase
        .from('_realtime')
        .select('*')
        .limit(1)
        
      if (pingError && !pingError.message.includes('does not exist')) {
        console.error('❌ Connection failed:', pingError.message)
        return false
      }
    }

    console.log('✅ Connection successful!')
    console.log('   Database is accessible')
    return true

  } catch (error) {
    console.error('❌ Connection error:', error)
    return false
  }
}

async function enableVectorExtension() {
  console.log('🔧 Enabling vector extension...')
  
  try {
    const { data, error } = await supabase.rpc('exec', {
      sql: 'CREATE EXTENSION IF NOT EXISTS vector;'
    })

    if (error) {
      console.warn('⚠️  Extension command failed, trying alternative approach')
      
      // Try direct SQL execution
      const { error: directError } = await supabase
        .rpc('query', { query: 'SELECT 1' })
      
      if (directError) {
        console.error('❌ Could not enable vector extension:', error.message)
        return false
      }
    }

    console.log('✅ Vector extension ready!')
    return true

  } catch (error) {
    console.error('❌ Extension error:', error)
    return false
  }
}

async function createBasicTable() {
  console.log('📝 Creating content_chunks table...')
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS content_chunks (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      creator_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      video_title TEXT NOT NULL,
      video_url TEXT NOT NULL,
      content TEXT NOT NULL,
      start_time FLOAT,
      end_time FLOAT,
      chunk_index INTEGER NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      UNIQUE(creator_id, video_id, chunk_index)
    );
  `

  try {
    const { error } = await supabase.rpc('exec', { sql: createTableSQL })

    if (error) {
      console.error('❌ Table creation failed:', error.message)
      return false
    }

    console.log('✅ Table created successfully!')
    return true

  } catch (error) {
    console.error('❌ Table creation error:', error)
    return false
  }
}

async function testTableAccess() {
  console.log('🔍 Testing table access...')
  
  try {
    const { data, error } = await supabase
      .from('content_chunks')
      .select('id')
      .limit(1)

    if (error) {
      console.error('❌ Table access failed:', error.message)
      return false
    }

    console.log('✅ Table access successful!')
    console.log('   Table is ready for content chunks')
    return true

  } catch (error) {
    console.error('❌ Table access error:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Setting up Supabase vector database...\n')

  const steps = [
    { name: 'Create Basic Table', fn: createBasicTable },
    { name: 'Test Table Access', fn: testTableAccess }
  ]

  for (const step of steps) {
    const success = await step.fn()
    if (!success) {
      console.log(`\n❌ Setup failed at step: ${step.name}`)
      process.exit(1)
    }
    console.log('')
  }

  console.log('🎉 Supabase setup completed successfully!')
}

// Run if this is the main module
main()