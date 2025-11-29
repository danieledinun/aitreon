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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get creator data if exists
    const { data: creator } = await supabase
      .from('creators')
      .select('username, display_name, bio, profile_image')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: creator?.profile_image || user.image,
      displayName: creator?.display_name || user.name,
      bio: creator?.bio,
      username: creator?.username,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, displayName, bio, profileImage } = body

    // Update user table
    const { error: userError } = await supabase
      .from('users')
      .update({
        name,
        image: profileImage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id)

    if (userError) {
      throw userError
    }

    // Update creator table if exists
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (creator) {
      const { error: creatorError } = await supabase
        .from('creators')
        .update({
          display_name: displayName || name,
          bio,
          profile_image: profileImage,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', session.user.id)

      if (creatorError) {
        throw creatorError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
