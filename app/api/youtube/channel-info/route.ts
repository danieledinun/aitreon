import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const PROXY_URL = 'http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80'

interface ProxyFetchOptions extends RequestInit {
  proxy?: string
}

async function fetchWithProxy(url: string, options: ProxyFetchOptions = {}): Promise<Response> {
  // For Vercel serverless, we can't use the proxy directly via native fetch
  // Instead, we need to use a custom HTTP agent or a service
  // For now, let's try direct fetch and handle errors gracefully

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    return response
  } catch (error) {
    console.error('Fetch error:', error)
    throw error
  }
}

async function extractChannelIdFromUsername(username: string): Promise<{ channelId: string; channelName: string } | null> {
  try {
    console.log(`🔍 Extracting channel ID from username: @${username}`)

    const url = `https://www.youtube.com/@${username}`
    const response = await fetchWithProxy(url)

    if (!response.ok) {
      console.error(`❌ Failed to fetch channel page: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Extract channel ID from page metadata
    // Look for: "channelId":"UCxxxxx" or "externalId":"UCxxxxx"
    const channelIdMatch = html.match(/"channelId":"([^"]+)"/) || html.match(/"externalId":"([^"]+)"/)
    const channelNameMatch = html.match(/"channelMetadataRenderer":\{"title":"([^"]+)"/)

    if (!channelIdMatch) {
      console.error('❌ Could not find channel ID in page HTML')
      return null
    }

    const channelId = channelIdMatch[1]
    const channelName = channelNameMatch ? channelNameMatch[1] : username

    console.log(`✅ Found channel: ${channelName} (${channelId})`)

    return {
      channelId,
      channelName
    }
  } catch (error) {
    console.error('Error extracting channel ID from username:', error)
    return null
  }
}

async function extractChannelIdFromVideo(videoId: string): Promise<{ channelId: string; channelName: string } | null> {
  try {
    console.log(`🔍 Extracting channel info from video: ${videoId}`)

    const url = `https://www.youtube.com/watch?v=${videoId}`
    const response = await fetchWithProxy(url)

    if (!response.ok) {
      console.error(`❌ Failed to fetch video page: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Extract channel ID and name from video page
    const channelIdMatch = html.match(/"channelId":"([^"]+)"/) || html.match(/"externalChannelId":"([^"]+)"/)
    const channelNameMatch = html.match(/"author":"([^"]+)"/) || html.match(/"channelName":"([^"]+)"/)

    if (!channelIdMatch) {
      console.error('❌ Could not find channel ID in video page')
      return null
    }

    const channelId = channelIdMatch[1]
    const channelName = channelNameMatch ? channelNameMatch[1] : 'Unknown Channel'

    console.log(`✅ Found channel: ${channelName} (${channelId})`)

    return {
      channelId,
      channelName
    }
  } catch (error) {
    console.error('Error extracting channel info from video:', error)
    return null
  }
}

function parseRSSDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0] // Returns YYYY-MM-DD
  } catch (error) {
    return ''
  }
}

function parseDuration(duration: string): string {
  // Parse ISO 8601 duration format (PT1H2M3S)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''

  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

async function getChannelVideosFromRSS(channelId: string): Promise<any> {
  try {
    console.log(`📹 Getting videos from RSS feed for channel: ${channelId}`)

    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const response = await fetchWithProxy(rssUrl)

    if (!response.ok) {
      console.error(`❌ Failed to fetch RSS feed: ${response.status}`)
      return {
        videos: [],
        channel_thumbnail: `https://yt3.googleusercontent.com/ytc/${channelId}`,
        total_videos: 0,
        subscriber_count: null
      }
    }

    const xml = await response.text()

    // Parse XML manually (basic parsing)
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []

    const videos = entries.slice(0, 10).map((entry) => {
      // Extract video ID
      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
      const videoId = videoIdMatch ? videoIdMatch[1] : ''

      // Extract title
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/)
      const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : ''

      // Extract published date
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/)
      const publishedAt = publishedMatch ? parseRSSDate(publishedMatch[1]) : ''

      // Extract view count from media:statistics if available
      const viewsMatch = entry.match(/views="(\d+)"/)
      const viewCount = viewsMatch ? parseInt(viewsMatch[1]) : 0

      // Extract thumbnail
      const thumbnailMatch = entry.match(/url="([^"]+)"/)
      const thumbnail = thumbnailMatch ? thumbnailMatch[1] : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

      // Extract description
      const descMatch = entry.match(/<media:description>([^<]*)<\/media:description>/)
      const description = descMatch ? descMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : ''

      return {
        id: videoId,
        title,
        description,
        thumbnail,
        duration: '', // RSS feed doesn't include duration, we'll need to fetch this separately if needed
        publishedAt,
        view_count: viewCount,
        url: `https://www.youtube.com/watch?v=${videoId}`
      }
    }).filter(v => v.id) // Only include entries with valid video IDs

    // Extract channel name from XML
    const channelNameMatch = xml.match(/<name>([^<]+)<\/name>/)
    const channelName = channelNameMatch ? channelNameMatch[1] : 'Unknown Channel'

    console.log(`✅ Found ${videos.length} videos for channel: ${channelName}`)

    return {
      videos,
      channel_thumbnail: `https://yt3.googleusercontent.com/ytc/${channelId}`,
      total_videos: videos.length,
      subscriber_count: null,
      channel_name: channelName
    }
  } catch (error) {
    console.error('Error getting channel videos from RSS:', error)
    return {
      videos: [],
      channel_thumbnail: `https://yt3.googleusercontent.com/ytc/${channelId}`,
      total_videos: 0,
      subscriber_count: null
    }
  }
}

