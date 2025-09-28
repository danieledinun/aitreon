import { NextRequest, NextResponse } from 'next/server'
import { RoomServiceClient } from 'livekit-server-sdk'

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
)

export async function POST(request: NextRequest) {
  try {
    const { userId, creatorId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    console.log('🧹 Cleaning up voice sessions for user:', userId, 'creator:', creatorId)

    try {
      // List all rooms to find ones with this user
      const allRooms = await roomService.listRooms()
      
      const userRooms = allRooms.filter(room => {
        // Match rooms that contain the user ID and are voice calls
        return room.name?.includes(`voice_call_${userId}`) || room.name?.includes(userId)
      })

      console.log('🔍 Found rooms to cleanup:', userRooms.map(r => r.name))

      let cleanedUpCount = 0
      let participantsRemoved = 0

      // Cleanup each room
      for (const room of userRooms) {
        try {
          console.log('🧹 Cleaning up room:', room.name)
          
          // Get participants in this room
          const participants = await roomService.listParticipants(room.name)
          console.log('👥 Participants in room:', participants.map(p => p.identity))
          
          // Remove all participants
          for (const participant of participants) {
            console.log('🚪 Removing participant:', participant.identity)
            await roomService.removeParticipant(room.name, participant.identity)
            participantsRemoved++
          }

          // Delete the room
          console.log('🗑️ Deleting room:', room.name)
          await roomService.deleteRoom(room.name)
          cleanedUpCount++
          
        } catch (roomError: any) {
          console.warn('⚠️ Error cleaning room:', room.name, roomError.message)
          // Continue with other rooms even if one fails
        }
      }

      console.log('✅ Session cleanup completed:', {
        roomsFound: userRooms.length,
        roomsCleaned: cleanedUpCount,
        participantsRemoved
      })

      return NextResponse.json({ 
        success: true, 
        message: 'User sessions cleaned up successfully',
        roomsFound: userRooms.length,
        roomsCleaned: cleanedUpCount,
        participantsRemoved,
        cleanedRooms: userRooms.map(r => r.name)
      })

    } catch (livekitError: any) {
      console.error('❌ LiveKit error during cleanup:', livekitError)
      
      // Even if cleanup fails, we want to allow the new call to proceed
      return NextResponse.json({ 
        success: true, 
        message: 'Cleanup attempted, proceeding with new call',
        warning: livekitError.message
      })
    }

  } catch (error: any) {
    console.error('❌ Error during session cleanup:', error)
    
    // Don't fail the cleanup entirely - allow new calls to proceed
    return NextResponse.json({ 
      success: true, 
      message: 'Cleanup attempted, proceeding with new call',
      error: error.message 
    })
  }
}