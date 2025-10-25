import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

interface VideoMetadata {
  success: boolean
  video_id: string
  title: string
  description: string
  duration: number
  upload_date: string
  uploader: string
  channel: string
  channel_id: string
  view_count: number
  like_count: number
  thumbnail: string
  tags: string[]
  categories: string[]
  availability: string
  age_limit: number
  language: string | null
  obtained_via: string
  processing_date: null
}

interface ChannelFromUsername {
  success: boolean
  username: string
  channel_id: string
  channel_name: string
  uploader: string
  obtained_via: string
  sample_video_id: string
  sample_video_title: string
  processing_date: null
  error?: string
  message?: string
}

async function extractVideoId(url: string): Promise<string> {
  // Extract video ID from various YouTube URL formats
  const videoIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  const match = url.match(videoIdRegex)
  return match ? match[1] : ''
}

async function getChannelInfoFromVideo(videoId: string): Promise<{ channelId: string; channelName: string } | null> {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'youtube_transcript_extractor.py')
    const pythonPath = path.join(process.cwd(), 'scripts', 'transcript_env', 'bin', 'python')
    
    console.log(`🔍 Extracting channel info from video: ${videoId}`)
    
    const { stdout } = await execAsync(`${pythonPath} ${scriptPath} metadata ${videoId}`)
    const metadata: VideoMetadata = JSON.parse(stdout)
    
    if (!metadata.success) {
      console.log(`❌ Failed to get metadata: ${metadata}`)
      return null
    }
    
    console.log(`✅ Found channel: ${metadata.channel} (${metadata.channel_id})`)
    
    return {
      channelId: metadata.channel_id,
      channelName: metadata.channel
    }
  } catch (error) {
    console.error('Error extracting channel info from video:', error)
    return null
  }
}

async function getChannelInfoFromUsername(username: string): Promise<{ channelId: string; channelName: string } | null> {
  try {
    console.log(`🔍 Extracting channel info from username: @${username}`)

    // Call the Python serverless function
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const response = await fetch(`${baseUrl}/api/py/youtube-channel-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    })

    const channelInfo: ChannelFromUsername = await response.json()

    if (!channelInfo.success) {
      console.log(`❌ Failed to get channel info: ${channelInfo.error || channelInfo.message}`)
      return null
    }

    console.log(`✅ Found channel: ${channelInfo.channel_name} (${channelInfo.channel_id})`)

    return {
      channelId: channelInfo.channel_id,
      channelName: channelInfo.channel_name
    }
  } catch (error) {
    console.error('Error extracting channel info from username:', error)
    return null
  }
}

async function getChannelVideos(channelId: string): Promise<any> {
  try {
    console.log(`📹 Getting last 10 videos for channel: ${channelId}`)

    // Call the Python serverless function
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const response = await fetch(`${baseUrl}/api/py/youtube-channel-videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel_id: channelId,
        limit: 10
      }),
    })

    const videosData = await response.json()

    if (!videosData.success) {
      console.log(`❌ Failed to get channel videos: ${videosData.error || videosData.message}`)
      return {
        videos: [],
        channel_thumbnail: '',
        total_videos: 0
      }
    }

    console.log(`✅ Found ${videosData.video_count} videos for channel`)

    return {
      videos: videosData.videos || [],
      channel_thumbnail: videosData.channel_thumbnail || '',
      total_videos: videosData.total_videos || 0,
      subscriber_count: videosData.subscriber_count
    }
  } catch (error) {
    console.error('Error getting channel videos:', error)
    return {
      videos: [],
      channel_thumbnail: '',
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
    }
    // Handle @username URLs using our Python script
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

    // Return channel information
    return NextResponse.json({
      channel: {
        id: channelId,
        name: channelName || 'Unknown Channel',
        thumbnail: channelData.channel_thumbnail || `https://yt3.ggpht.com/ytc/${channelId}`,
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