async function extractVideoId(url: string): Promise<string> {
  // Extract video ID from various YouTube URL formats
  const videoIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  const match = url.match(videoIdRegex)
  return match ? match[1] : ''
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

    // Handle direct channel URLs
    if (url.includes('/channel/')) {
      channelId = url.split('/channel/')[1].split('/')[0].split('?')[0]
      console.log(`✅ Extracted channel ID: ${channelId}`)
    }
    // Handle video URLs - extract channel info from video metadata
    else if (url.includes('watch?v=') || url.includes('youtu.be/')) {
      const videoId = await extractVideoId(url)
      if (!videoId) {
        return NextResponse.json({
          error: 'Could not extract video ID from URL'
        }, { status: 400 })
      }

      const channelInfo = await extractChannelIdFromVideo(videoId)
      if (!channelInfo) {
        return NextResponse.json({
          error: 'Could not extract channel information from video'
        }, { status: 400 })
      }

      channelId = channelInfo.channelId
      channelName = channelInfo.channelName
    }
    // Handle @username URLs
    else if (url.includes('/@')) {
      const username = url.split('/@')[1].split('/')[0].split('?')[0]
      console.log(`🔍 Processing @username URL: @${username}`)

      const channelInfo = await extractChannelIdFromUsername(username)
      if (!channelInfo) {
        return NextResponse.json({
          error: `Could not find channel information for @${username}. Please check the username and try again.`
        }, { status: 400 })
      }

      channelId = channelInfo.channelId
      channelName = channelInfo.channelName
    }
    // Handle other URL formats
    else {
      return NextResponse.json({
        error: 'Please provide either a channel URL (/channel/ID), a video URL, or a @username URL.'
      }, { status: 400 })
    }

    if (!channelId) {
      return NextResponse.json({
        error: 'Could not extract channel ID from URL. Please use a valid YouTube channel URL or video URL.'
      }, { status: 400 })
    }

    // Get channel videos and metadata from RSS
    const channelData = await getChannelVideosFromRSS(channelId)

    // Use channel name from RSS if we don't have one yet
    if (!channelName && channelData.channel_name) {
      channelName = channelData.channel_name
    }

    // Return channel information
    return NextResponse.json({
      channel: {
        id: channelId,
        name: channelName || 'Unknown Channel',
        thumbnail: channelData.channel_thumbnail || `https://yt3.ggpht.com/ytc/${channelId}`,
        subscriberCount: channelData.subscriber_count ? channelData.subscriber_count.toLocaleString() : 'Hidden',
        videoCount: channelData.total_videos || channelData.videos.length,
        description: 'Channel information extracted from YouTube'
      },
      videos: channelData.videos.map((video: any) => ({
        id: video.id || '',
        title: video.title || '',
        thumbnail: video.thumbnail || '',
        duration: video.duration || '',
        publishedAt: video.publishedAt || '',
        description: video.description || '',
        viewCount: video.view_count || 0
      }))
    })

  } catch (error) {
    console.error('Error fetching channel info:', error)
    return NextResponse.json({
      error: 'Failed to fetch channel information. Please try again.'
    }, { status: 500 })
  }
}
