/**
 * Centralized Plan Configuration and Constraints
 *
 * This file defines all subscription plans, their limits, and enforcement logic.
 * IMPORTANT: This is the single source of truth for plan limits across the platform.
 */

export type PlanTier = 'FREE' | 'LITE' | 'PRO' | 'ULTIMATE' | 'ENTERPRISE'

export interface PlanLimits {
  // Video Limits
  maxVideos: number | null // null = unlimited
  autoSync: 'none' | 'manual' | 'weekly' | 'realtime'

  // Message Limits
  maxMessagesPerMonth: number | null // null = unlimited

  // Feature Access
  embedWidget: boolean
  removeBranding: boolean
  advancedPersonality: boolean
  analytics: 'none' | 'basic' | 'full'
  priorityProcessing: boolean
  voiceChat: boolean
  smartCTAs: boolean
  customDomain: boolean
  apiAccess: boolean

  // Processing & Performance
  maxConcurrentChats: number
  responseQuality: 'basic' | 'standard' | 'enhanced' | 'premium'
  memoryWindow: 'short' | 'medium' | 'long' | 'extended'

  // Support
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated'
}

export interface PlanConfig {
  tier: PlanTier
  name: string
  displayName: string
  description: string
  monthlyPrice: number // in USD
  yearlyPrice: number // in USD (yearly billing)
  limits: PlanLimits
  popular?: boolean
  trial: boolean
  stripeProductId?: string
  stripePriceIdMonthly?: string
  stripePriceIdYearly?: string
}

// Plan Configurations
export const PLANS: Record<PlanTier, PlanConfig> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    displayName: 'Free',
    description: 'Get started with your first AI twin',
    monthlyPrice: 0,
    yearlyPrice: 0,
    trial: false,
    limits: {
      maxVideos: 5,
      autoSync: 'manual',
      maxMessagesPerMonth: 50,
      embedWidget: false,
      removeBranding: false,
      advancedPersonality: false,
      analytics: 'none',
      priorityProcessing: false,
      voiceChat: false,
      smartCTAs: false,
      customDomain: false,
      apiAccess: false,
      maxConcurrentChats: 1,
      responseQuality: 'basic',
      memoryWindow: 'short',
      supportLevel: 'community',
    },
  },

  LITE: {
    tier: 'LITE',
    name: 'Creator Lite',
    displayName: 'Creator Lite',
    description: 'Your AI twin, ready to engage',
    monthlyPrice: 29,
    yearlyPrice: 24, // $288/year (2 months free)
    trial: true,
    limits: {
      maxVideos: 10,
      autoSync: 'manual',
      maxMessagesPerMonth: 500,
      embedWidget: true,
      removeBranding: false,
      advancedPersonality: false,
      analytics: 'basic',
      priorityProcessing: false,
      voiceChat: false,
      smartCTAs: false,
      customDomain: false,
      apiAccess: false,
      maxConcurrentChats: 3,
      responseQuality: 'standard',
      memoryWindow: 'medium',
      supportLevel: 'email',
    },
  },

  PRO: {
    tier: 'PRO',
    name: 'Creator Pro',
    displayName: 'Creator Pro',
    description: 'More control. More intelligence. More engagement.',
    monthlyPrice: 69,
    yearlyPrice: 58, // $696/year (2 months free)
    trial: true,
    popular: true,
    limits: {
      maxVideos: 100,
      autoSync: 'weekly',
      maxMessagesPerMonth: 2500,
      embedWidget: true,
      removeBranding: true,
      advancedPersonality: true,
      analytics: 'full',
      priorityProcessing: true,
      voiceChat: false, // Coming soon
      smartCTAs: false, // Coming soon
      customDomain: false,
      apiAccess: false,
      maxConcurrentChats: 10,
      responseQuality: 'enhanced',
      memoryWindow: 'long',
      supportLevel: 'priority',
    },
  },

  ULTIMATE: {
    tier: 'ULTIMATE',
    name: 'Creator Ultimate',
    displayName: 'Creator Ultimate',
    description: 'Maximum presence. Complete video intelligence.',
    monthlyPrice: 149,
    yearlyPrice: 124, // $1488/year (2 months free)
    trial: true,
    limits: {
      maxVideos: null, // Unlimited
      autoSync: 'realtime',
      maxMessagesPerMonth: 10000,
      embedWidget: true,
      removeBranding: true,
      advancedPersonality: true,
      analytics: 'full',
      priorityProcessing: true,
      voiceChat: false, // Coming soon
      smartCTAs: false, // Coming soon
      customDomain: true,
      apiAccess: false,
      maxConcurrentChats: 25,
      responseQuality: 'premium',
      memoryWindow: 'extended',
      supportLevel: 'priority',
    },
  },

  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    displayName: 'Enterprise',
    description: 'For agencies, talent managers, and top creators',
    monthlyPrice: 0, // Custom pricing
    yearlyPrice: 0,
    trial: false,
    limits: {
      maxVideos: null, // Unlimited
      autoSync: 'realtime',
      maxMessagesPerMonth: null, // Unlimited
      embedWidget: true,
      removeBranding: true,
      advancedPersonality: true,
      analytics: 'full',
      priorityProcessing: true,
      voiceChat: true,
      smartCTAs: true,
      customDomain: true,
      apiAccess: true,
      maxConcurrentChats: 100,
      responseQuality: 'premium',
      memoryWindow: 'extended',
      supportLevel: 'dedicated',
    },
  },
}

/**
 * Get plan configuration by tier
 */
export function getPlanConfig(tier: PlanTier): PlanConfig {
  return PLANS[tier]
}

