import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { cancelImmediately = false } = await request.json()

    // Get creator for current user
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, plan_tier, subscription_status')
      .eq('user_id', session.user.id)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    if (creator.plan_tier === 'FREE') {
      return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 })
    }

    // TODO: Integrate with Stripe to cancel subscription
    // For development, we'll update the database directly

    if (cancelImmediately) {
      // Immediate cancellation - downgrade to FREE immediately
      const { error: updateError } = await supabase
        .from('creators')
        .update({
          plan_tier: 'FREE',
          billing_period: null,
          subscription_status: 'canceled',
          current_period_ends_at: new Date().toISOString(),
        })
        .eq('id', creator.id)

      if (updateError) {
        console.error('Error canceling subscription:', updateError)
        return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription canceled immediately. You have been downgraded to the FREE plan.',
      })
    } else {
      // Cancel at end of billing period - mark as canceled but keep access until period ends
      const { error: updateError } = await supabase
        .from('creators')
        .update({
          subscription_status: 'canceled',
        })
        .eq('id', creator.id)

      if (updateError) {
        console.error('Error canceling subscription:', updateError)
        return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
      }

      // In production with Stripe, you would:
      // await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })

      return NextResponse.json({
        success: true,
        message: 'Subscription will be canceled at the end of your billing period. You can continue using your current plan until then.',
      })
    }
  } catch (error) {
    console.error('Error in subscription cancellation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
