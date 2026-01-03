import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { cancelSubscription, resumeSubscription, getSubscriptionPeriodEnd } from '@/lib/stripe'

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
      .select('id, plan_tier, subscription_status, stripe_subscription_id')
      .eq('user_id', session.user.id)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    if (creator.plan_tier === 'FREE') {
      return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 })
    }

    // If there's a Stripe subscription, cancel it through Stripe
    if (creator.stripe_subscription_id) {
      try {
        const subscription = await cancelSubscription(
          creator.stripe_subscription_id,
          !cancelImmediately // cancel_at_period_end = true by default
        )

        if (cancelImmediately) {
          // Immediate cancellation - downgrade to FREE
          const { error: updateError } = await supabase
            .from('creators')
            .update({
              plan_tier: 'FREE',
              billing_period: null,
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              current_period_ends_at: null,
              trial_ends_at: null,
            })
            .eq('id', creator.id)

          if (updateError) {
            console.error('Error updating creator after cancellation:', updateError)
            return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            message: 'Subscription canceled immediately. You have been downgraded to the FREE plan.',
          })
        } else {
          // Cancel at end of billing period
          const { error: updateError } = await supabase
            .from('creators')
            .update({
              subscription_status: 'canceled',
            })
            .eq('id', creator.id)

          if (updateError) {
            console.error('Error updating subscription status:', updateError)
            return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
          }

          const periodEnd = new Date(getSubscriptionPeriodEnd(subscription) * 1000)
          return NextResponse.json({
            success: true,
            message: `Subscription will be canceled at the end of your billing period (${periodEnd.toLocaleDateString()}). You can continue using your current plan until then.`,
            periodEnd: periodEnd.toISOString(),
          })
        }
      } catch (stripeError) {
        console.error('Stripe cancellation error:', stripeError)
        return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
      }
    } else {
      // No Stripe subscription - just update the database
      if (cancelImmediately) {
        const { error: updateError } = await supabase
          .from('creators')
          .update({
            plan_tier: 'FREE',
            billing_period: null,
            subscription_status: 'canceled',
            current_period_ends_at: null,
          })
          .eq('id', creator.id)

        if (updateError) {
          console.error('Error canceling subscription:', updateError)
          return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Subscription canceled. You have been downgraded to the FREE plan.',
        })
      } else {
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

        return NextResponse.json({
          success: true,
          message: 'Subscription marked for cancellation at the end of your billing period.',
        })
      }
    }
  } catch (error) {
    console.error('Error in subscription cancellation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Resume a canceled subscription (if still in billing period)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get creator for current user
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, subscription_status, stripe_subscription_id')
      .eq('user_id', session.user.id)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    if (creator.subscription_status !== 'canceled') {
      return NextResponse.json({ error: 'No canceled subscription to resume' }, { status: 400 })
    }

    if (!creator.stripe_subscription_id) {
      return NextResponse.json({ error: 'No Stripe subscription found' }, { status: 400 })
    }

    try {
      // Resume the Stripe subscription
      const subscription = await resumeSubscription(creator.stripe_subscription_id)

      // Update our database
      const { error: updateError } = await supabase
        .from('creators')
        .update({
          subscription_status: 'active',
        })
        .eq('id', creator.id)

      if (updateError) {
        console.error('Error resuming subscription:', updateError)
        return NextResponse.json({ error: 'Failed to resume subscription' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription resumed successfully. Your plan will continue.',
      })
    } catch (stripeError) {
      console.error('Stripe resume error:', stripeError)
      return NextResponse.json({ error: 'Failed to resume subscription' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error resuming subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
