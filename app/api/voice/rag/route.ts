import { NextRequest, NextResponse } from 'next/server'
import { EnhancedRAGService } from '@/lib/enhanced-rag-service'
import { db } from '@/lib/database'
import { z } from 'zod'

const voiceRagSchema = z.object({
  message: z.string().min(1).max(1000),
  creatorId: z.string(),
  userId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, creatorId, userId } = voiceRagSchema.parse(body)

    console.log(`🎤🧠 Voice RAG request: "${message}" for creator ${creatorId}`)

    const creator = await db.creator.findUnique({
      where: { id: creatorId }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Generate AI response using Enhanced RAG (same as chat system)
    const { response, citations, confidence } = await EnhancedRAGService.generateResponse(
      creatorId,
      creator.display_name,
      message,
      [] // No conversation history for voice RAG lookups
    )

    console.log(`🎤🧠 Voice RAG generated ${citations.length} citations for: "${message}"`)

    // Return just the citations for voice agent video display
    return NextResponse.json({
      success: true,
      message: response,
      citations: citations.map(citation => ({
        videoId: citation.videoId || 'unknown',
        videoTitle: citation.videoTitle,
        startTime: citation.startTime,
        endTime: citation.endTime,
        content: citation.content,
        videoUrl: citation.videoUrl,
        timestampUrl: citation.timestampUrl,
        relevanceScore: citation.relevanceScore
      })),
      confidence,
      userId
    })
  } catch (error) {
    console.error('Voice RAG error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}