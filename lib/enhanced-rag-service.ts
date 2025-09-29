/**
 * Enhanced RAG Service with DeepInfra Reranking
 * Combines vector search + BM25 + reranking for better results
 */

import OpenAI from 'openai'
import { supabase } from './supabase'
import { SupabaseVectorService } from './supabase-vector-service'
import { StyleAdapterService } from './style-adapter'
import { CitationValidationService, type CitationCandidate } from './citation-validation-service'
import { DeepInfraEmbeddingService, type RerankCandidate } from './deepinfra-embedding-service'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface EnhancedRAGResponse {
  response: string
  citations: Array<{
    videoId: string
    videoTitle: string
    videoUrl: string
    timestampUrl: string
    content: string
    startTime?: number
    endTime?: number
    relevanceScore: number
    rerankScore?: number
    chunkLevel: 'retrieval' | 'vector' | 'reranked'
  }>
  confidence: number
  searchStats: {
    totalResults: number
    vectorMatches: number
    keywordMatches: number
    rerankedResults: number
    averageRelevance: number
  }
}

export class EnhancedRAGService {

  /**
   * Generate response using enhanced search pipeline:
   * 1. Vector search + BM25 fallback (existing)
   * 2. DeepInfra reranking for better relevance
   * 3. AI response generation with citations
   */
  static async generateResponse(
    creatorId: string,
    creatorName: string,
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<EnhancedRAGResponse> {
    try {
      console.log(`🔍 Enhanced RAG for creator ${creatorName}: "${userQuery}"`)

      // Step 1: Get initial search results (vector + BM25 fallback)
      let searchResults: any[] = []
      let vectorMatches = 0
      let keywordMatches = 0

      try {
        console.log(`🚀 Attempting vector search with DeepInfra...`)
        const vectorResponse = await SupabaseVectorService.searchSimilarContent({
          query: userQuery,
          creator_id: creatorId,
          limit: 15, // Get more results for reranking
          similarity_threshold: 0.6 // Lower threshold for more candidates
        })

        if (vectorResponse.vector_results && vectorResponse.vector_results.length > 0) {
          console.log(`✅ Vector search: ${vectorResponse.vector_results.length} results`)
          searchResults = vectorResponse.vector_results
          vectorMatches = vectorResponse.vector_results.length
        } else {
          console.log(`⚠️ Vector search failed, using BM25 fallback`)
          searchResults = await this.getBM25Fallback(creatorId, userQuery, 15)
          keywordMatches = searchResults.length
        }
      } catch (vectorError) {
        console.log(`⚠️ Vector search error, using BM25 fallback:`, vectorError instanceof Error ? vectorError.message : String(vectorError))
        searchResults = await this.getBM25Fallback(creatorId, userQuery, 15)
        keywordMatches = searchResults.length
      }

      if (searchResults.length === 0) {
        return this.getDefaultResponse()
      }

      // Step 2: Rerank results using DeepInfra
      let finalResults = searchResults
      let rerankedCount = 0

      try {
        console.log(`🔄 Reranking ${searchResults.length} results with DeepInfra...`)

        const rerankCandidates: RerankCandidate[] = searchResults.map(result => ({
          text: result.content,
          metadata: {
            videoTitle: result.video_title,
            videoId: result.video_id,
            startTime: result.start_time,
            endTime: result.end_time,
            originalScore: result.similarity_score || 0.8
          }
        }))

        const rerankedResults = await DeepInfraEmbeddingService.rerankResults(
          userQuery,
          rerankCandidates,
          { topK: 8 } // Get top 8 reranked results
        )

        if (rerankedResults && rerankedResults.length > 0) {
          // Map reranked results back to original format
          finalResults = rerankedResults.map((reranked, index) => {
            const originalResult = searchResults[reranked.index]
            return {
              ...originalResult,
              rerank_score: reranked.score,
              final_score: reranked.score * 0.7 + (originalResult.similarity_score || 0.8) * 0.3
            }
          })

          rerankedCount = rerankedResults.length
          console.log(`✅ Reranked to top ${rerankedCount} results`)
        } else {
          console.log(`⚠️ Reranking failed, using original results`)
          finalResults = searchResults.slice(0, 8)
        }
      } catch (rerankError) {
        console.log(`⚠️ Reranking failed, using original results:`, rerankError instanceof Error ? rerankError.message : String(rerankError))
        finalResults = searchResults.slice(0, 8)
      }

      // Step 3: Convert to citations format
      const citations = finalResults.map(result => ({
        videoTitle: result.video_title || 'Unknown Video',
        videoId: result.youtube_id || result.video_id || '',
        videoUrl: result.video_url || '#',
        timestampUrl: result.video_url && result.start_time
          ? `${result.video_url}&t=${Math.floor(result.start_time)}s`
          : result.video_url || '#',
        content: result.content,
        startTime: result.start_time,
        endTime: result.end_time,
        relevanceScore: result.similarity_score || 0.8,
        rerankScore: result.rerank_score,
        chunkLevel: result.rerank_score ? 'reranked' as const : (vectorMatches > 0 ? 'vector' as const : 'retrieval' as const)
      }))

      // Step 4: Generate AI response
      const aiResponse = await this.generateAIResponse(
        creatorId,
        creatorName,
        userQuery,
        citations,
        conversationHistory
      )

      console.log(`✅ Enhanced RAG complete: ${citations.length} citations (${rerankedCount} reranked)`)

      return {
        response: aiResponse,
        citations,
        confidence: rerankedCount > 0 ? 0.9 : (vectorMatches > 0 ? 0.8 : 0.7),
        searchStats: {
          totalResults: finalResults.length,
          vectorMatches,
          keywordMatches,
          rerankedResults: rerankedCount,
          averageRelevance: citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length
        }
      }

    } catch (error) {
      console.error('❌ Enhanced RAG failed:', error)
      return this.getDefaultResponse()
    }
  }

  /**
   * BM25 fallback search (from existing RAG service)
   */
  private static async getBM25Fallback(creatorId: string, query: string, limit: number): Promise<any[]> {
    // Extract keywords (simplified version of existing logic)
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5)

    if (keywords.length === 0) return []

    const { data: chunks } = await supabase
      .from('content_chunks')
      .select(`
        id, content, start_time, end_time, chunk_index, video_id, video_title, video_url
      `)
      .eq('creator_id', creatorId)
      .or(keywords.map(keyword => `content.ilike.%${keyword}%`).join(','))
      .order('video_title', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(limit)

    return chunks || []
  }

  /**
   * Generate AI response with citations
   */
  private static async generateAIResponse(
    creatorId: string,
    creatorName: string,
    userQuery: string,
    citations: any[],
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    // Get AI config
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('*')
      .eq('creator_id', creatorId)
      .single()

    const agentName = aiConfig?.agent_name || creatorName
    const agentIntro = aiConfig?.agent_intro || `a content creator named ${creatorName}`

    // Debug: Log citation content mapping
    console.log(`🔍 Citation mapping debug for "${userQuery.substring(0, 30)}...":`)
    citations.forEach((citation, i) => {
      console.log(`[${i + 1}] "${citation.videoTitle}" (${Math.floor(citation.startTime || 0)}s):`)
      console.log(`    Content: "${citation.content.substring(0, 200)}..."`)
      console.log(`    Score: ${citation.relevanceScore} | Rerank: ${citation.rerankScore || 'N/A'}`)
    })

    // Build system prompt with citations
    const systemPrompt = `You are ${agentName}, ${agentIntro}.

CONTENT CITATIONS (${citations.length} available):
${citations.map((citation, i) =>
  `[${i + 1}] From "${citation.videoTitle}" at ${citation.startTime ? `${Math.floor(citation.startTime)}s` : 'unknown time'}:
${citation.content}`
).join('\n\n')}

RESPONSE RULES:
- Build your response ONLY from the citations above
- You MUST use ALL ${citations.length} citations provided - do not skip any
- CRITICAL: When you reference [1], only use content from citation [1]. When you reference [2], only use content from citation [2], etc.
- NEVER mix content from one citation with a different citation number
- Use citations in sequential order: [1], [2], [3], [4], [5], etc. - no gaps or jumps
- Each citation [1]-[${citations.length}] must appear at least once in your response
- Double-check that the content you're describing matches the citation number you're using
- Maintain your personality and speaking style while being accurate with citations`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10).map(msg => ({
          role: msg.role.toLowerCase() as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user', content: userQuery }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    return response.choices[0]?.message?.content || "I couldn't generate a response."
  }

  /**
   * Default response when no content found
   */
  private static getDefaultResponse(): EnhancedRAGResponse {
    return {
      response: "I don't have enough information to answer that question based on my available content.",
      citations: [],
      confidence: 0,
      searchStats: {
        totalResults: 0,
        vectorMatches: 0,
        keywordMatches: 0,
        rerankedResults: 0,
        averageRelevance: 0
      }
    }
  }
}