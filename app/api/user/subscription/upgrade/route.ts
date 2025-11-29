import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import type { PlanTier } from '@/lib/plans'
import { PLANS } from '@/lib/plans'

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
      .select('id, plan_tier')
      .eq('user_id', session.user.id)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    const currentTier = creator.plan_tier || 'FREE'

    // Downgrade to FREE doesn't require payment
    if (targetTier === 'FREE') {
      await supabase
        .from('creators')
        .update({
          plan_tier: 'FREE',
          billing_period: null,
          subscription_status: 'active',
        })
        .eq('id', creator.id)

      return NextResponse.json({
        success: true,
        requiresPayment: false,
        message: 'Successfully downgraded to FREE plan',
      })
    }

    // For paid plans, you would integrate with Stripe here
    // For now, we'll just update the database directly
    // In production, you'd create a Stripe checkout session

    const planConfig = PLANS[targetTier as PlanTier]
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan configuration' }, { status: 400 })
    }

    // TODO: Integrate with Stripe to create checkout session
    // For development, we'll just update the plan directly
    const { error: updateError } = await supabase
      .from('creators')
      .update({
        plan_tier: targetTier,
        billing_period: billingPeriod,
        subscription_status: 'active',
        current_period_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      })
      .eq('id', creator.id)

    if (updateError) {
      console.error('Error updating creator plan:', updateError)
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }

    // In production, you would return a Stripe checkout URL:
    // return NextResponse.json({
    //   requiresPayment: true,
    //   checkoutUrl: stripeCheckoutSession.url,
    // })

    return NextResponse.json({
      success: true,
      requiresPayment: false, // Set to true in production with Stripe
      message: `Successfully upgraded to ${planConfig.displayName}`,
    })
  } catch (error) {
    console.error('Error in subscription upgrade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
