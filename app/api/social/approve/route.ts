import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { SocialReplyService } from '@/lib/social-reply-service'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/social/approve
 * Generate an AI reply for a pending comment.
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

    if (comment.status !== 'pending' && comment.status !== 'failed') {
      return NextResponse.json(
        { error: `Comment is already ${comment.status}` },
        { status: 400 }
      )
    }

    // Mark as generating
    await supabase
      .from('social_comments')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', commentId)

    // Generate reply
    const replyText = await SocialReplyService.generateReply(
      creator.id,
      comment.comment_text,
      comment.video_title || undefined
    )

    // Update with reply text
    await supabase
      .from('social_comments')
      .update({
        ai_reply_text: replyText,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)

    return NextResponse.json({ success: true, replyText })
  } catch (error) {
    console.error('Error in POST /api/social/approve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
