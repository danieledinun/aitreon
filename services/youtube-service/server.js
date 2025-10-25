const express = require('express')
const cors = require('cors')
const youtubedl = require('youtube-dl-exec')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Proxy configuration
const PROXY_URL = process.env.PROXY_URL || 'http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80'

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'youtube-service' })
})

// Get channel info from @username
app.post('/api/channel/info', async (req, res) => {
  try {
    const { url } = req.body

    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }

    console.log(`📺 Fetching channel info for: ${url}`)
    console.log(`🔒 Using proxy: ${PROXY_URL ? 'YES' : 'NO'}`)

    // Set a timeout for the yt-dlp request
    const timeout = 45000 // 45 seconds
    const videoInfoPromise = youtubedl(url, {
      dumpSingleJson: true,
      skipDownload: true,
      playlistItems: '1',
      noWarnings: true,
      noCheckCertificates: true,
      proxy: PROXY_URL,
      socketTimeout: 30
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout after 45s')), timeout)
    )

    const videoInfo = await Promise.race([videoInfoPromise, timeoutPromise])

    const channelId = videoInfo.channel_id || videoInfo.uploader_id
    const channelName = videoInfo.channel || videoInfo.uploader

    // Try to get channel thumbnail
    let channelThumbnail = ''
    if (videoInfo.uploader_url) {
      try {
        const channelData = await youtubedl(videoInfo.uploader_url, {
          dumpSingleJson: true,
          skipDownload: true,
          playlistEnd: 1,
          noWarnings: true,
          proxy: PROXY_URL
        })

        if (channelData.thumbnails && channelData.thumbnails.length > 0) {
          channelThumbnail = channelData.thumbnails[0].url
        }
      } catch (e) {
        console.log('Could not fetch channel thumbnail')
      }
    }

    if (!channelThumbnail && channelId) {
      channelThumbnail = `https://yt3.ggpht.com/ytc/${channelId}`
    }

    console.log(`✅ Found channel: ${channelName} (${channelId})`)

    res.json({
      channelId,
      channelName,
      channelThumbnail
    })

  } catch (error) {
    console.error('Error fetching channel info:', error)
    res.status(500).json({
      error: 'Failed to fetch channel information',
      details: error.message
    })
  }
})

// Get channel videos
app.post('/api/channel/videos', async (req, res) => {
  try {
    const { channelId, limit = 10 } = req.body

    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required' })
    }

    console.log(`📹 Fetching ${limit} videos for channel: ${channelId}`)

    const playlistData = await youtubedl(`https://www.youtube.com/channel/${channelId}`, {
      dumpSingleJson: true,
      flatPlaylist: true,
      skipDownload: true,
      playlistEnd: limit,
      quiet: true,
      noWarnings: true,
      proxy: PROXY_URL
    })

    const channelName = playlistData.channel || playlistData.uploader

    // Get channel thumbnail
    let channelThumbnail = ''
    if (playlistData.thumbnails && playlistData.thumbnails.length > 0) {
      channelThumbnail = playlistData.thumbnails[0].url
    } else {
      channelThumbnail = `https://yt3.ggpht.com/ytc/${channelId}`
    }

    // Parse video entries
    const videos = (playlistData.entries || []).slice(0, limit).map((video) => {
      let thumbnail = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
      if (video.thumbnails && video.thumbnails.length > 0) {
        const bestThumb = video.thumbnails[video.thumbnails.length - 1]
        thumbnail = bestThumb.url || thumbnail
      }

      // Format duration
      let duration = ''
      if (video.duration) {
        const hours = Math.floor(video.duration / 3600)
        const minutes = Math.floor((video.duration % 3600) / 60)
        const seconds = video.duration % 60

        if (hours > 0) {
          duration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        } else {
          duration = `${minutes}:${seconds.toString().padStart(2, '0')}`
        }
      }

      // Format date
      let publishedAt = ''
      if (video.upload_date && video.upload_date.length === 8) {
        const year = video.upload_date.substring(0, 4)
        const month = video.upload_date.substring(4, 6)
        const day = video.upload_date.substring(6, 8)
        publishedAt = `${year}-${month}-${day}`
      }

      return {
        id: video.id,
        title: video.title || '',
        description: video.description || '',
        thumbnail,
        duration,
        publishedAt,
        viewCount: video.view_count || 0,
        url: video.url || `https://www.youtube.com/watch?v=${video.id}`
      }
    })

    console.log(`✅ Found ${videos.length} videos`)

    res.json({
      channelName,
      channelThumbnail,
      totalVideos: playlistData.playlist_count || videos.length,
      subscriberCount: playlistData.channel_follower_count || null,
      videos
    })

  } catch (error) {
    console.error('Error fetching channel videos:', error)
    res.status(500).json({
      error: 'Failed to fetch channel videos',
      details: error.message
    })
  }
})

// Get video info (for transcript extraction later)
app.post('/api/video/info', async (req, res) => {
  try {
    const { videoId } = req.body

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' })
    }

    console.log(`🎥 Fetching video info for: ${videoId}`)

    const metadata = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpSingleJson: true,
      skipDownload: true,
      noWarnings: true,
      proxy: PROXY_URL
    })

    res.json({
      id: metadata.id,
      title: metadata.title,
      channelId: metadata.channel_id,
      channelName: metadata.channel,
      duration: metadata.duration,
      description: metadata.description,
      uploadDate: metadata.upload_date,
      viewCount: metadata.view_count,
      subtitles: metadata.subtitles || {},
      automaticCaptions: metadata.automatic_captions || {}
    })

  } catch (error) {
    console.error('Error fetching video info:', error)
    res.status(500).json({
      error: 'Failed to fetch video information',
      details: error.message
    })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 YouTube service running on port ${PORT}`)
})
