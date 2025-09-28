import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

export class StripeService {
  static async createConnectAccount(email: string, country: string = 'US') {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        country,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })

      return account
    } catch (error) {
      console.error('Error creating Stripe Connect account:', error)
      throw error
    }
  }

  static async createAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      })

      return accountLink
    } catch (error) {
      console.error('Error creating account link:', error)
      throw error
    }
  }

  static async createPrice(productId: string, amount: number, currency: string = 'usd') {
    try {
      const price = await stripe.prices.create({
        unit_amount: amount,
        currency,
        recurring: { interval: 'month' },
        product: productId,
      })

      return price
    } catch (error) {
      console.error('Error creating price:', error)
      throw error
    }
  }

  static async createProduct(name: string, description?: string) {
    try {
      const product = await stripe.products.create({
        name,
        description,
      })

      return product
    } catch (error) {
      console.error('Error creating product:', error)
      throw error
    }
  }

  static async createSubscription(
    customerId: string,
    priceId: string,
    connectedAccountId: string,
    applicationFeePercent: number = 10
  ) {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        application_fee_percent: applicationFeePercent,
        transfer_data: {
          destination: connectedAccountId,
        },
      })

      return subscription
    } catch (error) {
      console.error('Error creating subscription:', error)
      throw error
    }
  }

  static async createCustomer(email: string, name?: string) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
      })

      return customer
    } catch (error) {
      console.error('Error creating customer:', error)
      throw error
    }
  }

  static async createCheckoutSession({
    customerId,
    priceId,
    successUrl,
    cancelUrl,
    connectedAccountId,
    applicationFeePercent = 10,
  }: {
    customerId: string
    priceId: string
    successUrl: string
    cancelUrl: string
    connectedAccountId: string
    applicationFeePercent?: number
  }) {
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          application_fee_percent: applicationFeePercent,
          transfer_data: {
            destination: connectedAccountId,
          },
        },
      })

      return session
    } catch (error) {
      console.error('Error creating checkout session:', error)
      throw error
    }
  }

  static async cancelSubscription(subscriptionId: string) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })

      return subscription
    } catch (error) {
      console.error('Error canceling subscription:', error)
      throw error
    }
  }

  static async getAccount(accountId: string) {
    try {
      const account = await stripe.accounts.retrieve(accountId)
      return account
    } catch (error) {
      console.error('Error retrieving account:', error)
      throw error
    }
  }

  static async constructWebhookEvent(body: string, signature: string) {
    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
      return event
    } catch (error) {
      console.error('Error constructing webhook event:', error)
      throw error
    }
  }
}