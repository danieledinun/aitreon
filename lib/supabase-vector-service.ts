/**
 * Supabase Vector Search Service
 * Handles semantic search for video content using pgvector
 * Designed to work with any creator and eventually replace SQLite
 */

import { supabase as supabaseInstance } from './supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { DeepInfraEmbeddingService } from './deepinfra-embedding-service'

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// Embedding provider configuration
type EmbeddingProvider = 'openai' | 'deepinfra'
const EMBEDDING_PROVIDER: EmbeddingProvider = (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'deepinfra' // Default to DeepInfra for cost efficiency

// Supabase client - use centralized instance
function getSupabaseClient(): SupabaseClient {
  return supabaseInstance
}

// Types for the vector database schema
export interface VectorContentChunk {
  id: string
  creator_id: string
  video_id: string
  video_title: string
  video_url: string
  content: string
  start_time?: number
  end_time?: number
  chunk_index: number
  embedding: number[] // pgvector embedding
  metadata: {
    youtube_id: string
    published_at?: string
    duration?: number
    transcript_quality?: string
    keywords?: string[]
  }
  created_at: string
  updated_at: string
}

export interface VectorSearchResult {
  id: string
  video_id: string
  youtube_id: string
  video_title: string
  video_url: string
  content: string
  start_time?: number
  end_time?: number
  similarity_score: number
  metadata: Record<string, any>
}

export interface HybridSearchQuery {
  query: string
  creator_id: string
  limit?: number
  similarity_threshold?: number
  bm25_weight?: number
  vector_weight?: number
  include_metadata?: boolean
}

export interface HybridSearchResponse {
  vector_results: VectorSearchResult[]
  total_results: number
  search_stats: {
    vector_matches: number
    bm25_matches: number
    hybrid_matches: number
    average_similarity: number
    search_time_ms: number
    search_method: 'vector_only' | 'bm25_only' | 'hybrid'
  }
}

export class SupabaseVectorService {
  
  /**
   * Initialize the vector database tables (run once during setup)
   */
  static async initializeDatabase(): Promise<boolean> {
    try {
      const supabase = getSupabaseClient()
      
      console.log('🔧 Initializing Supabase vector database...')
      
      // Create the content_chunks table with vector support
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS content_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          creator_id TEXT NOT NULL,
          video_id TEXT NOT NULL,
          video_title TEXT NOT NULL,
          video_url TEXT NOT NULL,
          content TEXT NOT NULL,
          start_time FLOAT,
          end_time FLOAT,
          chunk_index INTEGER DEFAULT 0,
          embedding vector(1536), -- OpenAI ada-002 embedding dimension
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_content_chunks_creator_id ON content_chunks(creator_id);
        CREATE INDEX IF NOT EXISTS idx_content_chunks_video_id ON content_chunks(video_id);
        
        -- Vector similarity index (using cosine distance)
        CREATE INDEX IF NOT EXISTS idx_content_chunks_embedding ON content_chunks
        USING hnsw (embedding vector_cosine_ops);

        -- Full-text search index for BM25
        CREATE INDEX IF NOT EXISTS idx_content_chunks_fts ON content_chunks
        USING gin(to_tsvector('english', content));
        
        -- Enable RLS (Row Level Security)
        ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;
        
        -- RLS policy: users can only access chunks from creators they have access to
        CREATE POLICY IF NOT EXISTS "content_chunks_policy" ON content_chunks
        FOR SELECT USING (true); -- For now, allow read access - implement auth later
      `
      
      // Execute the SQL using the raw query
      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL })
      
      if (error) {
        console.error('❌ Error initializing vector database:', error)
        return false
      }
      
      console.log('✅ Supabase vector database initialized successfully')
      return true
      
    } catch (error) {
      console.error('❌ Error initializing vector database:', error)
      return false
    }
  }

  /**
   * Generate embedding for text content using configured provider
   * Supports both OpenAI and Baseten models
   */
  static async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      console.log(`🔄 Generating embedding with ${EMBEDDING_PROVIDER}...`)

      if (EMBEDDING_PROVIDER === 'deepinfra') {
        // Use DeepInfra embedding service (cost-effective)
        return await DeepInfraEmbeddingService.generateEmbedding(text)
      } else {
        // Use OpenAI embedding service
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: text.replace(/\n/g, ' ').trim(),
          dimensions: 1536 // Use 1536 dimensions for compatibility with existing Supabase schema
        })

        return response.data[0].embedding
      }
    } catch (error) {
      console.error(`❌ Error generating embedding with ${EMBEDDING_PROVIDER}:`, error)

      // Fallback chain: DeepInfra -> OpenAI -> Baseten
      if (EMBEDDING_PROVIDER === 'deepinfra' && process.env.OPENAI_API_KEY) {
        console.log('🔄 Falling back to OpenAI...')
        try {
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: text.replace(/\n/g, ' ').trim(),
            dimensions: 1536
          })
          return response.data[0].embedding
        } catch (fallbackError) {
          console.error('❌ Fallback to OpenAI also failed:', fallbackError)
        }
      }

      return null
    }
  }

  /**
   * Store content chunk with vector embedding
   */
  static async storeContentChunk(chunk: Omit<VectorContentChunk, 'id' | 'embedding' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      console.log(`📝 Storing content chunk for video: ${chunk.video_title}`)
      
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(chunk.content)
      if (!embedding) {
        console.error('❌ Failed to generate embedding for chunk')
        return false
      }
      
      const supabase = getSupabaseClient()
      
      // Insert the chunk with embedding
      const { error } = await supabase
        .from('content_chunks')
        .insert({
          creator_id: chunk.creator_id,
          video_id: chunk.video_id,
          video_title: chunk.video_title,
          video_url: chunk.video_url,
          content: chunk.content,
          start_time: chunk.start_time,
          end_time: chunk.end_time,
          chunk_index: chunk.chunk_index,
          embedding: embedding,
          metadata: chunk.metadata
        })
      
      if (error) {
        console.error('❌ Error storing content chunk:', error)
        return false
      }
      
      console.log('✅ Content chunk stored successfully')
      return true
      
    } catch (error) {
      console.error('❌ Error storing content chunk:', error)
      return false
    }
  }

  /**
   * Perform hybrid search combining vector similarity and BM25 full-text search
   */
  static async searchSimilarContent(query: HybridSearchQuery): Promise<HybridSearchResponse> {
    const startTime = Date.now()

    try {
      const vectorWeight = query.vector_weight || 0.7
      const bm25Weight = query.bm25_weight || 0.3
      const limit = query.limit || 10
      const threshold = query.similarity_threshold || 0.6  // Lower threshold for hybrid

      console.log(`🔍 Hybrid search for creator ${query.creator_id}: "${query.query}" (vector: ${vectorWeight}, bm25: ${bm25Weight})`)

      const supabase = getSupabaseClient()

      // Get results from both search methods in parallel
      const [vectorResults, bm25Results] = await Promise.all([
        this.performVectorSearch(query.query, query.creator_id, threshold, Math.ceil(limit * 1.5)),
        this.performBM25Search(query.query, query.creator_id, Math.ceil(limit * 1.5))
      ])

      console.log(`📊 Vector: ${vectorResults.length} results, BM25: ${bm25Results.length} results`)

      // Combine and rank results using hybrid scoring
      const combinedResults = this.combineHybridResults(
        vectorResults,
        bm25Results,
        vectorWeight,
        bm25Weight,
        limit
      )

      // Get unique video IDs to fetch YouTube IDs
      const uniqueVideoIds = [...new Set(combinedResults.map(r => r.video_id))]

      // Fetch YouTube IDs for all videos
      const youtubeIdMap = new Map<string, string>()
      if (uniqueVideoIds.length > 0) {
        const { data: videos } = await supabase
          .from('videos')
          .select('id, youtube_id')
          .in('id', uniqueVideoIds)

        if (videos) {
          videos.forEach((video: any) => {
            youtubeIdMap.set(video.id, video.youtube_id)
          })
        }
      }

      // Add YouTube IDs to results
      const finalResults = combinedResults.map(result => ({
        ...result,
        youtube_id: youtubeIdMap.get(result.video_id) || result.video_id
      }))

      const searchTime = Date.now() - startTime
      const avgSimilarity = finalResults.length > 0
        ? finalResults.reduce((sum, r) => sum + r.similarity_score, 0) / finalResults.length
        : 0

      console.log(`✅ Hybrid search completed: ${finalResults.length} results in ${searchTime}ms`)

      return {
        vector_results: finalResults,
        total_results: finalResults.length,
        search_stats: {
          vector_matches: vectorResults.length,
          bm25_matches: bm25Results.length,
          hybrid_matches: finalResults.length,
          average_similarity: avgSimilarity,
          search_time_ms: searchTime,
          search_method: 'hybrid'
        }
      }

    } catch (error) {
      console.error('❌ Hybrid search failed:', error)

      // Return empty results on error
      return {
        vector_results: [],
        total_results: 0,
        search_stats: {
          vector_matches: 0,
          bm25_matches: 0,
          hybrid_matches: 0,
          average_similarity: 0,
          search_time_ms: Date.now() - startTime,
          search_method: 'hybrid'
        }
      }
    }
  }

  /**
   * Perform vector similarity search
   */
  private static async performVectorSearch(
    query: string,
    creatorId: string,
    threshold: number,
    limit: number
  ): Promise<VectorSearchResult[]> {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await this.generateEmbedding(query)
      if (!queryEmbedding) {
        console.warn('⚠️ Failed to generate query embedding for vector search')
        return []
      }

      const supabase = getSupabaseClient()

      // Perform vector similarity search using pgvector
      const { data: results, error } = await supabase.rpc('search_content_chunks', {
        query_embedding: queryEmbedding,
        target_creator_id: creatorId,
        similarity_threshold: threshold,
        result_limit: limit
      })

      if (error) {
        console.error('❌ Vector search error:', error)
        return []
      }

      return (results || []).map((row: any) => ({
        id: row.id,
        video_id: row.video_id,
        youtube_id: row.video_id, // Will be replaced later
        video_title: row.video_title,
        video_url: row.video_url,
        content: row.content,
        start_time: row.start_time,
        end_time: row.end_time,
        similarity_score: row.similarity_score,
        metadata: row.metadata || {}
      }))

    } catch (error) {
      console.error('❌ Vector search failed:', error)
      return []
    }
  }

  /**
   * Perform BM25 full-text search using PostgreSQL
   */
  private static async performBM25Search(
    query: string,
    creatorId: string,
    limit: number
  ): Promise<VectorSearchResult[]> {
    try {
      const supabase = getSupabaseClient()

      // Clean and prepare query for full-text search
      const cleanQuery = query
        .replace(/[^\w\s]/g, ' ')  // Remove punctuation
        .split(/\s+/)              // Split on whitespace
        .filter(word => word.length > 2)  // Remove short words
        .join(' & ')               // Join with AND operator

      if (!cleanQuery.trim()) {
        console.warn('⚠️ No valid terms for BM25 search')
        return []
      }

      // Perform full-text search with BM25 ranking
      const { data: results, error } = await supabase
        .from('content_chunks')
        .select(`
          id,
          video_id,
          video_title,
          video_url,
          content,
          start_time,
          end_time,
          metadata
        `)
        .eq('creator_id', creatorId)
        .textSearch('content', cleanQuery)
        .limit(limit)

      if (error) {
        console.error('❌ BM25 search error:', error)
        return []
      }

      // Calculate BM25-style scores (simplified)
      return (results || []).map((row: any) => {
        const termMatches = cleanQuery.split(' & ').filter(term =>
          row.content.toLowerCase().includes(term.toLowerCase())
        ).length

        const score = Math.min(termMatches / cleanQuery.split(' & ').length, 0.95)

        return {
          id: row.id,
          video_id: row.video_id,
          youtube_id: row.video_id, // Will be replaced later
          video_title: row.video_title,
          video_url: row.video_url,
          content: row.content,
          start_time: row.start_time,
          end_time: row.end_time,
          similarity_score: score,
          metadata: row.metadata || {}
        }
      })

    } catch (error) {
      console.error('❌ BM25 search failed:', error)
      return []
    }
  }

  /**
   * Combine and rank results from vector and BM25 search
   */
  private static combineHybridResults(
    vectorResults: VectorSearchResult[],
    bm25Results: VectorSearchResult[],
    vectorWeight: number,
    bm25Weight: number,
    limit: number
  ): VectorSearchResult[] {
    const resultsMap = new Map<string, VectorSearchResult>()

    // Add vector results
    vectorResults.forEach(result => {
      resultsMap.set(result.id, {
        ...result,
        similarity_score: result.similarity_score * vectorWeight
      })
    })

    // Add or combine BM25 results
    bm25Results.forEach(result => {
      const existing = resultsMap.get(result.id)
      if (existing) {
        // Combine scores for items found in both searches
        existing.similarity_score += result.similarity_score * bm25Weight
      } else {
        // Add new BM25-only result
        resultsMap.set(result.id, {
          ...result,
          similarity_score: result.similarity_score * bm25Weight
        })
      }
    })

    // Sort by combined score and return top results
    return Array.from(resultsMap.values())
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit)
  }

  /**
   * Sync existing video chunks from SQLite to Supabase
   */
  static async syncVideoToSupabase(creatorId: string, videoId: string, videoData: {
    title: string
    youtubeId: string
    chunks: Array<{
      content: string
      startTime?: number
      endTime?: number
      chunkIndex: number
    }>
  }): Promise<boolean> {
    try {
      console.log(`🔄 Syncing video to Supabase: ${videoData.title}`)
      
      const videoUrl = `https://youtube.com/watch?v=${videoData.youtubeId}`
      
      // Store each chunk with embeddings
      let successCount = 0
      
      for (const chunk of videoData.chunks) {
        const chunkData: Omit<VectorContentChunk, 'id' | 'embedding' | 'created_at' | 'updated_at'> = {
          creator_id: creatorId,
          video_id: videoId,
          video_title: videoData.title,
          video_url: videoUrl,
          content: chunk.content,
          start_time: chunk.startTime,
          end_time: chunk.endTime,
          chunk_index: chunk.chunkIndex,
          metadata: {
            youtube_id: videoData.youtubeId,
            transcript_quality: 'imported_from_sqlite'
          }
        }
        
        if (await this.storeContentChunk(chunkData)) {
          successCount++
        }
      }
      
      console.log(`✅ Synced ${successCount}/${videoData.chunks.length} chunks to Supabase`)
      return successCount === videoData.chunks.length
      
    } catch (error) {
      console.error('❌ Error syncing video to Supabase:', error)
      return false
    }
  }

  /**
   * Get vector database statistics for a creator
   */
  static async getCreatorStats(creatorId: string): Promise<{
    total_chunks: number
    total_videos: number
    last_updated: string | null
  }> {
    try {
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase.rpc('get_creator_vector_stats', {
        target_creator_id: creatorId
      })
      
      if (error) {
        console.error('❌ Error getting creator stats:', error)
        return { total_chunks: 0, total_videos: 0, last_updated: null }
      }
      
      return data || { total_chunks: 0, total_videos: 0, last_updated: null }
      
    } catch (error) {
      console.error('❌ Error getting creator stats:', error)
      return { total_chunks: 0, total_videos: 0, last_updated: null }
    }
  }
}