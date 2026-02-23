import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { SocialReplyService } from '@/lib/social-reply-service'
import { getPlanConfig, PlanTier } from '@/lib/plans'

export const dynamic = 'force-dynamic'

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.AUTOMATION_API_KEY
}

/**
 * POST /api/social/generate-reply
 * Generate AI reply for a specific comment
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { commentId } = (await request.json()) as { commentId: string }

    if (!commentId) {
      return NextResponse.json({ error: 'commentId required' }, { status: 400 })
    }

    // Fetch the comment
    const { data: comment, error: commentError } = await supabase
      .from('social_comments')
      .select('*')
      .eq('id', commentId)
      .single()

    if (commentError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Check plan limits
    const { data: creator } = await supabase
      .from('creators')
      .select('id, user_id')
      .eq('id', comment.creator_id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', creator.user_id)
      .eq('status', 'active')
      .single()

    const tier = (subscription?.tier as PlanTier) || 'FREE'
    const planConfig = getPlanConfig(tier)

    if (!planConfig.limits.autoReply) {
      return NextResponse.json(
        { error: 'Auto-reply not available on current plan' },
        { status: 403 }
      )
    }

    // Check daily limit
    const todayCount = await SocialReplyService.getTodayReplyCount(comment.creator_id)
    if (todayCount >= planConfig.limits.autoReplyMaxPerDay) {
      return NextResponse.json(
        { error: 'Daily reply limit reached' },
        { status: 429 }
      )
    }

    // Check settings
    const settings = await SocialReplyService.getSettings(comment.creator_id)
    if (!settings?.isEnabled) {
      return NextResponse.json(
        { error: 'Auto-replies disabled' },
        { status: 403 }
      )
    }

    // Mark as generating
    await supabase
      .from('social_comments')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', commentId)

    // Generate reply
    const replyText = await SocialReplyService.generateReply(
      comment.creator_id,
      comment.comment_text,
      comment.video_title || undefined
    )

    // Save reply and mark as ready
    await supabase
      .from('social_comments')
      .update({
        ai_reply_text: replyText,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)

    return NextResponse.json({
      success: true,
      commentId,
      replyText,
    })
  } catch (error) {
    console.error('Error in POST /api/social/generate-reply:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
