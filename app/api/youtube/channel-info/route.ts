import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import youtubedl from 'youtube-dl-exec'

const PROXY_URL = 'http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80'

async function extractVideoId(url: string): Promise<string> {
  const videoIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  const match = url.match(videoIdRegex)
  return match ? match[1] : ''
}

async function getChannelInfoFromVideo(videoId: string): Promise<{ channelId: string; channelName: string; channelThumbnail: string } | null> {
  try {
    console.log(`🔍 Extracting channel info from video: ${videoId}`)

    const metadata = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpSingleJson: true,
      skipDownload: true,
      noWarnings: true,
      proxy: PROXY_URL
    }) as any

    const channelId = metadata.channel_id || metadata.uploader_id
    const channelName = metadata.channel || metadata.uploader

    // Extract channel thumbnail - yt-dlp provides this in thumbnails array or channel_url
    let channelThumbnail = ''
    if (metadata.channel_follower_count && metadata.thumbnails && metadata.thumbnails.length > 0) {
      channelThumbnail = metadata.thumbnails[0].url
    } else if (channelId) {
      channelThumbnail = `https://yt3.ggpht.com/ytc/${channelId}`
    }

    if (!channelId) {
      console.log(`❌ Failed to get channel info from video`)
      return null
    }

    console.log(`✅ Found channel: ${channelName} (${channelId})`)
    console.log(`📸 Channel thumbnail: ${channelThumbnail}`)

    return {
      channelId,
      channelName,
      channelThumbnail
    }
  } catch (error) {
    console.error('Error extracting channel info from video:', error)
    return null
  }
}

