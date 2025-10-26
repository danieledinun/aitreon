import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

// Set maximum duration for this API route (Vercel Pro: 300s)
export const maxDuration = 300

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Start a YouTube channel analysis job
 * Returns immediately with job ID - processing happens in background
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'YouTube channel URL is required' }, { status: 400 })
    }

    console.log(`🎬 Creating analysis job for user ${session.user.id}: ${url}`)

    // Create job in database with pending status
    const { data: job, error } = await supabase
      .from('youtube_analysis_jobs')
      .insert({
        user_id: session.user.id,
        channel_url: url,
        status: 'pending',
        progress: 0
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating job:', error)
      return NextResponse.json(
        { error: 'Failed to create analysis job', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Created job ${job.id} - now processing in background`)

    // Return job ID immediately - Railway service will pick it up
    return NextResponse.json({
      jobId: job.id,
      status: 'pending',
      message: 'Analysis started. Poll /api/youtube/job-status/{jobId} for progress.'
    }, { status: 202 }) // 202 Accepted

  } catch (error) {
    console.error('Error starting analysis:', error)
    return NextResponse.json(
      { error: 'Failed to start channel analysis' },
      { status: 500 }
    )
  }
}
