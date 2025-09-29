import { NextRequest, NextResponse } from 'next/server'
import { SuggestedQuestionsGenerator } from '@/lib/suggested-questions-generator'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')
    const refresh = searchParams.get('refresh') === 'true'
    const debug = searchParams.get('debug') === 'true'

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 })
    }

    console.log(`📝 Getting suggested questions for creator ${creatorId}${refresh ? ' (force refresh)' : ''}${debug ? ' (debug mode)' : ''}`)

    let questions
    if (refresh || debug) {
      // Always refresh in debug mode
      questions = await SuggestedQuestionsGenerator.refreshSuggestedQuestions(creatorId)
    } else {
      questions = await SuggestedQuestionsGenerator.getCachedSuggestedQuestions(creatorId)
    }

    const response: any = { 
      success: true,
      questions,
      count: questions.length,
      cached: !refresh && !debug
    }

    // Add debug information
    if (debug) {
      const { db } = await import('@/lib/database')
      
      // Get basic stats for debugging
      const creator = await db.creator.findUnique({
        where: { id: creatorId }
      })

      const videoCount = await db.video.count({
        where: { creator_id: creatorId, is_processed: true }
      })

      const chunkCount = await db.contentChunk.count({
        where: { video: { creator_id: creatorId } }
      })

      response.debug = {
        creator,
        videoCount,
        chunkCount,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error getting suggested questions:', error)
    return NextResponse.json({ 
      error: 'Failed to get suggested questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Admin endpoint to regenerate questions
export async function POST(request: NextRequest) {
  try {
    const { creatorId } = await request.json()

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 })
    }

    console.log(`🔄 Manually regenerating suggested questions for creator ${creatorId}`)

    const questions = await SuggestedQuestionsGenerator.refreshSuggestedQuestions(creatorId)

    return NextResponse.json({ 
      success: true,
      message: 'Questions regenerated successfully',
      questions,
      count: questions.length
    })

  } catch (error) {
    console.error('❌ Error regenerating suggested questions:', error)
    return NextResponse.json({ 
      error: 'Failed to regenerate questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}