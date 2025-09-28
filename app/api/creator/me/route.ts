import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from session
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get creator data including YouTube info
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select(`
        id,
        user_id,
        username,
        display_name,
        bio,
        profile_image,
        youtube_channel_id,
        youtube_channel_url,
        is_active,
        created_at,
        updated_at
      `)
      .eq('user_id', userData.id)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    console.log(`📋 Creator data for ${creator.username}:`, {
      id: creator.id,
      username: creator.username,
      displayName: creator.display_name,
      youtubeChannelId: creator.youtube_channel_id,
      youtubeChannelUrl: creator.youtube_channel_url,
    })

    return NextResponse.json({
      id: creator.id,
      username: creator.username,
      displayName: creator.display_name,
      bio: creator.bio,
      profileImage: creator.profile_image,
      youtubeChannelId: creator.youtube_channel_id,
      youtubeChannelUrl: creator.youtube_channel_url,
      isActive: creator.is_active,
      createdAt: creator.created_at,
      updatedAt: creator.updated_at
    })

  } catch (error) {
    console.error('❌ Creator me API error:', error)
    return NextResponse.json({ error: 'Failed to fetch creator data' }, { status: 500 })
  }
}