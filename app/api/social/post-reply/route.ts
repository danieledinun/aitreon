import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

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
 * POST /api/social/post-reply
 * Post an AI-generated reply to YouTube as a comment reply.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { commentId } = body as { commentId: string }

    if (!commentId) {
      return NextResponse.json({ error: 'commentId is required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Look up creator for this user
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Get the comment and verify ownership
    const { data: comment, error: commentError } = await supabase
      .from('social_comments')
      .select('*')
      .eq('id', commentId)
      .eq('creator_id', creator.id)
      .single()

    if (commentError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (!comment.ai_reply_text) {
      return NextResponse.json(
        { error: 'No AI reply text available. Generate a reply first.' },
        { status: 400 }
      )
    }

    if (comment.status === 'posted') {
      return NextResponse.json(
        { error: 'Reply already posted' },
        { status: 400 }
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

    // Post the reply to YouTube
    await youtube.comments.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          parentId: comment.platform_comment_id,
          textOriginal: comment.ai_reply_text,
        },
      },
    })

    const now = new Date().toISOString()

    // Update status to posted
    await supabase
      .from('social_comments')
      .update({
        status: 'posted',
        posted_at: now,
        updated_at: now,
      })
      .eq('id', commentId)

    return NextResponse.json({ success: true, postedAt: now })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error in POST /api/social/post-reply:', message)

    // If posting failed, mark comment as failed
    if (request) {
      try {
        const body = await request.clone().json().catch(() => null)
        if (body?.commentId) {
          const supabase = getSupabaseClient()
          await supabase
            .from('social_comments')
            .update({
              status: 'failed',
              failure_reason: message,
              updated_at: new Date().toISOString(),
            })
            .eq('id', body.commentId)
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json({ error: message || 'Internal server error' }, { status: 500 })
  }
}
