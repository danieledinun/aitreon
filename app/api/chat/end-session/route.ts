import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { SentimentScheduler } from '@/lib/sentiment-scheduler'

// Explicit endpoint to mark a chat session as ended
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, reason = 'user_ended' } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    console.log(`🔚 Ending chat session ${sessionId} (reason: ${reason})`)

    // Verify session belongs to user
    const { data: chatSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, creator_id, user_id')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single()

    if (sessionError || !chatSession) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    // Check if there are user messages in this session
    const { data: userMessages } = await supabase
      .from('messages')
      .select('id')
      .eq('session_id', sessionId)
      .in('role', ['user', 'USER'])
      .limit(1)

    if (!userMessages || userMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No user messages to analyze',
        sessionId
      })
    }

    // Schedule immediate sentiment analysis using the shared scheduler
    try {
      const jobId = await SentimentScheduler.scheduleImmediate(
        sessionId,
        chatSession.creator_id,
        `session_ended_${reason}`
      )

      if (!jobId) {
        return NextResponse.json({
          success: true,
          message: 'No user messages to analyze',
          sessionId
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Session ended and sentiment analysis scheduled for immediate processing',
        sessionId,
        jobId,
        scheduledFor: new Date().toISOString()
      })

    } catch (error) {
      console.error('❌ Error scheduling sentiment analysis:', error)
      return NextResponse.json({ error: 'Failed to schedule sentiment analysis' }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Error ending chat session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}