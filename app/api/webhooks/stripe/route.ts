import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  stripe,
  mapStripeStatus,
  getPlanTierFromPriceId,
  getBillingPeriodFromPriceId,
  getSubscriptionPeriodEnd,
} from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  console.log(`Processing Stripe webhook: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentSucceeded(invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id)

  const creatorId = session.metadata?.creatorId
  const targetTier = session.metadata?.targetTier
  const billingPeriod = session.metadata?.billingPeriod
  const subscriptionId = session.subscription as string

  if (!creatorId || !subscriptionId) {
    console.error('Missing creatorId or subscriptionId in checkout session metadata')
    return
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // Update creator in database
  const { error } = await supabase
    .from('creators')
    .update({
      plan_tier: targetTier || 'PRO',
      billing_period: billingPeriod || 'monthly',
      subscription_status: mapStripeStatus(subscription.status),
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
      current_period_ends_at: new Date(getSubscriptionPeriodEnd(subscription) * 1000).toISOString(),
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    })
    .eq('id', creatorId)

  if (error) {
    console.error('Error updating creator after checkout:', error)
    throw error
  }

  console.log(`Creator ${creatorId} upgraded to ${targetTier}`)
}

/**
 * Handle subscription updates (plan changes, status changes)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id)

  const customerId = subscription.customer as string

  // Find creator by Stripe customer ID
  const { data: creator, error: findError } = await supabase
    .from('creators')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !creator) {
    console.log('Creator not found for customer:', customerId)
    return
  }

  // Get the price ID from the subscription
  const priceId = subscription.items.data[0]?.price?.id
  const planTier = priceId ? getPlanTierFromPriceId(priceId) : null
  const billingPeriod = priceId ? getBillingPeriodFromPriceId(priceId) : null

  // Update creator subscription status
  const updateData: Record<string, unknown> = {
    subscription_status: mapStripeStatus(subscription.status),
    current_period_ends_at: new Date(getSubscriptionPeriodEnd(subscription) * 1000).toISOString(),
    trial_ends_at: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
  }

  // Only update plan tier if we can determine it from the price
  if (planTier) {
    updateData.plan_tier = planTier
  }
  if (billingPeriod) {
    updateData.billing_period = billingPeriod
  }

  // Handle cancellation at period end
  if (subscription.cancel_at_period_end) {
    updateData.subscription_status = 'canceled'
  }

  const { error } = await supabase
    .from('creators')
    .update(updateData)
    .eq('id', creator.id)

  if (error) {
    console.error('Error updating creator subscription:', error)
    throw error
  }

  console.log(`Creator ${creator.id} subscription updated to status: ${subscription.status}`)
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id)

  const customerId = subscription.customer as string

  // Find creator by Stripe customer ID
  const { data: creator, error: findError } = await supabase
    .from('creators')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !creator) {
    console.log('Creator not found for customer:', customerId)
    return
  }

  // Downgrade to FREE plan
  const { error } = await supabase
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

  if (error) {
    console.error('Error downgrading creator:', error)
    throw error
  }

  console.log(`Creator ${creator.id} downgraded to FREE plan`)
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Invoice payment succeeded:', invoice.id)

  const customerId = invoice.customer as string
  // Get subscription ID from parent.subscription_details in new Stripe API
  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subscriptionRef === 'string'
    ? subscriptionRef
    : subscriptionRef?.id

  if (!subscriptionId) {
    // Not a subscription invoice
    return
  }

  // Find creator by Stripe customer ID
  const { data: creator, error: findError } = await supabase
    .from('creators')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !creator) {
    return
  }

  // Get subscription to update period end date
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // Update subscription status to active and update period
  const { error } = await supabase
    .from('creators')
    .update({
      subscription_status: 'active',
      current_period_ends_at: new Date(getSubscriptionPeriodEnd(subscription) * 1000).toISOString(),
    })
    .eq('id', creator.id)

  if (error) {
    console.error('Error updating creator after payment:', error)
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Invoice payment failed:', invoice.id)

  const customerId = invoice.customer as string

  // Find creator by Stripe customer ID
  const { data: creator, error: findError } = await supabase
    .from('creators')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !creator) {
    return
  }

  // Update subscription status to past_due
  const { error } = await supabase
    .from('creators')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', creator.id)

  if (error) {
    console.error('Error updating creator after payment failure:', error)
  }

  // Here you could also send an email to the creator about the failed payment
  console.log(`Payment failed for creator ${creator.id}`)
}
