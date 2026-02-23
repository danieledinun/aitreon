import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { SocialReplyService } from '@/lib/social-reply-service'
import { getPlanConfig, PlanTier } from '@/lib/plans'

export const dynamic = 'force-dynamic'

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.AUTOMATION_API_KEY
}

async function getCreatorIdFromSession(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single()

  if (!user) return null

  const { data: creator } = await supabase
    .from('creators')
    .select('id')
    .eq('user_id', user.id)
    .single()

  return creator?.id || null
}

/**
 * GET /api/social/settings
 * Get auto-reply settings (session auth or API key)
 */
export async function GET(request: NextRequest) {
  let creatorId: string | null = null

  // Support both API key auth (automation) and session auth (dashboard)
  if (verifyApiKey(request)) {
    creatorId = request.nextUrl.searchParams.get('creatorId')
  } else {
    creatorId = await getCreatorIdFromSession()
  }

  if (!creatorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await SocialReplyService.getSettings(creatorId)

    if (!settings) {
      // Return defaults
      return NextResponse.json({
        creatorId,
        isEnabled: false,
        platform: 'youtube',
        maxRepliesPerDay: 50,
        minDelaySeconds: 30,
        maxDelaySeconds: 120,
        toneOverride: 'default',
        maxReplyLength: 300,
        filterKeywords: [],
        requireKeywords: [],
        skipNegative: false,
        videoFilter: 'all',
        videoIds: [],
        recentDays: 7,
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error in GET /api/social/settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/social/settings
 * Update auto-reply settings (session auth only)
 */
export async function PUT(request: NextRequest) {
  const creatorId = await getCreatorIdFromSession()

  if (!creatorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check plan access
    const { data: creator } = await supabase
      .from('creators')
      .select('user_id')
      .eq('id', creatorId)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', creator.user_id)
      .eq('status', 'active')
      .single()

    const tier = (subscription?.tier as PlanTier) || 'FREE'
    const planConfig = getPlanConfig(tier)

    if (!planConfig.limits.autoReply) {
      return NextResponse.json(
        { error: 'Auto-reply not available on current plan. Upgrade to Pro or higher.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Enforce plan limit on maxRepliesPerDay
    if (body.maxRepliesPerDay && body.maxRepliesPerDay > planConfig.limits.autoReplyMaxPerDay) {
      body.maxRepliesPerDay = planConfig.limits.autoReplyMaxPerDay
    }

    const settings = await SocialReplyService.updateSettings(creatorId, body)

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error in PUT /api/social/settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
