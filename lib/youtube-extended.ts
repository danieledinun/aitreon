import { YouTubeService, YouTubeVideo, TranscriptSegment, ProcessedTranscript } from './youtube'

export interface ExtendedYouTubeVideo extends YouTubeVideo {
  transcriptAvailable?: boolean
  transcriptLanguages?: string[]
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
}

export interface TranscriptExtractionResult {
  success: boolean
  video_id?: string
  language?: string
  is_generated?: boolean
  segments_count?: number
  segments?: TranscriptSegment[]
  obtained_via?: string
  confidence?: number
  processing_date?: string
  error?: string
  message?: string
}

export interface BatchTranscriptResult {
  [videoId: string]: TranscriptExtractionResult
}

export class ExtendedYouTubeService extends YouTubeService {
  
  /**
   * Extract channel ID from various YouTube channel URL formats
   */
  static extractChannelIdFromUrl(channelUrl: string): string | null {
    try {
      const url = new URL(channelUrl)
      const hostname = url.hostname.toLowerCase()
      
      // Only handle YouTube URLs
      if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
        return null
      }
      
      const pathname = url.pathname
      
      // Format: /channel/UCxxxxxxxxx
      const channelMatch = pathname.match(/\/channel\/([a-zA-Z0-9_-]+)/)
      if (channelMatch) {
        return channelMatch[1]
      }
      
      // Format: /c/username or /@username
      const customMatch = pathname.match(/\/(?:c|@)\/([a-zA-Z0-9_-]+)/)
      if (customMatch) {
        // For custom URLs, we need to resolve them to channel IDs
        // This will be handled by the discovery method
        return `@${customMatch[1]}`
      }
      
      // Format: /user/username
      const userMatch = pathname.match(/\/user\/([a-zA-Z0-9_-]+)/)
      if (userMatch) {
        return `user:${userMatch[1]}`
      }
      
      return null
    } catch (error) {
      console.error('Error parsing channel URL:', error)
      return null
    }
  }

  /**
   * Discover videos from any YouTube channel URL
   */
  static async discoverChannelVideos(
    channelUrl: string,
    maxVideos: number = 25
  ): Promise<{
    success: boolean
    channelTitle?: string
    channelId?: string
    videoIds: string[]
    videoTitles: { [key: string]: string }
    error?: string
  }> {
    try {
      console.log(`🔍 Discovering videos for channel: ${channelUrl}`)
      
      const channelIdentifier = this.extractChannelIdFromUrl(channelUrl)
      if (!channelIdentifier) {
        return {
          success: false,
          videoIds: [],
          videoTitles: {},
          error: 'Invalid YouTube channel URL format'
        }
      }

      let channelId: string
      let channelInfo: any

      // Handle different channel identifier formats
      if (channelIdentifier.startsWith('@') || channelIdentifier.startsWith('user:')) {
        // For custom URLs and usernames, we need to resolve to channel ID first
        console.log(`🔍 Resolving custom channel identifier: ${channelIdentifier}`)
        
        try {
          // Use search to find the channel
          const searchQuery = channelIdentifier.startsWith('@') 
            ? channelIdentifier.substring(1)
            : channelIdentifier.substring(5) // Remove 'user:' prefix
            
          channelInfo = await this.searchChannelByName(searchQuery)
          if (!channelInfo) {
            return {
              success: false,
              videoIds: [],
              videoTitles: {},
              error: 'Channel not found or private'
            }
          }
          channelId = channelInfo.id
        } catch (error) {
          console.error('Error resolving custom channel URL:', error)
          return {
            success: false,
            videoIds: [],
            videoTitles: {},
            error: 'Failed to resolve channel URL'
          }
        }
      } else {
        // Direct channel ID
        channelId = channelIdentifier
        channelInfo = await this.getChannelInfo(channelId)
        if (!channelInfo) {
          return {
            success: false,
            videoIds: [],
            videoTitles: {},
            error: 'Channel not found or private'
          }
        }
      }

      console.log(`✅ Found channel: ${channelInfo.title} (${channelId})`)

      // Get videos from the channel
      const videos = await this.getChannelVideos(channelId, maxVideos)
      
      const videoIds = videos.map(v => v.id)
      const videoTitles: { [key: string]: string } = {}
      
      videos.forEach(video => {
        videoTitles[video.id] = video.title
      })

      console.log(`✅ Discovered ${videoIds.length} videos from channel: ${channelInfo.title}`)

      return {
        success: true,
        channelTitle: channelInfo.title,
        channelId: channelId,
        videoIds,
        videoTitles
      }

    } catch (error) {
      console.error('Error discovering channel videos:', error)
      return {
        success: false,
        videoIds: [],
        videoTitles: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Search for channel by name/username
   */
  private static async searchChannelByName(channelName: string): Promise<{ id: string; title: string } | null> {
    try {
      console.log(`🔍 Searching for channel: ${channelName}`)
      
      // Use YouTube search API to find channel by name
      const { google } = await import('googleapis')
      const youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY,
      })
      
      const response = await youtube.search.list({
        part: ['snippet'],
        q: channelName,
        type: ['channel'],
        maxResults: 1
      })
      
      const channel = response.data.items?.[0]
      if (!channel?.id?.channelId) {
        console.log(`⚠️ No channel found for: ${channelName}`)
        return null
      }
      
      console.log(`✅ Found channel: ${channel.snippet?.title} (${channel.id.channelId})`)
      
      return {
        id: channel.id.channelId,
        title: channel.snippet?.title || channelName
      }
      
    } catch (error) {
      console.error('Error searching for channel:', error)
      return null
    }
  }

  /**
   * Get video IDs using YouTube API (quota efficient)
   * Then extract transcripts using youtube-transcript-api (no quota)
   */
  static async getVideosWithTranscripts(
    accessToken: string,
    options: {
      maxResults?: number
      languages?: string[]
      includeTranscripts?: boolean
    } = {}
  ): Promise<ExtendedYouTubeVideo[]> {
    const { maxResults = 50, languages = ['en'], includeTranscripts = true } = options

    try {
      // Step 1: Get video IDs using existing YouTube API service
      console.log('🎥 Fetching video IDs from YouTube API...')
      const videos = await this.getAllUserVideos(accessToken)
      
      if (videos.length === 0) {
        console.log('📭 No videos found for user')
        return []
      }

      console.log(`🎥 Found ${videos.length} videos, limiting to ${maxResults}`)
      const limitedVideos = videos.slice(0, maxResults)
      
      // Convert to extended format
      const extendedVideos: ExtendedYouTubeVideo[] = limitedVideos.map(video => ({
        ...video,
        transcriptAvailable: false,
        transcriptLanguages: [],
        processingStatus: 'pending'
      }))

      if (!includeTranscripts) {
        return extendedVideos
      }

      // Step 2: Check transcript availability using our API
      console.log('🎯 Checking transcript availability...')
      await this.checkTranscriptAvailability(extendedVideos)
      
      return extendedVideos

    } catch (error) {
      console.error('❌ Error in getVideosWithTranscripts:', error)
      throw error
    }
  }

  /**
   * Check transcript availability for multiple videos
   */
  private static async checkTranscriptAvailability(videos: ExtendedYouTubeVideo[]): Promise<void> {
    const batchSize = 10 // Process in batches to avoid overwhelming the service
    
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize)
      console.log(`🔍 Checking transcript availability for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(videos.length/batchSize)}`)
      
      await Promise.allSettled(
        batch.map(async (video) => {
          try {
            const availabilityInfo = await this.getTranscriptInfo(video.id)
            if (availabilityInfo.success && availabilityInfo.count > 0) {
              video.transcriptAvailable = true
              video.transcriptLanguages = availabilityInfo.transcripts?.map(t => t.language_code) || []
            }
          } catch (error) {
            console.warn(`⚠️ Failed to check transcript for video ${video.id}:`, error)
          }
        })
      )
      
      // Small delay between batches to be respectful
      if (i + batchSize < videos.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }

  /**
   * Get transcript information for a single video
   */
  static async getTranscriptInfo(videoId: string): Promise<{
    success: boolean
    video_id: string
    transcripts?: Array<{
      language: string
      language_code: string
      is_generated: boolean
      is_translatable: boolean
    }>
    count: number
    error?: string
  }> {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/youtube/transcripts?videoId=${videoId}&action=info`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`❌ Error getting transcript info for ${videoId}:`, error)
      return {
        success: false,
        video_id: videoId,
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Extract transcript for a single video
   */
  static async extractTranscript(
    videoId: string, 
    languages: string[] = ['en']
  ): Promise<TranscriptExtractionResult> {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/youtube/transcripts?videoId=${videoId}&languages=${languages.join(',')}`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`❌ Error extracting transcript for ${videoId}:`, error)
      return {
        success: false,
        error: 'api_request_failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Extract transcripts for multiple videos
   */
  static async extractMultipleTranscripts(
    videoIds: string[], 
    languages: string[] = ['en']
  ): Promise<BatchTranscriptResult> {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/youtube/transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoIds,
          languages
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`❌ Error extracting multiple transcripts:`, error)
      throw error
    }
  }

  /**
   * Process user's channel for transcript extraction
   * This combines video discovery with transcript extraction efficiently
   */
  static async processChannelTranscripts(
    accessToken: string,
    options: {
      maxVideos?: number
      languages?: string[]
      onProgress?: (processed: number, total: number, currentVideo?: string) => void
      onVideoProcessed?: (videoId: string, result: TranscriptExtractionResult) => void
    } = {}
  ): Promise<{
    totalVideos: number
    processedVideos: number
    successfulExtractions: number
    results: BatchTranscriptResult
  }> {
    const { 
      maxVideos = 100, 
      languages = ['en'], 
      onProgress,
      onVideoProcessed 
    } = options

    try {
      console.log('🚀 Starting channel transcript processing...')
      
      // Step 1: Get all video IDs (using YouTube API efficiently)
      console.log('📋 Fetching video list...')
      const videos = await this.getVideosWithTranscripts(accessToken, {
        maxResults: maxVideos,
        languages,
        includeTranscripts: false // Don't check availability yet to speed up initial fetch
      })

      if (videos.length === 0) {
        return {
          totalVideos: 0,
          processedVideos: 0,
          successfulExtractions: 0,
          results: {}
        }
      }

      console.log(`🎯 Processing ${videos.length} videos for transcripts`)
      
      // Step 2: Extract transcripts in batches (using transcript API - no YouTube quota)
      const videoIds = videos.map(v => v.id)
      const batchSize = 20 // Process in reasonable batches
      const allResults: BatchTranscriptResult = {}
      let processed = 0
      let successful = 0

      for (let i = 0; i < videoIds.length; i += batchSize) {
        const batch = videoIds.slice(i, i + batchSize)
        console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(videoIds.length/batchSize)}`)
        
        try {
          const batchResults = await this.extractMultipleTranscripts(batch, languages)
          
          // Process results
          for (const [videoId, result] of Object.entries(batchResults)) {
            allResults[videoId] = result
            processed++
            
            if (result.success) {
              successful++
            }
            
            // Call callbacks
            onVideoProcessed?.(videoId, result)
            onProgress?.(processed, videoIds.length, videoId)
          }
        } catch (error) {
          console.error(`❌ Error processing batch:`, error)
          
          // Mark batch as failed
          for (const videoId of batch) {
            allResults[videoId] = {
              success: false,
              error: 'batch_processing_failed',
              message: error instanceof Error ? error.message : 'Batch processing failed'
            }
            processed++
            onVideoProcessed?.(videoId, allResults[videoId])
            onProgress?.(processed, videoIds.length, videoId)
          }
        }
        
        // Small delay between batches
        if (i + batchSize < videoIds.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      console.log(`✅ Channel processing completed: ${successful}/${processed} successful extractions`)

      return {
        totalVideos: videos.length,
        processedVideos: processed,
        successfulExtractions: successful,
        results: allResults
      }

    } catch (error) {
      console.error('❌ Error in processChannelTranscripts:', error)
      throw error
    }
  }

  /**
   * Get video metadata (title, description, etc.)
   */
  static async getVideoMetadata(videoId: string): Promise<{
    id: string
    title: string
    description: string
    thumbnail: string
    publishedAt: string
    duration: string
    viewCount: string
  } | null> {
    try {
      const { google } = await import('googleapis')
      const youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY,
      })

      const response = await youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: [videoId],
      })

      const video = response.data.items?.[0]
      if (!video) {
        console.warn(`Video ${videoId} not found`)
        return null
      }

      return {
        id: video.id!,
        title: video.snippet?.title || '',
        description: video.snippet?.description || '',
        thumbnail: video.snippet?.thumbnails?.high?.url || '',
        publishedAt: video.snippet?.publishedAt || '',
        duration: video.contentDetails?.duration || '',
        viewCount: video.statistics?.viewCount || '0',
      }
    } catch (error) {
      console.error(`Error fetching metadata for video ${videoId}:`, error)
      return null
    }
  }

  /**
   * Convert transcript segments to searchable text chunks
   */
  static createSearchableChunks(
    segments: TranscriptSegment[], 
    chunkDuration: number = 30, // seconds
    overlapDuration: number = 5 // seconds
  ): Array<{
    start: number
    end: number
    text: string
    segmentCount: number
  }> {
    const chunks = []
    let currentStart = 0
    
    while (currentStart < segments[segments.length - 1]?.end) {
      const chunkEnd = currentStart + chunkDuration
      
      // Find segments that overlap with this chunk
      const chunkSegments = segments.filter(segment => 
        (segment.start >= currentStart && segment.start < chunkEnd) ||
        (segment.end > currentStart && segment.end <= chunkEnd) ||
        (segment.start < currentStart && segment.end > chunkEnd)
      )
      
      if (chunkSegments.length > 0) {
        const text = chunkSegments.map(s => s.text).join(' ')
        const actualStart = Math.max(currentStart, chunkSegments[0].start)
        const actualEnd = Math.min(chunkEnd, chunkSegments[chunkSegments.length - 1].end)
        
        chunks.push({
          start: actualStart,
          end: actualEnd,
          text,
          segmentCount: chunkSegments.length
        })
      }
      
      currentStart += chunkDuration - overlapDuration
    }
    
    return chunks
  }
}