'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react'

export default function SubscriptionSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planName, setPlanName] = useState<string>('your new plan')

  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId) {
      setError('No checkout session found')
      setIsVerifying(false)
      return
    }

    // Verify the session and get plan details
    const verifySession = async () => {
      try {
        const response = await fetch('/api/user/subscription/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })

        if (!response.ok) {
          throw new Error('Failed to verify subscription')
        }

        const data = await response.json()
        if (data.planName) {
          setPlanName(data.planName)
        }
      } catch (err) {
        console.error('Verification error:', err)
        // Don't show error - the webhook should have handled everything
      } finally {
        setIsVerifying(false)
      }
    }

    // Small delay to allow webhook to process
    const timer = setTimeout(verifySession, 1500)
    return () => clearTimeout(timer)
  }, [sessionId])

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Setting up your subscription...</p>
            <p className="text-sm text-muted-foreground">This will only take a moment</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/creator/subscription')} className="w-full">
              Return to Subscription Page
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-primary-foreground/20 p-3">
              <CheckCircle className="h-12 w-12" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center">Welcome to {planName}!</h1>
        </div>

        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">Your subscription is now active</p>
            <p className="text-sm text-muted-foreground">
              You now have access to all the features included in your plan.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>All premium features unlocked</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Priority support available</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Increased usage limits</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/creator/dashboard')}
              className="w-full"
              size="lg"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push('/creator/subscription')}
              className="w-full"
            >
              View Subscription Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
