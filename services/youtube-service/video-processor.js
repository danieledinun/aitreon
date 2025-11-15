const { createClient } = require('@supabase/supabase-js')
const { spawn } = require('child_process')
const path = require('path')

// Supabase client for job tracking
console.log('🔧 Initializing Supabase client for video processing...')
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

const VERCEL_URL = process.env.VERCEL_URL || 'https://aitreon.vercel.app'

class VideoProcessor {
  constructor() {
    this.isProcessing = false
    this.currentJobId = null
  }

  /**
   * Update job status in database
   */
  async updateJob(jobId, updates) {
    const { error } = await supabase
      .from('video_processing_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId)

    if (error) {
      console.error(`❌ Failed to update job ${jobId}:`, error)
    }
  }

  /**
   * Process a single video using the Vercel /api/youtube/sync endpoint
   */
  async processSingleVideo(creatorId, videoId, videoIndex, totalVideos) {
    console.log(`   📹 [${videoIndex + 1}/${totalVideos}] Processing video: ${videoId}`)

    try {
      const response = await fetch(`${VERCEL_URL}/api/youtube/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoIds: [videoId],  // Process ONE video at a time
          creatorId: creatorId
        }),
        signal: AbortSignal.timeout(120000) // 2 minute timeout per video
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`   ✅ [${videoIndex + 1}/${totalVideos}] Video ${videoId} processed successfully`)
        return { success: true, result }
      } else {
        const error = await response.text()
        console.error(`   ❌ [${videoIndex + 1}/${totalVideos}] Failed: ${error}`)
        return { success: false, error }
      }
    } catch (error) {
      console.error(`   ❌ [${videoIndex + 1}/${totalVideos}] Error: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * Process a video processing job
   */
  async processJob(job) {
    this.currentJobId = job.id
    this.isProcessing = true

    console.log(`\n🎬 Starting video processing job ${job.id}`)
    console.log(`📺 Creator ID: ${job.creator_id}`)
    console.log(`📹 Videos to process: ${job.video_ids.length}`)

    try {
      // Mark job as processing
      await this.updateJob(job.id, {
        status: 'processing',
        started_at: new Date().toISOString(),
        progress: 0,
        metadata: { step: 'initializing' }
      })

      let processedCount = 0
      let failedCount = 0
      const results = []

      // Process each video sequentially
      for (let i = 0; i < job.video_ids.length; i++) {
        const videoId = job.video_ids[i]

        // Update progress
        const currentProgress = Math.floor((i / job.video_ids.length) * 90) // 0-90%
        await this.updateJob(job.id, {
          progress: currentProgress,
          videos_processed: processedCount,
          videos_failed: failedCount,
          metadata: {
            step: 'processing_videos',
            current_video: videoId,
            current_index: i + 1,
            total_videos: job.video_ids.length
          }
        })

        // Process the video
        const result = await this.processSingleVideo(job.creator_id, videoId, i, job.video_ids.length)

        if (result.success) {
          processedCount++
        } else {
          failedCount++
        }

        results.push({
          videoId,
          success: result.success,
          error: result.error || null
        })

        // Small delay between videos to avoid overwhelming Vercel
        if (i < job.video_ids.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // Job completed
      const finalStatus = failedCount === job.video_ids.length ? 'failed' : 'completed'
      const finalProgress = failedCount === job.video_ids.length ? 0 : 100

      await this.updateJob(job.id, {
        status: finalStatus,
        progress: finalProgress,
        videos_processed: processedCount,
        videos_failed: failedCount,
        completed_at: new Date().toISOString(),
        result: {
          total: job.video_ids.length,
          processed: processedCount,
          failed: failedCount,
          details: results
        },
        metadata: { step: 'completed' }
      })

      console.log(`\n✅ Job ${job.id} completed!`)
      console.log(`   Processed: ${processedCount}/${job.video_ids.length}`)
      console.log(`   Failed: ${failedCount}/${job.video_ids.length}`)

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
        .from('video_processing_jobs')
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
  start(interval = 3000) {
    console.log(`🚀 Video processor started (polling every ${interval}ms)`)

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
      console.log('🛑 Video processor stopped')
    }
  }
}

module.exports = VideoProcessor
