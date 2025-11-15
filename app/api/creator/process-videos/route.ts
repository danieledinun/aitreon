import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Create a video processing job
 * Returns immediately with job ID - processing happens in background on Railway
 */
export async function POST(request: NextRequest) {
  try {
    // Check for internal request headers (from onboarding flow)
    const isInternalRequest = request.headers.get('X-Internal-Request') === 'true'
    const internalCreatorId = request.headers.get('X-Creator-Id')

    let creatorId: string

    if (isInternalRequest && internalCreatorId) {
      // Internal request from onboarding - trust the creator ID
      creatorId = internalCreatorId
    } else {
      // External request - would need auth checking (not implemented for now)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoIds } = await request.json()

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'videoIds array is required and must not be empty' },
        { status: 400 }
      )
    }

    console.log(`🎬 Creating video processing job for creator ${creatorId}`)
    console.log(`📹 Videos to process: ${videoIds.length}`)

    // Create job in database with pending status
    const { data: job, error } = await supabase
      .from('video_processing_jobs')
      .insert({
        creator_id: creatorId,
        video_ids: videoIds,
        status: 'pending',
        progress: 0,
        videos_processed: 0,
        videos_failed: 0
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating job:', error)
      return NextResponse.json(
        { error: 'Failed to create video processing job', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Created job ${job.id} - Railway will process in background`)

    // Return job ID immediately - Railway service will pick it up
    return NextResponse.json({
      jobId: job.id,
      status: 'pending',
      videoCount: videoIds.length,
      message: 'Video processing started. Poll /api/creator/job-status/{jobId} for progress.'
    }, { status: 202 }) // 202 Accepted

  } catch (error) {
    console.error('Error starting video processing:', error)
    return NextResponse.json(
      { error: 'Failed to start video processing' },
      { status: 500 }
    )
  }
}
