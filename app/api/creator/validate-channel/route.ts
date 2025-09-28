import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { youtubeChannelUrl } = await request.json()

    if (!youtubeChannelUrl) {
      return NextResponse.json({
        available: false,
        error: 'YouTube channel URL is required'
      })
    }

    // Basic URL validation
    try {
      new URL(youtubeChannelUrl)
    } catch {
      return NextResponse.json({
        available: false,
        error: 'Please enter a valid YouTube URL'
      })
    }

    if (!youtubeChannelUrl.includes('youtube.com')) {
      return NextResponse.json({
        available: false,
        error: 'Please enter a valid YouTube channel URL'
      })
    }


    // Check if YouTube channel is already connected to another creator
    const { data: existingChannel } = await supabase
      .from('creators')
      .select('id')
      .eq('youtube_channel_url', youtubeChannelUrl)
      .single()

    return NextResponse.json({
      available: !existingChannel,
      error: existingChannel ? 'This YouTube channel is already connected to another creator' : null
    })

  } catch (error) {
    console.error('Channel validation error:', error)
    return NextResponse.json({
      available: false,
      error: 'Failed to validate YouTube channel'
    }, { status: 500 })
  }
}