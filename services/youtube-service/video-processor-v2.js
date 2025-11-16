const { createClient } = require('@supabase/supabase-js')
const youtubedl = require('youtube-dl-exec')

// Supabase client
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

const PROXY_URL = process.env.PROXY_URL || 'http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80'

class VideoProcessorV2 {
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
   * Get video metadata and transcript using youtube-dl-exec
   */
  async getVideoData(videoId) {
    try {
      console.log(`   📥 Fetching metadata + subtitles for video ${videoId}...`)

      const { execSync } = require('child_process')
      const fs = require('fs')
      const path = require('path')
      const os = require('os')

      // Create temp paths
      const tempDir = os.tmpdir()
      const tempFile = path.join(tempDir, `${videoId}.en.json3`)
      const infoJsonFile = path.join(tempDir, `${videoId}.info.json`)

      // Clean up any existing files first
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      if (fs.existsSync(infoJsonFile)) fs.unlinkSync(infoJsonFile)

      // Get metadata using --dump-json (outputs to stdout, not file)
      let metadataJson = ''
      try {
        metadataJson = execSync(
          `yt-dlp --dump-single-json --socket-timeout 30 --proxy "${PROXY_URL}" --no-check-certificates "https://www.youtube.com/watch?v=${videoId}"`,
          { encoding: 'utf-8', timeout: 300000 }
        )
      } catch (metaError) {
        console.warn(`   ⚠️  Failed to get metadata:`, metaError.message)
        // Try to get stdout even on error
        if (metaError.stdout) {
          metadataJson = metaError.stdout
        }
      }

      // Separately download ONLY subtitles
      let ytdlpOutput = ''
      try {
        // Download subtitles only - this should create the .json3 file
        ytdlpOutput = execSync(
          `cd "${tempDir}" && yt-dlp --write-auto-subs --sub-lang en --sub-format json3 --skip-download --socket-timeout 30 --proxy "${PROXY_URL}" --no-check-certificates -o "${videoId}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`,
          { encoding: 'utf-8', timeout: 300000 }
        )
        console.log(`   📋 Subtitle download output (last 300 chars):`, ytdlpOutput.slice(-300))
      } catch (execError) {
        console.warn(`   ⚠️  yt-dlp subtitle error:`, execError.message)
        const output = execError.stdout || execError.stderr || ''
        console.log(`   📋 Subtitle error output (last 400 chars):`, output.slice(-400))
      }

      // Parse metadata from JSON output
      let metadata = {
        title: 'Unknown Title',
        description: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: 0,
        uploadDate: null,
        viewCount: 0
      }

      if (metadataJson) {
        try {
          const infoData = JSON.parse(metadataJson)
          metadata = {
            title: infoData.title || 'Unknown Title',
            description: infoData.description || '',
            thumbnail: infoData.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: infoData.duration || 0,
            uploadDate: infoData.upload_date || null,
            viewCount: infoData.view_count || 0
          }
          console.log(`   ✅ Parsed metadata: ${metadata.title}`)
        } catch (parseError) {
          console.warn(`   ⚠️  Failed to parse metadata JSON:`, parseError.message)
        }
      }

      // Read and parse subtitles
      let transcript = ''
      let segments = []

      // Debug: List all files created in temp dir for this video
      const allFiles = fs.readdirSync(tempDir).filter(f => f.includes(videoId))
      console.log(`   🔍 Files created for ${videoId}:`, allFiles)

      // Try multiple subtitle file patterns
      const subtitlePatterns = [
        path.join(tempDir, `${videoId}.en.json3`),
        path.join(tempDir, `${videoId}.en-US.json3`),
        path.join(tempDir, `${videoId}.en-GB.json3`)
      ]

      let foundSubtitle = false
      for (const subtitlePath of subtitlePatterns) {
        if (fs.existsSync(subtitlePath)) {
          console.log(`   📖 Found subtitle file: ${path.basename(subtitlePath)}`)
          const subContent = fs.readFileSync(subtitlePath, 'utf-8')
          const subData = JSON.parse(subContent)

          // Clean up temp file
          fs.unlinkSync(subtitlePath)

          // Parse JSON3 format
          if (subData.events) {
            segments = subData.events
              .filter(event => event.segs)
              .map(event => {
                const text = event.segs.map(seg => seg.utf8).join('')
                return {
                  start: event.tStartMs / 1000,
                  duration: event.dDurationMs / 1000,
                  text: text.trim()
                }
              })
              .filter(seg => seg.text)

            transcript = segments.map(s => s.text).join(' ')
            console.log(`   ✅ Extracted transcript: ${segments.length} segments, ${transcript.split(/\s+/).length} words`)
            foundSubtitle = true
            break
          }
        }
      }

      if (!foundSubtitle) {
        console.warn(`   ⚠️  No subtitle file found. Tried patterns:`, subtitlePatterns.map(p => path.basename(p)))
      }

      return {
        metadata,
        transcript,
        segments
      }

    } catch (error) {
      console.error(`   ❌ Error fetching video data:`, error.message)
      throw error
    }
  }

