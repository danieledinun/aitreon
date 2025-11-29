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
} from 'lucide-react'
import { PLANS, getPlanConfig, type PlanTier } from '@/lib/plans'
import { useCreatorPlan } from '@/lib/hooks/use-plan-limits'
import { cn } from '@/lib/utils'

export default function SubscriptionPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const suggestedUpgrade = searchParams.get('upgrade') as PlanTier | null

  const [creatorId, setCreatorId] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [upgrading, setUpgrading] = useState<PlanTier | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { plan, isLoading: planLoading, refetch } = useCreatorPlan(creatorId || undefined)

  useEffect(() => {
    // Fetch creator ID for current user
    const fetchCreatorId = async () => {
      if (!session?.user?.id) return

      try {
        const res = await fetch(`/api/user/creator`)
        if (res.ok) {
          const data = await res.json()
          setCreatorId(data.creatorId)
        }
      } catch (err) {
        console.error('Failed to fetch creator ID:', err)
      }
    }

    fetchCreatorId()
  }, [session])

  const handleUpgrade = async (targetTier: PlanTier) => {
    if (!creatorId) return

    setUpgrading(targetTier)
    setError(null)

    try {
      const response = await fetch(`/api/creators/${creatorId}/subscription/upgrade`, {
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
    if (!creatorId || !confirm('Are you sure you want to cancel your subscription?')) return

    try {
      const response = await fetch(`/api/creators/${creatorId}/subscription/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelImmediately: false }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel')
      }

      await refetch()
      alert(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Current Plan: {currentPlan.displayName}
                  {plan.subscriptionStatus === 'trialing' && (
                    <Badge variant="secondary">Trial</Badge>
                  )}
                  {plan.subscriptionStatus === 'canceled' && (
                    <Badge variant="destructive">Canceled</Badge>
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
              </div>
              {currentTier !== 'FREE' && plan.subscriptionStatus === 'active' && (
                <Button variant="outline" onClick={handleCancelSubscription}>
                  Cancel Plan
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
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
            </div>
          </CardContent>
        </Card>
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
