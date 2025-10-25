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
    const pythonPath = path.join(process.cwd(), 'scripts', 'transcript_env', 'bin', 'python')
    console.log(`🔍 Extracting channel info from username: @${username}`)

    // Optimized: Use --dump-single-json with --flat-playlist for fastest extraction
    // --skip-download ensures no video downloading, --playlist-items 1 gets just first video
    const ytdlpCommand = `${pythonPath} -m yt_dlp --dump-single-json --flat-playlist --skip-download --playlist-items 1 --quiet --no-warnings --proxy "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80" "https://www.youtube.com/@${username}"`

    const { stdout } = await execAsync(ytdlpCommand)
    const playlistInfo = JSON.parse(stdout)

    // With --dump-single-json, we get playlist info with entries array
    const channelId = playlistInfo.channel_id || playlistInfo.uploader_id
    const channelName = playlistInfo.channel || playlistInfo.uploader

    if (!channelId) {
      console.log(`❌ No channel_id found for @${username}`)
      return null
    }

    console.log(`✅ Found channel: ${channelName} (${channelId})`)

    return {
      channelId,
      channelName: channelName || username
    }
  } catch (error) {
    console.error('Error extracting channel info from username:', error)
    return null
  }
}

async function getChannelVideos(channelId: string): Promise<any> {
  try {
    const pythonPath = path.join(process.cwd(), 'scripts', 'transcript_env', 'bin', 'python')
    console.log(`📹 Getting last 10 videos for channel: ${channelId}`)

    // Optimized: Use --dump-single-json for faster extraction (all data in one JSON object)
    // --lazy-playlist combined with --playlist-end is fastest for large channels
    const ytdlpCommand = `${pythonPath} -m yt_dlp --dump-single-json --flat-playlist --skip-download --lazy-playlist --playlist-end 10 --quiet --no-warnings --proxy "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80" "https://www.youtube.com/channel/${channelId}"`

    const { stdout } = await execAsync(ytdlpCommand)
    const playlistData = JSON.parse(stdout)

    // Extract channel info from playlist metadata
    const channelName = playlistData.channel || playlistData.uploader
    const channelThumbnail = playlistData.channel_follower_count
      ? (playlistData.thumbnails?.[0]?.url || `https://yt3.googleusercontent.com/ytc/${channelId}`)
      : `https://yt3.googleusercontent.com/ytc/${channelId}`

    // Parse entries array from the single JSON response
    const videos = (playlistData.entries || []).slice(0, 10).map((video: any) => ({
      id: video.id,
      title: video.title || '',
      description: video.description || '',
      thumbnail: video.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`,
      duration: video.duration ? formatDuration(video.duration) : '',
      publishedAt: video.upload_date ? formatDate(video.upload_date) : '',
      view_count: video.view_count || 0,
      url: video.url || `https://www.youtube.com/watch?v=${video.id}`
    }))

    console.log(`✅ Found ${videos.length} videos for channel: ${channelName}`)

    return {
      videos,
      channel_thumbnail: channelThumbnail,
      total_videos: playlistData.playlist_count || videos.length,
      subscriber_count: playlistData.channel_follower_count || null
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