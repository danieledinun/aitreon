import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Set maximum duration for this API route (Vercel limit: 60s for Hobby, 300s for Pro)
export const maxDuration = 60

const YOUTUBE_SERVICE_URL = process.env.YOUTUBE_SERVICE_URL || 'http://localhost:3001'

async function extractVideoId(url: string): Promise<string> {
  const videoIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  const match = url.match(videoIdRegex)
  return match ? match[1] : ''
}

async function getChannelInfoFromUrl(url: string): Promise<{ channelId: string; channelName: string; channelThumbnail: string } | null> {
  try {
    console.log(`🔍 Calling YouTube service for URL: ${url}`)
    console.log(`📍 YouTube service URL: ${YOUTUBE_SERVICE_URL}`)

    // Set a 50-second timeout for the fetch request (leaving 10s buffer for Vercel's 60s limit)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 50000)

    const response = await fetch(`${YOUTUBE_SERVICE_URL}/api/channel/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ YouTube service error:', error)
      console.error(`❌ Response status: ${response.status}`)
      return null
    }

    const data = await response.json()
    console.log(`✅ Got channel info: ${data.channelName} (${data.channelId})`)

    return {
      channelId: data.channelId,
      channelName: data.channelName,
      channelThumbnail: data.channelThumbnail
    }
  } catch (error) {
    console.error('Error calling YouTube service:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return null
  }
}

async function getChannelVideos(channelId: string): Promise<any> {
  try {
    console.log(`📹 Calling YouTube service for videos: ${channelId}`)

    // Set a 50-second timeout for the fetch request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 50000)

    const response = await fetch(`${YOUTUBE_SERVICE_URL}/api/channel/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId,
        limit: 10
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ YouTube service error:', error)
      return {
        videos: [],
        channelThumbnail: '',
        channelName: '',
        totalVideos: 0,
        subscriberCount: null
      }
    }

    const data = await response.json()
    console.log(`✅ Got ${data.videos.length} videos`)

    return {
      videos: data.videos,
      channelThumbnail: data.channelThumbnail,
      channelName: data.channelName,
      totalVideos: data.totalVideos,
      subscriberCount: data.subscriberCount
    }
  } catch (error) {
    console.error('Error calling YouTube service:', error)
    return {
      videos: [],
      channelThumbnail: '',
      channelName: '',
      totalVideos: 0,
      subscriberCount: null
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'YouTube channel URL is required' }, { status: 400 })
    }

    console.log(`🔄 Processing URL: ${url}`)

    let channelId = ''
    let channelData: any

    // For @username URLs, use the combined endpoint that returns channel info AND videos in one call
    if (url.includes('/@') || url.includes('/user/') || url.includes('/c/')) {
      console.log(`🔍 Fetching @username channel with videos in one request...`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 58000)  // 58s timeout, leaving 2s buffer for Vercel's 60s limit

      const response = await fetch(`${YOUTUBE_SERVICE_URL}/api/channel/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          includeVideos: true,
          limit: 3  // Reduced to 3 videos to fit within Vercel's 60s timeout
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return NextResponse.json({
          error: `Could not find channel information. Please check the URL and try again.`
        }, { status: 400 })
      }

      const data = await response.json()
      channelId = data.channelId
      channelData = {
        videos: data.videos || [],
        channelThumbnail: data.channelThumbnail,
        channelName: data.channelName,
        totalVideos: data.totalVideos || 0,
        subscriberCount: data.subscriberCount
      }
      console.log(`✅ Got channel data with ${data.videos?.length || 0} videos`)
    }
    // For direct channel URLs, extract channel ID directly and fetch videos
    else if (url.includes('/channel/')) {
      channelId = url.split('/channel/')[1].split('/')[0].split('?')[0]
      console.log(`✅ Extracted channel ID from URL: ${channelId}`)
      channelData = await getChannelVideos(channelId)
    }
    // For video URLs, get channel info first then fetch videos
    else {
      const channelInfo = await getChannelInfoFromUrl(url)
      if (!channelInfo) {
        return NextResponse.json({
          error: `Could not find channel information. Please check the URL and try again.`
        }, { status: 400 })
      }
      channelId = channelInfo.channelId
      channelData = await getChannelVideos(channelId)
    }

    if (!channelId) {
      return NextResponse.json({
        error: 'Could not extract channel ID from URL. Please use a valid YouTube channel URL or video URL.'
      }, { status: 400 })
    }

    // Return channel information
    return NextResponse.json({
      channel: {
        id: channelId,
        name: channelData.channelName || 'Unknown Channel',
        thumbnail: channelData.channelThumbnail || `https://yt3.ggpht.com/ytc/${channelId}`,
        subscriberCount: channelData.subscriberCount ? channelData.subscriberCount.toLocaleString() : 'Hidden',
        videoCount: channelData.totalVideos || channelData.videos.length,
        description: 'Channel information extracted from YouTube'
      },
      videos: channelData.videos.map((video: any) => ({
        id: video.id || '',
        title: video.title || '',
        thumbnail: video.thumbnail || '',
        duration: video.duration || '',
        publishedAt: video.publishedAt || '',
        description: video.description || '',
        viewCount: video.viewCount || 0
      }))
    })

  } catch (error) {
    console.error('Error fetching channel info:', error)
    return NextResponse.json({
      error: 'Failed to fetch channel information. Please try again.'
    }, { status: 500 })
  }
}
