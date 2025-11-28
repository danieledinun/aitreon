import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface SyncContentRequest {
  type: 'single' | 'playlist' | 'channel'
  videoId?: string
  playlistId?: string
  channelUrl?: string
  maxVideos?: number
  languages?: string[]
}

/**
 * New approach: Create video processing jobs instead of direct processing
 * This uses the same Railway worker queue as onboarding and auto-recovery
 */
export async function POST(request: NextRequest) {
  try {
    // Check for internal requests first
    const isInternalRequest = request.headers.get('X-Internal-Request') === 'true'
    const internalCreatorId = request.headers.get('X-Creator-Id')

    let creator: any = null

    if (isInternalRequest && internalCreatorId) {
      // Internal request - get creator directly by ID
      const { data: creatorData, error } = await supabase
        .from('creators')
        .select('id, user_id, username, youtube_channel_url')
        .eq('id', internalCreatorId)
        .single()

      if (error || !creatorData) {
        console.error('Internal request - creator not found:', error)
        return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
      }

      creator = creatorData
    } else {
      // Regular request - check session
      const session = await getServerSession(authOptions)

      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get user and creator using Supabase
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (userError || !userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const { data: creatorData, error: creatorError } = await supabase
        .from('creators')
        .select('id, user_id, username, youtube_channel_url')
        .eq('user_id', userData.id)
        .single()

      if (creatorError || !creatorData) {
        return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
      }

      creator = creatorData
    }

    const body: SyncContentRequest = await request.json()
    const { type, videoId, playlistId, channelUrl, maxVideos = 10 } = body

    console.log(`📺 Sync content request - Type: ${type}, Creator: ${creator.username}`)

    // Step 1: Discover video IDs based on sync type
    let videoIds: string[] = []

    switch (type) {
      case 'single':
        if (!videoId) {
          return NextResponse.json({ error: 'Video ID is required for single video sync' }, { status: 400 })
        }
        videoIds = [videoId]
        console.log(`   ✅ Single video mode: ${videoId}`)
        break

      case 'playlist':
        if (!playlistId) {
          return NextResponse.json({ error: 'Playlist ID is required for playlist sync' }, { status: 400 })
        }

        // Use Railway YouTube service to discover playlist videos
        console.log(`   🔍 Discovering videos from playlist: ${playlistId}`)
        try {
          const RAILWAY_SERVICE_URL = process.env.RAILWAY_SERVICE_URL || 'http://localhost:3001'
          const playlistResponse = await fetch(`${RAILWAY_SERVICE_URL}/api/playlist/videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playlistId, limit: maxVideos })
          })

          if (!playlistResponse.ok) {
            const error = await playlistResponse.json()
            throw new Error(error.error || 'Failed to fetch playlist videos')
          }

          const playlistData = await playlistResponse.json()
          videoIds = playlistData.videos?.map((v: any) => v.id) || []
          console.log(`   ✅ Found ${videoIds.length} videos in playlist`)
        } catch (error) {
          console.error('   ❌ Playlist discovery failed:', error)
          return NextResponse.json({
            error: 'Failed to discover playlist videos',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        }
        break

      case 'channel':
        const effectiveChannelUrl = channelUrl || creator.youtube_channel_url

        if (!effectiveChannelUrl) {
          return NextResponse.json({
            error: 'Channel URL is required. Please connect your YouTube channel in settings.'
          }, { status: 400 })
        }

        // Use Railway YouTube service to discover channel videos
        console.log(`   🔍 Discovering videos from channel: ${effectiveChannelUrl}`)
        try {
          const RAILWAY_SERVICE_URL = process.env.RAILWAY_SERVICE_URL || 'http://localhost:3001'
          const channelResponse = await fetch(`${RAILWAY_SERVICE_URL}/api/channel/videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelUrl: effectiveChannelUrl, limit: maxVideos })
          })

          if (!channelResponse.ok) {
            const error = await channelResponse.json()
            throw new Error(error.error || 'Failed to fetch channel videos')
          }

          const channelData = await channelResponse.json()
          videoIds = channelData.videos?.map((v: any) => v.id) || []
          console.log(`   ✅ Found ${videoIds.length} videos in channel`)
        } catch (error) {
          console.error('   ❌ Channel discovery failed:', error)
          return NextResponse.json({
            error: 'Failed to discover channel videos',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid sync type' }, { status: 400 })
    }

    if (videoIds.length === 0) {
      return NextResponse.json({
        error: 'No videos found to process',
        videoCount: 0
      }, { status: 400 })
    }

    // Step 2: Create video processing job (same as onboarding)
    console.log(`   🎬 Creating video processing job for ${videoIds.length} videos`)

    const { data: job, error: jobError } = await supabase
      .from('video_processing_jobs')
      .insert({
        creator_id: creator.id,
        video_ids: videoIds,
        status: 'pending',
        progress: 0,
        videos_processed: 0,
        videos_failed: 0,
        metadata: {
          source: 'sync_content',
          sync_type: type,
          requested_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (jobError) {
      console.error('   ❌ Failed to create video processing job:', jobError)
      return NextResponse.json({
        error: 'Failed to create processing job',
        details: jobError.message
      }, { status: 500 })
    }

    console.log(`   ✅ Video processing job created: ${job.id}`)
    console.log(`   ⏳ Railway worker will pick up this job within ~3 seconds`)

    // Return job ID immediately (Railway will process it)
    return NextResponse.json({
      jobId: job.id,
      status: 'pending',
      videoCount: videoIds.length,
      message: `Video processing started. Railway worker will process ${videoIds.length} video${videoIds.length > 1 ? 's' : ''}.`
    }, { status: 202 })

  } catch (error) {
    console.error('Sync content error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
