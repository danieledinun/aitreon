import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    const { data: job, error } = await supabase
      .from('video_processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      videosProcessed: job.videos_processed,
      videosFailed: job.videos_failed,
      totalVideos: job.video_ids.length,
      result: job.result,
      error: job.error_message,
      createdAt: job.created_at,
      startedAt: job.started_at,
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
