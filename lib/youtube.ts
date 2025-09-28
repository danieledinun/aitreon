import { google } from 'googleapis'

// Rate limiter to prevent exceeding 100 grants per minute
class RateLimiter {
  private queue: Array<() => void> = []
  private processing = false
  private requestCount = 0
  private windowStart = Date.now()
  
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Reset counter every minute
          const now = Date.now()
          if (now - this.windowStart > 60000) {
            this.requestCount = 0
            this.windowStart = now
          }
          
          // If approaching limit, wait
          if (this.requestCount >= 95) {
            console.log('🛑 Rate limit approaching, waiting 60 seconds...')
            await new Promise(resolve => setTimeout(resolve, 60000))
            this.requestCount = 0
            this.windowStart = Date.now()
          }
          
          this.requestCount++
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }
  
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      await task()
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    this.processing = false
  }
}

const rateLimiter = new RateLimiter()

// Always use OAuth for authenticated requests - no mixing with API keys
function createAuthenticatedYouTube(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ access_token: accessToken })
  
  return google.youtube({
    version: 'v3',
    auth: oauth2Client,
  })
}

// For public data, still use API key but with rate limiting
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
})

export interface YouTubeChannel {
  id: string
  title: string
  description: string
  thumbnail: string
  subscriberCount: string
}

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  thumbnail: string
  publishedAt: string
  duration: string
  viewCount: string
  language?: string
  categoryId?: string
  tags?: string[]
  defaultLanguage?: string
  hasAutoCaption?: boolean
  hasManualCaption?: boolean
  captionLanguages?: string[]
  privacy?: 'public' | 'unlisted' | 'private'
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  confidence?: number
}

export interface ProcessedTranscript {
  videoId: string
  language: string
  segments: TranscriptSegment[]
  obtainedVia: 'youtube_captions' | 'whisper' | 'manual'
  confidence: number
  processingDate: string
}

export class YouTubeService {
  // Check if user has a YouTube channel using their access token
  static async getUserChannel(accessToken: string): Promise<YouTubeChannel | null> {
    try {
      const authenticatedYoutube = createAuthenticatedYouTube(accessToken)
      
      const response = await authenticatedYoutube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        mine: true,
      })

      const channel = response.data.items?.[0]
      if (!channel) return null

