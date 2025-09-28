import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { StripeService } from '@/lib/stripe'
import { z } from 'zod'

const subscriptionSchema = z.object({
  creatorId: z.string(),
  userId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { creatorId, userId } = subscriptionSchema.parse(body)

    if (session.user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const creator = await db.creator.findUnique({
      where: { id: creatorId }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Get creator's user separately
    const creatorUser = await db.user.findUnique({
      where: { id: creator.userId }
    })

    if (!creator.stripeAccountId) {
      return NextResponse.json({ 
        error: 'Creator has not set up payments yet' 
      }, { status: 400 })
    }

    const existingSubscription = await db.subscription.findFirst({
      where: {
        userId,
        creatorId
      }
    })

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      return NextResponse.json({ 
        error: 'Already subscribed to this creator' 
      }, { status: 400 })
    }

    let customerId: string
    
    const user = await db.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const stripeCustomer = await StripeService.createCustomer(
      user.email,
      user.name || undefined
    )
    customerId = stripeCustomer.id

    const product = await StripeService.createProduct(
      `${creator.displayName} Premium`,
      `Unlimited access to chat with ${creator.displayName}`
    )

    const price = await StripeService.createPrice(product.id, 500) // $5.00

    const checkoutSession = await StripeService.createCheckoutSession({
      customerId,
      priceId: price.id,
      successUrl: `${process.env.NEXTAUTH_URL}/${creator.username}?subscribed=true`,
      cancelUrl: `${process.env.NEXTAUTH_URL}/subscribe/${creator.username}?canceled=true`,
      connectedAccountId: creator.stripeAccountId,
      applicationFeePercent: creator.commissionRate * 100,
    })

    return NextResponse.json({ 
      sessionId: checkoutSession.id 
    })
  } catch (error) {
    console.error('Subscription creation error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}