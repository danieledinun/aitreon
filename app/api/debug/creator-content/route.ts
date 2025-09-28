import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 })
    }

    console.log(`🔍 Debugging creator content for ${creatorId}`)

    // Get creator info
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      select: { 
        display_name: true, 
        bio: true,
        youtube_channel_id: true,
        username: true
      }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Get video data
    const videos = await db.video.findMany({
      where: { 
        creator_id: creatorId,
        is_processed: true 
      },
      select: { 
        id: true,
        title: true, 
        description: true,
        published_at: true,
        duration: true
      },
      orderBy: { published_at: 'desc' },
      take: 10
    })

    // Get sample chunks
    const chunks = await db.contentChunk.findMany({
      where: {
        video: { creator_id: creatorId }
      },
      select: {
        content: true,
        metadata: true,
        video: {
          select: {
            title: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 20
    })

    // Get total counts
    const totalVideos = await db.video.count({
      where: { creator_id: creatorId }
    })

    const totalProcessed = await db.video.count({
      where: { creator_id: creatorId, is_processed: true }
    })

    const totalChunks = await db.contentChunk.count({
      where: { video: { creator_id: creatorId } }
    })

    return NextResponse.json({
      creator,
      stats: {
        totalVideos,
        totalProcessed,
        totalChunks
      },
      sampleVideos: videos.map(v => ({
        title: v.title,
        description: v.description?.substring(0, 200) + '...',
        duration: v.duration,
        publishedAt: v.published_at
      })),
      sampleChunks: chunks.slice(0, 5).map(c => ({
        content: c.content.substring(0, 300) + '...',
        videoTitle: c.video.title,
        metadata: c.metadata ? JSON.parse(c.metadata) : null
      })),
      contentSample: {
        videoTitles: videos.map(v => v.title),
        chunkContents: chunks.slice(0, 10).map(c => c.content.substring(0, 150))
      }
    })

  } catch (error) {
    console.error('❌ Error debugging creator content:', error)
    return NextResponse.json({ 
      error: 'Failed to debug content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}