  /**
   * Create semantic chunks from transcript segments
   */
  createSemanticChunks(segments, videoId, metadata) {
    if (!segments || segments.length === 0) {
      return []
    }

    const chunks = []
    let currentChunk = {
      content: '',
      startTime: 0,
      endTime: 0,
      segments: []
    }

    const minChunkDuration = 15  // 15-40 second chunks
    const maxChunkDuration = 40
    const minWordsPerChunk = 20

    for (const segment of segments) {
      // Start new chunk if needed
      if (currentChunk.segments.length === 0) {
        currentChunk.startTime = segment.start
      }

      currentChunk.segments.push(segment)
      currentChunk.content += (currentChunk.content ? ' ' : '') + segment.text
      currentChunk.endTime = segment.start + segment.duration

      const chunkDuration = currentChunk.endTime - currentChunk.startTime
      const wordCount = currentChunk.content.split(/\s+/).length

      // Create chunk if it meets criteria
      if (chunkDuration >= minChunkDuration && wordCount >= minWordsPerChunk) {
        chunks.push({
          content: currentChunk.content,
          start_time: currentChunk.startTime,
          end_time: currentChunk.endTime,
          video_title: metadata.title,
          video_url: `https://youtube.com/watch?v=${videoId}`
        })

        // Start new chunk
        currentChunk = {
          content: '',
          startTime: 0,
          endTime: 0,
          segments: []
        }
      }

      // Force chunk creation if too long
      if (chunkDuration >= maxChunkDuration) {
        if (currentChunk.segments.length > 0) {
          chunks.push({
            content: currentChunk.content,
            start_time: currentChunk.startTime,
            end_time: currentChunk.endTime,
            video_title: metadata.title,
            video_url: `https://youtube.com/watch?v=${videoId}`
          })
        }

        currentChunk = {
          content: '',
          startTime: 0,
          endTime: 0,
          segments: []
        }
      }
    }

    // Add final chunk if it has content
    if (currentChunk.segments.length > 0 && currentChunk.content.split(/\s+/).length >= minWordsPerChunk) {
      chunks.push({
        content: currentChunk.content,
        start_time: currentChunk.startTime,
        end_time: currentChunk.endTime,
        video_title: metadata.title,
        video_url: `https://youtube.com/watch?v=${videoId}`
      })
    }

    return chunks
  }

