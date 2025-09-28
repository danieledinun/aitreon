import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and creator using Supabase
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    // Get all videos for this creator using Supabase
    const { data: allVideos } = await supabase
      .from('videos')
      .select('id, title, is_processed, created_at, updated_at')
      .eq('creator_id', creator.id)
      .order('created_at', { ascending: false })

    console.log('📊 Processing Status - Found videos:', allVideos?.length || 0)
    console.log('📊 Processing Status - Videos status:', allVideos?.map(v => ({
      id: v.id,
      title: v.title,
      is_processed: v.is_processed
    })))

    if (!allVideos) {
      return NextResponse.json({
        isProcessing: false,
        totalVideos: 0,
        processedVideos: 0,
        processingVideos: [],
        recentlyCompleted: [],
        hasErrors: false,
        lastChecked: new Date().toISOString()
      })
    }

    const totalVideos = allVideos.length
    const processedVideos = allVideos.filter(v => v.is_processed === true).length
    const processingVideos = allVideos.filter(v => v.is_processed === false)
    const recentlyCompleted = allVideos.filter(v =>
      v.is_processed === true &&
      v.updated_at &&
      new Date(v.updated_at) > new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
    )

    // If all videos are processed, there's no processing happening
    const isProcessing = processingVideos.length > 0

    const status = {
      isProcessing,
      totalVideos,
      processedVideos,
      processingVideos: processingVideos.map(v => v.id),
      recentlyCompleted: recentlyCompleted.map(v => v.id),
      hasErrors: false, // No processing status field to check errors
      startedAt: allVideos.length > 0 ? allVideos[allVideos.length - 1].created_at : null,
      lastChecked: new Date().toISOString()
    }

    console.log('📊 Processing Status - Returning status:', status)

    return NextResponse.json(status)

  } catch (error) {
    console.error('Error checking processing status:', error)
    return NextResponse.json({
      error: 'Failed to check processing status'
    }, { status: 500 })
  }
}