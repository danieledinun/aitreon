import OpenAI from 'openai'
import { YouTubeService, ProcessedTranscript, TranscriptSegment } from './youtube'
import { db } from "./database"

// Helper function to log processing updates
async function logProcessingUpdate(userId: string, message: string) {
  console.log(`📝 Attempting to log update for user ${userId}: ${message}`)
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/processing-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message })
    })
    
    if (response.ok) {
      console.log(`✅ Successfully logged: ${message}`)
    } else {
      console.log(`❌ Failed to log (${response.status}): ${message}`)
      const errorText = await response.text()
      console.log(`   Error response: ${errorText}`)
    }
  } catch (error) {
    console.log(`❌ Failed to log processing update: ${message}`, error)
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface VideoSummary {
  videoId: string
  title: string
  overallSummary: string
  topicSegments: TopicSegment[]
  keywords: string[]
  language: string
  duration: number
}

export interface TopicSegment {
  startTime: number
  endTime: number
  topic: string
  summary: string
  keywords: string[]
}

export interface RetrievalChunk {
  id: string
  videoId: string
  videoTitle: string
  startTime: number
  endTime: number
  text: string
  chunkIndex: number
  level: 'retrieval' | 'section' | 'video' // Hierarchical levels
  parentChunkId?: string
  embedding?: number[]
  keywords: string[]
  topics: string[]
  confidence: number
}

export interface HybridSearchResult {
  chunk: RetrievalChunk
  vectorScore: number
  bm25Score: number
  combinedScore: number
  videoUrl: string
  timestampUrl: string
}

export class KnowledgeBaseService {
  private static readonly RETRIEVAL_CHUNK_SIZE = 800 // tokens
  private static readonly SECTION_CHUNK_SIZE = 3000 // tokens (5-10 min)
  private static readonly CHUNK_OVERLAP = 0.15 // 15% overlap

  // Main processing pipeline for a creator's channel  
  static async processCreatorKnowledgeBase(creatorId: string, accessToken: string, maxVideos: number = 20, userId?: string): Promise<{
    totalVideos: number
    processedVideos: number
    totalChunks: number
    errors: string[]
    quotaLimited: boolean
  }> {
    console.log(`🧠 Starting knowledge base processing for creator ${creatorId}`)
    if (userId) await logProcessingUpdate(userId, '🧠 Starting knowledge base processing...')
    
    const result = {
      totalVideos: 0,
      processedVideos: 0,
      totalChunks: 0,
      errors: [],
      quotaLimited: false
    }

    try {
      if (userId) await logProcessingUpdate(userId, '📹 Discovering videos from YouTube...')
      // Get all videos with comprehensive metadata
      const allVideos = await YouTubeService.getAllUserVideos(accessToken)
      
      // Apply smart filtering and limits to conserve quota
      console.log(`🔍 Starting video filtering process...`)
      let filteredCount = 0
      let skippedReasons: Record<string, number> = {}
      
      const eligibleVideos = allVideos
        .filter(video => {
          const shouldSkip = this.shouldSkipVideo(video)
          if (shouldSkip) {
            filteredCount++
            const duration = YouTubeService.parseDuration(video.duration)
            const title = video.title?.toLowerCase() || ''
            
            // Track skip reasons for debugging
            if (duration < 10) {
              skippedReasons['too_short'] = (skippedReasons['too_short'] || 0) + 1
            } else if (duration > 7200) {
              skippedReasons['too_long'] = (skippedReasons['too_long'] || 0) + 1
            } else if (['instrumental', 'karaoke', 'lyrics only', 'no vocals', 'beat only'].some(k => title.includes(k))) {
              skippedReasons['instrumental'] = (skippedReasons['instrumental'] || 0) + 1
            } else if (title.includes('#shorts') && duration < 60 && ['music', 'beat', 'sound', 'noise', 'asmr'].some(k => title.includes(k))) {
              skippedReasons['non_conversational_shorts'] = (skippedReasons['non_conversational_shorts'] || 0) + 1
            }
            
            console.log(`❌ Skipping video "${video.title}" (${duration}s): ${this.getSkipReason(video)}`)
            return false
          } else {
            console.log(`✅ Video eligible: "${video.title}" (${YouTubeService.parseDuration(video.duration)}s)`)
            return true
          }
        })
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) // Most recent first
        .slice(0, maxVideos) // Limit processing
      
      result.totalVideos = allVideos.length
      console.log(`📹 Filtering summary:`)
      console.log(`   • Total videos: ${allVideos.length}`)
      console.log(`   • Filtered out: ${filteredCount}`)
      console.log(`   • Skip reasons:`, skippedReasons)
      console.log(`   • Eligible videos: ${allVideos.length - filteredCount}`)
      console.log(`   • Actually processing: ${eligibleVideos.length} (limited by maxVideos=${maxVideos})`)
      
      if (userId) await logProcessingUpdate(userId, `📹 Found ${allVideos.length} total videos, ${allVideos.length - filteredCount} eligible, processing ${eligibleVideos.length}`)
      
      const videos = eligibleVideos

      // Process videos one at a time with very conservative rate limiting
      const batchSize = 1 // Process one video at a time
      for (let i = 0; i < videos.length; i += batchSize) {
        const batch = videos.slice(i, i + batchSize)
        
        // Process sequentially with extensive delays to respect rate limits
        for (const video of batch) {
          try {
            console.log(`🔄 Processing video ${result.processedVideos + 1}/${videos.length}: ${video.title} (ID: ${video.id})`)
            if (userId) await logProcessingUpdate(userId, `🔄 Processing video ${result.processedVideos + 1}/${videos.length}: ${video.title}`)
            
            await this.processVideoForKnowledgeBase(creatorId, video, accessToken, userId)
            result.processedVideos++
            
            console.log(`✅ Processed KB for: ${video.title} (${result.processedVideos}/${videos.length})`)
            if (userId) await logProcessingUpdate(userId, `✅ Processed video: ${video.title} (${result.processedVideos}/${videos.length})`)
          } catch (error: any) {
            console.error(`❌ Error processing video ${video.title}:`, error)
            result.errors.push(`${video.title}: ${error}`)
            
            if (userId) await logProcessingUpdate(userId, `❌ Error processing ${video.title}: ${error?.message || error}`)
            
            // If rate limit or quota exceeded, stop processing
            if (error?.message?.includes('quota') || error?.message?.includes('rate')) {
              console.log('🛑 Quota exceeded, stopping processing to preserve remaining quota')
              if (userId) await logProcessingUpdate(userId, '🛑 Quota exceeded, stopping processing')
              result.quotaLimited = true
              break
            }
          }
          
          // Much longer delay between each video (2 seconds minimum)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Even longer delay between batches
        if (i + batchSize < videos.length) {
          console.log('⏳ Waiting 30 seconds before next video...')
          await new Promise(resolve => setTimeout(resolve, 30000))
        }
      }

      // Count total chunks created
      result.totalChunks = await db.contentChunk.count({
        where: { video: { creatorId } }
      })

      // Analyze speech patterns if we processed any videos successfully
      if (result.processedVideos > 0) {
        try {
          console.log(`🎯 Analyzing speech patterns from processed videos...`)
          if (userId) await logProcessingUpdate(userId, '🎯 Analyzing speech patterns from video transcripts...')
          
          const { SpeechPatternAnalyzer } = await import('./speech-pattern-analyzer')
          const analysisResult = await SpeechPatternAnalyzer.analyzeCreatorSpeechPatterns(creatorId)
          
          if (analysisResult) {
            // Auto-update AI configuration with extracted patterns
            await SpeechPatternAnalyzer.updateAIConfigWithSpeechPatterns(creatorId, analysisResult.patterns)
            
            console.log(`✅ Speech pattern analysis complete:`)
            console.log(`   • Catchphrases found: ${analysisResult.patterns.catchphrases.length}`)
            console.log(`   • Opening patterns: ${analysisResult.patterns.openingPatterns.length}`)
            console.log(`   • Closing patterns: ${analysisResult.patterns.closingPatterns.length}`)
            console.log(`   • Confidence: ${analysisResult.confidence}%`)
            
            if (userId) {
              await logProcessingUpdate(userId, `✅ Speech patterns analyzed: ${analysisResult.patterns.catchphrases.length} catchphrases, ${analysisResult.patterns.openingPatterns.length} opening patterns`)
            }
          } else {
            console.log(`⚠️ Speech pattern analysis skipped - no suitable transcripts found`)
            if (userId) await logProcessingUpdate(userId, '⚠️ Speech pattern analysis skipped - no transcripts available')
          }
        } catch (error) {
          console.error('❌ Speech pattern analysis failed:', error)
          if (userId) await logProcessingUpdate(userId, `❌ Speech pattern analysis failed: ${error}`)
          // Don't fail the entire process if speech analysis fails
        }
      }

      // traditional RAG sync has been removed - content is available for vector search

      console.log(`🎉 Knowledge base processing complete! ${result.processedVideos} videos, ${result.totalChunks} chunks`)
      return result

    } catch (error) {
      console.error('❌ Knowledge base processing failed:', error)
      result.errors.push(`Processing failed: ${error}`)
      return result
    }
  }

  // Process individual video with hierarchical chunking
  private static async processVideoForKnowledgeBase(creatorId: string, video: any, accessToken: string, userId?: string) {
    // Check if video is already processed (more aggressive caching)
    const existingVideo = await db.video.findUnique({
      where: { youtubeId: video.id },
      include: { chunks: true }
    })

    if (existingVideo && existingVideo.isProcessed) {
      console.log(`⏭️ Video already in knowledge base: ${video.title}`)
      return
    }

    // Video already pre-filtered, so no need to skip here

    // Get high-quality transcript with timestamps
    const transcript = await YouTubeService.getVideoTranscript(video.id, 'en', accessToken)
    if (!transcript || transcript.segments.length === 0) {
      console.log(`⚠️ No usable transcript for: ${video.title}`)
      return
    }

    const duration = YouTubeService.parseDuration(video.duration)
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`

    // Create or update video record
    const videoRecord = await db.video.upsert({
      where: { youtubeId: video.id },
      update: {
        title: video.title,
        description: video.description,
        thumbnail: video.thumbnail,
        duration,
        publishedAt: new Date(video.publishedAt),
        transcript: JSON.stringify(transcript),
        isProcessed: false, // Will be set to true after chunking
      },
      create: {
        creatorId,
        youtubeId: video.id,
        title: video.title,
        description: video.description,
        thumbnail: video.thumbnail,
        duration,
        publishedAt: new Date(video.publishedAt),
        transcript: JSON.stringify(transcript),
        isProcessed: false,
      }
    })

    // Generate video-level summary and topic segmentation
    const videoSummary = await this.generateVideoSummary(video, transcript)
    
    // Create hierarchical chunks
    const hierarchicalChunks = await this.createHierarchicalChunks(videoRecord.id, video, transcript, videoSummary)
    
    // Generate embeddings for all chunks
    const chunksWithEmbeddings = await this.generateChunkEmbeddings(hierarchicalChunks)

    // Save chunks to database
    for (const chunk of chunksWithEmbeddings) {
      await db.contentChunk.create({
        data: {
          videoId: videoRecord.id,
          content: chunk.text,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          chunkIndex: chunk.chunkIndex,
          embedding: chunk.embedding ? JSON.stringify(chunk.embedding) : null,
          metadata: JSON.stringify({
            videoTitle: video.title,
            videoUrl: `${videoUrl}&t=${Math.floor(chunk.startTime)}s`,
            level: chunk.level,
            keywords: chunk.keywords,
            topics: chunk.topics,
            confidence: chunk.confidence,
            parentChunkId: chunk.parentChunkId,
            language: transcript.language,
            obtainedVia: transcript.obtainedVia
          })
        }
      })
    }

    // Mark video as processed
    await db.video.update({
      where: { id: videoRecord.id },
      data: { isProcessed: true }
    })

    console.log(`✅ Created ${chunksWithEmbeddings.length} hierarchical chunks for: ${video.title}`)
  }

  // Generate comprehensive video summary with topic segmentation
  private static async generateVideoSummary(video: any, transcript: ProcessedTranscript): Promise<VideoSummary> {
    const fullText = transcript.segments.map(s => s.text).join(' ')
    
    const prompt = `Analyze this YouTube video transcript and provide a structured summary:

Title: ${video.title}
Duration: ${YouTubeService.parseDuration(video.duration)} seconds
Transcript: ${fullText.substring(0, 8000)}...

Provide:
1. A concise overall summary (2-3 sentences)
2. 3-5 main topic segments with timestamps
3. 5-10 key keywords/phrases
4. Primary language

Format as JSON:
{
  "overallSummary": "...",
  "topicSegments": [
    {"startTime": 0, "endTime": 120, "topic": "Introduction", "summary": "...", "keywords": ["..."]}
  ],
  "keywords": ["keyword1", "keyword2"],
  "language": "en"
}`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('No summary generated')

      const parsed = JSON.parse(content)
      
      return {
        videoId: video.id,
        title: video.title,
        overallSummary: parsed.overallSummary,
        topicSegments: parsed.topicSegments || [],
        keywords: parsed.keywords || [],
        language: parsed.language || 'en',
        duration: YouTubeService.parseDuration(video.duration)
      }
    } catch (error) {
      console.error('Error generating video summary:', error)
      return {
        videoId: video.id,
        title: video.title,
        overallSummary: `Discussion about ${video.title}`,
        topicSegments: [],
        keywords: [],
        language: 'en',
        duration: YouTubeService.parseDuration(video.duration)
      }
    }
  }

  // Create hierarchical chunks (video -> section -> retrieval)
  private static async createHierarchicalChunks(
    videoRecordId: string,
    video: any,
    transcript: ProcessedTranscript,
    summary: VideoSummary
  ): Promise<RetrievalChunk[]> {
    const chunks: RetrievalChunk[] = []
    const fullText = transcript.segments.map(s => s.text).join(' ')
    
    // Level 0: Video-level chunk (entire video summary)
    const videoChunk: RetrievalChunk = {
      id: `${video.id}_video_0`,
      videoId: video.id,
      videoTitle: video.title,
      startTime: 0,
      endTime: transcript.segments[transcript.segments.length - 1]?.end || 0,
      text: `${video.title}. ${summary.overallSummary}. Main topics: ${summary.topicSegments.map(t => t.topic).join(', ')}.`,
      chunkIndex: 0,
      level: 'video',
      keywords: summary.keywords,
      topics: summary.topicSegments.map(t => t.topic),
      confidence: 0.9
    }
    chunks.push(videoChunk)

    // Level 1: Section-level chunks (5-10 min segments)
    const sectionChunks = this.createSectionChunks(video, transcript, summary)
    chunks.push(...sectionChunks)

    // Level 2: Retrieval-level chunks (1-3 min segments for precise retrieval)
    const retrievalChunks = this.createRetrievalChunks(video, transcript)
    chunks.push(...retrievalChunks)

    return chunks
  }

  // Create section-level chunks (5-10 minutes each)
  private static createSectionChunks(video: any, transcript: ProcessedTranscript, summary: VideoSummary): RetrievalChunk[] {
    const chunks: RetrievalChunk[] = []
    const sectionDuration = 600 // 10 minutes
    const overlapDuration = sectionDuration * this.CHUNK_OVERLAP
    
    let chunkIndex = 0
    let currentStart = 0
    
    while (currentStart < transcript.segments[transcript.segments.length - 1]?.end || 0) {
      const currentEnd = Math.min(currentStart + sectionDuration, transcript.segments[transcript.segments.length - 1]?.end || 0)
      
      const sectionSegments = transcript.segments.filter(s => 
        s.start >= currentStart && s.end <= currentEnd
      )
      
      if (sectionSegments.length === 0) break
      
      const sectionText = sectionSegments.map(s => s.text).join(' ')
      const relatedTopicSegment = summary.topicSegments.find(t => 
        t.startTime <= currentStart && t.endTime >= currentEnd
      )
      
      chunks.push({
        id: `${video.id}_section_${chunkIndex}`,
        videoId: video.id,
        videoTitle: video.title,
        startTime: currentStart,
        endTime: currentEnd,
        text: sectionText,
        chunkIndex,
        level: 'section',
        parentChunkId: `${video.id}_video_0`,
        keywords: relatedTopicSegment?.keywords || [],
        topics: relatedTopicSegment ? [relatedTopicSegment.topic] : [],
        confidence: 0.85
      })
      
      currentStart += sectionDuration - overlapDuration
      chunkIndex++
    }
    
    return chunks
  }

  // Create retrieval-level chunks (1-3 minutes for precise search)
  private static createRetrievalChunks(video: any, transcript: ProcessedTranscript): RetrievalChunk[] {
    const chunks: RetrievalChunk[] = []
    const retrievalDuration = 180 // 3 minutes
    const overlapDuration = retrievalDuration * this.CHUNK_OVERLAP
    
    let chunkIndex = 0
    let currentStart = 0
    
    while (currentStart < transcript.segments[transcript.segments.length - 1]?.end || 0) {
      const currentEnd = Math.min(currentStart + retrievalDuration, transcript.segments[transcript.segments.length - 1]?.end || 0)
      
      const chunkSegments = transcript.segments.filter(s => 
        s.start >= currentStart && s.end <= currentEnd
      )
      
      if (chunkSegments.length === 0) break
      
      const chunkText = chunkSegments.map(s => s.text).join(' ')
      const keywords = this.extractKeywordsSync(chunkText)
      
      chunks.push({
        id: `${video.id}_retrieval_${chunkIndex}`,
        videoId: video.id,
        videoTitle: video.title,
        startTime: currentStart,
        endTime: currentEnd,
        text: chunkText,
        chunkIndex,
        level: 'retrieval',
        keywords,
        topics: [],
        confidence: 0.8
      })
      
      currentStart += retrievalDuration - overlapDuration
      chunkIndex++
    }
    
    return chunks
  }

  // Extract keywords from text using simple NLP
  private static extractKeywordsSync(text: string): string[] {
    // Simple keyword extraction - could be enhanced with more sophisticated NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
    
    const wordFreq = words.reduce((freq: Record<string, number>, word) => {
      freq[word] = (freq[word] || 0) + 1
      return freq
    }, {})
    
    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  // Generate embeddings for chunks
  private static async generateChunkEmbeddings(chunks: RetrievalChunk[]): Promise<RetrievalChunk[]> {
    const batchSize = 50
    const chunksWithEmbeddings: RetrievalChunk[] = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-large', // Using large model for better quality
          input: batch.map(chunk => `${chunk.videoTitle}: ${chunk.text}`),
        })

        batch.forEach((chunk, index) => {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: response.data[index].embedding
          })
        })

        console.log(`🔢 Generated embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`)
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error) {
        console.error('Error generating embeddings for batch:', error)
        // Add chunks without embeddings as fallback
        batch.forEach(chunk => chunksWithEmbeddings.push(chunk))
      }
    }

    return chunksWithEmbeddings
  }

  // Hybrid search combining vector similarity and keyword matching
  static async hybridSearch(
    creatorId: string,
    query: string,
    limit: number = 10,
    includeVideoSummaries: boolean = true
  ): Promise<HybridSearchResult[]> {
    try {
      console.log(`🔍 Performing hybrid search for: "${query}"`)
      
      // Generate query embedding
      const queryEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: query,
      })

      const queryVector = queryEmbedding.data[0].embedding

      // Get all chunks for the creator
      const chunks = await db.contentChunk.findMany({
        where: {
          video: { creatorId },
          embedding: { not: null }
        },
        include: { video: true },
        orderBy: { createdAt: 'desc' }
      })

      if (chunks.length === 0) {
        console.log('No chunks found for hybrid search')
        return []
      }

      // Calculate vector similarity and BM25 scores
      const searchResults: HybridSearchResult[] = []
      
      for (const chunk of chunks) {
        try {
          const chunkEmbedding = JSON.parse(chunk.embedding!)
          const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {}
          
          // Vector similarity (cosine)
          const vectorScore = this.cosineSimilarity(queryVector, chunkEmbedding)
          
          // BM25-style keyword scoring
          const bm25Score = this.calculateBM25Score(query, chunk.content, chunks.map(c => c.content))
          
          // Combined score (weighted)
          const combinedScore = (vectorScore * 0.7) + (bm25Score * 0.3)
          
          // Skip very low relevance results
          if (combinedScore < 0.1) continue
          
          const retrievalChunk: RetrievalChunk = {
            id: chunk.id,
            videoId: chunk.video.youtubeId,
            videoTitle: metadata.videoTitle || chunk.video.title,
            startTime: chunk.startTime || 0,
            endTime: chunk.endTime || 0,
            text: chunk.content,
            chunkIndex: chunk.chunkIndex,
            level: metadata.level || 'retrieval',
            parentChunkId: metadata.parentChunkId,
            keywords: metadata.keywords || [],
            topics: metadata.topics || [],
            confidence: metadata.confidence || 0.8
          }
          
          searchResults.push({
            chunk: retrievalChunk,
            vectorScore,
            bm25Score,
            combinedScore,
            videoUrl: `https://www.youtube.com/watch?v=${chunk.video.youtubeId}`,
            timestampUrl: `https://www.youtube.com/watch?v=${chunk.video.youtubeId}&t=${Math.floor(chunk.startTime || 0)}s`
          })
          
        } catch (parseError) {
          console.warn('Error processing chunk for search:', parseError)
          continue
        }
      }

      // Sort by combined score and return top results
      const topResults = searchResults
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, limit)

      console.log(`✅ Found ${topResults.length} relevant results`)
      return topResults

    } catch (error) {
      console.error('Error performing hybrid search:', error)
      return []
    }
  }

  // Calculate cosine similarity between vectors
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0
    return dotProduct / (magnitudeA * magnitudeB)
  }

  // Simple BM25-style scoring
  private static calculateBM25Score(query: string, document: string, allDocuments: string[]): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
    const docTerms = document.toLowerCase().split(/\s+/)
    const docLength = docTerms.length
    const avgDocLength = allDocuments.reduce((sum, doc) => sum + doc.split(/\s+/).length, 0) / allDocuments.length
    
    const k1 = 1.5
    const b = 0.75
    
    let score = 0
    
    for (const term of queryTerms) {
      const tf = docTerms.filter(t => t.includes(term)).length
      if (tf === 0) continue
      
      const df = allDocuments.filter(doc => doc.toLowerCase().includes(term)).length
      const idf = Math.log((allDocuments.length - df + 0.5) / (df + 0.5))
      
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)))
    }
    
    return Math.max(0, score / 10) // Normalize to 0-1 range
  }

  // Get knowledge base statistics
  static async getKnowledgeBaseStats(creatorId: string): Promise<{
    totalVideos: number
    processedVideos: number
    totalChunks: number
    chunksByLevel: Record<string, number>
    totalWords: number
    averageConfidence: number
    languageDistribution: Record<string, number>
  }> {
    const stats = await db.$transaction(async (tx) => {
      const totalVideos = await tx.video.count({ where: { creatorId } })
      const processedVideos = await tx.video.count({ where: { creatorId, isProcessed: true } })
      const totalChunks = await tx.contentChunk.count({ where: { video: { creatorId } } })
      
      const chunks = await tx.contentChunk.findMany({
        where: { video: { creatorId } },
        select: { content: true, metadata: true }
      })
      
      const totalWords = chunks.reduce((sum, chunk) => sum + chunk.content.split(/\s+/).length, 0)
      
      const chunksByLevel: Record<string, number> = {}
      const languageDistribution: Record<string, number> = {}
      let totalConfidence = 0
      let confidenceCount = 0
      
      chunks.forEach(chunk => {
        try {
          const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {}
          const level = metadata.level || 'unknown'
          const language = metadata.language || 'unknown'
          const confidence = metadata.confidence || 0
          
          chunksByLevel[level] = (chunksByLevel[level] || 0) + 1
          languageDistribution[language] = (languageDistribution[language] || 0) + 1
          
          if (confidence > 0) {
            totalConfidence += confidence
            confidenceCount++
          }
        } catch (e) {
          // Skip malformed metadata
        }
      })
      
      return {
        totalVideos,
        processedVideos,
        totalChunks,
        chunksByLevel,
        totalWords,
        averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        languageDistribution
      }
    })
    
    return stats
  }

  // Smart video filtering to avoid wasting quota on videos without captions
  private static shouldSkipVideo(video: any): boolean {
    const title = video.title?.toLowerCase() || ''
    const duration = YouTubeService.parseDuration(video.duration)
    
    // Skip extremely short videos (likely no meaningful content)
    if (duration < 10) {
      return true
    }
    
    // Skip very long videos (likely streams, less likely to have quality captions)
    if (duration > 7200) { // 2+ hours
      return true
    }
    
    // Skip videos that are clearly music/instrumental only (much more specific)
    const instrumentalKeywords = ['instrumental', 'karaoke', 'lyrics only', 'no vocals', 'beat only']
    const hasInstrumental = instrumentalKeywords.some(keyword => title.includes(keyword))
    if (hasInstrumental) {
      return true
    }
    
    // Only skip #shorts if they're very short AND clearly non-conversational
    const isShort = title.includes('#shorts') && duration < 60
    const nonConversationalShorts = ['music', 'beat', 'sound', 'noise', 'asmr']
    const hasNonConversational = nonConversationalShorts.some(keyword => title.includes(keyword))
    if (isShort && hasNonConversational) {
      return true
    }
    
    return false
  }

  // Get human-readable reason why a video was skipped (for debugging)
  private static getSkipReason(video: any): string {
    const title = video.title?.toLowerCase() || ''
    const duration = YouTubeService.parseDuration(video.duration)
    
    if (duration < 10) {
      return 'too short (<10s)'
    }
    
    if (duration > 7200) {
      return 'too long (>2h)'
    }
    
    const instrumentalKeywords = ['instrumental', 'karaoke', 'lyrics only', 'no vocals', 'beat only']
    const hasInstrumental = instrumentalKeywords.some(keyword => title.includes(keyword))
    if (hasInstrumental) {
      return 'instrumental/music only'
    }
    
    const isShort = title.includes('#shorts') && duration < 60
    const nonConversationalShorts = ['music', 'beat', 'sound', 'noise', 'asmr']
    const hasNonConversational = nonConversationalShorts.some(keyword => title.includes(keyword))
    if (isShort && hasNonConversational) {
      return 'non-conversational short'
    }
    
    return 'unknown reason'
  }
}