  /**
   * Process a single video - COMPLETELY ON RAILWAY
   */
  async processSingleVideo(creatorId, videoId, videoIndex, totalVideos) {
    console.log(`   📹 [${videoIndex + 1}/${totalVideos}] Processing video: ${videoId}`)

    try {
      // Check if video already exists
      const { data: existingVideo } = await supabase
        .from('videos')
        .select('id')
        .eq('youtube_id', videoId)
        .single()

      if (existingVideo) {
        console.log(`   ℹ️  [${videoIndex + 1}/${totalVideos}] Video ${videoId} already exists, skipping`)
        return { success: true, skipped: true }
      }

      // Get video data (metadata + transcript)
      const { metadata, transcript, segments } = await this.getVideoData(videoId)

      // Create video record
      const { data: videoRecord, error: videoError } = await supabase
        .from('videos')
        .insert({
          creator_id: creatorId,
          youtube_id: videoId,
          title: metadata.title,
          description: metadata.description,
          thumbnail: metadata.thumbnail,
          duration: metadata.duration,
          published_at: metadata.uploadDate ? new Date(metadata.uploadDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toISOString() : new Date().toISOString(),
          transcript: transcript,
          is_processed: !!transcript,
          synced_at: transcript ? new Date().toISOString() : null
        })
        .select()
        .single()

      if (videoError || !videoRecord) {
        console.error(`   ❌ [${videoIndex + 1}/${totalVideos}] Failed to create video record:`, videoError)
        return { success: false, error: videoError?.message || 'Failed to create video' }
      }

      console.log(`   ✅ [${videoIndex + 1}/${totalVideos}] Created video record`)

      // Create semantic chunks if transcript exists
      if (transcript && segments.length > 0) {
        const semanticChunks = this.createSemanticChunks(segments, videoId, metadata)
        console.log(`   📝 [${videoIndex + 1}/${totalVideos}] Generated ${semanticChunks.length} semantic chunks`)

        if (semanticChunks.length > 0) {
          const chunks = semanticChunks.map((chunk, i) => ({
            creator_id: creatorId,
            video_id: videoRecord.id,
            video_title: chunk.video_title,
            video_url: chunk.video_url,
            content: chunk.content,
            start_time: chunk.start_time,
            end_time: chunk.end_time,
            chunk_index: i,
            metadata: {
              chunk_type: 'semantic',
              word_count: chunk.content.split(/\s+/).length
            }
          }))

          // Insert in batches
          const batchSize = 50
          for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize)
            const { error: chunkError } = await supabase
              .from('content_chunks')
              .insert(batch)

            if (chunkError) {
              console.error(`   ⚠️  [${videoIndex + 1}/${totalVideos}] Failed to insert chunk batch ${i}-${i + batch.length}:`, chunkError)
            }
          }

          console.log(`   ✅ [${videoIndex + 1}/${totalVideos}] Saved ${chunks.length} chunks`)
        }
      }

      console.log(`   ✅ [${videoIndex + 1}/${totalVideos}] Video ${videoId} processed successfully`)
      return { success: true }

    } catch (error) {
      console.error(`   ❌ [${videoIndex + 1}/${totalVideos}] Error processing video ${videoId}:`, error.message)
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
      let skippedCount = 0
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

        if (result.success && result.skipped) {
          skippedCount++
        } else if (result.success) {
          processedCount++
        } else {
          failedCount++
        }

        results.push({
          videoId,
          success: result.success,
          skipped: result.skipped || false,
          error: result.error || null
        })

        // Small delay between videos
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
          skipped: skippedCount,
          details: results
        },
        metadata: { step: 'completed' }
      })

      console.log(`\n✅ Job ${job.id} completed!`)
      console.log(`   Processed: ${processedCount}/${job.video_ids.length}`)
      console.log(`   Skipped: ${skippedCount}/${job.video_ids.length}`)
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
    if (this.isProcessing) {
      return
    }

    try {
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
    console.log(`🚀 Video processor V2 started (polling every ${interval}ms)`)
    console.log(`🔧 Processing videos DIRECTLY on Railway (no Vercel dependency)`)

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
      console.log('🛑 Video processor V2 stopped')
    }
  }
}

module.exports = VideoProcessorV2
