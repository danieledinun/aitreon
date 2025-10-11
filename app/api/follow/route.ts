import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const followSchema = z.object({
  creatorId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { creatorId } = followSchema.parse(body)

    // Check if user is already following this creator
    const { data: existingFollow } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('creator_id', creatorId)
      .single()

    if (existingFollow) {
      // Toggle follow status
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ is_active: !existingFollow.is_active })
        .eq('user_id', session.user.id)
        .eq('creator_id', creatorId)

      if (error) {
        console.error('Error updating follow status:', error)
        return NextResponse.json({ error: 'Failed to update follow status' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        isFollowing: !existingFollow.is_active,
        message: !existingFollow.is_active ? 'Successfully followed creator' : 'Successfully unfollowed creator'
      })
    } else {
      // Create new follow
      const { error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: session.user.id,
          creator_id: creatorId,
          subscription_type: 'follow',
          is_active: true
        })

      if (error) {
        console.error('Error creating follow:', error)
        return NextResponse.json({ error: 'Failed to follow creator' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        isFollowing: true,
        message: 'Successfully followed creator'
      })
    }
  } catch (error) {
    console.error('Follow error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}