      return {
        id: channel.id!,
        title: channel.snippet?.title || '',
        description: channel.snippet?.description || '',
        thumbnail: channel.snippet?.thumbnails?.high?.url || '',
        subscriberCount: channel.statistics?.subscriberCount || '0',
      }
    } catch (error) {
      console.error('Error fetching user channel:', error)
      return null
    }
  }

  // Get detailed channel statistics
  static async getChannelStats(channelId: string, accessToken?: string): Promise<{
    subscriberCount: string
    viewCount: string
    videoCount: string
    customUrl?: string
    country?: string
    joinedDate?: string
  } | null> {
    try {
      const youtubeClient = accessToken ? createAuthenticatedYouTube(accessToken) : youtube
      
      const response = await youtubeClient.channels.list({
        part: ['statistics', 'snippet', 'brandingSettings'],
        id: [channelId],
      })

      const channel = response.data.items?.[0]
      if (!channel) return null

      return {
        subscriberCount: channel.statistics?.subscriberCount || '0',
        viewCount: channel.statistics?.viewCount || '0',
        videoCount: channel.statistics?.videoCount || '0',
        customUrl: channel.snippet?.customUrl,
        country: channel.snippet?.country,
        joinedDate: channel.snippet?.publishedAt,
      }
    } catch (error) {
      console.error('Error fetching channel stats:', error)
      return null
    }
  }

  // Get ALL user's videos using their access token (for comprehensive content processing)
  static async getAllUserVideos(accessToken: string): Promise<YouTubeVideo[]> {
    try {
      const authenticatedYoutube = createAuthenticatedYouTube(accessToken)
      
      // Get user's channel first with rate limiting
      const channelResponse = await rateLimiter.throttle(() => 
        authenticatedYoutube.channels.list({
          part: ['contentDetails'],
          mine: true,
        })
      )

      const channel = channelResponse.data.items?.[0]
      if (!channel?.contentDetails?.relatedPlaylists?.uploads) {
        return []
      }

      const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads
      const allVideos: YouTubeVideo[] = []
      let nextPageToken: string | undefined

      // Paginate through all videos with rate limiting and larger batches
      do {
        const playlistResponse = await rateLimiter.throttle(() =>
          authenticatedYoutube.playlistItems.list({
            part: ['contentDetails'], // Only get essential data
            playlistId: uploadsPlaylistId,
            maxResults: 50, // Maximum allowed
            pageToken: nextPageToken,
          })
        )

        const videoIds = playlistResponse.data.items?.map(item => item.contentDetails?.videoId).filter(Boolean) || []
        
        if (videoIds.length > 0) {
          // Get only essential video information to minimize quota usage
          const videosResponse = await rateLimiter.throttle(() =>
            authenticatedYoutube.videos.list({
              part: ['snippet', 'contentDetails'], // Removed 'statistics', 'localizations' to save quota
              id: videoIds,
            })
          )

          // Process videos with minimal data for discovery
          for (const video of videosResponse.data.items || []) {
            if (!video.id) continue

            const videoData: YouTubeVideo = {
              id: video.id,
              title: video.snippet?.title || '',
              description: video.snippet?.description || '',
              thumbnail: video.snippet?.thumbnails?.medium?.url || '', // Use medium instead of high to save bandwidth
              publishedAt: video.snippet?.publishedAt || '',
              duration: video.contentDetails?.duration || '',
              viewCount: '0', // Skip view count during discovery
              language: video.snippet?.defaultAudioLanguage || video.snippet?.defaultLanguage,
              categoryId: video.snippet?.categoryId,
              tags: video.snippet?.tags?.slice(0, 5) || [], // Limit tags to save space
              defaultLanguage: video.snippet?.defaultLanguage,
              hasAutoCaption: false, // Will check during processing only
              hasManualCaption: false, // Will check during processing only
              captionLanguages: [], // Will populate during processing only
              privacy: 'public' // Assume public during discovery, verify during processing
            }

            allVideos.push(videoData)
          }
        }

        nextPageToken = playlistResponse.data.nextPageToken || undefined
      } while (nextPageToken)

      console.log(`📹 Found ${allVideos.length} total videos for processing`)
      return allVideos
    } catch (error) {
      console.error('Error fetching all user videos:', error)
      return []
    }
  }

  // Get user's recent videos using their access token (for display/preview)
  static async getUserVideos(accessToken: string, maxResults: number = 10): Promise<YouTubeVideo[]> {
    try {
      const authenticatedYoutube = createAuthenticatedYouTube(accessToken)
      
      // Get user's channel first
      const channelResponse = await authenticatedYoutube.channels.list({
        part: ['contentDetails'],
        mine: true,
      })

      const channel = channelResponse.data.items?.[0]
      if (!channel?.contentDetails?.relatedPlaylists?.uploads) {
        return []
      }

      const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads

      // Get videos from uploads playlist
      const playlistResponse = await authenticatedYoutube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults,
        order: 'date',
      })

      const videoIds = playlistResponse.data.items?.map(item => item.contentDetails?.videoId).filter(Boolean) || []
      
      if (videoIds.length === 0) return []

      // Get detailed video information
      const videosResponse = await authenticatedYoutube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds,
      })

      return videosResponse.data.items?.map(video => ({
        id: video.id!,
        title: video.snippet?.title || '',
        description: video.snippet?.description || '',
        thumbnail: video.snippet?.thumbnails?.high?.url || '',
        publishedAt: video.snippet?.publishedAt || '',
        duration: video.contentDetails?.duration || '',
        viewCount: video.statistics?.viewCount || '0',
      })) || []
    } catch (error) {
      console.error('Error fetching user videos:', error)
      return []
    }
  }

  static async getChannelInfo(channelId: string): Promise<YouTubeChannel | null> {
    try {
      const response = await youtube.channels.list({
        part: ['snippet', 'statistics'],
        id: [channelId],
      })

      const channel = response.data.items?.[0]
      if (!channel) return null

      return {
        id: channel.id!,
        title: channel.snippet?.title || '',
        description: channel.snippet?.description || '',
        thumbnail: channel.snippet?.thumbnails?.high?.url || '',
        subscriberCount: channel.statistics?.subscriberCount || '0',
      }
    } catch (error) {
      console.error('Error fetching channel info:', error)
      return null
    }
  }

  static async getChannelVideos(channelId: string, maxResults: number = 50): Promise<YouTubeVideo[]> {
    try {
      const response = await youtube.search.list({
        part: ['snippet'],
        channelId,
        type: ['video'],
        order: 'date',
        maxResults,
      })

      const videoIds = response.data.items?.map(item => item.id?.videoId).filter(Boolean) || []
      
      if (videoIds.length === 0) return []

      const videosResponse = await youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds,
      })

      return videosResponse.data.items?.map(video => ({
        id: video.id!,
        title: video.snippet?.title || '',
        description: video.snippet?.description || '',
        thumbnail: video.snippet?.thumbnails?.high?.url || '',
        publishedAt: video.snippet?.publishedAt || '',
        duration: video.contentDetails?.duration || '',
        viewCount: video.statistics?.viewCount || '0',
      })) || []
    } catch (error) {
      console.error('Error fetching channel videos:', error)
      return []
    }
  }

  // Get video privacy status
  private static getVideoPrivacy(video: any): 'public' | 'unlisted' | 'private' {
    const status = video.status?.privacyStatus
    if (status === 'public') return 'public'
    if (status === 'unlisted') return 'unlisted'
    return 'private'
  }

  // Enhanced transcript fetching with language preference and multiple formats
  static async getVideoTranscript(videoId: string, preferredLanguage: string = 'en', accessToken?: string): Promise<ProcessedTranscript | null> {
    if (!accessToken) {
      console.log(`⚠️ No access token provided for transcript download: ${videoId}`)
      return null
    }

    try {
      console.log(`🔍 Fetching transcript for video ${videoId}`)
      const youtubeClient = createAuthenticatedYouTube(accessToken)
      
      // Skip video verification to save 1 quota unit per video
      // Directly try to get captions - if video doesn't exist, captions.list will fail anyway
      
      const response = await rateLimiter.throttle(() =>
        youtubeClient.captions.list({
          part: ['snippet'],
          videoId,
        })
      )

      const captions = response.data.items
      if (!captions || captions.length === 0) {
        console.log(`⚠️ No captions available for video: ${videoId}`)
        return null
      }

      // Prioritize manual captions over auto-generated, and preferred language
      const preferredCaption = this.selectBestCaption(captions, preferredLanguage)
      if (!preferredCaption?.id) {
        console.log(`⚠️ No suitable caption track found for video: ${videoId}`)
        return null
      }

      console.log(`📥 Downloading ${preferredCaption.snippet?.trackKind} captions in ${preferredCaption.snippet?.language} for video: ${videoId}`)

      // Try SRT format first, fallback to VTT if needed
      let transcriptResponse
      try {
        transcriptResponse = await rateLimiter.throttle(() =>
          youtubeClient.captions.download({
            id: preferredCaption.id,
            tfmt: 'srt',
          })
        )
      } catch (srtError) {
        console.log(`⚠️ SRT download failed, trying VTT for video: ${videoId}`)
        transcriptResponse = await rateLimiter.throttle(() =>
          youtubeClient.captions.download({
            id: preferredCaption.id,
            tfmt: 'vtt',
          })
        )
      }

      const rawTranscript = transcriptResponse.data
      
      // Debug the actual response type
      console.log(`🔍 Raw transcript type: ${typeof rawTranscript}`)
      console.log(`🔍 Raw transcript constructor: ${rawTranscript?.constructor?.name}`)
      console.log(`🔍 Is Blob: ${rawTranscript instanceof Blob}`)
      console.log(`🔍 Has text method: ${typeof rawTranscript?.text === 'function'}`)
      
      // Handle different response types from YouTube API
      let transcriptText: string
      if (rawTranscript && typeof rawTranscript.text === 'function') {
        console.log(`🔧 Converting response with .text() method for video: ${videoId}`)
        transcriptText = await rawTranscript.text()
      } else if (rawTranscript instanceof Blob) {
        console.log(`🔧 Converting Blob to text for video: ${videoId}`)
        transcriptText = await rawTranscript.text()
      } else if (typeof rawTranscript === 'string') {
        console.log(`🔧 Using string response for video: ${videoId}`)
        transcriptText = rawTranscript
      } else {
        console.log(`🔧 Converting unknown type to string for video: ${videoId}`)
        transcriptText = String(rawTranscript || '')
      }
      
      if (!transcriptText || transcriptText.trim().length === 0) {
        console.log(`⚠️ Empty transcript downloaded for video: ${videoId}`)
        return null
      }

      console.log(`🔍 Downloaded transcript for ${videoId}: ${transcriptText.length} chars`)
      console.log(`🔍 First 1000 chars of transcript:`)
      console.log(transcriptText.substring(0, 1000))
      console.log(`🔍 Last 500 chars of transcript:`)
      console.log(transcriptText.substring(Math.max(0, transcriptText.length - 500)))
      
      // Try both SRT and VTT formats since YouTube may return either
      let segments = this.parseSRTTranscript(transcriptText)
      console.log(`🔍 SRT parsing result: ${segments.length} segments`)
      
      if (segments.length === 0) {
        console.log(`🔄 SRT parsing failed, trying VTT format for video: ${videoId}`)
        segments = this.parseVTTTranscript(transcriptText)
        console.log(`🔍 VTT parsing result: ${segments.length} segments`)
      }
      if (segments.length === 0) {
        console.log(`⚠️ No transcript segments parsed for video: ${videoId}`)
        return null
      }

      console.log(`✅ Successfully parsed ${segments.length} transcript segments for video: ${videoId}`)

      return {
        videoId,
        language: preferredCaption.snippet?.language || 'unknown',
        segments,
        obtainedVia: 'youtube_captions',
        confidence: preferredCaption.snippet?.trackKind === 'standard' ? 0.95 : 0.85,
        processingDate: new Date().toISOString()
      }
    } catch (error: any) {
      console.error(`❌ Error fetching video transcript for ${videoId}:`, error?.message || error)
      
      // Log more specific error information
      if (error?.response?.data) {
        console.error(`   API Error Details:`, error.response.data)
      }
      if (error?.response?.status) {
        console.error(`   HTTP Status:`, error.response.status)
      }
      
      return null
    }
  }

  // Select the best available caption track
  private static selectBestCaption(captions: any[], preferredLanguage: string) {
    // Priority: manual captions > auto captions
    // Language: preferred > English > any other
    
    const manualCaptions = captions.filter(c => c.snippet?.trackKind === 'standard')
    const autoCaptions = captions.filter(c => c.snippet?.trackKind === 'ASR')

    // Try manual captions first
    let bestCaption = manualCaptions.find(c => c.snippet?.language === preferredLanguage) ||
                     manualCaptions.find(c => c.snippet?.language?.startsWith('en')) ||
                     manualCaptions[0]

    // Fall back to auto captions if no manual captions
    if (!bestCaption) {
      bestCaption = autoCaptions.find(c => c.snippet?.language === preferredLanguage) ||
                   autoCaptions.find(c => c.snippet?.language?.startsWith('en')) ||
                   autoCaptions[0]
    }

    return bestCaption
  }

  // Parse SRT format transcript into segments with timestamps
  private static parseSRTTranscript(srtContent: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = []
    const blocks = srtContent.split('\n\n').filter(block => block.trim())

    for (const block of blocks) {
      const lines = block.split('\n').map(line => line.trim())
      if (lines.length < 3) continue

      // Match both comma and dot decimal separators
      const timeMatch = lines[1].match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3}) --> (\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/)
      if (!timeMatch) continue

      const startTime = this.parseTimeToSeconds(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4])
      const endTime = this.parseTimeToSeconds(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8])

      const text = lines.slice(2)
        .join(' ')
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()

      if (text) {
        segments.push({
          start: startTime,
          end: endTime,
          text,
          confidence: 1.0
        })
      }
    }

    return segments
  }

  // Parse VTT format transcript into segments with timestamps
  private static parseVTTTranscript(vttContent: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = []
    const lines = vttContent.split('\n').map(line => line.trim())

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // VTT time format: 00:00:00.000 --> 00:00:03.000
      const timeMatch = line.match(/(\d{1,2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{1,2}):(\d{2}):(\d{2})\.(\d{3})/)
      if (!timeMatch) continue

      const startTime = this.parseTimeToSeconds(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4])
      const endTime = this.parseTimeToSeconds(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8])

      // Get text from next lines until empty line or another timestamp
      const textLines = []
      i++
      while (i < lines.length && lines[i] && !lines[i].includes('-->')) {
        textLines.push(lines[i])
        i++
      }
      i-- // Step back one since the for loop will increment

      const text = textLines
        .join(' ')
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()

      if (text) {
        segments.push({
          start: startTime,
          end: endTime,
          text,
          confidence: 1.0
        })
      }
    }

    return segments
  }

  // Convert time components to seconds
  private static parseTimeToSeconds(hours: string, minutes: string, seconds: string, milliseconds: string): number {
    return parseInt(hours) * 3600 + 
           parseInt(minutes) * 60 + 
           parseInt(seconds) + 
           parseInt(milliseconds) / 1000
  }

  static parseDuration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
    if (!match) return 0

    const hours = parseInt(match[1]?.replace('H', '') || '0')
    const minutes = parseInt(match[2]?.replace('M', '') || '0')
    const seconds = parseInt(match[3]?.replace('S', '') || '0')

    return hours * 3600 + minutes * 60 + seconds
  }

  static parseTranscript(transcript: string): Array<{ startTime: number; endTime: number; text: string }> {
    const chunks = []
    const lines = transcript.split('\n')
    
    let i = 0
    while (i < lines.length) {
      const indexLine = lines[i]
      const timeLine = lines[i + 1]
      const textLines = []
      
      i += 2
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^\d+$/)) {
        textLines.push(lines[i])
        i++
      }
      
      if (timeLine && textLines.length > 0) {
        const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/)
        if (timeMatch) {
          const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000
          const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000
          
          chunks.push({
            startTime,
            endTime,
            text: textLines.join(' ').replace(/<[^>]*>/g, '').trim()
          })
        }
      }
      
      i++
    }
    
    return chunks
  }
}