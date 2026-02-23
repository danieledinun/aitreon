import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { mapCommentFromDb } from '@/lib/types/social'
import type { CommentStats } from '@/lib/types/social'

export const dynamic = 'force-dynamic'

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.AUTOMATION_API_KEY
}

/**
 * GET /api/social/comments
 * Session-authenticated endpoint for the creator dashboard to list comments.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up creator for this user
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    let query = supabase
      .from('social_comments')
      .select('*')
      .eq('creator_id', creator.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching comments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch status counts for stats
    const { data: allStatuses } = await supabase
      .from('social_comments')
      .select('status')
      .eq('creator_id', creator.id)

    const stats: CommentStats = {
      total: 0,
      pending: 0,
      ready: 0,
      posted: 0,
      failed: 0,
    }

    if (allStatuses) {
      stats.total = allStatuses.length
      for (const row of allStatuses) {
        const s = row.status as string
        if (s === 'pending' || s === 'generating') stats.pending++
        else if (s === 'ready') stats.ready++
        else if (s === 'posted') stats.posted++
        else if (s === 'failed') stats.failed++
      }
    }

    return NextResponse.json({
      comments: (data || []).map(mapCommentFromDb),
      stats,
    })
  } catch (error) {
    console.error('Error in GET /api/social/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
