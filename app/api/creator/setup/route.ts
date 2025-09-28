import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { YouTubeService } from '@/lib/youtube'
import { ExtendedYouTubeService } from '@/lib/youtube-extended'
import { z } from 'zod'

const setupSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  youtubeChannelUrl: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = setupSchema.parse(body)

    // Check if creator already exists
    const { data: existingCreator } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (existingCreator) {
      return NextResponse.json({ error: 'Creator profile already exists' }, { status: 400 })
    }

    // Check if username is already taken
    const { data: existingUsername } = await supabase
      .from('creators')
      .select('id')
      .eq('username', validatedData.username)
      .single()

    if (existingUsername) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
    }

    // Check if YouTube channel is already connected to another creator
    if (validatedData.youtubeChannelUrl) {
      const { data: existingChannel } = await supabase
        .from('creators')
        .select('id')
        .eq('youtube_channel_url', validatedData.youtubeChannelUrl)
        .single()

      if (existingChannel) {
        return NextResponse.json({ error: 'This YouTube channel is already connected to another creator' }, { status: 400 })
      }
    }

    let youtubeChannelId: string | undefined
    let youtubeChannelInfo: any = null
    
    if (validatedData.youtubeChannelUrl) {
      const channelIdMatch = validatedData.youtubeChannelUrl.match(/channel\/([a-zA-Z0-9_-]+)/)
      if (channelIdMatch) {
        youtubeChannelId = channelIdMatch[1]
        
        youtubeChannelInfo = await YouTubeService.getChannelInfo(youtubeChannelId)
        if (!youtubeChannelInfo) {
          return NextResponse.json({ error: 'YouTube channel not found' }, { status: 400 })
        }
      }
    }

    // Create creator in Supabase
    const { data: creator, error: createError } = await supabase
      .from('creators')
      .insert({
        user_id: session.user.id,
        username: validatedData.username,
        display_name: validatedData.displayName,
        bio: validatedData.bio || null,
        youtube_channel_id: youtubeChannelId || null,
        youtube_channel_url: validatedData.youtubeChannelUrl || null,
        profile_image: youtubeChannelInfo?.snippet?.thumbnails?.default?.url || session.user.image || null,
      })
      .select()
      .single()

    if (createError || !creator) {
      console.error('Failed to create creator:', createError)
      return NextResponse.json({ error: 'Failed to create creator profile' }, { status: 500 })
    }

    // Auto-sync YouTube content if channel is provided
    if (youtubeChannelId && validatedData.youtubeChannelUrl) {
      console.log(`🚀 Auto-syncing YouTube content for creator ${creator.username} (${creator.id})`)
      
      // Trigger auto-sync in the background without waiting
      triggerAutoSync(creator.id, validatedData.youtubeChannelUrl)
        .catch(error => {
          console.error('Auto-sync failed for creator', creator.id, error)
        })
    }

    return NextResponse.json({ creator })
  } catch (error) {
    console.error('Creator setup error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function triggerAutoSync(creatorId: string, channelUrl: string) {
  try {
    console.log(`🔄 Triggering auto-sync for creator ${creatorId} with channel: ${channelUrl}`)
    
    // Use the existing sync-content API internally
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    const syncResponse = await fetch(`${baseUrl}/api/creator/sync-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',  // Mark as internal request
        'X-Creator-Id': creatorId,     // Pass creator ID for internal auth
      },
      body: JSON.stringify({
        type: 'channel',
        channelUrl: channelUrl,
        maxVideos: 10,  // Limit initial sync to 10 videos
        languages: ['en']
      })
    })

    if (syncResponse.ok) {
      console.log(`✅ Auto-sync successfully triggered for creator ${creatorId}`)
    } else {
      const errorText = await syncResponse.text()
      console.error(`❌ Auto-sync failed for creator ${creatorId}:`, errorText)
    }
  } catch (error) {
    console.error('Error triggering auto-sync:', error)
  }
}