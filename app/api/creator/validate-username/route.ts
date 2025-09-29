import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { username, youtubeChannelUrl } = await request.json()

    // Get current user session to check for existing creator profile
    const session = await getServerSession(authOptions)

    if (session?.user?.email) {
      // Check if this user already has a creator profile
      const { data: existingUser } = await supabase
        .from('users')
        .select(`
          id,
          creators (
            id,
            username,
            youtube_channel_url
          )
        `)
        .eq('email', session.user.email)
        .single()

      if (existingUser?.creators && existingUser.creators.length > 0) {
        const existingCreator = existingUser.creators[0]
        return NextResponse.json({
          available: false,
          error: 'You already have a creator profile',
          existingProfile: {
            username: existingCreator.username,
            youtubeUrl: existingCreator.youtube_channel_url
          }
        })
      }
    }

    if (!username || username.length < 3) {
      return NextResponse.json({
        available: false,
        error: 'Username must be at least 3 characters long'
      })
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({
        available: false,
        error: 'Username can only contain letters, numbers, and underscores'
      })
    }


    // Check if username is already taken
    const { data: existingUsername } = await supabase
      .from('creators')
      .select('id, username')
      .eq('username', username)
      .single()

    if (existingUsername) {
      return NextResponse.json({
        available: false,
        error: 'Username already taken'
      })
    }

    // Check if YouTube channel is already connected (if provided)
    if (youtubeChannelUrl) {
      const { data: existingChannel } = await supabase
        .from('creators')
        .select('id, username, youtube_channel_url')
        .eq('youtube_channel_url', youtubeChannelUrl)
        .single()

      if (existingChannel) {
        return NextResponse.json({
          available: false,
          error: 'This YouTube channel is already connected to another creator',
          conflictingProfile: {
            username: existingChannel.username
          }
        })
      }
    }

    return NextResponse.json({
      available: true,
      error: null
    })

  } catch (error) {
    console.error('Username validation error:', error)
    return NextResponse.json({
      available: false,
      error: 'Failed to validate username'
    }, { status: 500 })
  }
}