async function getChannelInfoFromUsername(username: string): Promise<{ channelId: string; channelName: string; channelThumbnail: string } | null> {
  try {
    console.log(`🔍 Extracting channel info from username: @${username}`)

    const videoInfo = await youtubedl(`https://www.youtube.com/@${username}`, {
      dumpSingleJson: true,
      skipDownload: true,
      playlistItems: '1',
      noWarnings: true,
      proxy: PROXY_URL
    }) as any

    const channelId = videoInfo.channel_id || videoInfo.uploader_id
    const channelName = videoInfo.channel || videoInfo.uploader

    // Extract channel thumbnail from uploader metadata
    let channelThumbnail = ''
    if (videoInfo.uploader_url) {
      // Try to get channel thumbnail from channel page
      try {
        const channelData = await youtubedl(videoInfo.uploader_url, {
          dumpSingleJson: true,
          skipDownload: true,
          playlistEnd: 1,
          noWarnings: true,
          proxy: PROXY_URL
        }) as any

        if (channelData.thumbnails && channelData.thumbnails.length > 0) {
          channelThumbnail = channelData.thumbnails[0].url
        }
      } catch (e) {
        console.log('Could not fetch channel thumbnail from uploader_url')
      }
    }

    // Fallback to default thumbnail
    if (!channelThumbnail && channelId) {
      channelThumbnail = `https://yt3.ggpht.com/ytc/${channelId}`
    }

    if (!channelId) {
      console.log(`❌ No channel_id found for @${username}`)
      console.log(`📊 Available fields: ${Object.keys(videoInfo).join(', ')}`)
      return null
    }

    console.log(`✅ Found channel: ${channelName} (${channelId})`)
    console.log(`📸 Channel thumbnail: ${channelThumbnail}`)

    return {
      channelId,
      channelName: channelName || username,
      channelThumbnail
    }
  } catch (error) {
    console.error('Error extracting channel info from username:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
    return null
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  // yt-dlp returns dates as YYYYMMDD
  if (dateStr.length === 8) {
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    return `${year}-${month}-${day}`
  }
  return dateStr
}

async function getChannelVideos(channelId: string): Promise<any> {
  try {
    console.log(`📹 Getting last 10 videos for channel: ${channelId}`)

    const playlistData = await youtubedl(`https://www.youtube.com/channel/${channelId}`, {
      dumpSingleJson: true,
      flatPlaylist: true,
      skipDownload: true,
      playlistEnd: 10,
      quiet: true,
      noWarnings: true,
      proxy: PROXY_URL
    }) as any

    // Extract channel info from playlist metadata
    const channelName = playlistData.channel || playlistData.uploader

    // Get channel thumbnail from playlist metadata
    let channelThumbnail = ''
    if (playlistData.thumbnails && playlistData.thumbnails.length > 0) {
      channelThumbnail = playlistData.thumbnails[0].url
    } else {
      channelThumbnail = `https://yt3.ggpht.com/ytc/${channelId}`
    }

    // Parse entries array from the single JSON response
    const videos = (playlistData.entries || []).slice(0, 10).map((video: any) => {
      // Get best thumbnail
      let thumbnail = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
      if (video.thumbnails && video.thumbnails.length > 0) {
        // Get the highest quality thumbnail
        const bestThumb = video.thumbnails[video.thumbnails.length - 1]
        thumbnail = bestThumb.url || thumbnail
      }

      return {
        id: video.id,
        title: video.title || '',
        description: video.description || '',
        thumbnail,
        duration: video.duration ? formatDuration(video.duration) : '',
        publishedAt: video.upload_date ? formatDate(video.upload_date) : '',
        view_count: video.view_count || 0,
        url: video.url || `https://www.youtube.com/watch?v=${video.id}`
      }
    })

    console.log(`✅ Found ${videos.length} videos for channel: ${channelName}`)
    console.log(`📸 Channel thumbnail: ${channelThumbnail}`)

    return {
      videos,
      channel_thumbnail: channelThumbnail,
      channel_name: channelName,
      total_videos: playlistData.playlist_count || videos.length,
      subscriber_count: playlistData.channel_follower_count || null
    }
  } catch (error) {
    console.error('Error getting channel videos:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
    return {
      videos: [],
      channel_thumbnail: '',
      channel_name: '',
      total_videos: 0
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
    // Handle video URLs - extract channel info from video metadata
    else if (url.includes('watch?v=') || url.includes('youtu.be/')) {
      const videoId = await extractVideoId(url)
      if (!videoId) {
        return NextResponse.json({
          error: 'Could not extract video ID from URL'
        }, { status: 400 })
      }

      const channelInfo = await getChannelInfoFromVideo(videoId)
      if (!channelInfo) {
        return NextResponse.json({
          error: 'Could not extract channel information from video'
        }, { status: 400 })
      }

      channelId = channelInfo.channelId
      channelName = channelInfo.channelName
      channelThumbnail = channelInfo.channelThumbnail
    }
    // Handle @username URLs using yt-dlp
    else if (url.includes('/@')) {
      const username = url.split('/@')[1].split('/')[0].split('?')[0]
      console.log(`🔍 Processing @username URL: @${username}`)

      const channelInfo = await getChannelInfoFromUsername(username)
      if (!channelInfo) {
        return NextResponse.json({
          error: `Could not find channel information for @${username}. Please check the username and try again.`
        }, { status: 400 })
      }

      channelId = channelInfo.channelId
      channelName = channelInfo.channelName
      channelThumbnail = channelInfo.channelThumbnail
    }
    // Handle other URL formats that need video-based extraction
    else {
      return NextResponse.json({
        error: 'Please provide either a channel URL (/channel/ID) or a video URL. Other URL formats are not yet supported.'
      }, { status: 400 })
    }

    if (!channelId) {
      return NextResponse.json({
        error: 'Could not extract channel ID from URL. Please use a valid YouTube channel URL or video URL.'
      }, { status: 400 })
    }

    // Get channel videos and metadata
    const channelData = await getChannelVideos(channelId)

    // Use channel thumbnail from initial lookup if available, otherwise from channel data
    if (!channelThumbnail && channelData.channel_thumbnail) {
      channelThumbnail = channelData.channel_thumbnail
    }

    // Use channel name from initial lookup if available, otherwise from channel data
    if (!channelName && channelData.channel_name) {
      channelName = channelData.channel_name
    }

    // Return channel information
    return NextResponse.json({
      channel: {
        id: channelId,
        name: channelName || 'Unknown Channel',
        thumbnail: channelThumbnail || `https://yt3.ggpht.com/ytc/${channelId}`,
        subscriberCount: channelData.subscriber_count ? channelData.subscriber_count.toLocaleString() : 'Hidden',
        videoCount: channelData.total_videos || channelData.videos.length,
        description: 'Channel information extracted from video metadata'
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
