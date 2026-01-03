import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import type { PlanTier } from '@/lib/plans'
import { PLANS } from '@/lib/plans'
import {
  stripe,
  getOrCreateStripeCustomer,
  getStripePriceId,
  createCheckoutSession,
  updateSubscriptionPlan,
} from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { targetTier, billingPeriod } = await request.json()

    if (!targetTier || !['FREE', 'LITE', 'PRO', 'ULTIMATE', 'ENTERPRISE'].includes(targetTier)) {
      return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 })
    }

    if (!billingPeriod || !['monthly', 'yearly'].includes(billingPeriod)) {
      return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 })
    }

    // Get creator for current user
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, plan_tier, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', session.user.id)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    const currentTier = creator.plan_tier || 'FREE'

    // Downgrade to FREE - cancel existing subscription if any
    if (targetTier === 'FREE') {
      if (creator.stripe_subscription_id) {
        try {
          await stripe.subscriptions.update(creator.stripe_subscription_id, {
            cancel_at_period_end: true,
          })
        } catch (stripeError) {
          console.error('Error canceling Stripe subscription:', stripeError)
        }
      }

      await supabase
        .from('creators')
        .update({
          plan_tier: 'FREE',
          billing_period: null,
          subscription_status: creator.stripe_subscription_id ? 'canceled' : 'active',
        })
        .eq('id', creator.id)

      return NextResponse.json({
        success: true,
        requiresPayment: false,
        message: creator.stripe_subscription_id
          ? 'Your subscription will be canceled at the end of the billing period'
          : 'Successfully changed to FREE plan',
      })
    }

    // Get the Stripe price ID for the target plan
    const priceId = getStripePriceId(targetTier as PlanTier, billingPeriod)
    if (!priceId) {
      return NextResponse.json({
        error: 'Payment system not configured for this plan. Please contact support.'
      }, { status: 400 })
    }

    const planConfig = PLANS[targetTier as PlanTier]
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan configuration' }, { status: 400 })
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(
      session.user.email,
      session.user.name || session.user.email,
      session.user.id,
      creator.stripe_customer_id
    )

    // Update creator with Stripe customer ID if new
    if (!creator.stripe_customer_id) {
      await supabase
        .from('creators')
        .update({ stripe_customer_id: customer.id })
        .eq('id', creator.id)
    }

    // If user already has an active subscription, update it instead of creating new checkout
    if (creator.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(creator.stripe_subscription_id)

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          // Update existing subscription to new plan
          const updatedSubscription = await updateSubscriptionPlan(
            creator.stripe_subscription_id,
            priceId
          )

          // Update our database
          await supabase
            .from('creators')
            .update({
              plan_tier: targetTier,
              billing_period: billingPeriod,
              subscription_status: 'active',
            })
            .eq('id', creator.id)

          return NextResponse.json({
            success: true,
            requiresPayment: false,
            message: `Successfully changed to ${planConfig.displayName}. Your billing has been adjusted.`,
          })
        }
      } catch (error) {
        console.error('Error updating existing subscription:', error)
        // Continue to create new checkout session
      }
    }

    // Create Stripe Checkout Session for new subscription
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const checkoutSession = await createCheckoutSession({
      customerId: customer.id,
      priceId,
      successUrl: `${baseUrl}/creator/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/creator/subscription?canceled=true`,
      trialDays: planConfig.trial ? 14 : undefined,
      metadata: {
        creatorId: creator.id,
        userId: session.user.id,
        targetTier,
        billingPeriod,
      },
    })

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      checkoutUrl: checkoutSession.url,
      message: 'Redirecting to checkout...',
    })
  } catch (error) {
    console.error('Error in subscription upgrade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
