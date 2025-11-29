/**
 * Plan Enforcement Middleware
 *
 * Use these functions to enforce plan limits before critical operations
 */

import { createClient } from '@supabase/supabase-js'
import {
  getPlanConfig,
  canAddVideos,
  canSendMessages,
  hasFeatureAccess,
  type PlanTier,
} from '@/lib/plans'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface EnforcementResult {
  allowed: boolean
  reason?: string
  upgradeRequired?: PlanTier
}

/**
 * Check if a creator can add a new video
 */
export async function enforceVideoLimit(creatorId: string): Promise<EnforcementResult> {
  try {
    // Get creator's plan
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('plan_tier')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      return {
        allowed: false,
        reason: 'Creator not found',
      }
    }

    const planTier = (creator.plan_tier || 'FREE') as PlanTier

    // Get current video count
    const { count, error: countError } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)

    if (countError) {
      throw countError
    }

    const videoCount = count || 0
    const allowed = canAddVideos(videoCount, planTier)

    if (!allowed) {
      const plan = getPlanConfig(planTier)
      return {
        allowed: false,
        reason: `You've reached your plan limit of ${plan.limits.maxVideos} videos. Upgrade to add more.`,
        upgradeRequired: planTier === 'FREE' ? 'LITE' : planTier === 'LITE' ? 'PRO' : 'ULTIMATE',
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error enforcing video limit:', error)
    return {
      allowed: false,
      reason: 'Failed to check video limit',
    }
  }
}

/**
 * Check if a user can send a message to a creator
 */
export async function enforceMessageLimit(creatorId: string): Promise<EnforcementResult> {
  try {
    // Get creator's plan
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('plan_tier')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      return {
        allowed: false,
        reason: 'Creator not found',
      }
    }

    const planTier = (creator.plan_tier || 'FREE') as PlanTier

    // Get current month's message count
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count, error: countError } = await supabase
      .from('chat_sessions')
      .select(`
        messages!inner(id)
      `, { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .gte('created_at', startOfMonth.toISOString())

    if (countError) {
      throw countError
    }

    const messageCount = count || 0
    const allowed = canSendMessages(messageCount, planTier)

    if (!allowed) {
      const plan = getPlanConfig(planTier)
      return {
        allowed: false,
        reason: `This creator has reached their monthly message limit of ${plan.limits.maxMessagesPerMonth} messages. They need to upgrade to continue chatting.`,
        upgradeRequired: planTier === 'FREE' ? 'LITE' : planTier === 'LITE' ? 'PRO' : 'ULTIMATE',
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error enforcing message limit:', error)
    return {
      allowed: false,
      reason: 'Failed to check message limit',
    }
  }
}

/**
 * Check if a creator has access to a specific feature
 */
export async function enforceFeatureAccess(
  creatorId: string,
  feature: keyof Omit<
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
): Promise<EnforcementResult> {
  try {
    // Get creator's plan
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('plan_tier')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      return {
        allowed: false,
        reason: 'Creator not found',
      }
    }

    const planTier = (creator.plan_tier || 'FREE') as PlanTier
    const allowed = hasFeatureAccess(planTier, feature)

    if (!allowed) {
      // Determine which tier has this feature
      let requiredTier: PlanTier = 'LITE'
      const tiers: PlanTier[] = ['LITE', 'PRO', 'ULTIMATE', 'ENTERPRISE']

      for (const tier of tiers) {
        if (hasFeatureAccess(tier, feature)) {
          requiredTier = tier
          break
        }
      }

      return {
        allowed: false,
        reason: `This feature requires the ${getPlanConfig(requiredTier).displayName} plan or higher.`,
        upgradeRequired: requiredTier,
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error enforcing feature access:', error)
    return {
      allowed: false,
      reason: 'Failed to check feature access',
    }
  }
}

/**
 * Check if creator's subscription is active
 */
export async function enforceActiveSubscription(creatorId: string): Promise<EnforcementResult> {
  try {
    const { data: creator, error } = await supabase
      .from('creators')
      .select('subscription_status, plan_tier, current_period_ends_at')
      .eq('id', creatorId)
      .single()

    if (error || !creator) {
      return {
        allowed: false,
        reason: 'Creator not found',
      }
    }

    const planTier = (creator.plan_tier || 'FREE') as PlanTier

    // FREE tier is always allowed
    if (planTier === 'FREE') {
      return { allowed: true }
    }

    // Check subscription status
    if (creator.subscription_status === 'active' || creator.subscription_status === 'trialing') {
      return { allowed: true }
    }

    // Check if grace period applies (within 7 days of period end)
    if (creator.current_period_ends_at) {
      const periodEnd = new Date(creator.current_period_ends_at)
      const gracePeriodEnd = new Date(periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000)

      if (new Date() < gracePeriodEnd) {
        return { allowed: true }
      }
    }

    return {
      allowed: false,
      reason: 'Your subscription is not active. Please update your payment method.',
    }
  } catch (error) {
    console.error('Error enforcing subscription status:', error)
    return {
      allowed: false,
      reason: 'Failed to check subscription status',
    }
  }
}

/**
 * Comprehensive plan check before adding a video
 */
export async function canCreatorAddVideo(creatorId: string): Promise<EnforcementResult> {
  // Check subscription is active
  const subscriptionCheck = await enforceActiveSubscription(creatorId)
  if (!subscriptionCheck.allowed) {
    return subscriptionCheck
  }

  // Check video limit
  return enforceVideoLimit(creatorId)
}

/**
 * Comprehensive plan check before processing a message
 */
export async function canCreatorReceiveMessage(creatorId: string): Promise<EnforcementResult> {
  // Check subscription is active
  const subscriptionCheck = await enforceActiveSubscription(creatorId)
  if (!subscriptionCheck.allowed) {
    return subscriptionCheck
  }

  // Check message limit
  return enforceMessageLimit(creatorId)
}
