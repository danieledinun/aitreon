import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { PLANS } from '@/lib/plans'
import type { PlanTier } from '@/lib/plans'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)

    if (!checkoutSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get plan name from metadata
    const targetTier = checkoutSession.metadata?.targetTier as PlanTier | undefined
    const planConfig = targetTier ? PLANS[targetTier] : null

    return NextResponse.json({
      success: true,
      status: checkoutSession.status,
      paymentStatus: checkoutSession.payment_status,
      planName: planConfig?.displayName || 'Premium',
      subscriptionId: checkoutSession.subscription,
    })
  } catch (error) {
    console.error('Error verifying session:', error)
    return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 })
  }
}
