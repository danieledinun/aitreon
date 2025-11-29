'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ArrowUpCircle, X, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { PlanTier } from '@/lib/plans'
import { getPlanConfig } from '@/lib/plans'

interface PlanUpgradeBannerProps {
  creatorId: string
  currentTier: PlanTier
  reason: 'videos' | 'messages' | 'feature'
  featureName?: string
  upgradeTo?: PlanTier
}

export default function PlanUpgradeBanner({
  creatorId,
  currentTier,
  reason,
  featureName,
  upgradeTo,
}: PlanUpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const currentPlan = getPlanConfig(currentTier)
  const targetPlan = upgradeTo ? getPlanConfig(upgradeTo) : null

  const getMessage = () => {
    switch (reason) {
      case 'videos':
        return {
          title: 'Video Limit Reached',
          description: `You've reached your ${currentPlan.displayName} plan limit of ${currentPlan.limits.maxVideos} videos.${
            targetPlan
              ? ` Upgrade to ${targetPlan.displayName} to add ${
                  targetPlan.limits.maxVideos === null
                    ? 'unlimited'
                    : `up to ${targetPlan.limits.maxVideos}`
                } videos.`
              : ''
          }`,
        }
      case 'messages':
        return {
          title: 'Message Limit Reached',
          description: `You've reached your monthly message limit of ${currentPlan.limits.maxMessagesPerMonth} messages.${
            targetPlan
              ? ` Upgrade to ${targetPlan.displayName} for ${
                  targetPlan.limits.maxMessagesPerMonth === null
                    ? 'unlimited'
                    : `${targetPlan.limits.maxMessagesPerMonth.toLocaleString()}`
                } messages per month.`
              : ''
          }`,
        }
      case 'feature':
        return {
          title: 'Premium Feature',
          description: `${featureName || 'This feature'} requires ${
            targetPlan ? `the ${targetPlan.displayName} plan` : 'a plan upgrade'
          }.`,
        }
      default:
        return {
          title: 'Upgrade Your Plan',
          description: 'Unlock more features and higher limits.',
        }
    }
  }

  const message = getMessage()

  return (
    <Alert className="relative bg-gradient-to-r from-tandym-cobalt/10 to-tandym-lilac/10 border-tandym-cobalt/30">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 h-6 w-6 p-0"
      >
        <X className="h-4 w-4" />
      </Button>

      <Sparkles className="h-5 w-5 text-tandym-cobalt" />
      <AlertTitle className="text-tandym-text-dark font-semibold pr-8">
        {message.title}
      </AlertTitle>
      <AlertDescription className="text-tandym-text-muted mt-2">
        {message.description}
      </AlertDescription>

      <div className="mt-4 flex gap-3">
        <Link href={`/creator/subscription?upgrade=${upgradeTo || 'PRO'}`}>
          <Button
            size="sm"
            className="bg-gradient-to-r from-tandym-cobalt to-tandym-lilac text-white hover:opacity-90"
          >
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            {targetPlan ? `Upgrade to ${targetPlan.displayName}` : 'View Plans'}
          </Button>
        </Link>
        <Link href="/pricing">
          <Button size="sm" variant="outline">
            Compare Plans
          </Button>
        </Link>
      </div>
    </Alert>
  )
}
