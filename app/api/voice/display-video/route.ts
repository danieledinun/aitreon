import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { 
      userId, 
      roomName,
      videoId,
      videoTitle,
      recipeName
    } = await request.json()

    if (!userId || !videoId || !videoTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, videoId, videoTitle' },
        { status: 400 }
      )
    }

    console.log('🎥 Voice agent requesting video display:', {
      userId,
      roomName,
      videoId, 
      videoTitle,
      recipeName
    })

    // For now, we'll just log the request and return success
    // The frontend will need to listen for these events via WebSocket or polling
    // to actually display the video overlay
    
    // In a production system, you might:
    // 1. Store this in Redis or database for the frontend to poll
    // 2. Send via WebSocket to the specific user session
    // 3. Use Server-Sent Events to push to frontend
    
    // Store the video display request (simple in-memory for demo)
    // You could replace this with Redis, database, or WebSocket
    global.pendingVideoDisplays = global.pendingVideoDisplays || new Map()
    
    const displayRequest = {
      videoId,
      videoTitle,
      recipeName,
      timestamp: new Date().toISOString(),
      roomName,
      userId
    }
    
    global.pendingVideoDisplays.set(userId, displayRequest)
    
    console.log('✅ Video display request stored for user:', userId)
    
    return NextResponse.json({
      success: true,
      message: 'Video display request received',
      videoId,
      videoTitle,
      recipeName
    })

  } catch (error: any) {
    console.error('❌ Error handling video display request:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process video display request', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check for pending video displays (polling)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }
    
    const pendingDisplays = global.pendingVideoDisplays || new Map()
    const pendingVideo = pendingDisplays.get(userId)
    
    if (pendingVideo) {
      // Clear the pending display after retrieving it
      pendingDisplays.delete(userId)
      
      return NextResponse.json({
        hasPendingVideo: true,
        videoDisplay: pendingVideo
      })
    }
    
    return NextResponse.json({
      hasPendingVideo: false
    })
    
  } catch (error: any) {
    console.error('❌ Error checking pending video displays:', error)
    return NextResponse.json(
      { error: 'Failed to check pending videos', details: error.message },
      { status: 500 }
    )
  }
}