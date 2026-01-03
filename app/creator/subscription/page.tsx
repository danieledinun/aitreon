'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Check,
  Crown,
  Sparkles,
  Zap,
  AlertCircle,
  ArrowRight,
  Loader2,
  CreditCard,
  RefreshCw,
} from 'lucide-react'
import { PLANS, getPlanConfig, type PlanTier } from '@/lib/plans'
import { useCreatorPlan } from '@/lib/hooks/use-plan-limits'
import { cn } from '@/lib/utils'

export default function SubscriptionPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const suggestedUpgrade = searchParams.get('upgrade') as PlanTier | null
  const checkoutCanceled = searchParams.get('canceled') === 'true'

  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [upgrading, setUpgrading] = useState<PlanTier | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { plan, isLoading: planLoading, refetch } = useCreatorPlan()

  // Show checkout canceled message
  useEffect(() => {
    if (checkoutCanceled) {
      setError('Checkout was canceled. You can try again when ready.')
      // Clear the query param
      router.replace('/creator/subscription', { scroll: false })
    }
  }, [checkoutCanceled, router])

  const handleUpgrade = async (targetTier: PlanTier) => {
    setUpgrading(targetTier)
    setError(null)

    try {
      const response = await fetch(`/api/user/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier, billingPeriod }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upgrade')
      }

      if (data.requiresPayment && data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl
      } else {
        // Upgrade successful (e.g., downgrade to FREE)
        await refetch()
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade plan')
    } finally {
      setUpgrading(null)
    }
  }

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) return

    try {
      const response = await fetch(`/api/user/subscription/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelImmediately: false }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel')
      }

      await refetch()
      setSuccessMessage(data.message)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    }
  }

  const handleResumeSubscription = async () => {
    setResuming(true)
    setError(null)

    try {
      const response = await fetch(`/api/user/subscription/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resume subscription')
      }

      await refetch()
      setSuccessMessage(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume subscription')
    } finally {
      setResuming(false)
    }
  }

  const openBillingPortal = async () => {
    setPortalLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/user/subscription/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal')
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="container max-w-7xl mx-auto px-6 py-12">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please sign in to manage your subscription.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const currentTier = (plan?.planTier || 'FREE') as PlanTier
  const currentPlan = getPlanConfig(currentTier)

  return (
    <div className="container max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-poppins text-tandym-text-dark mb-2">
          Subscription Management
        </h1>
        <p className="text-tandym-text-muted">
          Manage your plan, billing, and usage limits
        </p>
      </div>

      {/* Current Plan Card */}
      {!planLoading && plan && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Current Plan: {currentPlan.displayName}
                  {plan.subscriptionStatus === 'trialing' && (
                    <Badge variant="secondary">Trial</Badge>
                  )}
                  {plan.subscriptionStatus === 'canceled' && (
                    <Badge variant="destructive">Canceling</Badge>
                  )}
                  {plan.subscriptionStatus === 'past_due' && (
                    <Badge variant="destructive">Past Due</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {currentTier === 'FREE'
                    ? 'Free forever - upgrade anytime'
                    : `$${
                        plan.billingPeriod === 'yearly'
                          ? currentPlan.yearlyPrice
                          : currentPlan.monthlyPrice
                      }/month${plan.billingPeriod === 'yearly' ? ' (billed yearly)' : ''}`}
                </CardDescription>
                {plan.subscriptionStatus === 'canceled' && plan.currentPeriodEndsAt && (
                  <p className="text-sm text-amber-600 mt-1">
                    Access until {new Date(plan.currentPeriodEndsAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Billing Portal Button */}
                {currentTier !== 'FREE' && (
                  <Button
                    variant="outline"
                    onClick={openBillingPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Manage Billing
                  </Button>
                )}

                {/* Resume Button for canceled subscriptions */}
                {plan.subscriptionStatus === 'canceled' && currentTier !== 'FREE' && (
                  <Button
                    variant="default"
                    onClick={handleResumeSubscription}
                    disabled={resuming}
                  >
                    {resuming ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Resume Subscription
                  </Button>
                )}

                {/* Cancel Button for active subscriptions */}
                {currentTier !== 'FREE' && plan.subscriptionStatus === 'active' && (
                  <Button variant="outline" onClick={handleCancelSubscription}>
                    Cancel Plan
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-tandym-text-muted mb-1">Videos</p>
                <p className="text-lg font-semibold">
                  {plan.videoCount} /{' '}
                  {currentPlan.limits.maxVideos === null
                    ? '∞'
                    : currentPlan.limits.maxVideos}
                </p>
              </div>
              <div>
                <p className="text-sm text-tandym-text-muted mb-1">Messages This Month</p>
                <p className="text-lg font-semibold">
                  {plan.monthlyMessageCount} /{' '}
                  {currentPlan.limits.maxMessagesPerMonth === null
                    ? '∞'
                    : currentPlan.limits.maxMessagesPerMonth}
                </p>
              </div>
              <div>
                <p className="text-sm text-tandym-text-muted mb-1">Auto-Sync</p>
                <p className="text-lg font-semibold capitalize">
                  {currentPlan.limits.autoSync}
                </p>
              </div>
              {plan.currentPeriodEndsAt && plan.subscriptionStatus !== 'canceled' && (
                <div>
                  <p className="text-sm text-tandym-text-muted mb-1">Next Billing</p>
                  <p className="text-lg font-semibold">
                    {new Date(plan.currentPeriodEndsAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {successMessage && (
        <Alert className="mb-8 border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Billing Period Toggle */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'text-sm font-medium transition-colors cursor-pointer',
              billingPeriod === 'monthly' ? 'text-tandym-text-dark' : 'text-tandym-text-muted'
            )}
            onClick={() => setBillingPeriod('monthly')}
          >
            Monthly
          </span>
          <button
            onClick={() =>
              setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')
            }
            className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-tandym-cobalt focus:ring-offset-2"
          >
            <span
              className={cn(
                'inline-block h-6 w-6 transform rounded-full bg-gradient-to-r from-tandym-cobalt to-tandym-lilac transition-transform shadow-md',
                billingPeriod === 'yearly' ? 'translate-x-7' : 'translate-x-1'
              )}
            />
          </button>
          <span
            className={cn(
              'text-sm font-medium transition-colors cursor-pointer',
              billingPeriod === 'yearly' ? 'text-tandym-text-dark' : 'text-tandym-text-muted'
            )}
            onClick={() => setBillingPeriod('yearly')}
          >
            Yearly
          </span>
          {billingPeriod === 'yearly' && (
            <Badge className="bg-tandym-coral">2 Months Free</Badge>
          )}
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        {Object.values(PLANS)
          .filter(p => p.tier !== 'ENTERPRISE')
          .map(planConfig => {
            const isCurrent = currentTier === planConfig.tier
            const isUpgrade =
              ['FREE', 'LITE', 'PRO', 'ULTIMATE'].indexOf(planConfig.tier) >
              ['FREE', 'LITE', 'PRO', 'ULTIMATE'].indexOf(currentTier)
            const isSuggested = suggestedUpgrade === planConfig.tier

            return (
              <Card
                key={planConfig.tier}
                className={cn(
                  'relative',
                  isCurrent && 'ring-2 ring-tandym-cobalt',
                  planConfig.popular && 'ring-2 ring-tandym-lilac scale-105'
                )}
              >
                {planConfig.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-tandym-lilac to-tandym-coral py-1 text-center rounded-t-lg">
                    <span className="text-white text-xs font-bold">MOST POPULAR</span>
                  </div>
                )}

                {isSuggested && !isCurrent && (
                  <div className="absolute top-0 left-0 right-0 bg-tandym-cobalt py-1 text-center rounded-t-lg">
                    <span className="text-white text-xs font-bold">RECOMMENDED</span>
                  </div>
                )}

                <CardHeader className={cn(planConfig.popular || isSuggested ? 'pt-8' : '')}>
                  <CardTitle className="text-xl">{planConfig.displayName}</CardTitle>
                  <CardDescription className="h-12">
                    {planConfig.description}
                  </CardDescription>
                  <div className="pt-4">
                    <span className="text-3xl font-bold">
                      $
                      {billingPeriod === 'monthly'
                        ? planConfig.monthlyPrice
                        : planConfig.yearlyPrice}
                    </span>
                    <span className="text-tandym-text-muted">/month</span>
                  </div>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full mb-4"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || upgrading !== null}
                    onClick={() => handleUpgrade(planConfig.tier)}
                  >
                    {upgrading === planConfig.tier ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : isUpgrade ? (
                      <>
                        Upgrade <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      'Downgrade'
                    )}
                  </Button>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>
                        {planConfig.limits.maxVideos === null
                          ? 'Unlimited videos'
                          : `${planConfig.limits.maxVideos} videos`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>
                        {planConfig.limits.maxMessagesPerMonth === null
                          ? 'Unlimited messages'
                          : `${planConfig.limits.maxMessagesPerMonth} messages/mo`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="capitalize">{planConfig.limits.autoSync} sync</span>
                    </div>
                    {planConfig.limits.embedWidget && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>Embed widget</span>
                      </div>
                    )}
                    {planConfig.limits.removeBranding && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>No branding</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