/**
 * Get all available plans for display (excludes Enterprise)
 */
export function getPublicPlans(): PlanConfig[] {
  return [PLANS.FREE, PLANS.LITE, PLANS.PRO, PLANS.ULTIMATE]
}

/**
 * Check if a creator can add more videos based on their plan
 */
export function canAddVideos(
  currentVideoCount: number,
  planTier: PlanTier
): boolean {
  const plan = getPlanConfig(planTier)
  if (plan.limits.maxVideos === null) return true // Unlimited
  return currentVideoCount < plan.limits.maxVideos
}

/**
 * Check if a creator can send more messages this month based on their plan
 */
export function canSendMessages(
  currentMonthlyMessages: number,
  planTier: PlanTier
): boolean {
  const plan = getPlanConfig(planTier)
  if (plan.limits.maxMessagesPerMonth === null) return true // Unlimited
  return currentMonthlyMessages < plan.limits.maxMessagesPerMonth
}

/**
 * Get remaining videos quota for a plan
 */
export function getRemainingVideos(
  currentVideoCount: number,
  planTier: PlanTier
): number | null {
  const plan = getPlanConfig(planTier)
  if (plan.limits.maxVideos === null) return null // Unlimited
  return Math.max(0, plan.limits.maxVideos - currentVideoCount)
}

/**
 * Get remaining messages quota for current month
 */
export function getRemainingMessages(
  currentMonthlyMessages: number,
  planTier: PlanTier
): number | null {
  const plan = getPlanConfig(planTier)
  if (plan.limits.maxMessagesPerMonth === null) return null // Unlimited
  return Math.max(0, plan.limits.maxMessagesPerMonth - currentMonthlyMessages)
}

/**
 * Check if a feature is available for a plan tier
 */
export function hasFeatureAccess(
  planTier: PlanTier,
  feature: keyof Omit<PlanLimits, 'maxVideos' | 'maxMessagesPerMonth' | 'autoSync' | 'maxConcurrentChats' | 'responseQuality' | 'memoryWindow' | 'supportLevel' | 'analytics'>
): boolean {
  const plan = getPlanConfig(planTier)
  return plan.limits[feature] === true
}

/**
 * Get upgrade path recommendations
 */
export function getUpgradeRecommendation(
  currentTier: PlanTier,
  reason: 'videos' | 'messages' | 'features'
): PlanTier | null {
  const tierOrder: PlanTier[] = ['FREE', 'LITE', 'PRO', 'ULTIMATE', 'ENTERPRISE']
  const currentIndex = tierOrder.indexOf(currentTier)

  if (currentIndex === tierOrder.length - 1) return null // Already on highest tier

  // Recommend next tier up
  return tierOrder[currentIndex + 1]
}

/**
 * Calculate annual savings for yearly billing
 */
export function getAnnualSavings(planTier: PlanTier): number {
  const plan = getPlanConfig(planTier)
  if (plan.monthlyPrice === 0) return 0

  const monthlyAnnual = plan.monthlyPrice * 12
  const yearlyAnnual = plan.yearlyPrice * 12
  return monthlyAnnual - yearlyAnnual
}

/**
 * Validate if a tier transition is allowed
 */
export function canUpgradeOrDowngrade(
  fromTier: PlanTier,
  toTier: PlanTier
): {
  allowed: boolean
  reason?: string
} {
  // Always allow upgrades
  const tierOrder: PlanTier[] = ['FREE', 'LITE', 'PRO', 'ULTIMATE', 'ENTERPRISE']
  const fromIndex = tierOrder.indexOf(fromTier)
  const toIndex = tierOrder.indexOf(toTier)

  if (toIndex > fromIndex) {
    return { allowed: true }
  }

  // Allow downgrades with warning
  if (toIndex < fromIndex) {
    return {
      allowed: true,
      reason: 'Downgrading may limit features and usage. Changes take effect at the end of your billing period.'
    }
  }

  // Same tier
  return { allowed: false, reason: 'You are already on this plan' }
}

/**
 * Get plan comparison data for UI
 */
export interface PlanComparison {
  feature: string
  free: string | boolean
  lite: string | boolean
  pro: string | boolean
  ultimate: string | boolean
}

export function getPlanComparisons(): PlanComparison[] {
  return [
    {
      feature: 'Max Videos',
      free: '5 videos',
      lite: '10 videos',
      pro: '100 videos',
      ultimate: 'Unlimited',
    },
    {
      feature: 'Video Sync',
      free: 'Manual only',
      lite: 'Manual only',
      pro: 'Weekly automatic',
      ultimate: 'Real-time',
    },
    {
      feature: 'Monthly Messages',
      free: '50 messages',
      lite: '500 messages',
      pro: '2,500 messages',
      ultimate: '10,000 messages',
    },
    {
      feature: 'Embed Widget',
      free: false,
      lite: true,
      pro: true,
      ultimate: true,
    },
    {
      feature: 'Remove Branding',
      free: false,
      lite: false,
      pro: true,
      ultimate: true,
    },
    {
      feature: 'Advanced Personality',
      free: false,
      lite: false,
      pro: true,
      ultimate: true,
    },
    {
      feature: 'Analytics',
      free: 'None',
      lite: 'Basic',
      pro: 'Full',
      ultimate: 'Full',
    },
    {
      feature: 'Priority Processing',
      free: false,
      lite: false,
      pro: true,
      ultimate: true,
    },
    {
      feature: 'Custom Domain',
      free: false,
      lite: false,
      pro: false,
      ultimate: true,
    },
  ]
}
