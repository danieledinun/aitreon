import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Get status of a YouTube analysis job
 * Frontend polls this endpoint to check progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = params.jobId

    // Fetch job from database
    const { data: job, error } = await supabase
      .from('youtube_analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', session.user.id) // Ensure user owns this job
      .single()

    if (error || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Return job status and progress
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      channelId: job.channel_id,
      errorMessage: job.error_message,
      result: job.result,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      metadata: job.metadata
    })

  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}
