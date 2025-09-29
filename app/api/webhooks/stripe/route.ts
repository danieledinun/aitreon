import { NextRequest, NextResponse } from 'next/server'
import { StripeService, stripe } from '@/lib/stripe'
import { db } from '@/lib/database'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  try {
    const event = await StripeService.constructWebhookEvent(body, signature)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    if (!session.subscription || !session.customer) {
      console.error('Missing subscription or customer in checkout session')
      return
    }

    const subscriptionId = session.subscription as string
    const customerId = session.customer as string

    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
    
    // Find the user by email from the customer
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer || customer.deleted) {
      console.error('Customer not found or deleted')
      return
    }

    const user = await db.user.findUnique({
      where: { email: (customer as Stripe.Customer).email! }
    })

    if (!user) {
      console.error('User not found for customer email')
      return
    }

    // Find the creator by the connected account
    const connectedAccountId = stripeSubscription.transfer_data?.destination
    if (!connectedAccountId) {
      console.error('No connected account found in subscription')
      return
    }

    const creator = await db.creator.findFirst({
      where: { stripeAccountId: connectedAccountId }
    })

    if (!creator) {
      console.error('Creator not found for connected account')
      return
    }

    // Find existing subscription first
    const existingSubs = await db.subscription.findMany({
      where: { user_id: user.id, creator_id: creator.id }
    })
    
    const subscriptionData = {
      user_id: user.id,
      creator_id: creator.id,
      stripe_subscription_id: subscriptionId,
      status: 'ACTIVE' as const,
      tier: 'BASIC' as const,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000),
      cancel_at_period_end: false,
    }

    if (existingSubs.length > 0) {
      await db.subscription.update({
        where: { id: existingSubs[0].id },
        data: {
          stripe_subscription_id: subscriptionId,
          status: 'ACTIVE' as const,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000),
          cancel_at_period_end: false,
        }
      })
    } else {
      await db.subscription.create({ data: subscriptionData })
    }
  } catch (error) {
    console.error('Error handling checkout completed:', error)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return

    const subscriptionId = invoice.subscription as string
    
    const subscription = await db.subscription.findFirst({
      where: { stripe_subscription_id: subscriptionId }
    })

    if (subscription) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE' as const,
          current_period_start: new Date(invoice.period_start * 1000),
          current_period_end: new Date(invoice.period_end * 1000),
        }
      })
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error)
  }
}

async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  try {
    const subscription = await db.subscription.findFirst({
      where: { stripe_subscription_id: stripeSubscription.id }
    })

    if (subscription) {
      let status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID'
      
      switch (stripeSubscription.status) {
        case 'active':
          status = 'ACTIVE'
          break
        case 'canceled':
          status = 'CANCELED'
          break
        case 'past_due':
          status = 'PAST_DUE'
          break
        case 'unpaid':
          status = 'UNPAID'
          break
        default:
          status = 'ACTIVE'
      }

      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        }
      })
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error)
  }
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  try {
    const subscription = await db.subscription.findFirst({
      where: { stripe_subscription_id: stripeSubscription.id }
    })

    if (subscription) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'CANCELED' as const,
          cancel_at_period_end: true,
        }
      })
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error)
  }
}