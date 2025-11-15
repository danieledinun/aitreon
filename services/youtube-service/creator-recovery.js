const { createClient } = require('@supabase/supabase-js')

// Supabase client
console.log('🔧 Initializing Supabase client for creator recovery...')
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

class CreatorRecovery {
  constructor() {
    this.isChecking = false
  }

  /**
   * Find creators who have profiles but no videos and no pending/processing jobs
   * These are "broken" accounts that need recovery
   */
  async findBrokenCreators() {
    try {
      // Get all creators
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('id, username, display_name, youtube_channel_id, created_at')
        .not('youtube_channel_id', 'is', null) // Must have YouTube channel
        .order('created_at', { ascending: false })

      if (creatorsError) {
        console.error('❌ Error fetching creators:', creatorsError)
        return []
      }

      if (!creators || creators.length === 0) {
        return []
      }

      const brokenCreators = []

      for (const creator of creators) {
        // Check if creator has videos
        const { count: videoCount, error: videoError } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', creator.id)

        if (videoError) {
          console.error(`❌ Error checking videos for ${creator.username}:`, videoError)
          continue
        }

        // If creator has videos, they're fine
        if (videoCount > 0) {
          continue
        }

        // Check if there's already a pending/processing job
        const { data: existingJobs, error: jobError } = await supabase
          .from('video_processing_jobs')
          .select('id, status')
          .eq('creator_id', creator.id)
          .in('status', ['pending', 'processing'])

        if (jobError) {
          console.error(`❌ Error checking jobs for ${creator.username}:`, jobError)
          continue
        }

        // If there's already a pending/processing job, don't create another
        if (existingJobs && existingJobs.length > 0) {
          console.log(`ℹ️  Creator ${creator.username} has pending job, skipping`)
          continue
        }

        // This creator is broken - has profile but no videos and no pending job
        brokenCreators.push(creator)
      }

      return brokenCreators

    } catch (error) {
      console.error('❌ Error in findBrokenCreators:', error)
      return []
    }
  }

  /**
   * Get recent videos for a YouTube channel
   */
  async getChannelVideos(channelId, limit = 10) {
    try {
      const youtubedl = require('youtube-dl-exec')
      const PROXY_URL = process.env.PROXY_URL || 'http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80'

      console.log(`   📺 Fetching ${limit} videos for channel: ${channelId}`)

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

      const videos = (playlistData.entries || []).slice(0, limit).map(video => video.id).filter(Boolean)

      return videos

    } catch (error) {
      console.error(`   ❌ Error fetching videos for channel ${channelId}:`, error.message)
      return []
    }
  }

  /**
   * Create a video processing job for a broken creator
   */
  async createRecoveryJob(creator, videoIds) {
    try {
      console.log(`   🎬 Creating recovery job for ${creator.username} with ${videoIds.length} videos`)

      const { data: job, error } = await supabase
        .from('video_processing_jobs')
        .insert({
          creator_id: creator.id,
          video_ids: videoIds,
          status: 'pending',
          progress: 0,
          videos_processed: 0,
          videos_failed: 0,
          metadata: {
            recovery: true,
            reason: 'auto_recovery_for_missing_videos'
          }
        })
        .select()
        .single()

      if (error) {
        console.error(`   ❌ Failed to create recovery job:`, error)
        return null
      }

      console.log(`   ✅ Created recovery job ${job.id}`)
      return job

    } catch (error) {
      console.error(`   ❌ Error creating recovery job:`, error)
      return null
    }
  }

  /**
   * Recover a single broken creator
   */
  async recoverCreator(creator) {
    console.log(`\n🔧 Attempting to recover creator: ${creator.username} (${creator.id})`)

    // Fetch recent videos from their YouTube channel
    const videoIds = await this.getChannelVideos(creator.youtube_channel_id, 10)

    if (videoIds.length === 0) {
      console.log(`   ⚠️  No videos found for ${creator.username}, skipping recovery`)
      return false
    }

    console.log(`   📹 Found ${videoIds.length} videos to process`)

    // Create recovery job
    const job = await this.createRecoveryJob(creator, videoIds)

    if (job) {
      console.log(`   ✅ Recovery job created for ${creator.username}`)
      return true
    } else {
      console.log(`   ❌ Failed to create recovery job for ${creator.username}`)
      return false
    }
  }

  /**
   * Check for broken creators and create recovery jobs
   */
  async checkAndRecover() {
    if (this.isChecking) {
      console.log('⏭️  Recovery check already in progress, skipping')
      return
    }

    this.isChecking = true

    try {
      console.log('\n🔍 Checking for broken creator accounts...')

      const brokenCreators = await this.findBrokenCreators()

      if (brokenCreators.length === 0) {
        console.log('✅ All creators have videos or pending jobs - no recovery needed')
        return
      }

      console.log(`\n⚠️  Found ${brokenCreators.length} broken creator(s) that need recovery:`)
      brokenCreators.forEach(c => {
        console.log(`   - ${c.username} (created: ${new Date(c.created_at).toLocaleString()})`)
      })

      // Recover each broken creator
      let recovered = 0
      for (const creator of brokenCreators) {
        const success = await this.recoverCreator(creator)
        if (success) recovered++

        // Small delay between recoveries
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      console.log(`\n✅ Recovery complete: ${recovered}/${brokenCreators.length} creators recovered\n`)

    } catch (error) {
      console.error('❌ Error in checkAndRecover:', error)
    } finally {
      this.isChecking = false
    }
  }

  /**
   * Start periodic recovery checks
   */
  start(interval = 300000) { // Default: 5 minutes
    console.log(`🚀 Creator recovery service started (checking every ${interval/1000}s)`)

    // Run immediately
    this.checkAndRecover()

    // Then run periodically
    this.checkInterval = setInterval(() => {
      this.checkAndRecover()
    }, interval)
  }

  /**
   * Stop recovery checks
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      console.log('🛑 Creator recovery service stopped')
    }
  }
}

module.exports = CreatorRecovery
