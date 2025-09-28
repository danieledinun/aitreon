import { NextRequest, NextResponse } from 'next/server'
import { RAGService } from '@/lib/rag-service'
import { db } from '@/lib/database'
import { z } from 'zod'

const voiceVideoSearchSchema = z.object({
  query: z.string().min(1).max(500),
  creatorId: z.string().min(1), // Creator ID is required for any creator
  limit: z.number().optional().default(5),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, creatorId, limit } = voiceVideoSearchSchema.parse(body)

    console.log(`🎤🔍 Voice agent video search: "${query}" for creator ${creatorId}`)

    // Get available videos for the creator
    const videos = await db.video.findMany({
      where: { 
        creatorId,
        isProcessed: true,
        transcript: {
          not: null
        }
      },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        description: true,
        thumbnail: true,
        duration: true,
        publishedAt: true
      },
      orderBy: {
        publishedAt: 'desc'
      },
      take: 100 // Get a larger pool to search from
    })

    console.log(`🎤📺 Found ${videos.length} processed videos for creator`)

    if (videos.length === 0) {
      return NextResponse.json({
        success: true,
        query,
        availableVideos: [],
        suggestions: [],
        message: 'No processed videos found for this creator'
      })
    }

    // Use GraphRAG service to find most relevant videos based on query
    console.log(`🧠 Using GraphRAG to search for videos matching: "${query}"`)
    const graphResults = await RAGService.searchWithGraphRAG(creatorId, query, limit * 2)
    
    // Format GraphRAG results as citations for compatibility
    const citations = graphResults.map((result, index) => ({
      videoId: result.videoId,
      videoTitle: result.videoTitle,
      videoUrl: result.videoUrl,
      timestampUrl: result.timestampUrl,
      content: result.content,
      startTime: result.startTime,
      endTime: result.endTime,
      relevanceScore: result.relevanceScore || (1 - (index * 0.05)) // Decreasing relevance
    }))
    
    // Calculate confidence based on GraphRAG results
    const confidence = citations.length > 0 
      ? citations.reduce((sum, c) => sum + (c.relevanceScore || 0.5), 0) / citations.length 
      : 0

    console.log(`🎤🧠 RAG found ${citations.length} relevant citations with confidence: ${confidence}`)

    // Transform citations into video suggestions with relevance
    const videoSuggestions = citations
      .slice(0, limit)
      .map((citation, index) => {
        // Match by YouTube ID instead of database ID
        const matchingVideo = videos.find(v => citation.videoUrl && citation.videoUrl.includes(v.youtubeId))
        
        return {
          videoId: citation.videoId || 'unknown',
          youtubeId: matchingVideo?.youtubeId || citation.videoId || 'unknown', // Use matched video or fallback to citation.videoId
          videoTitle: citation.videoTitle,
          startTime: citation.startTime,
          endTime: citation.endTime,
          content: citation.content,
          videoUrl: citation.videoUrl,
          timestampUrl: citation.timestampUrl,
          relevanceScore: citation.relevanceScore || (1 - (index * 0.1)), // Decreasing relevance
          thumbnail: matchingVideo?.thumbnail,
          duration: matchingVideo?.duration,
          reasonForSuggestion: `This video covers "${citation.content.slice(0, 100)}..." which relates to your query about "${query}"`
        }
      })

    // Get all available video titles for agent awareness
    const availableVideoTitles = videos.map(v => ({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      description: v.description?.slice(0, 200) || ''
    }))

    return NextResponse.json({
      success: true,
      query,
      availableVideos: availableVideoTitles,
      suggestions: videoSuggestions,
      confidence,
      totalVideosAvailable: videos.length,
      message: videoSuggestions.length > 0 
        ? `Found ${videoSuggestions.length} relevant videos for "${query}"` 
        : `No specific videos found for "${query}", but ${videos.length} videos are available`
    })

  } catch (error) {
    console.error('🎤❌ Voice video search error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 })
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to search videos'
    }, { status: 500 })
  }
}

// GET endpoint for simple video listing (no search)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!creatorId) {
      return NextResponse.json({ 
        error: 'Creator ID is required' 
      }, { status: 400 })
    }

    console.log(`🎤📋 Voice agent requesting video list for creator ${creatorId}`)

    const videos = await db.video.findMany({
      where: { 
        creatorId,
        isProcessed: true,
        transcript: {
          not: null
        }
      },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        description: true,
        thumbnail: true,
        duration: true,
        publishedAt: true
      },
      orderBy: {
        publishedAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json({
      success: true,
      videos: videos.map(video => ({
        id: video.id,
        youtubeId: video.youtubeId,
        title: video.title,
        description: video.description?.slice(0, 200) || '',
        thumbnail: video.thumbnail,
        duration: video.duration,
        publishedAt: video.publishedAt,
        videoUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`
      })),
      totalCount: videos.length,
      creatorId
    })

  } catch (error) {
    console.error('🎤❌ Voice video list error:', error)
    return NextResponse.json({ 
      error: 'Failed to get video list' 
    }, { status: 500 })
  }
}