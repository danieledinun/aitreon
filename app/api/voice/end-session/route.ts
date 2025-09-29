import { NextRequest, NextResponse } from 'next/server'
import { RoomServiceClient } from 'livekit-server-sdk'

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
)

export async function POST(request: NextRequest) {
  try {
    const { roomName, reason } = await request.json()

    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
    }

    console.log('🔴 Ending voice session for room:', roomName, 'Reason:', reason || 'User ended call')

    try {
      // Get room info first
      const rooms = await roomService.listRooms([roomName])
      
      if (rooms.length === 0) {
        console.log('ℹ️ Room not found or already ended:', roomName)
        return NextResponse.json({ 
          success: true, 
          message: 'Room already ended or does not exist' 
        })
      }

      const room = rooms[0]
      console.log('📍 Room found:', room.name, 'Participants:', room.numParticipants)

      // List all participants in the room
      const participants = await roomService.listParticipants(roomName)
      console.log('👥 Participants in room:', participants.map(p => p.identity))

      // Remove all participants (this will effectively end the session)
      for (const participant of participants) {
        console.log('🚪 Removing participant:', participant.identity)
        await roomService.removeParticipant(roomName, participant.identity)
      }

      // Delete the room entirely
      console.log('🗑️ Deleting room:', roomName)
      await roomService.deleteRoom(roomName)

      console.log('✅ Successfully ended voice session:', roomName)

      return NextResponse.json({ 
        success: true, 
        message: 'Voice session ended successfully',
        roomName,
        participantsRemoved: participants.length
      })

    } catch (livekitError: any) {
      console.error('❌ LiveKit error ending session:', livekitError)
      
      // If room doesn't exist, that's actually fine - it's already ended
      if (livekitError.message?.includes('room not found') || livekitError.message?.includes('404')) {
        return NextResponse.json({ 
          success: true, 
          message: 'Room already ended' 
        })
      }
      
      throw livekitError
    }

  } catch (error: any) {
    console.error('❌ Error ending voice session:', error)
    return NextResponse.json({ 
      error: 'Failed to end voice session',
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}