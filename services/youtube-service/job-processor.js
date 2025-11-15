const { createClient } = require('@supabase/supabase-js')
const youtubedl = require('youtube-dl-exec')

// Supabase client for job tracking
console.log('🔧 Initializing Supabase client...')
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`)
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : '❌ Missing'}`)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const PROXY_URL = process.env.PROXY_URL || 'http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80'

class JobProcessor {
  constructor() {
    this.isProcessing = false
    this.currentJobId = null
  }

  /**
   * Update job status in database
   */
  async updateJob(jobId, updates) {
    const { error } = await supabase
      .from('youtube_analysis_jobs')
      .update(updates)
      .eq('id', jobId)

    if (error) {
      console.error(`❌ Failed to update job ${jobId}:`, error)
    }
  }

  /**
   * Process a single YouTube analysis job
   */
  async processJob(job) {
    this.currentJobId = job.id
    this.isProcessing = true

    console.log(`\n🎬 Starting job ${job.id}`)
    console.log(`📺 Channel URL: ${job.channel_url}`)

    try {
      // Step 1: Get channel ID (10% progress)
      await this.updateJob(job.id, {
        status: 'processing',
        progress: 10,
        metadata: { step: 'resolving_channel_id' }
      })

      console.log(`🔍 Step 1: Resolving channel ID...`)
      const channelInfo = await this.getChannelInfo(job.channel_url)

      if (!channelInfo) {
        throw new Error('Could not resolve channel ID from URL')
      }

      const { channelId, channelName, channelThumbnail } = channelInfo
      console.log(`✅ Found channel: ${channelName} (${channelId})`)

      // Update job with channel ID (20% progress)
      await this.updateJob(job.id, {
        channel_id: channelId,
        progress: 20,
        metadata: { step: 'fetching_videos', channelName }
      })

      // Step 2: Fetch 10 videos with full metadata (20% → 100%)
      console.log(`📹 Step 2: Fetching 10 videos...`)
      const videosData = await this.getChannelVideos(channelId, 10, (progress) => {
        // Update progress from 20% to 90% as videos are fetched
        const currentProgress = 20 + Math.floor(progress * 0.7)
        this.updateJob(job.id, {
          progress: currentProgress,
          metadata: { step: 'fetching_videos', videosProgress: progress }
        })
      })

      console.log(`✅ Fetched ${videosData.videos.length} videos`)

      // Step 3: Finalize job (100%)
      await this.updateJob(job.id, {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        result: {
          channelId,
          channelName: videosData.channelName || channelName,
          channelThumbnail: videosData.channelThumbnail || channelThumbnail,
          subscriberCount: videosData.subscriberCount,
          totalVideos: videosData.totalVideos,
          videos: videosData.videos
        },
        metadata: { step: 'completed' }
      })

      console.log(`✅ Job ${job.id} completed successfully`)

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error)

      await this.updateJob(job.id, {
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        metadata: { error: error.stack }
      })
    } finally {
      this.isProcessing = false
      this.currentJobId = null
    }
  }

  /**
   * Get channel info from @username or video URL
   */
  async getChannelInfo(url) {
    try {
      const timeout = 45000 // 45 seconds
      const videoInfoPromise = youtubedl(url, {
        dumpSingleJson: true,
        skipDownload: true,
        playlistItems: '1',
        noCheckCertificates: true,
        proxy: PROXY_URL,
        socketTimeout: 30
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Channel info request timeout after 45s')), timeout)
      )

      const videoInfo = await Promise.race([videoInfoPromise, timeoutPromise])

      const channelId = videoInfo.channel_id || videoInfo.uploader_id
      const channelName = videoInfo.channel || videoInfo.uploader
      const channelThumbnail = channelId ? `https://yt3.ggpht.com/ytc/${channelId}` : ''

      return { channelId, channelName, channelThumbnail }
    } catch (error) {
      console.error('Error getting channel info:', error)
      return null
    }
  }

  /**
   * Get channel videos with progress callback
   */
  async getChannelVideos(channelId, limit = 10, onProgress = null) {
    try {
      console.log(`📹 Fetching ${limit} videos for channel: ${channelId}`)

      // Fetch videos with optimized settings
      const playlistData = await youtubedl(`https://www.youtube.com/channel/${channelId}/videos`, {
        dumpSingleJson: true,
        skipDownload: true,
        playlistEnd: limit,
        noWarnings: true,
        proxy: PROXY_URL,
        ignoreErrors: true,
        noCheckCertificates: true,
        format: 'worst' // Don't fetch full format info
      })

      const channelName = playlistData.channel || playlistData.uploader

      // Get channel thumbnail
      let channelThumbnail = ''
      if (playlistData.thumbnails && playlistData.thumbnails.length > 0) {
        channelThumbnail = playlistData.thumbnails[playlistData.thumbnails.length - 1].url
      } else if (playlistData.thumbnail) {
        channelThumbnail = playlistData.thumbnail
      } else if (channelId) {
        channelThumbnail = `https://yt3.googleusercontent.com/ytc/${channelId}=s800-c-k-c0x00ffffff-no-rj`
      }

      // Parse video entries
      const videos = (playlistData.entries || []).slice(0, limit).map((video, index) => {
        // Report progress for each video processed
        if (onProgress) {
          onProgress(Math.floor(((index + 1) / limit) * 100))
        }

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

      return {
        channelName,
        channelThumbnail,
        totalVideos: playlistData.playlist_count || videos.length,
        subscriberCount: playlistData.channel_follower_count || null,
        videos
      }

    } catch (error) {
      console.error('Error fetching channel videos:', error)
      throw error
    }
  }

  /**
   * Poll for pending jobs and process them
   */
  async pollJobs() {
    // Don't poll if already processing
    if (this.isProcessing) {
      return
    }

    try {
      // Get oldest pending job
      const { data: jobs, error } = await supabase
        .from('youtube_analysis_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)

      if (error) {
        console.error('❌ Error fetching jobs:', error)
        return
      }

      if (jobs && jobs.length > 0) {
        await this.processJob(jobs[0])
      }

    } catch (error) {
      console.error('❌ Error in pollJobs:', error)
    }
  }

  /**
   * Start continuous job polling
   */
  start(interval = 5000) {
    console.log(`🚀 Job processor started (polling every ${interval}ms)`)

    // Poll immediately
    this.pollJobs()

    // Then poll at regular intervals
    this.pollInterval = setInterval(() => {
      this.pollJobs()
    }, interval)
  }

  /**
   * Stop job polling
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
      console.log('🛑 Job processor stopped')
    }
  }
}

module.exports = JobProcessor
