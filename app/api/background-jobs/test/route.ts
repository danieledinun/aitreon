import { NextRequest, NextResponse } from 'next/server'
import { backgroundJobService } from '@/lib/background-jobs'
import { conversationTracker } from '@/lib/conversation-tracker'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, sessionId, creatorId } = body

    if (action === 'schedule_sentiment') {
      if (!sessionId || !creatorId) {
        return NextResponse.json({ error: 'sessionId and creatorId required' }, { status: 400 })
      }

      // Schedule sentiment analysis immediately for testing (no 30-minute delay)
      await backgroundJobService.scheduleSentimentAnalysis(sessionId, creatorId, new Date())

      return NextResponse.json({
        success: true,
        message: `Sentiment analysis scheduled for session ${sessionId}`
      })
    }

    if (action === 'end_conversation') {
      if (!sessionId || !creatorId) {
        return NextResponse.json({ error: 'sessionId and creatorId required' }, { status: 400 })
      }

      // Manually end conversation for testing
      await conversationTracker.endConversation(sessionId, creatorId)

      return NextResponse.json({
        success: true,
        message: `Conversation ${sessionId} ended and sentiment analysis scheduled`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('❌ Error in test endpoint:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}