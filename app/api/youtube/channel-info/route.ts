import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

    const response = await fetch(`${YOUTUBE_SERVICE_URL}/api/channel/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    })

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

    const response = await fetch(`${YOUTUBE_SERVICE_URL}/api/channel/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId,
        limit: 10
      })
    })

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
    let channelName = ''
    let channelThumbnail = ''

    // Handle direct channel URLs
    if (url.includes('/channel/')) {
      channelId = url.split('/channel/')[1].split('/')[0].split('?')[0]
      console.log(`✅ Extracted channel ID: ${channelId}`)
    }
    // Handle all other URL formats (video URLs, @username URLs) via YouTube service
    else {
      const channelInfo = await getChannelInfoFromUrl(url)
      if (!channelInfo) {
        return NextResponse.json({
          error: `Could not find channel information. Please check the URL and try again.`
        }, { status: 400 })
      }

      channelId = channelInfo.channelId
      channelName = channelInfo.channelName
      channelThumbnail = channelInfo.channelThumbnail
    }

    if (!channelId) {
      return NextResponse.json({
        error: 'Could not extract channel ID from URL. Please use a valid YouTube channel URL or video URL.'
      }, { status: 400 })
    }

    // Get channel videos and metadata from YouTube service
    const channelData = await getChannelVideos(channelId)

    // Use channel thumbnail from initial lookup if available, otherwise from channel data
    if (!channelThumbnail && channelData.channelThumbnail) {
      channelThumbnail = channelData.channelThumbnail
    }

    // Use channel name from initial lookup if available, otherwise from channel data
    if (!channelName && channelData.channelName) {
      channelName = channelData.channelName
    }

    // Return channel information
    return NextResponse.json({
      channel: {
        id: channelId,
        name: channelName || 'Unknown Channel',
        thumbnail: channelThumbnail || `https://yt3.ggpht.com/ytc/${channelId}`,
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
