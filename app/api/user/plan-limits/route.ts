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

    // Get creator for current user
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, plan_tier, billing_period, subscription_status, trial_ends_at, current_period_ends_at')
      .eq('user_id', session.user.id)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: 'Creator profile not found' },
        { status: 404 }
      )
    }

    const creatorId = creator.id

    // Get video count
    const { count: videoCount, error: videoError } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)

    if (videoError) {
      console.error('Error fetching video count:', videoError)
    }

    // Get current month's message count
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: messageCount, error: messageError } = await supabase
      .from('chat_sessions')
      .select(`
        messages!inner(id)
      `, { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .gte('created_at', startOfMonth.toISOString())

    if (messageError) {
      console.error('Error fetching message count:', messageError)
    }

    return NextResponse.json({
      planTier: creator.plan_tier || 'FREE',
      billingPeriod: creator.billing_period,
      subscriptionStatus: creator.subscription_status || 'active',
      trialEndsAt: creator.trial_ends_at,
      currentPeriodEndsAt: creator.current_period_ends_at,
      videoCount: videoCount || 0,
      monthlyMessageCount: messageCount || 0,
    })
  } catch (error) {
    console.error('Error in plan-limits API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
