import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SentimentScheduler } from '@/lib/sentiment-scheduler'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, creatorId, reason = 'manual_trigger' } = await request.json()

    if (!sessionId || !creatorId) {
      return NextResponse.json({
        error: 'sessionId and creatorId are required'
      }, { status: 400 })
    }

    console.log(`🧪 Manual sentiment analysis trigger for session ${sessionId}`)

    try {
      const jobId = await SentimentScheduler.scheduleImmediate(sessionId, creatorId, reason)

      if (!jobId) {
        return NextResponse.json({
          success: true,
          message: 'No unanalyzed messages found',
          sessionId
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Sentiment analysis scheduled immediately',
        sessionId,
        jobId,
        scheduledFor: new Date().toISOString()
      })

    } catch (error) {
      console.error('❌ Error scheduling sentiment analysis:', error)
      return NextResponse.json({
        error: 'Failed to schedule sentiment analysis'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Error in manual sentiment trigger:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}