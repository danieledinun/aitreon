import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const user = await db.user.findUnique({
      where: { email: session.user.email }
    })

    console.log('🔍 Videos API - User:', { id: user?.id, email: user?.email })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get creator
    const creator = await db.creator.findFirst({
      where: { userId: user.id }
    })

    console.log('🔍 Videos API - Creator:', { id: creator?.id, username: creator?.username, userId: creator?.user_id })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Get videos using the database service
    console.log('🔍 Videos API - Querying videos for creator_id:', creator.id)
    const videos = await db.video.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: 'desc' }
    })

    console.log('🔍 Videos API - Found videos:', videos.length, videos.map(v => ({ id: v.id, title: v.title, creator_id: v.creator_id })))

    // Now get content chunks for each video using the database service
    const videosWithChunks = await Promise.all((videos || []).map(async (video) => {
      try {
        console.log('Fetching chunks for video:', video.id, video.title)
        const chunks = await db.contentChunk.findMany({
          where: { video_id: video.id },
          orderBy: { chunk_index: 'asc' }
        })
        
        console.log('Found', chunks.length, 'chunks for video:', video.title)
        
        return {
          ...video,
          content_chunks: chunks
        }
      } catch (error) {
        console.warn('Error fetching chunks for video:', video.id, error)
        return {
          ...video,
          content_chunks: []
        }
      }
    }))

    return NextResponse.json({ videos: videosWithChunks })
  } catch (error) {
    console.error('Error in videos API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}