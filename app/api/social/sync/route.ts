import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { SocialReplyService } from '@/lib/social-reply-service'
import { getPlanConfig, PlanTier } from '@/lib/plans'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const tokens = await response.json()

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(tokens)}`)
  }

  return tokens.access_token
}

/**
 * POST /api/social/sync
 * Manually sync YouTube comments from the last 24 hours and generate AI replies.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()

    // Look up creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, youtube_channel_id')
      .eq('user_id', session.user.id)
      .single()

    if (creatorError || !creator?.youtube_channel_id) {
      return NextResponse.json(
        { error: 'Creator profile or YouTube channel not found' },
        { status: 404 }
      )
    }

    // Check plan limits
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .single()

    const tier = (subscription?.tier as PlanTier) || 'FREE'
    const planConfig = getPlanConfig(tier)

    if (!planConfig.limits.autoReply) {
      return NextResponse.json(
        { error: 'Auto-reply not available on your current plan' },
        { status: 403 }
      )
    }

    // Get Google refresh token
    const { data: account } = await supabase
      .from('accounts')
      .select('refresh_token')
      .eq('user_id', session.user.id)
      .eq('provider', 'google')
      .single()

    if (!account?.refresh_token) {
      return NextResponse.json(
        { error: 'YouTube not connected. Please reconnect your Google account.' },
        { status: 400 }
      )
    }

    // Refresh the access token
    const accessToken = await refreshAccessToken(account.refresh_token)

    // Set up YouTube API client
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Step 1: Find recent videos (last 24h)
    const searchRes = await youtube.search.list({
      channelId: creator.youtube_channel_id,
      type: ['video'],
      publishedAfter: twentyFourHoursAgo,
      maxResults: 20,
      order: 'date',
    })

    const videoIds = (searchRes.data.items || [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => !!id)

    // If no recent videos, also check the channel's latest videos for new comments
    if (videoIds.length === 0) {
      const latestRes = await youtube.search.list({
        channelId: creator.youtube_channel_id,
        type: ['video'],
        maxResults: 5,
        order: 'date',
      })
      const latestIds = (latestRes.data.items || [])
        .map((item) => item.id?.videoId)
        .filter((id): id is string => !!id)
      videoIds.push(...latestIds)
    }

    if (videoIds.length === 0) {
      return NextResponse.json({
        success: true,
        commentsFetched: 0,
        repliesGenerated: 0,
        message: 'No videos found on channel',
      })
    }

    // Step 2: Fetch comments from each video
    const allComments: Array<{
      platformCommentId: string
      videoId: string
      videoTitle: string
      authorName: string
      authorChannelId: string
      commentText: string
      commentPublishedAt: string
    }> = []

    for (const videoId of videoIds) {
      try {
        const commentsRes = await youtube.commentThreads.list({
          videoId,
          part: ['snippet'],
          maxResults: 100,
          order: 'time',
        })

        for (const thread of commentsRes.data.items || []) {
          const snippet = thread.snippet?.topLevelComment?.snippet
          if (!snippet) continue

          const publishedAt = snippet.publishedAt || ''
          // Only include comments from the last 24 hours
          if (publishedAt && new Date(publishedAt) < new Date(twentyFourHoursAgo)) {
            continue
          }

          allComments.push({
            platformCommentId: thread.snippet?.topLevelComment?.id || thread.id || '',
            videoId,
            videoTitle: thread.snippet?.videoId || videoId,
            authorName: snippet.authorDisplayName || '',
            authorChannelId: snippet.authorChannelUrl || '',
            commentText: snippet.textOriginal || snippet.textDisplay || '',
            commentPublishedAt: publishedAt,
          })
        }
      } catch (err) {
        // Comments might be disabled on some videos — skip
        console.warn(`Could not fetch comments for video ${videoId}:`, err)
      }
    }

    if (allComments.length === 0) {
      return NextResponse.json({
        success: true,
        commentsFetched: 0,
        repliesGenerated: 0,
        message: 'No new comments found in the last 24 hours',
      })
    }

    // Step 3: Upsert comments into social_comments
    const rows = allComments.map((c) => ({
      creator_id: creator.id,
      platform: 'youtube',
      platform_comment_id: c.platformCommentId,
      video_id: c.videoId,
      video_title: c.videoTitle,
      author_name: c.authorName,
      author_channel_id: c.authorChannelId,
      comment_text: c.commentText,
      comment_published_at: c.commentPublishedAt || null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }))

    const { data: upserted, error: upsertError } = await supabase
      .from('social_comments')
      .upsert(rows, {
        onConflict: 'creator_id,platform_comment_id',
        ignoreDuplicates: true,
      })
      .select('id, platform_comment_id, status')

    if (upsertError) {
      console.error('Error upserting comments:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    const newComments = upserted || []

    // Step 4: Generate replies for newly inserted pending comments
    const todayCount = await SocialReplyService.getTodayReplyCount(creator.id)
    const dailyLimit = planConfig.limits.autoReplyMaxPerDay
    let repliesGenerated = 0

    for (const comment of newComments) {
      if (comment.status !== 'pending') continue
      if (todayCount + repliesGenerated >= dailyLimit) break

      try {
        // Mark as generating
        await supabase
          .from('social_comments')
          .update({ status: 'generating', updated_at: new Date().toISOString() })
          .eq('id', comment.id)

        // Find the full comment text for reply generation
        const matchingComment = allComments.find(
          (c) => c.platformCommentId === comment.platform_comment_id
        )

        const replyText = await SocialReplyService.generateReply(
          creator.id,
          matchingComment?.commentText || '',
          matchingComment?.videoTitle || undefined
        )

        await supabase
          .from('social_comments')
          .update({
            ai_reply_text: replyText,
            status: 'ready',
            updated_at: new Date().toISOString(),
          })
          .eq('id', comment.id)

        repliesGenerated++
      } catch (err) {
        console.error(`Failed to generate reply for comment ${comment.id}:`, err)
        await supabase
          .from('social_comments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', comment.id)
      }
    }

    // Update session poll timestamp
    await supabase
      .from('social_platform_sessions')
      .upsert(
        {
          creator_id: creator.id,
          platform: 'youtube',
          comments_fetched_today: allComments.length,
          last_poll_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'creator_id,platform' }
      )

    return NextResponse.json({
      success: true,
      commentsFetched: newComments.length,
      repliesGenerated,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('Error in POST /api/social/sync:', message)
    if (stack) console.error('Stack:', stack)
    return NextResponse.json({ error: message || 'Internal server error' }, { status: 500 })
  }
}
