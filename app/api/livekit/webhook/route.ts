import { NextRequest, NextResponse } from 'next/server'
import { WebhookReceiver, AgentDispatchClient, TrackType } from 'livekit-server-sdk'

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
)

const agentDispatch = new AgentDispatchClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const authHeader = request.headers.get('Authorization')

    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    // Verify webhook authenticity
    const event = await receiver.receive(body, authHeader)
    console.log('🎤 LiveKit webhook event:', event.event, event.room?.name)

    switch (event.event) {
      case 'room_started':
        console.log('🎉 Room started:', event.room?.name)
        // Room created and first participant joined
        break
        
      case 'room_finished':
        console.log('👋 Room finished:', event.room?.name)
        // All participants left, room is being cleaned up
        break
        
      case 'participant_joined':
        console.log('👤 Participant joined:', event.participant?.identity)
        // New participant joined the room
        break
        
      case 'participant_left':
        console.log('👋 Participant left:', event.participant?.identity)
        // Participant left the room
        break
        
      case 'track_published':
        console.log('🎵 Track published:', event.track?.type, 'by', event.participant?.identity)
        // Audio/video track was published
        if (event.track?.type === TrackType.AUDIO && event.room?.name?.includes('voice_call')) {
          // Dispatch AI agent when user publishes audio in voice call room
          console.log('🤖 Dispatching AI agent to room:', event.room.name)
          try {
            await agentDispatch.createDispatch(event.room.name, 'voice-assistant')
            console.log('✅ AI agent dispatched successfully')
          } catch (dispatchError) {
            console.error('❌ Failed to dispatch AI agent:', dispatchError)
          }
        }
        break
        
      case 'track_unpublished':
        console.log('🔇 Track unpublished:', event.track?.type, 'by', event.participant?.identity)
        // Audio/video track was unpublished
        break
        
      default:
        console.log('📦 Unhandled event:', event.event)
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    webhook: 'LiveKit webhook endpoint',
    timestamp: new Date().toISOString()
  })
}