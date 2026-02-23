import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.AUTOMATION_API_KEY
}

/**
 * POST /api/social/session-health
 * Automation reports browser session status
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { creatorId, sessionStatus, lastError } = (await request.json()) as {
      creatorId: string
      sessionStatus: 'active' | 'degraded' | 'expired' | 'error'
      lastError?: string
    }

    if (!creatorId || !sessionStatus) {
      return NextResponse.json(
        { error: 'creatorId and sessionStatus required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('social_platform_sessions')
      .upsert(
        {
          creator_id: creatorId,
          platform: 'youtube',
          session_status: sessionStatus,
          last_error: lastError || null,
          last_poll_at: now,
          updated_at: now,
        },
        { onConflict: 'creator_id,platform' }
      )

    if (error) {
      console.error('Error updating session health:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/social/session-health:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
