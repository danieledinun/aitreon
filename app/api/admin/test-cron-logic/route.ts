import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { SentimentScheduler } from '@/lib/sentiment-scheduler'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🧪 Testing cron job detection logic manually...')

    const now = new Date()
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()

    console.log(`🕐 Looking for conversations inactive since: ${thirtyMinutesAgo}`)

    // Get all chat sessions that have user messages (same logic as cron job)
    const { data: sessionIds, error: sessionIdsError } = await supabase
      .from('messages')
      .select('session_id')
      .in('role', ['user', 'USER'])

    if (sessionIdsError) {
      console.error('❌ Error fetching session IDs:', sessionIdsError)
      return NextResponse.json({ error: 'Failed to fetch session IDs' }, { status: 500 })
    }

    if (!sessionIds || sessionIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sessions with user messages found',
        sessionsChecked: 0
      })
    }

    // Extract unique session IDs
    const uniqueSessionIds = [...new Set(sessionIds.map(s => s.session_id))]
    console.log(`📋 Found ${uniqueSessionIds.length} unique sessions with user messages`)

    // Get chat session details for these IDs
    const { data: sessionsWithUserMessages, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('id, creator_id')
      .in('id', uniqueSessionIds)

    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    console.log(`📋 Checking ${sessionsWithUserMessages.length} sessions for inactivity...`)

    let inactiveCount = 0
    let scheduledCount = 0
    const inactiveSessions = []

    // Check each session for inactivity
    for (const session of sessionsWithUserMessages) {
      try {
        // Check if session is actually inactive (last message > 30 min ago)
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('created_at')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!lastMessage || lastMessage.created_at > thirtyMinutesAgo) {
          // Session is still active or no messages found
          continue
        }

        inactiveCount++
        const minutesInactive = Math.round((now.getTime() - new Date(lastMessage.created_at).getTime()) / 60000)

        console.log(`⏰ Found inactive session ${session.id} (${minutesInactive} minutes inactive)`)

        inactiveSessions.push({
          sessionId: session.id,
          creatorId: session.creator_id,
          lastMessageAt: lastMessage.created_at,
          minutesInactive
        })

        // Check if there are any unanalyzed user messages
        const { data: unanalyzedMessages } = await supabase
          .from('messages')
          .select('id')
          .eq('session_id', session.id)
          .in('role', ['user', 'USER'])
          .is('sentiment', null)
          .limit(1)

        if (!unanalyzedMessages || unanalyzedMessages.length === 0) {
          console.log(`📋 No unanalyzed messages for session ${session.id}`)
          continue
        }

        // Would normally schedule here, but just count for testing
        scheduledCount++
        console.log(`✅ Would schedule sentiment analysis for session ${session.id}`)

      } catch (error) {
        console.error(`❌ Error processing session ${session.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cron logic test completed',
      totalSessionsWithMessages: uniqueSessionIds.length,
      sessionsChecked: sessionsWithUserMessages.length,
      inactiveSessionsFound: inactiveCount,
      wouldSchedule: scheduledCount,
      thirtyMinutesAgo,
      inactiveSessions
    })

  } catch (error) {
    console.error('❌ Error in cron logic test:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}