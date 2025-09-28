'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface SubscriptionFormProps {
  creatorId: string
  creatorName: string
  userId: string
}

export default function SubscriptionForm({ 
  creatorId, 
  creatorName, 
  userId 
}: SubscriptionFormProps) {
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creatorId,
          userId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription')
      }

      const stripe = await stripePromise
      if (!stripe) {
        throw new Error('Stripe failed to load')
      }

      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('Subscription error:', error)
      alert('Failed to start subscription. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button 
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full py-3 text-lg"
      >
        {loading ? 'Processing...' : `Subscribe to ${creatorName}`}
      </Button>
      
      <p className="text-xs text-gray-500 text-center mt-4">
        Powered by Stripe. Your payment information is secure and encrypted.
      </p>
    </div>
  )
}