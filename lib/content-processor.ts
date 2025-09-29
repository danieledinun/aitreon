import OpenAI from 'openai'
import { YouTubeService } from './youtube'
import { db } from "./database"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ContentChunk {
  videoId: string
  videoTitle: string
  videoUrl: string
  content: string
  startTime?: number
  endTime?: number
  chunkIndex: number
  embedding?: number[]
}

export interface ProcessingResult {
  totalVideos: number
  processedVideos: number
  totalChunks: number
  errors: string[]
}

export class ContentProcessor {
  private static readonly CHUNK_SIZE = 500 // words per chunk
  private static readonly CHUNK_OVERLAP = 100 // words overlap between chunks

  // Process all videos for a creator and generate embeddings
  static async processCreatorContent(creatorId: string, accessToken: string): Promise<ProcessingResult> {
    console.log(`🤖 Starting comprehensive content processing for creator ${creatorId}`)
    
    const result: ProcessingResult = {
      totalVideos: 0,
      processedVideos: 0,
      totalChunks: 0,
      errors: []
    }

    try {
      // Get ALL videos from the creator's channel
      const videos = await YouTubeService.getAllUserVideos(accessToken)
      result.totalVideos = videos.length
      console.log(`📹 Processing ${videos.length} videos...`)

      // Process videos in batches to avoid rate limits
      const batchSize = 10
      for (let i = 0; i < videos.length; i += batchSize) {
        const batch = videos.slice(i, i + batchSize)
        await Promise.all(batch.map(async (video) => {
          try {
            await this.processVideo(creatorId, video)
            result.processedVideos++
            console.log(`✅ Processed: ${video.title} (${result.processedVideos}/${result.totalVideos})`)
          } catch (error) {
            console.error(`❌ Error processing video ${video.title}:`, error)
            result.errors.push(`${video.title}: ${error}`)
          }
        }))

        // Small delay between batches
        if (i + batchSize < videos.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // Count total chunks created
      const chunks = await db.contentChunk.count({
        where: { 
          video: { creatorId } 
        }
      })
      result.totalChunks = chunks

      console.log(`🎉 Content processing complete! ${result.processedVideos} videos, ${result.totalChunks} chunks`)
      return result

    } catch (error) {
      console.error('❌ Content processing failed:', error)
      result.errors.push(`Processing failed: ${error}`)
      return result
    }
  }

  // Process a single video
  private static async processVideo(creatorId: string, video: any) {
    // Check if video already exists
    const existingVideo = await db.video.findUnique({
      where: { youtubeId: video.id }
    })

    // Check if video has chunks
    let hasChunks = false
    if (existingVideo) {
      const chunks = await db.contentChunk.findMany({
        where: { videoId: existingVideo.id }
      })
      hasChunks = chunks.length > 0
    }

    if (existingVideo && hasChunks) {
      console.log(`⏭️  Video already processed: ${video.title}`)
      return
    }

    // Get transcript
    const transcript = await YouTubeService.getVideoTranscript(video.id)
    if (!transcript) {
      console.log(`⚠️  No transcript available for: ${video.title}`)
      return
    }

    const duration = YouTubeService.parseDuration(video.duration)
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`

    // Create or update video record
    let videoRecord
    if (existingVideo) {
      videoRecord = await db.video.update({
        where: { id: existingVideo.id },
        data: {
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          duration,
          published_at: new Date(video.publishedAt),
          transcript: transcript.segments.map(s => s.text).join(' '),
          is_processed: true,
        }
      })
    } else {
      videoRecord = await db.video.create({
        data: {
          creator_id: creatorId,
          youtube_id: video.id,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          duration,
          published_at: new Date(video.publishedAt),
          transcript: transcript.segments.map(s => s.text).join(' '),
          is_processed: true,
        }
      })
    }

    // Process transcript into smart chunks
    const transcriptText = transcript.segments.map(s => s.text).join(' ')
    const chunks = this.createSmartChunks(transcriptText, video.title, videoUrl)
    
    // Generate embeddings for chunks
    const chunksWithEmbeddings = await this.generateEmbeddings(chunks)

    // Save chunks to database
    for (const [index, chunk] of chunksWithEmbeddings.entries()) {
      await db.contentChunk.create({
        data: {
          videoId: videoRecord.id,
          content: chunk.content,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          chunkIndex: index,
          embedding: chunk.embedding ? JSON.stringify(chunk.embedding) : null,
          metadata: JSON.stringify({
            videoTitle: video.title,
            videoUrl: videoUrl,
            viewCount: parseInt(video.viewCount),
            publishedAt: video.publishedAt
          })
        }
      })
    }

    console.log(`✅ Created ${chunksWithEmbeddings.length} chunks for: ${video.title}`)
  }

  // Create intelligent chunks from transcript
  private static createSmartChunks(transcript: string, videoTitle: string, videoUrl: string): ContentChunk[] {
    const transcriptChunks = YouTubeService.parseTranscript(transcript)
    const chunks: ContentChunk[] = []
    let currentChunk = ''
    let currentStartTime = 0
    let currentEndTime = 0
    let chunkIndex = 0

    for (const transcriptChunk of transcriptChunks) {
      const words = transcriptChunk.text.split(' ')
      
      // If adding this chunk would exceed our size limit, finalize current chunk
      if (currentChunk.split(' ').length + words.length > this.CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push({
          videoId: '', // Will be set later
          videoTitle,
          videoUrl,
          content: currentChunk.trim(),
          startTime: currentStartTime,
          endTime: currentEndTime,
          chunkIndex: chunkIndex++
        })

        // Start new chunk with overlap
        const overlapWords = currentChunk.split(' ').slice(-this.CHUNK_OVERLAP)
        currentChunk = overlapWords.join(' ') + ' ' + transcriptChunk.text
        currentStartTime = transcriptChunk.startTime
      } else {
        if (currentChunk.length === 0) {
          currentStartTime = transcriptChunk.startTime
        }
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + transcriptChunk.text
      }
      
      currentEndTime = transcriptChunk.endTime
    }

    // Add the final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        videoId: '',
        videoTitle,
        videoUrl,
        content: currentChunk.trim(),
        startTime: currentStartTime,
        endTime: currentEndTime,
        chunkIndex: chunkIndex
      })
    }

    return chunks
  }

  // Generate embeddings for content chunks
  private static async generateEmbeddings(chunks: ContentChunk[]): Promise<ContentChunk[]> {
    const batchSize = 100 // OpenAI's batch limit
    const chunksWithEmbeddings: ContentChunk[] = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map(chunk => chunk.content),
        })

        batch.forEach((chunk, index) => {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: response.data[index].embedding
          })
        })

        console.log(`🔢 Generated embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`)
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error) {
        console.error('Error generating embeddings for batch:', error)
        // Add chunks without embeddings as fallback
        batch.forEach(chunk => chunksWithEmbeddings.push(chunk))
      }
    }

    return chunksWithEmbeddings
  }

  // Calculate cosine similarity between two vectors
  private static cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magnitudeA * magnitudeB)
  }

  // Search for relevant content chunks using vector similarity
  static async searchContent(creatorId: string, query: string, limit: number = 5): Promise<Array<{
    content: string
    videoTitle: string
    videoUrl: string
    startTime?: number
    endTime?: number
    similarity: number
  }>> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      })

      const queryVector = queryEmbedding.data[0].embedding

      // Get all content chunks for the creator
      const chunks = await db.contentChunk.findMany({
        where: {
          video: { creatorId },
          embedding: { not: null }
        },
        include: {
          video: true
        }
      })

      // Calculate similarity scores
      const results = chunks.map(chunk => {
        const chunkEmbedding = JSON.parse(chunk.embedding!)
        const similarity = this.cosineSimilarity(queryVector, chunkEmbedding)
        const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {}

        return {
          content: chunk.content,
          videoTitle: metadata.videoTitle || chunk.video.title,
          videoUrl: metadata.videoUrl || `https://www.youtube.com/watch?v=${chunk.video.youtubeId}`,
          startTime: chunk.startTime || undefined,
          endTime: chunk.endTime || undefined,
          similarity
        }
      })

      // Sort by similarity and return top results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

    } catch (error) {
      console.error('Error searching content:', error)
      return []
    }
  }

  // Get content statistics for a creator
  static async getContentStats(creatorId: string): Promise<{
    totalVideos: number
    processedVideos: number
    totalChunks: number
    totalWords: number
    averageChunksPerVideo: number
  }> {
    const totalVideos = await db.video.count({
      where: { creatorId }
    })

    const processedVideos = await db.video.count({
      where: { creatorId, isProcessed: true }
    })

    const totalChunks = await db.contentChunk.count({
      where: { video: { creatorId } }
    })

    const chunks = await db.contentChunk.findMany({
      where: { video: { creatorId } },
      select: { content: true }
    })

    const totalWords = chunks.reduce((sum, chunk) => 
      sum + chunk.content.split(' ').length, 0
    )

    return {
      totalVideos,
      processedVideos,
      totalChunks,
      totalWords,
      averageChunksPerVideo: processedVideos > 0 ? totalChunks / processedVideos : 0
    }
  }
}