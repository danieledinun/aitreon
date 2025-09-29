import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging Tanner user data')

    // Get user data for tanner@tanner.com
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'tanner@tanner.com')
      .single()

    if (userError) {
      console.error('❌ User query error:', userError)
      return NextResponse.json({
        error: 'User query failed',
        details: userError.message
      }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({
        error: 'User not found',
        email: 'tanner@tanner.com'
      }, { status: 404 })
    }

    console.log('✅ Found user:', { id: user.id, email: user.email, name: user.name })

    // Get creator data for this user
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (creatorError) {
      console.error('❌ Creator query error:', creatorError)
    }

    const response = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        email_verified: user.email_verified
      },
      creator: creator ? {
        id: creator.id,
        user_id: creator.user_id,
        username: creator.username,
        display_name: creator.display_name,
        bio: creator.bio,
        profile_image: creator.profile_image,
        youtube_channel_id: creator.youtube_channel_id,
        youtube_channel_url: creator.youtube_channel_url,
        is_active: creator.is_active,
        created_at: creator.created_at
      } : null,
      creatorError: creatorError ? creatorError.message : null,
      isCompleteCreator: creator && creator.username && creator.display_name
    }

    console.log('📋 Tanner debug response:', response)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error debugging Tanner data:', error)
    return NextResponse.json({
      error: 'Failed to debug Tanner data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}