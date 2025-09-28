import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Create background_jobs table
    const { error } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS background_jobs (
          id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
          type TEXT NOT NULL,
          payload JSONB NOT NULL,
          scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_background_jobs_status_scheduled ON background_jobs(status, scheduled_for);
        CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(type);
      `
    })

    if (error) {
      console.error('❌ Error creating background_jobs table:', error)
      return NextResponse.json({ error: 'Failed to create table' }, { status: 500 })
    }

    console.log('✅ Background jobs table created successfully')

    return NextResponse.json({
      success: true,
      message: 'Background jobs table created successfully'
    })

  } catch (error) {
    console.error('❌ Error setting up background jobs:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}