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

// Test yt-dlp installation
app.get('/test-ytdlp', async (req, res) => {
  try {
    console.log('Testing yt-dlp installation...')
    const { execSync } = require('child_process')

    // Check if yt-dlp binary exists
    try {
      const version = execSync('yt-dlp --version', { encoding: 'utf-8' })
      console.log(`yt-dlp version: ${version}`)

      // Try a simple fetch without proxy
      console.log('Testing simple fetch without proxy...')
      try {
        const testResult = execSync(
          'yt-dlp --dump-json --skip-download --playlist-items 1 "https://www.youtube.com/watch?v=dQw4w9WgXcQ"',
          { encoding: 'utf-8', timeout: 10000 }
        )
        const testData = JSON.parse(testResult)
        console.log(`Test fetch successful: ${testData.title}`)

        res.json({
          status: 'ok',
          ytdlp: 'installed',
          version: version.trim(),
          proxy: PROXY_URL ? 'configured' : 'not configured',
          testFetch: 'success',
          testTitle: testData.title
        })
      } catch (fetchError) {
        console.error('Test fetch failed:', fetchError.message)
        res.json({
          status: 'ok',
          ytdlp: 'installed',
          version: version.trim(),
          proxy: PROXY_URL ? 'configured' : 'not configured',
          testFetch: 'failed',
          testError: fetchError.message
        })
      }
    } catch (e) {
      console.error('yt-dlp not found in PATH:', e.message)
      res.json({
        status: 'error',
        ytdlp: 'not found',
        error: e.message,
        proxy: PROXY_URL ? 'configured' : 'not configured'
      })
    }
  } catch (error) {
    console.error('Test error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get channel info from @username
// This endpoint now returns BOTH channel info AND videos to reduce total API calls
app.post('/api/channel/info', async (req, res) => {
  try {
    const { url, includeVideos = true, limit = 10 } = req.body

    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }

    console.log(`📺 Fetching channel info for: ${url}`)
    console.log(`🔒 Using proxy: ${PROXY_URL ? 'YES' : 'NO'}`)
    console.log(`⏱️  Starting yt-dlp request...`)

    // Set a timeout for the yt-dlp request
    const timeout = 45000 // 45 seconds
    const videoInfoPromise = youtubedl(url, {
      dumpSingleJson: true,
      skipDownload: true,
      playlistItems: '1',
      noCheckCertificates: true,
      proxy: PROXY_URL,
      socketTimeout: 30
    }).then(result => {
      console.log(`✅ yt-dlp completed successfully`)
      return result
    }).catch(err => {
      console.error(`❌ yt-dlp error:`, err.message)
      console.error(`📋 Error details:`, err.stderr || err.stdout || 'No details')
      throw err
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout after 45s')), timeout)
    )

    const videoInfo = await Promise.race([videoInfoPromise, timeoutPromise])

    const channelId = videoInfo.channel_id || videoInfo.uploader_id
    const channelName = videoInfo.channel || videoInfo.uploader

    // Use fallback thumbnail (skip extra request for speed)
    const channelThumbnail = channelId ? `https://yt3.ggpht.com/ytc/${channelId}` : ''

    console.log(`✅ Found channel: ${channelName} (${channelId})`)

    // If includeVideos is true, also fetch videos in the same request
    if (includeVideos && channelId) {
      console.log(`📹 Also fetching ${limit} videos for channel...`)
      try {
        const playlistData = await youtubedl(`https://www.youtube.com/channel/${channelId}/videos`, {
          dumpSingleJson: true,
          skipDownload: true,
          playlistEnd: limit,
          noWarnings: true,
          proxy: PROXY_URL,
          ignoreErrors: true,
          noCheckCertificates: true,
          format: 'worst'
        })

        const videos = (playlistData.entries || []).slice(0, limit).map((video) => {
          let thumbnail = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
          if (video.thumbnails && video.thumbnails.length > 0) {
            const bestThumb = video.thumbnails[video.thumbnails.length - 1]
            thumbnail = bestThumb.url || thumbnail
          }

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

          let publishedAt = ''
          const dateStr = video.upload_date || video.uploadDate || video.release_date || video.release_timestamp || video.timestamp
          if (dateStr) {
            if (typeof dateStr === 'string' && dateStr.length === 8) {
              const year = dateStr.substring(0, 4)
              const month = dateStr.substring(4, 6)
              const day = dateStr.substring(6, 8)
              publishedAt = `${year}-${month}-${day}`
            } else if (typeof dateStr === 'number') {
              const date = new Date(dateStr * 1000)
              publishedAt = date.toISOString().split('T')[0]
            } else if (typeof dateStr === 'string') {
              try {
                const date = new Date(dateStr)
                if (!isNaN(date.getTime())) {
                  publishedAt = date.toISOString().split('T')[0]
                }
              } catch (e) {
                // Ignore
              }
            }
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

        // Get better channel thumbnail from playlist data if available
        let betterThumbnail = channelThumbnail
        if (playlistData.thumbnails && playlistData.thumbnails.length > 0) {
          betterThumbnail = playlistData.thumbnails[playlistData.thumbnails.length - 1].url
        } else if (playlistData.thumbnail) {
          betterThumbnail = playlistData.thumbnail
        } else if (channelId) {
          betterThumbnail = `https://yt3.googleusercontent.com/ytc/${channelId}=s800-c-k-c0x00ffffff-no-rj`
        }

        console.log(`✅ Found ${videos.length} videos`)

        return res.json({
          channelId,
          channelName,
          channelThumbnail: betterThumbnail,
          subscriberCount: playlistData.channel_follower_count || null,
          totalVideos: playlistData.playlist_count || videos.length,
          videos
        })
      } catch (videoError) {
        console.error('Error fetching videos:', videoError)
        // Return channel info without videos
        return res.json({
          channelId,
          channelName,
          channelThumbnail,
          subscriberCount: null,
          totalVideos: 0,
          videos: []
        })
      }
    }

    // If includeVideos is false, just return channel info
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

    // Fetch from the channel's videos tab to get actual videos with metadata
    // Don't use flatPlaylist to get upload dates, but use playlistEnd to limit fetching
    const playlistData = await youtubedl(`https://www.youtube.com/channel/${channelId}/videos`, {
      dumpSingleJson: true,
      skipDownload: true,
      playlistEnd: limit,
      noWarnings: true,
      proxy: PROXY_URL,
      ignoreErrors: true,  // Continue even if some videos fail
      noCheckCertificates: true,
      // Only get minimal info needed (no formats)
      skipDownload: true,
      format: 'worst'  // Don't try to select best format, just get metadata
    })

    const channelName = playlistData.channel || playlistData.uploader

    // Get channel thumbnail - try multiple sources
    let channelThumbnail = ''

    // First try to get from the playlist/channel metadata
    if (playlistData.thumbnails && playlistData.thumbnails.length > 0) {
      const bestThumb = playlistData.thumbnails[playlistData.thumbnails.length - 1]
      channelThumbnail = bestThumb.url
    } else if (playlistData.thumbnail) {
      channelThumbnail = playlistData.thumbnail
    }

    // If no thumbnail found, use the standard YouTube channel avatar URL pattern
    // This is more reliable than trying to fetch it separately
    if (!channelThumbnail && channelId) {
      // YouTube channel avatars are served from these endpoints:
      // - https://yt3.googleusercontent.com/ytc/[channel_id]
      // - https://yt3.ggpht.com/ytc/[channel_id]
      // The second format is more commonly available
      channelThumbnail = `https://yt3.googleusercontent.com/ytc/${channelId}=s800-c-k-c0x00ffffff-no-rj`
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

      // Format date - flatPlaylist doesn't provide upload dates, so we'll leave empty for now
      // The frontend can optionally fetch individual video dates if needed
      let publishedAt = ''
      const dateStr = video.upload_date || video.uploadDate || video.release_date || video.release_timestamp || video.timestamp

      if (dateStr) {
        if (typeof dateStr === 'string' && dateStr.length === 8) {
          // Format: YYYYMMDD
          const year = dateStr.substring(0, 4)
          const month = dateStr.substring(4, 6)
          const day = dateStr.substring(6, 8)
          publishedAt = `${year}-${month}-${day}`
        } else if (typeof dateStr === 'number') {
          // Unix timestamp
          const date = new Date(dateStr * 1000)
          publishedAt = date.toISOString().split('T')[0]
        } else if (typeof dateStr === 'string') {
          // Try parsing as ISO string
          try {
            const date = new Date(dateStr)
            if (!isNaN(date.getTime())) {
              publishedAt = date.toISOString().split('T')[0]
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
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
