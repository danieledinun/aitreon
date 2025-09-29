import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { conversationTracker } from '@/lib/conversation-tracker'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomName, creatorId, participantId, text, trackId, timestamp } = await request.json()

    if (!roomName || !creatorId || !participantId || !text) {
      return NextResponse.json({ 
        error: 'Missing required fields: roomName, creatorId, participantId, text' 
      }, { status: 400 })
    }

    console.log('📝 Saving voice transcription:', {
      userId: session.user.id,
      creatorId,
      participantId,
      roomName,
      textLength: text.length
    })

    // Find or create chat session
    // Find existing chat sessions - note: orderBy not supported yet
    const chatSessions = await db.chatSession.findMany({
      where: {
        userId: session.user.id,
        creatorId: creatorId,
      }
    })
    
    let chatSession = chatSessions.length > 0 ? chatSessions[0] : null

    if (!chatSession) {
      chatSession = await db.chatSession.create({
        data: {
          user_id: session.user.id,
          creator_id: creatorId,
        }
      })
      console.log('📝 Created new chat session:', chatSession.id)
    }

    // Determine the role based on participant ID
    // If participant is the user, it's a user message
    // If participant is the agent/AI, it's an assistant message
    const isUser = participantId === session.user.id || participantId.includes('user')
    const role = isUser ? 'user' : 'assistant'
    const messageType = 'voice_transcript'

    // Create metadata object with voice call information
    const metadata = JSON.stringify({
      roomName,
      participantId,
      trackId,
      transcriptionTimestamp: timestamp,
      voiceCall: true
    })

    // Save transcription as a message
    const message = await db.message.create({
      data: {
        sessionId: chatSession.id,
        role: role,
        content: text,
        messageType: messageType,
        metadata: metadata,
      }
    })

    console.log('📝✅ Transcription saved as message:', message.id)

    // Track message for conversation end detection
    await conversationTracker.trackMessage(chatSession.id, creatorId, role.toUpperCase())

    return NextResponse.json({
      success: true,
      message: 'Transcription saved successfully',
      messageId: message.id
    })

  } catch (error) {
    console.error('📝❌ Error saving transcription:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}