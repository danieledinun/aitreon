/**
 * Stripe Product Setup Script
 *
 * Run this script to create the subscription products and prices in Stripe.
 * Make sure STRIPE_SECRET_KEY is set in your environment.
 *
 * Usage: node scripts/setup-stripe-products.js
 */

const Stripe = require('stripe')

// Plan configurations matching lib/plans.ts
const PLANS = {
  LITE: {
    name: 'Creator Lite',
    description: 'Your AI twin, ready to engage',
    monthlyPrice: 2900, // $29.00 in cents
    yearlyPrice: 28800, // $288.00/year ($24/month)
  },
  PRO: {
    name: 'Creator Pro',
    description: 'More control. More intelligence. More engagement.',
    monthlyPrice: 6900, // $69.00 in cents
    yearlyPrice: 69600, // $696.00/year ($58/month)
  },
  ULTIMATE: {
    name: 'Creator Ultimate',
    description: 'Maximum presence. Complete video intelligence.',
    monthlyPrice: 14900, // $149.00 in cents
    yearlyPrice: 148800, // $1488.00/year ($124/month)
  },
}

async function setupStripeProducts() {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    console.error('❌ STRIPE_SECRET_KEY environment variable is required')
    console.log('\nPlease set your Stripe secret key:')
    console.log('  export STRIPE_SECRET_KEY="sk_test_..."')
    process.exit(1)
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-05-28.basil',
  })

  console.log('🔧 Setting up Stripe products and prices...\n')

  const priceIds = {}

  for (const [tier, config] of Object.entries(PLANS)) {
    console.log(`📦 Creating product: ${config.name}`)

    // Create product
    const product = await stripe.products.create({
      name: config.name,
      description: config.description,
      metadata: {
        tier: tier,
        app: 'tandym',
      },
    })

    console.log(`   ✓ Product created: ${product.id}`)

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: config.monthlyPrice,
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        tier: tier,
        billing_period: 'monthly',
      },
    })

    console.log(`   ✓ Monthly price created: ${monthlyPrice.id} ($${config.monthlyPrice / 100}/month)`)

    // Create yearly price
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: config.yearlyPrice,
      currency: 'usd',
      recurring: {
        interval: 'year',
      },
      metadata: {
        tier: tier,
        billing_period: 'yearly',
      },
    })

    console.log(`   ✓ Yearly price created: ${yearlyPrice.id} ($${config.yearlyPrice / 100}/year)\n`)

    priceIds[tier] = {
      productId: product.id,
      monthlyPriceId: monthlyPrice.id,
      yearlyPriceId: yearlyPrice.id,
    }
  }

  console.log('✅ All products and prices created successfully!\n')
  console.log('Add these environment variables to your .env file:\n')
  console.log('# Stripe Price IDs')

  for (const [tier, ids] of Object.entries(priceIds)) {
    console.log(`STRIPE_PRICE_${tier}_MONTHLY="${ids.monthlyPriceId}"`)
    console.log(`STRIPE_PRICE_${tier}_YEARLY="${ids.yearlyPriceId}"`)
  }

  console.log('\n📋 Full configuration object:\n')
  console.log(JSON.stringify(priceIds, null, 2))
}

setupStripeProducts().catch((error) => {
  console.error('❌ Error setting up Stripe products:', error.message)
  process.exit(1)
})
