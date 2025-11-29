/**
 * React hooks for plan limits and usage tracking
 */

import { useEffect, useState } from 'react'
import type { PlanTier } from '@/lib/plans'
import {
  getPlanConfig,
  canAddVideos,
  canSendMessages,
  getRemainingVideos,
  getRemainingMessages,
  hasFeatureAccess,
} from '@/lib/plans'

export interface CreatorPlanInfo {
  planTier: PlanTier
  billingPeriod: 'monthly' | 'yearly' | null
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  videoCount: number
  monthlyMessageCount: number
}

export interface PlanLimitStatus {
  canAddVideos: boolean
  canSendMessages: boolean
  remainingVideos: number | null
  remainingMessages: number | null
  isLoading: boolean
  error: string | null
}

/**
 * Hook to check plan limits for a creator
 */
export function usePlanLimits(creatorId?: string): PlanLimitStatus {
  const [status, setStatus] = useState<PlanLimitStatus>({
    canAddVideos: false,
    canSendMessages: false,
    remainingVideos: null,
    remainingMessages: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    if (!creatorId) {
      setStatus({
        canAddVideos: false,
        canSendMessages: false,
        remainingVideos: null,
        remainingMessages: null,
        isLoading: false,
        error: 'No creator ID provided',
      })
      return
    }

    async function fetchPlanLimits() {
      try {
        const response = await fetch(`/api/creators/${creatorId}/plan-limits`)
        if (!response.ok) {
          throw new Error('Failed to fetch plan limits')
        }

        const data: CreatorPlanInfo = await response.json()

        setStatus({
          canAddVideos: canAddVideos(data.videoCount, data.planTier),
          canSendMessages: canSendMessages(data.monthlyMessageCount, data.planTier),
          remainingVideos: getRemainingVideos(data.videoCount, data.planTier),
          remainingMessages: getRemainingMessages(data.monthlyMessageCount, data.planTier),
          isLoading: false,
          error: null,
        })
      } catch (error) {
        setStatus({
          canAddVideos: false,
          canSendMessages: false,
          remainingVideos: null,
          remainingMessages: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    fetchPlanLimits()
  }, [creatorId])

  return status
}

/**
 * Hook to check if a creator has access to a specific feature
 */
export function useFeatureAccess(
  creatorId?: string,
  feature?: keyof Omit<
    ReturnType<typeof getPlanConfig>['limits'],
    | 'maxVideos'
    | 'maxMessagesPerMonth'
    | 'autoSync'
    | 'maxConcurrentChats'
    | 'responseQuality'
    | 'memoryWindow'
    | 'supportLevel'
    | 'analytics'
  >
): {
  hasAccess: boolean
  isLoading: boolean
  planTier: PlanTier | null
} {
  const [state, setState] = useState<{
    hasAccess: boolean
    isLoading: boolean
    planTier: PlanTier | null
  }>({
    hasAccess: false,
    isLoading: true,
    planTier: null,
  })

  useEffect(() => {
    if (!creatorId || !feature) {
      setState({ hasAccess: false, isLoading: false, planTier: null })
      return
    }

    async function checkFeatureAccess() {
      try {
        const response = await fetch(`/api/creators/${creatorId}/plan-limits`)
        if (!response.ok) {
          throw new Error('Failed to fetch plan info')
        }

        const data: CreatorPlanInfo = await response.json()
        // Type guard: feature is guaranteed to be defined here due to early return above
        if (!feature) {
          setState({ hasAccess: false, isLoading: false, planTier: null })
          return
        }
        setState({
          hasAccess: hasFeatureAccess(data.planTier, feature),
          isLoading: false,
          planTier: data.planTier,
        })
      } catch (error) {
        setState({ hasAccess: false, isLoading: false, planTier: null })
      }
    }

    checkFeatureAccess()
  }, [creatorId, feature])

  return state
}

/**
 * Hook to get full creator plan information
 */
export function useCreatorPlan(creatorId?: string): {
  plan: CreatorPlanInfo | null
  isLoading: boolean
  error: string | null
  refetch: () => void
} {
  const [state, setState] = useState<{
    plan: CreatorPlanInfo | null
    isLoading: boolean
    error: string | null
  }>({
    plan: null,
    isLoading: true,
    error: null,
  })

  const fetchPlan = async () => {
    if (!creatorId) {
      setState({ plan: null, isLoading: false, error: 'No creator ID provided' })
      return
    }

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const response = await fetch(`/api/creators/${creatorId}/plan-limits`)
      if (!response.ok) {
        throw new Error('Failed to fetch plan information')
      }

      const data: CreatorPlanInfo = await response.json()
      setState({ plan: data, isLoading: false, error: null })
    } catch (error) {
      setState({
        plan: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  useEffect(() => {
    fetchPlan()
  }, [creatorId])

  return {
    ...state,
    refetch: fetchPlan,
  }
}
