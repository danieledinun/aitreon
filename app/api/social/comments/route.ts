import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.AUTOMATION_API_KEY
}

/**
 * POST /api/social/comments
 * Automation service sends new comments (batch upsert)
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { creatorId, comments } = body as {
      creatorId: string
      comments: Array<{
        platformCommentId: string
        videoId?: string
        videoTitle?: string
        authorName?: string
        authorChannelId?: string
        commentText: string
        commentPublishedAt?: string
        parentCommentId?: string
      }>
    }

    if (!creatorId || !comments?.length) {
      return NextResponse.json(
        { error: 'creatorId and comments array required' },
        { status: 400 }
      )
    }

    // Map to snake_case for DB upsert
    const rows = comments.map((c) => ({
      creator_id: creatorId,
      platform: 'youtube',
      platform_comment_id: c.platformCommentId,
      video_id: c.videoId || null,
      video_title: c.videoTitle || null,
      author_name: c.authorName || null,
      author_channel_id: c.authorChannelId || null,
      comment_text: c.commentText,
      comment_published_at: c.commentPublishedAt || null,
      parent_comment_id: c.parentCommentId || null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('social_comments')
      .upsert(rows, {
        onConflict: 'creator_id,platform_comment_id',
        ignoreDuplicates: true,
      })
      .select('id, platform_comment_id, status')

    if (error) {
      console.error('Error upserting comments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update session fetched count
    const today = new Date().toISOString()
    await supabase
      .from('social_platform_sessions')
      .upsert(
        {
          creator_id: creatorId,
          platform: 'youtube',
          comments_fetched_today: comments.length,
          last_poll_at: today,
          updated_at: today,
        },
        { onConflict: 'creator_id,platform' }
      )

    return NextResponse.json({
      success: true,
      inserted: data?.length || 0,
    })
  } catch (error) {
    console.error('Error in POST /api/social/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
