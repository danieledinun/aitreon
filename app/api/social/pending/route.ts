import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.AUTOMATION_API_KEY
}

/**
 * GET /api/social/pending
 * List active creators with auto-replies enabled + their OAuth refresh tokens
 */
export async function GET(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all creators with auto-replies enabled
    const { data: settings, error: settingsError } = await supabase
      .from('social_reply_settings')
      .select('creator_id')
      .eq('is_enabled', true)

    if (settingsError || !settings?.length) {
      return NextResponse.json({ creators: [] })
    }

    const creatorIds = settings.map((s) => s.creator_id)

    // Get creator info + user IDs
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select('id, user_id, username, youtube_channel_id, youtube_channel_url')
      .in('id', creatorIds)
      .eq('is_active', true)

    if (creatorsError || !creators?.length) {
      return NextResponse.json({ creators: [] })
    }

    // Get refresh tokens for these users
    const userIds = creators.map((c) => c.user_id)
    const { data: accounts } = await supabase
      .from('accounts')
      .select('user_id, refresh_token')
      .in('user_id', userIds)
      .eq('provider', 'google')

    const tokenMap = new Map(
      (accounts || []).map((a) => [a.user_id, a.refresh_token])
    )

    const result = creators.map((c) => ({
      creatorId: c.id,
      username: c.username,
      youtubeChannelId: c.youtube_channel_id,
      youtubeChannelUrl: c.youtube_channel_url,
      refreshToken: tokenMap.get(c.user_id) || null,
    }))

    return NextResponse.json({ creators: result })
  } catch (error) {
    console.error('Error in GET /api/social/pending:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
