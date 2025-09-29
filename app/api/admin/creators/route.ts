import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

// Admin emails for access control
const ADMIN_EMAILS = [
  'admin@aitrion.com',
  'the-air-fryer-g-9837@pages.plusgoogle.com'
]

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'admin-secret-key'

async function checkAdminAuth(request: NextRequest) {
  // Check for admin token first
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const decoded = jwt.verify(token, JWT_SECRET) as any
      if (decoded.role === 'admin') {
        return { isAdmin: true, email: 'admin@aitrion.com' }
      }
    } catch (error) {
      // Invalid token, continue to NextAuth check
    }
  }

  // Fallback to NextAuth session
  const session = await getServerSession(authOptions)
  if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) {
    return { isAdmin: true, email: session.user.email }
  }

  return { isAdmin: false, email: null }
}

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const { isAdmin, email } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch creators with their users, AI config, and counts using Supabase
    const { data: creators, error } = await supabase
      .from('creators')
      .select(`
        id,
        user_id,
        username,
        display_name,
        profile_image,
        bio,
        youtube_channel_id,
        youtube_channel_url,
        is_active,
        created_at,
        updated_at,
        users!inner(
          id,
          name,
          email
        ),
        ai_config(
          id,
          agent_name,
          agent_intro,
          directness,
          humor,
          empathy,
          formality,
          spiciness,
          sentence_length,
          format_default,
          use_emojis,
          citation_policy,
          catchphrases,
          avoid_words
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching creators:', error)
      throw error
    }

    // Get video and subscription counts for each creator
    const creatorsWithCounts = await Promise.all(
      creators.map(async (creator) => {
        // Get video count
        const { count: videoCount } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', creator.id)

        // Get subscription count
        const { count: subscriptionCount } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', creator.id)

        return {
          id: creator.id,
          username: creator.username,
          displayName: creator.display_name,
          profileImage: creator.profile_image,
          description: creator.bio,
          youtubeChannelId: creator.youtube_channel_id,
          youtubeChannelUrl: creator.youtube_channel_url,
          isActive: creator.is_active,
          createdAt: creator.created_at,
          updatedAt: creator.updated_at,
          user: creator.users,
          aiConfig: creator.ai_config?.[0] || null, // Take first AI config (should only be one)
          _count: {
            videos: videoCount || 0,
            subscriptions: subscriptionCount || 0
          }
        }
      })
    )

    console.log(`📊 Returning ${creatorsWithCounts.length} creators for admin with AI config data`)

    return NextResponse.json({
      creators: creatorsWithCounts,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Creators API error:', error)
    return NextResponse.json({ error: 'Failed to fetch creators' }, { status: 500 })
  }
}