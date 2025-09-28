import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function DELETE(
  request: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoId } = params

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Verify video belongs to creator
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, title')
      .eq('id', videoId)
      .eq('creator_id', creator.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Delete content chunks first (cascade should handle this, but being explicit)
    const { error: chunksError } = await supabase
      .from('content_chunks')
      .delete()
      .eq('video_id', videoId)

    if (chunksError) {
      console.error('Error deleting content chunks:', chunksError)
      return NextResponse.json({ error: 'Failed to delete content chunks' }, { status: 500 })
    }

    // Delete video
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)

    if (deleteError) {
      console.error('Error deleting video:', deleteError)
      return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Video "${video.title}" and all associated content chunks have been deleted.`
    })
  } catch (error) {
    console.error('Error in video delete API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}