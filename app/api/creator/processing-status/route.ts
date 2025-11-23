import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and creator using Supabase
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    // Check for active video processing jobs
    const { data: activeJobs } = await supabase
      .from('video_processing_jobs')
      .select('*')
      .eq('creator_id', creator.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })

    console.log('📊 Processing Status - Found active jobs:', activeJobs?.length || 0)

    // If there are active jobs, return processing status
    if (activeJobs && activeJobs.length > 0) {
      const job = activeJobs[0] // Get the most recent job
      const totalVideos = job.video_ids?.length || 0
      const processedVideos = job.videos_processed || 0
      const processingCount = totalVideos - processedVideos

      const status = {
        isProcessing: true,
        totalVideos,
        processedVideos,
        processingVideos: Array(processingCount).fill('processing'), // Placeholder IDs
        recentlyCompleted: [],
        hasErrors: job.status === 'failed',
        startedAt: job.started_at,
        lastChecked: new Date().toISOString()
      }

      console.log('📊 Processing Status - Job in progress:', status)
      return NextResponse.json(status)
    }

    // Check for recently completed jobs (last 30 minutes)
    const { data: recentJobs } = await supabase
      .from('video_processing_jobs')
      .select('*')
      .eq('creator_id', creator.id)
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order('completed_at', { ascending: false })
      .limit(1)

    if (recentJobs && recentJobs.length > 0) {
      const job = recentJobs[0]
      const status = {
        isProcessing: false,
        totalVideos: job.video_ids?.length || 0,
        processedVideos: job.videos_processed || 0,
        processingVideos: [],
        recentlyCompleted: job.video_ids || [],
        hasErrors: false,
        startedAt: job.started_at,
        lastChecked: new Date().toISOString()
      }

      console.log('📊 Processing Status - Recently completed:', status)
      return NextResponse.json(status)
    }

    // No active or recent jobs - return idle status
    const status = {
      isProcessing: false,
      totalVideos: 0,
      processedVideos: 0,
      processingVideos: [],
      recentlyCompleted: [],
      hasErrors: false,
      lastChecked: new Date().toISOString()
    }

    console.log('📊 Processing Status - No active jobs:', status)
    return NextResponse.json(status)

  } catch (error) {
    console.error('Error checking processing status:', error)
    return NextResponse.json({
      error: 'Failed to check processing status'
    }, { status: 500 })
  }
}