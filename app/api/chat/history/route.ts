import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 })
    }

    // Fetch chat sessions for this user and creator
    const chatSessions = await db.chatSession.findMany({
      where: {
        user_id: session.user.id,
        creator_id: creatorId,
      },
      orderBy: { updated_at: 'desc' },
      take: 50, // Limit to last 50 sessions
    })

    // Fetch messages for each session
    const sessionsWithMessagesData = await Promise.all(
      chatSessions.map(async (session) => {
        const messages = await db.message.findMany({
          where: { session_id: session.id },
          orderBy: { created_at: 'asc' }
        })
        return { ...session, messages }
      })
    )

    // Filter out sessions with no messages
    const sessionsWithMessages = sessionsWithMessagesData.filter(session => session.messages.length > 0)

    // Debug logging
    console.log(`📝 Chat history API: Found ${chatSessions.length} total sessions, ${sessionsWithMessages.length} with messages`)
    const voiceSessionsCount = sessionsWithMessages.filter(s => 
      s.messages.some(m => m.message_type === 'voice_transcript')
    ).length
    console.log(`📝 Chat history API: ${voiceSessionsCount} sessions contain voice transcriptions`)
    
    if (sessionsWithMessages.length > 0) {
      const firstSession = sessionsWithMessages[0]
      console.log(`📝 First session: ${firstSession.messages.length} messages, messageTypes:`, 
        firstSession.messages.map(m => m.message_type || 'text').join(', '))
    }

    return NextResponse.json({
      success: true,
      sessions: sessionsWithMessages
    })
  } catch (error) {
    console.error('Chat history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}