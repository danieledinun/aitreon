import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.AUTOMATION_API_KEY
}

/**
 * POST /api/social/report-status
 * Automation reports reply posted or failed
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { commentId, status, failureReason } = (await request.json()) as {
      commentId: string
      status: 'posted' | 'failed'
      failureReason?: string
    }

    if (!commentId || !status) {
      return NextResponse.json(
        { error: 'commentId and status required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    const updateFields: Record<string, unknown> = {
      status,
      updated_at: now,
    }

    if (status === 'posted') {
      updateFields.posted_at = now
    }

    if (status === 'failed' && failureReason) {
      updateFields.failure_reason = failureReason
    }

    const { error } = await supabase
      .from('social_comments')
      .update(updateFields)
      .eq('id', commentId)

    if (error) {
      console.error('Error updating comment status:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If posted, increment replies_posted_today
    if (status === 'posted') {
      const { data: comment } = await supabase
        .from('social_comments')
        .select('creator_id')
        .eq('id', commentId)
        .single()

      if (comment) {
        const { data: session } = await supabase
          .from('social_platform_sessions')
          .select('replies_posted_today')
          .eq('creator_id', comment.creator_id)
          .eq('platform', 'youtube')
          .single()

        await supabase
          .from('social_platform_sessions')
          .upsert(
            {
              creator_id: comment.creator_id,
              platform: 'youtube',
              replies_posted_today: (session?.replies_posted_today || 0) + 1,
              updated_at: now,
            },
            { onConflict: 'creator_id,platform' }
          )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/social/report-status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
