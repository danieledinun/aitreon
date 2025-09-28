import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@/lib/supabase'

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get creator using Supabase
    const supabase = createClient()

    const { data: user } = await supabase
      .from('users')
      .select('*, creators(*)')
      .eq('email', session.user.email)
      .single()

    if (!user?.creators?.[0]) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    const creator = user.creators[0]

    const { videoId } = await request.json()
    
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
    }

    // Find the video to ensure it belongs to this creator
    const { data: video } = await supabase
      .from('videos')
      .select('*')
      .eq('youtube_id', videoId)
      .eq('creator_id', creator.id)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'Video not found or access denied' }, { status: 404 })
    }

    console.log(`🗑️ Removing video ${video.title} (${videoId}) from knowledge base`)

    // Remove video and related content chunks from database
    await supabase
      .from('content_chunks')
      .delete()
      .eq('video_id', video.id)

    await supabase
      .from('videos')
      .delete()
      .eq('id', video.id)

    console.log(`✅ Successfully removed video ${video.title} from knowledge base`)

    return NextResponse.json({
      success: true,
      message: 'Video removed from knowledge base',
      removedVideo: {
        id: video.id,
        youtubeId: video.youtube_id,
        title: video.title
      }
    })

  } catch (error) {
    console.error('Remove video error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to remove video from knowledge base', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}