import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const subscriptionStatusSchema = z.object({
  creatorId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { creatorId } = subscriptionStatusSchema.parse(body)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString().split('T')[0]

    // Check if user is a paid subscriber for this creator
    const { data: paidSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('creator_id', creatorId)
      .eq('status', 'ACTIVE')
      .single()

    // Check if user is following this creator (free follow)
    const { data: followSubscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('creator_id', creatorId)
      .eq('is_active', true)
      .single()

    // Get today's daily usage
    const { data: dailyUsage } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('creator_id', creatorId)
      .eq('date', todayISO)
      .single()

    // Determine user tier and limits
    const isPaidSubscriber = !!paidSubscription
    const isFollowing = !!followSubscription
    const currentUsage = dailyUsage?.message_count || 0

    let userTier: 'free' | 'follower' | 'paid' = 'free'
    let messageLimit = 2

    if (isPaidSubscriber) {
      userTier = 'paid'
      messageLimit = -1 // Unlimited
    } else if (isFollowing) {
      userTier = 'follower'
      messageLimit = 5
    }

    const remainingMessages = messageLimit === -1 ? 999 : Math.max(0, messageLimit - currentUsage)

    return NextResponse.json({
      success: true,
      isPaidSubscriber,
      isFollowing,
      userTier,
      messageLimit,
      dailyUsage: currentUsage,
      remainingMessages
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}