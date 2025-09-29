import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

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

    // Check if sentiment analysis job already exists
    const { data: existingJob } = await supabase
      .from('background_jobs')
      .select('id, status')
      .eq('type', 'sentiment_analysis')
      .eq('payload->sessionId', sessionId)
      .in('status', ['pending', 'processing'])
      .single()

    if (existingJob) {
      return NextResponse.json({
        success: true,
        message: 'Sentiment analysis already scheduled',
        sessionId,
        jobId: existingJob.id
      })
    }

    // Schedule sentiment analysis for next day at noon (when cron runs)
    const scheduledFor = new Date()
    scheduledFor.setDate(scheduledFor.getDate() + 1)
    scheduledFor.setHours(12, 0, 0, 0) // Next day at 12:00 PM

    const { data: job, error: jobError } = await supabase
      .from('background_jobs')
      .insert({
        type: 'sentiment_analysis',
        payload: {
          sessionId,
          creatorId: chatSession.creator_id,
          endReason: reason
        },
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending',
        attempts: 0,
        max_attempts: 3
      })
      .select()
      .single()

    if (jobError) {
      console.error('❌ Error scheduling sentiment analysis:', jobError)
      return NextResponse.json({ error: 'Failed to schedule sentiment analysis' }, { status: 500 })
    }

    console.log(`✅ Scheduled sentiment analysis for session ${sessionId} at ${scheduledFor.toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Session ended and sentiment analysis scheduled',
      sessionId,
      jobId: job.id,
      scheduledFor: scheduledFor.toISOString()
    })

  } catch (error) {
    console.error('❌ Error ending chat session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}