import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { EnhancedRAGService } from '@/lib/enhanced-rag-service'

const SUPER_ADMIN_EMAILS = [
  'the-air-fryer-g-9837@pages.plusgoogle.com', // Your current email
  'admin@aitrion.com'
]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !SUPER_ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { creatorId, message } = await request.json()

    // Get creator
    const creator = await db.creator.findUnique({
      where: { id: creatorId }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Generate AI response using the Enhanced RAG service with reranking
    const ragResponse = await EnhancedRAGService.generateResponse(
      creatorId,
      creator.display_name,
      message,
      [] // No conversation history for testing
    )

    return NextResponse.json({
      response: ragResponse.response,
      citations: ragResponse.citations,
      confidence: ragResponse.confidence,
      searchStats: ragResponse.searchStats
    })
  } catch (error) {
    console.error('Error testing chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}