import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// In-memory log storage (in production, use Redis or database)
let processingLogs: Record<string, string[]> = {}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    console.log(`🔍 Processing logs GET - Session user ID: ${session?.user?.id}`)
    
    if (!session?.user?.id) {
      console.log(`❌ Processing logs GET - Unauthorized (no session)`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const logs = processingLogs[session.user.id] || []
    console.log(`📊 Processing logs GET - Found ${logs.length} logs for user ${session.user.id}`)
    console.log(`📋 Current logs:`, logs.slice(-5)) // Show last 5 logs for debugging
    
    return NextResponse.json({ logs })

  } catch (error) {
    console.error('Error fetching processing logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, clear, userId } = await request.json()
    console.log(`🔍 Processing logs POST - Request: { message: "${message}", clear: ${clear}, userId: "${userId}" }`)
    
    // For server-side calls, userId is required
    // For frontend calls, we'll get session
    let targetUserId = userId
    
    if (!targetUserId) {
      const session = await getServerSession(authOptions)
      console.log(`🔍 Processing logs POST - Session user ID: ${session?.user?.id}`)
      
      if (!session?.user?.id) {
        console.log(`❌ Processing logs POST - Unauthorized (no session and no userId)`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      targetUserId = session.user.id
    }
    
    console.log(`🔍 Processing logs POST - Target user ID: ${targetUserId}`)

    if (clear) {
      processingLogs[targetUserId] = []
      console.log(`✅ Cleared logs for user: ${targetUserId}`)
    } else if (message) {
      if (!processingLogs[targetUserId]) {
        processingLogs[targetUserId] = []
      }
      const logEntry = `${new Date().toLocaleTimeString()}: ${message}`
      processingLogs[targetUserId].push(logEntry)
      console.log(`✅ Added log for user ${targetUserId}: ${logEntry}`)
      
      // Keep only last 50 logs
      if (processingLogs[targetUserId].length > 50) {
        processingLogs[targetUserId] = processingLogs[targetUserId].slice(-50)
      }
      
      console.log(`📊 Total logs for user ${targetUserId}: ${processingLogs[targetUserId].length}`)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating processing logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to add logs (can be imported in other files)
export async function addProcessingLog(userId: string, message: string) {
  if (!processingLogs[userId]) {
    processingLogs[userId] = []
  }
  processingLogs[userId].push(`${new Date().toLocaleTimeString()}: ${message}`)
  
  if (processingLogs[userId].length > 50) {
    processingLogs[userId] = processingLogs[userId].slice(-50)
  }
}