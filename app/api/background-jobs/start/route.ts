import { NextRequest, NextResponse } from 'next/server'
import { backgroundJobService } from '@/lib/background-jobs'
import { conversationTracker } from '@/lib/conversation-tracker'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting background services...')

    // Start the background job processor
    backgroundJobService.start()

    // Start the conversation tracker
    conversationTracker.start()

    console.log('✅ Background services started successfully')

    return NextResponse.json({
      success: true,
      message: 'Background services started successfully',
      services: {
        backgroundJobs: 'running',
        conversationTracker: 'running'
      }
    })

  } catch (error) {
    console.error('❌ Error starting background services:', error)
    return NextResponse.json({
      error: 'Failed to start background services'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get status of background services
    const conversationStats = conversationTracker.getStats()

    return NextResponse.json({
      success: true,
      status: {
        conversationTracker: {
          activeConversations: conversationStats.activeConversations,
          conversations: conversationStats.conversations
        }
      }
    })

  } catch (error) {
    console.error('❌ Error getting background service status:', error)
    return NextResponse.json({
      error: 'Failed to get status'
    }, { status: 500 })
  }
}