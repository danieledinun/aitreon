/**
 * Stripe Configuration and Utilities
 *
 * This file provides Stripe client initialization and helper functions
 * for handling payments, subscriptions, and customer management.
 */

import Stripe from 'stripe'
import { PLANS, PlanTier, getPlanConfig } from './plans'

// Validate environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set. Stripe functionality will be limited.')
}

// Initialize Stripe client (server-side only)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
  typescript: true,
})

// Stripe Price IDs for each plan
// These should be created in your Stripe Dashboard and updated here
export const STRIPE_PRICE_IDS: Record<Exclude<PlanTier, 'FREE' | 'ENTERPRISE'>, {
  monthly: string
  yearly: string
}> = {
  LITE: {
    monthly: process.env.STRIPE_PRICE_LITE_MONTHLY || '',
    yearly: process.env.STRIPE_PRICE_LITE_YEARLY || '',
  },
  PRO: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
  },
  ULTIMATE: {
    monthly: process.env.STRIPE_PRICE_ULTIMATE_MONTHLY || '',
    yearly: process.env.STRIPE_PRICE_ULTIMATE_YEARLY || '',
  },
}

/**
 * Get Stripe price ID for a plan tier and billing period
 */
export function getStripePriceId(
  tier: PlanTier,
  billingPeriod: 'monthly' | 'yearly'
): string | null {
  if (tier === 'FREE' || tier === 'ENTERPRISE') {
    return null
  }
  return STRIPE_PRICE_IDS[tier][billingPeriod] || null
}

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(
  email: string,
  name: string,
  userId: string,
  existingCustomerId?: string | null
): Promise<Stripe.Customer> {
  // If customer already exists, retrieve them
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId)
      if (!customer.deleted) {
        return customer as Stripe.Customer
      }
    } catch (error) {
      console.error('Error retrieving customer:', error)
    }
  }

  // Create a new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  })

  return customer
}

/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession({
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  trialDays,
  metadata,
}: {
  customerId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  trialDays?: number
  metadata?: Record<string, string>
}): Promise<Stripe.Checkout.Session> {
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: {
      metadata,
    },
  }

  // Add trial period if specified
  if (trialDays && trialDays > 0) {
    sessionConfig.subscription_data = {
      ...sessionConfig.subscription_data,
      trial_period_days: trialDays,
    }
  }

  const session = await stripe.checkout.sessions.create(sessionConfig)
  return session
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
  return session
}

/**
 * Cancel a Stripe subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    // Cancel at the end of the billing period
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
  } else {
    // Cancel immediately
    return await stripe.subscriptions.cancel(subscriptionId)
  }
}

/**
 * Resume a cancelled subscription (if cancellation was scheduled for period end)
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId)
  } catch (error) {
    console.error('Error retrieving subscription:', error)
    return null
  }
}

/**
 * Update subscription to a different plan
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: 'create_prorations',
  })
}

/**
 * Map Stripe subscription status to our internal status
 */
export function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' {
  switch (stripeStatus) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    case 'unpaid':
    case 'incomplete':
      return 'unpaid'
    default:
      return 'active'
  }
}

/**
 * Extract plan tier from Stripe price ID
 */
export function getPlanTierFromPriceId(priceId: string): PlanTier | null {
  for (const [tier, prices] of Object.entries(STRIPE_PRICE_IDS)) {
    if (prices.monthly === priceId || prices.yearly === priceId) {
      return tier as PlanTier
    }
  }
  return null
}

/**
 * Get billing period from Stripe price ID
 */
export function getBillingPeriodFromPriceId(
  priceId: string
): 'monthly' | 'yearly' | null {
  for (const prices of Object.values(STRIPE_PRICE_IDS)) {
    if (prices.monthly === priceId) return 'monthly'
    if (prices.yearly === priceId) return 'yearly'
  }
  return null
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

/**
 * Calculate the prorated amount for a plan change
 */
export async function calculateProration(
  subscriptionId: string,
  newPriceId: string
): Promise<{
  amount: number
  dueNow: boolean
  description: string
}> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const proration = await stripe.invoices.createPreview({
    customer: subscription.customer as string,
    subscription: subscriptionId,
    subscription_details: {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
    },
  })

  const amount = proration.amount_due
  const isUpgrade = amount > 0

  return {
    amount: Math.abs(amount),
    dueNow: isUpgrade,
    description: isUpgrade
      ? `You'll be charged ${formatPrice(amount)} now for the upgrade.`
      : `You'll receive a credit of ${formatPrice(Math.abs(amount))} on your next bill.`,
  }
}

/**
 * Get the current period end timestamp from a subscription
 * In newer Stripe API versions, current_period_end is on SubscriptionItem, not Subscription
 */
export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number {
  // Get from first subscription item
  const firstItem = subscription.items.data[0]
  if (firstItem?.current_period_end) {
    return firstItem.current_period_end
  }
  // Fallback to billing cycle anchor if no items
  return subscription.billing_cycle_anchor
}
