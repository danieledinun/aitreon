import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { AccessToken, RoomServiceClient, AgentDispatchClient } from 'livekit-server-sdk'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomName, creatorId } = await request.json()

    if (!roomName || !creatorId) {
      return NextResponse.json({ error: 'Room name and creator ID are required' }, { status: 400 })
    }

    // Verify user has access to this creator
    const creator = await db.creator.findUnique({
      where: { id: creatorId }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Check for active subscriptions separately
    const activeSubscriptions = await db.subscription.findMany({
      where: { 
        userId: session.user.id, 
        creatorId: creatorId,
        status: 'ACTIVE' 
      }
    })

    // Check if user is the creator or has an active subscription
    const user = await db.user.findUnique({
      where: { id: session.user.id }
    })

    // Check if user is a creator
    const userCreator = await db.creator.findFirst({
      where: { userId: session.user.id }
    })

    const isCreator = userCreator?.id === creatorId
    const hasSubscription = activeSubscriptions.length > 0

    if (!isCreator && !hasSubscription) {
      return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
    }

    const livekitUrl = process.env.LIVEKIT_URL
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!livekitUrl || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    // Create room if it doesn't exist
    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret)
    
    let roomCreated = false
    try {
      await roomService.createRoom({
        name: roomName,
        maxParticipants: 10, // Creator + up to 9 fans
        emptyTimeout: 1800,   // 30 minutes before room closes when empty
        departureTimeout: 300, // 5 minutes before participant is removed after disconnect
        metadata: JSON.stringify({
          creatorId,
          creatorName: creator.displayName,
          createdAt: new Date().toISOString()
        })
      })
      roomCreated = true
      console.log('✅ Created new LiveKit room:', roomName)
    } catch (error: any) {
      // Room might already exist, which is fine
      if (!error.message?.includes('already exists')) {
        console.error('❌ Failed to create LiveKit room:', error)
      } else {
        console.log('ℹ️ Room already exists:', roomName)
      }
    }

    // Dispatch AI agent to voice call rooms (only if no agent is already present)
    if (roomName.includes('voice_call')) {
      try {
        const agentDispatch = new AgentDispatchClient(livekitUrl, apiKey, apiSecret)
        
        // Check if there's already an AI agent in the room
        const participants = await roomService.listParticipants(roomName)
        const hasAgent = participants.some(p => 
          p.identity.includes('agent') || 
          p.name?.toLowerCase().includes('agent')
        )
        
        if (!hasAgent) {
          console.log('🤖 Dispatching AI agent to voice call room:', roomName)
          // Dispatch with specific metadata to avoid duplicates
          await agentDispatch.createDispatch(roomName, {
            metadata: JSON.stringify({
              roomName,
              dispatchedAt: Date.now(),
              preventDuplicates: true
            })
          })
          console.log('✅ AI agent dispatched successfully to room:', roomName)
        } else {
          console.log('ℹ️ AI agent already present in room:', roomName)
        }
      } catch (dispatchError) {
        console.error('❌ Failed to dispatch AI agent:', dispatchError)
        console.error('❌ Dispatch error details:', dispatchError.message)
        // Don't fail the token generation if agent dispatch fails
      }
    }

    // Generate access token with longer expiration
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: session.user.id,
      name: session.user.name || session.user.email || 'User',
      metadata: JSON.stringify({
        userId: session.user.id,
        userEmail: session.user.email,
        isCreator,
        creatorId: isCreator ? creatorId : undefined
      }),
      ttl: '24h' // Token valid for 24 hours instead of default (which might be 15 seconds)
    })

    // Set permissions based on user role
    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomRecord: isCreator, // Only creators can record
      roomAdmin: isCreator,  // Only creators have admin rights
    })

    const token = await accessToken.toJwt()

    console.log('🎤 Generated LiveKit token for user:', session.user.id, 'room:', roomName)

    return NextResponse.json({
      token,
      serverUrl: livekitUrl,
      roomName,
      identity: session.user.id,
      metadata: {
        isCreator,
        creatorId,
        creatorName: creator.displayName
      }
    })

  } catch (error) {
    console.error('❌ LiveKit token generation error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate room access token' 
    }, { status: 500 })
  }
}

// Get room info and participants
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomName = searchParams.get('roomName')

    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
    }

    const livekitUrl = process.env.LIVEKIT_URL
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!livekitUrl || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret)
    
    try {
      const rooms = await roomService.listRooms([roomName])
      const participants = await roomService.listParticipants(roomName)
      
      return NextResponse.json({
        room: rooms.length > 0 ? rooms[0] : null,
        participants,
        participantCount: participants.length
      })
    } catch (error) {
      // Room might not exist yet
      return NextResponse.json({
        room: null,
        participants: [],
        participantCount: 0
      })
    }

  } catch (error) {
    console.error('❌ LiveKit room info error:', error)
    return NextResponse.json({ 
      error: 'Failed to get room information' 
    }, { status: 500 })
  }
}