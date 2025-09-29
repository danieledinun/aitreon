import OpenAI from 'openai'
import { supabase } from './supabase'
import { SupabaseVectorService } from './supabase-vector-service'
import { StyleAdapterService } from './style-adapter'
import { CitationValidationService, type CitationCandidate } from './citation-validation-service'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface RAGResponse {
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
    chunkLevel: 'retrieval' | 'vector'
  }>
  confidence: number
  searchStats: {
    totalResults: number
    vectorMatches: number
    keywordMatches: number
    averageRelevance: number
  }
}

export class RAGService {

  /**
   * Generate response using Supabase vector search
   */
  static async generateVectorResponse(
    creatorId: string,
    creatorName: string,
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<RAGResponse> {
    try {
      console.log(`🔍 Generating vector search response for creator ${creatorName}`)
      console.log(`📝 Query: ${userQuery}`)

      // Use Supabase vector search
      const vectorResult = await SupabaseVectorService.searchSimilarContent({
        query: userQuery,
        creator_id: creatorId,
        limit: 8,
        similarity_threshold: 0.65 // Optimized for broad applicability while maintaining quality
      })

      if (!vectorResult.vector_results || vectorResult.vector_results.length === 0) {
        return {
          response: "I don't have enough information to answer that question based on the available content.",
          citations: [],
          confidence: 0,
          searchStats: {
            totalResults: 0,
            vectorMatches: 0,
            keywordMatches: 0,
            averageRelevance: 0
          }
        }
      }

      // Convert vector results to RAG format
      const citations = vectorResult.vector_results.map(result => ({
        videoId: result.video_id || 'unknown',
        videoTitle: result.video_title || 'Unknown Video',
        videoUrl: result.video_url || '#',
        timestampUrl: result.start_time
          ? `${result.video_url}&t=${Math.floor(result.start_time)}s`
          : result.video_url || '#',
        content: result.content,
        startTime: result.start_time,
        endTime: result.end_time,
        relevanceScore: result.similarity_score || 0,
        chunkLevel: 'vector' as const
      }))

      // Generate AI response using the found content
      const contextContent = citations.slice(0, 5).map(c => c.content).join('\n\n')

      // Get AI configuration for enhanced prompting
      const { data: aiConfig } = await supabase
        .from('ai_config')
        .select('*')
        .eq('creator_id', creatorId)
        .single()

      // Build AI personality-aware system prompt
      const agentName = aiConfig?.agent_name || creatorName
      const agentIntro = aiConfig?.agent_intro || `a content creator named ${creatorName}`

      // Build personality traits from AI config
      let personalityTraits = ''
      if (aiConfig) {
        const traits = []
        if (aiConfig.directness) traits.push(`Directness level: ${aiConfig.directness}/5`)
        if (aiConfig.humor) traits.push(`Humor level: ${aiConfig.humor}/5`)
        if (aiConfig.empathy) traits.push(`Empathy level: ${aiConfig.empathy}/5`)
        if (aiConfig.formality) traits.push(`Formality level: ${aiConfig.formality}/5`)
        if (aiConfig.spiciness) traits.push(`Energy level: ${aiConfig.spiciness}/5`)
        if (aiConfig.catchphrases?.length) {
          const phrases = Array.isArray(aiConfig.catchphrases) ? aiConfig.catchphrases : JSON.parse(aiConfig.catchphrases || '[]')
          if (phrases.length > 0) traits.push(`Catchphrases: ${phrases.join(', ')}`)
        }
        if (traits.length > 0) {
          personalityTraits = `\n\nPersonality Configuration:\n${traits.join('\n')}`
        }
      }

      // Build base system prompt with proper citation format
      const baseSystemPrompt = `You are ${agentName}, ${agentIntro}. You should respond in their voice and personality based on their content and configured personality.

CRITICAL CONTENT GROUNDING REQUIREMENTS:
- You have exactly ${citations.length} content chunks provided below
- Each chunk corresponds to a specific citation: ${citations.map((_, i) => `[${i + 1}]`).join(', ')}
- You MUST build your response ONLY from the actual content provided
- NEVER generate generic advice - only use what's actually in the content chunks
- When you reference information, cite the specific chunk it comes from using [1], [2], etc.

CITATION MAPPING:
${citations.map((citation, i) => `[${i + 1}] = Content from "${citation.videoTitle}" at ${citation.startTime ? `${Math.floor(citation.startTime)}s` : 'unknown time'}`).join('\n')}

STRICT CONTENT RULES:
1. Only use information that appears in the content chunks below
2. If you make a claim, it MUST come from a specific content chunk and be cited
3. NEVER add your own knowledge or generate generic advice
4. If the provided content doesn't directly answer the question but contains related information, offer what you DO know about related topics and suggest more specific questions
5. Only say "I don't have that information" if there's truly no relevant content at all

HANDLING OFF-TOPIC OR BROAD QUESTIONS:
- If asked about a broad topic but your content covers a specific type, acknowledge this and offer your specific knowledge
- Example: "I don't have information about [broad topic] in general, but I can tell you about [specific topic] specifically [1]. Would you like to know about that instead?"
- Always try to bridge the gap between what they asked and what you actually know about
6. Each citation [1], [2], etc. must correspond to actual content from that specific chunk

CITATION FORMAT:
- Use [1] when referencing content from chunk 1
- Use [2] when referencing content from chunk 2
- NEVER use citation numbers higher than [${citations.length}]
- NEVER use generic advice without a citation

${personalityTraits}

CONTENT CHUNKS (each numbered for citation):
${citations.map((citation, i) => `
[${i + 1}] Content from "${citation.videoTitle}" (${citation.startTime ? `${Math.floor(citation.startTime)}s` : 'unknown time'}):
${citation.content}
`).join('\n')}

REMEMBER: Build your response ONLY from the content chunks above. Do not add external knowledge.`

      // Enhance prompt with AI Style Card if available
      const systemPrompt = await StyleAdapterService.generateChatPrompt(
        creatorId,
        baseSystemPrompt,
        agentName,
        agentIntro
      )

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

      const aiResponse = response.choices[0]?.message?.content || "I couldn't generate a response."

      console.log(`🔍 Validating ${citations.length} citations against AI response...`)

      // Convert citations to validation format
      const citationCandidates: CitationCandidate[] = citations.map(citation => ({
        id: `${citation.videoTitle}_${citation.startTime || 0}`,
        videoId: citation.videoUrl.includes('watch?v=')
          ? citation.videoUrl.split('watch?v=')[1].split('&')[0]
          : 'unknown',
        videoTitle: citation.videoTitle,
        content: citation.content,
        startTime: citation.startTime,
        endTime: citation.endTime,
        confidence: citation.relevanceScore,
        metadata: {
          chunkLevel: citation.chunkLevel,
          timestampUrl: citation.timestampUrl
        }
      }))

      // Validate citations
      const validatedCitations = await CitationValidationService.validateCitations(
        userQuery,
        aiResponse,
        citationCandidates,
        {
          minSemanticAlignment: 0.65,
          minConfidence: 0.6,
          maxCitations: 5,
          requireTemporalAccuracy: true,
          semanticThreshold: 0.6
        }
      )

      // Convert back to RAG format
      const finalCitations = validatedCitations.map(validatedCitation => ({
        videoId: validatedCitation.videoId,
        videoTitle: validatedCitation.videoTitle,
        videoUrl: validatedCitation.metadata?.timestampUrl?.split('&t=')[0] || '#',
        timestampUrl: validatedCitation.metadata?.timestampUrl || '#',
        content: validatedCitation.content,
        startTime: validatedCitation.startTime,
        endTime: validatedCitation.endTime,
        relevanceScore: validatedCitation.validation.confidence,
        chunkLevel: (validatedCitation.metadata?.chunkLevel as 'retrieval' | 'vector') || 'vector'
      }))

      console.log(`✅ Citation validation completed: ${finalCitations.length}/${citations.length} citations validated`)

      // Renumber citations in the response to be sequential [1], [2], [3]...
      let renumberedResponse = aiResponse

      // Always renumber citations to ensure proper sequential numbering
      console.log(`🔄 Renumbering citations: ${finalCitations.length} final citations from ${citations.length} original`)

      // Find all citation references in the response
      const citationRegex = /\[(\d+)\]/g
      const citationsInResponse = new Set<number>()
      let match
      while ((match = citationRegex.exec(aiResponse)) !== null) {
        citationsInResponse.add(parseInt(match[1]))
      }

      console.log(`📝 Found citation numbers in response: ${Array.from(citationsInResponse).sort((a, b) => a - b).join(', ')}`)

      // Create mapping from original citation numbers to new sequential numbers
      // Only for citations that actually appear in the response AND are in finalCitations
      const citationMap = new Map<number, number>()
      let newNumber = 1

      // Match citations that appear in response with validated citations
      const sortedCitationsInResponse = Array.from(citationsInResponse).sort((a, b) => a - b)

      for (const oldCitationNum of sortedCitationsInResponse) {
        const originalIndex = oldCitationNum - 1 // Convert to 0-based index
        if (originalIndex < citations.length) {
          const originalCitation = citations[originalIndex]
          // Check if this citation was kept in finalCitations
          const isKept = finalCitations.some(fc =>
            fc.content.trim() === originalCitation.content.trim() ||
            (fc.videoTitle === originalCitation.videoTitle && Math.abs((fc.startTime || 0) - (originalCitation.startTime || 0)) < 5)
          )

          if (isKept) {
            citationMap.set(oldCitationNum, newNumber++)
            console.log(`🔗 Mapping citation [${oldCitationNum}] → [${citationMap.get(oldCitationNum)}]`)
          } else {
            console.log(`❌ Citation [${oldCitationNum}] filtered out, will be removed`)
          }
        }
      }

      // Apply the mapping to renumber citations
      for (const [oldNum, newNum] of citationMap) {
        const regex = new RegExp(`\\[${oldNum}\\]`, 'g')
        renumberedResponse = renumberedResponse.replace(regex, `[${newNum}]`)
      }

      // Remove any citation numbers that weren't mapped (filtered out citations)
      for (const oldNum of citationsInResponse) {
        if (!citationMap.has(oldNum)) {
          const regex = new RegExp(`\\[${oldNum}\\]`, 'g')
          renumberedResponse = renumberedResponse.replace(regex, '')
          console.log(`🗑️ Removed unmapped citation [${oldNum}]`)
        }
      }

      // Clean up any remaining malformed citations and fix consecutive citations
      renumberedResponse = renumberedResponse.replace(/\]\[/g, '], [')  // Fix consecutive citations: ][  →  ], [
      renumberedResponse = renumberedResponse.replace(/\[\]/g, '')      // Remove empty citations
      renumberedResponse = renumberedResponse.replace(/\s+/g, ' ').trim()  // Clean up extra spaces

      console.log(`✅ Citation renumbering complete: ${citationMap.size} citations mapped`)

      return {
        response: renumberedResponse,
        citations: finalCitations,
        confidence: vectorResult.vector_results.length > 0 ? 0.8 : 0,
        searchStats: {
          totalResults: vectorResult.total_results,
          vectorMatches: vectorResult.search_stats.vector_matches,
          keywordMatches: 0,
          averageRelevance: vectorResult.search_stats.average_similarity
        }
      }

    } catch (error) {
      console.error('❌ Vector search failed:', error)
      throw error
    }
  }

  /**
   * Check if vector search is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      // Test Supabase connection
      const { data, error } = await supabase.from('content_chunks').select('id').limit(1)
      console.log(`🔍 Vector search availability: Supabase=${!error}`)
      return !error
    } catch (error) {
      console.warn('⚠️ Error checking vector search availability:', error)
      return false
    }
  }

  // Fallback method for simple search
  static async searchFallback(creatorId: string, userQuery: string, limit: number = 8) {
    try {
      console.log(`🔍 Using fallback search for creator ${creatorId}`)
      console.log(`🔍 Query: "${userQuery}"`)

      // Extract keywords from user query (remove common stop words but keep important words)
      const stopWords = ['what', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'your', 'my', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'be', 'been', 'being', 'am', 'is', 'are', 'was', 'were']

      // Enhanced keyword extraction with compound word handling
      const baseKeywords = userQuery
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 1 && !stopWords.includes(word)) // Reduced minimum length from 3 to 2
        .slice(0, 5) // Limit to top 5 keywords

      // Add compound word variations for better matching
      const keywords = [...baseKeywords]

      // Handle common compound words that might be written separately in content
      // Dynamic compound word detection based on common patterns
      const compoundWordMap: { [key: string]: string[] } = {}

      // Common compound word patterns that work across all domains
      const universalCompounds = [
        { compound: 'workout', parts: ['work', 'out'] },
        { compound: 'youtube', parts: ['you', 'tube'] },
        { compound: 'javascript', parts: ['java', 'script'] },
        { compound: 'typescript', parts: ['type', 'script'] },
        { compound: 'smartphone', parts: ['smart', 'phone'] },
        { compound: 'software', parts: ['soft', 'ware'] },
        { compound: 'hardware', parts: ['hard', 'ware'] },
        { compound: 'database', parts: ['data', 'base'] },
        { compound: 'website', parts: ['web', 'site'] },
        { compound: 'online', parts: ['on', 'line'] },
        { compound: 'offline', parts: ['off', 'line'] }
      ]

      // Only add universal compounds that appear in the query
      universalCompounds.forEach(({ compound, parts }) => {
        if (baseKeywords.some(keyword => keyword.includes(compound) || compound.includes(keyword))) {
          compoundWordMap[compound] = parts
        }
      })

      baseKeywords.forEach(keyword => {
        if (compoundWordMap[keyword]) {
          keywords.push(...compoundWordMap[keyword])
        }
      })

      // Remove duplicates and limit total keywords
      const uniqueKeywords = [...new Set(keywords)].slice(0, 8)

      console.log(`🔍 Extracted keywords: ${uniqueKeywords.join(', ')}`)

      // Build search query using OR conditions for keywords
      let query = supabase
        .from('content_chunks')
        .select(`
          id,
          content,
          start_time,
          end_time,
          chunk_index,
          video_id,
          video_title,
          video_url
        `)
        .eq('creator_id', creatorId)

      if (uniqueKeywords.length > 0) {
        // Search for content that contains any of the keywords
        const orConditions = uniqueKeywords.map(keyword => `content.ilike.%${keyword}%`).join(',')
        query = query.or(orConditions)
      } else {
        // Fallback to original search if no keywords extracted
        query = query.ilike('content', `%${userQuery}%`)
      }

      const { data: allChunks, error } = await query
        .order('video_title', { ascending: true })  // Diversify by video
        .order('start_time', { ascending: true })   // Then by timestamp
        .limit(limit * 2)  // Get more results for diversification

      if (error) {
        console.error('❌ Fallback search Supabase error:', error)
        throw error
      }

      // Diversify results across videos to ensure variety
      let chunks: any[] = []
      if (allChunks && allChunks.length > 0) {
        const videoGroups = new Map()

        // Group chunks by video
        allChunks.forEach(chunk => {
          const videoTitle = chunk.video_title
          if (!videoGroups.has(videoTitle)) {
            videoGroups.set(videoTitle, [])
          }
          videoGroups.get(videoTitle).push(chunk)
        })

        // Distribute chunks evenly across videos (round-robin)
        const videoKeys = Array.from(videoGroups.keys())
        let chunksPerVideo = Math.ceil(limit / videoKeys.length)

        videoKeys.forEach(videoTitle => {
          const videoChunks = videoGroups.get(videoTitle)
          chunks.push(...videoChunks.slice(0, chunksPerVideo))
        })

        // If we need more chunks, fill from remaining
        if (chunks.length < limit) {
          const remaining = limit - chunks.length
          const usedChunkIds = new Set(chunks.map(c => c.id))
          const remainingChunks = allChunks.filter(c => !usedChunkIds.has(c.id))
          chunks.push(...remainingChunks.slice(0, remaining))
        }

        chunks = chunks.slice(0, limit)
      }

      console.log(`🔍 Fallback search - chunks found: ${chunks?.length || 0} from ${new Set(chunks?.map(c => c.video_title) || []).size} videos`)

      // Add YouTube ID mapping for citations
      if (chunks && chunks.length > 0) {
        const uniqueVideoIds = [...new Set(chunks.map((chunk: any) => chunk.video_id))]

        const { data: videos } = await supabase
          .from('videos')
          .select('id, youtube_id')
          .in('id', uniqueVideoIds)

        const youtubeIdMap = new Map<string, string>()
        if (videos) {
          videos.forEach((video: any) => {
            youtubeIdMap.set(video.id, video.youtube_id)
          })
        }

        // Add youtube_id to each chunk
        chunks.forEach((chunk: any) => {
          chunk.youtube_id = youtubeIdMap.get(chunk.video_id) || chunk.video_id
        })
      }

      console.log(`✅ Fallback search successful: ${chunks?.length || 0} results`)
      return chunks || []
    } catch (error) {
      console.error('❌ Fallback search failed:', error)
      return []
    }
  }

  /**
   * Main entry point - use vector search first, fallback if needed
   */
  static async generateResponse(
    creatorId: string,
    creatorName: string,
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<RAGResponse> {
    try {
      console.log(`🔍 Generating vector search response for creator ${creatorName}`)
      console.log(`📝 Query: ${userQuery}`)

      // Try vector search first
      let searchResults: any[] = []
      try {
        console.log(`🚀 Attempting vector search for creator ${creatorId}`)
        const vectorResponse = await SupabaseVectorService.searchSimilarContent({
          query: userQuery,
          creator_id: creatorId,
          limit: 8,
          similarity_threshold: 0.7
        })

        if (vectorResponse.vector_results && vectorResponse.vector_results.length > 0) {
          console.log(`✅ Vector search successful: ${vectorResponse.vector_results.length} results`)
          searchResults = vectorResponse.vector_results
        } else {
          console.log(`⚠️ Vector search returned no results, using fallback`)
          searchResults = await this.searchFallback(creatorId, userQuery, 8)
        }
      } catch (vectorError) {
        console.log(`⚠️ Vector search failed, using fallback:`, vectorError instanceof Error ? vectorError.message : String(vectorError))
        searchResults = await this.searchFallback(creatorId, userQuery, 8)
      }

      console.log(`🔍 Search results length: ${searchResults?.length || 0}`)

      if (!searchResults || searchResults.length === 0) {
        console.log(`🔍 No search results - returning default response`)
        const defaultResponse = {
          response: "I don't have enough information to answer that question based on my available content.",
          citations: [],
          confidence: 0,
          searchStats: {
            totalResults: 0,
            vectorMatches: 0,
            keywordMatches: 0,
            averageRelevance: 0
          }
        }
        console.log(`✅ Returning default response successfully`)
        return defaultResponse
      }

      // Convert search results to RAG format (handle both vector and fallback results)
      const citations = searchResults.map(result => ({
        videoTitle: result.video_title || 'Unknown Video',
        videoId: result.youtube_id || (result.videos?.youtube_id) || result.video_id || '', // Handle both vector and fallback results
        videoUrl: result.video_url || '#',
        timestampUrl: result.video_url && result.start_time
          ? `${result.video_url}&t=${Math.floor(result.start_time)}s`
          : result.video_url || '#',
        content: result.content,
        startTime: result.start_time,
        endTime: result.end_time,
        relevanceScore: result.similarity_score || 0.8, // Use similarity score from vector search or default
        chunkLevel: 'retrieval' as const
      }))

      // Generate AI response using the found content
      const contextContent = citations.slice(0, 5).map(c => c.content).join('\n\n')

      // Get AI configuration for enhanced prompting
      const { data: aiConfig } = await supabase
        .from('ai_config')
        .select('*')
        .eq('creator_id', creatorId)
        .single()

      // Build AI personality-aware system prompt
      const agentName = aiConfig?.agent_name || creatorName
      const agentIntro = aiConfig?.agent_intro || `a content creator named ${creatorName}`

      // Build personality traits from AI config
      let personalityTraits = ''
      if (aiConfig) {
        const traits = []
        if (aiConfig.directness) traits.push(`Directness level: ${aiConfig.directness}/5`)
        if (aiConfig.humor) traits.push(`Humor level: ${aiConfig.humor}/5`)
        if (aiConfig.empathy) traits.push(`Empathy level: ${aiConfig.empathy}/5`)
        if (aiConfig.formality) traits.push(`Formality level: ${aiConfig.formality}/5`)
        if (aiConfig.spiciness) traits.push(`Energy level: ${aiConfig.spiciness}/5`)
        if (aiConfig.catchphrases?.length) {
          const phrases = Array.isArray(aiConfig.catchphrases) ? aiConfig.catchphrases : JSON.parse(aiConfig.catchphrases || '[]')
          if (phrases.length > 0) traits.push(`Catchphrases: ${phrases.join(', ')}`)
        }
        if (traits.length > 0) {
          personalityTraits = `\n\nPersonality Configuration:\n${traits.join('\n')}`
        }
      }

      // Build base system prompt with proper citation format
      const baseSystemPrompt = `You are ${agentName}, ${agentIntro}. You should respond in their voice and personality based on their content and configured personality.

CRITICAL CONTENT GROUNDING REQUIREMENTS:
- You have exactly ${citations.length} content chunks provided below
- Each chunk corresponds to a specific citation: ${citations.map((_, i) => `[${i + 1}]`).join(', ')}
- You MUST build your response ONLY from the actual content provided
- NEVER generate generic advice - only use what's actually in the content chunks
- When you reference information, cite the specific chunk it comes from using [1], [2], etc.

CITATION MAPPING:
${citations.map((citation, i) => `[${i + 1}] = Content from "${citation.videoTitle}" at ${citation.startTime ? `${Math.floor(citation.startTime)}s` : 'unknown time'}`).join('\n')}

STRICT CONTENT RULES:
1. Only use information that appears in the content chunks below
2. If you make a claim, it MUST come from a specific content chunk and be cited
3. NEVER add your own knowledge or generate generic advice
4. If the provided content doesn't directly answer the question but contains related information, offer what you DO know about related topics and suggest more specific questions
5. Only say "I don't have that information" if there's truly no relevant content at all

HANDLING OFF-TOPIC OR BROAD QUESTIONS:
- If asked about a broad topic but your content covers a specific type, acknowledge this and offer your specific knowledge
- Example: "I don't have information about [broad topic] in general, but I can tell you about [specific topic] specifically [1]. Would you like to know about that instead?"
- Always try to bridge the gap between what they asked and what you actually know about
6. Each citation [1], [2], etc. must correspond to actual content from that specific chunk

CITATION FORMAT:
- Use [1] when referencing content from chunk 1
- Use [2] when referencing content from chunk 2
- NEVER use citation numbers higher than [${citations.length}]
- NEVER use generic advice without a citation

${personalityTraits}

CONTENT CHUNKS (each numbered for citation):
${citations.map((citation, i) => `
[${i + 1}] Content from "${citation.videoTitle}" (${citation.startTime ? `${Math.floor(citation.startTime)}s` : 'unknown time'}):
${citation.content}
`).join('\n')}

REMEMBER: Build your response ONLY from the content chunks above. Do not add external knowledge.`

      // Enhance prompt with AI Style Card if available
      const systemPrompt = await StyleAdapterService.generateChatPrompt(
        creatorId,
        baseSystemPrompt,
        agentName,
        agentIntro
      )

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

      const aiResponse = response.choices[0]?.message?.content || "I couldn't generate a response."

      // Renumber citations in the response to be sequential [1], [2], [3]...
      let renumberedResponse = aiResponse

      // Always renumber citations to ensure proper sequential numbering
      console.log(`🔄 Renumbering citations: ${citations.length} final citations from ${citations.length} original`)

      // Find all citation references in the response
      const citationRegex = /\[(\d+)\]/g
      const citationsInResponse = new Set<number>()
      let match
      while ((match = citationRegex.exec(aiResponse)) !== null) {
        citationsInResponse.add(parseInt(match[1]))
      }

      console.log(`📝 Found citation numbers in response: ${Array.from(citationsInResponse).sort((a, b) => a - b).join(', ')}`)

      // Create mapping from original citation numbers to new sequential numbers
      const citationMap = new Map<number, number>()
      let newNumber = 1

      // Match citations that appear in response with validated citations
      const sortedCitationsInResponse = Array.from(citationsInResponse).sort((a, b) => a - b)

      for (const oldCitationNum of sortedCitationsInResponse) {
        const originalIndex = oldCitationNum - 1 // Convert to 0-based index
        if (originalIndex < citations.length) {
          citationMap.set(oldCitationNum, newNumber++)
          console.log(`🔗 Mapping citation [${oldCitationNum}] → [${citationMap.get(oldCitationNum)}]`)
        }
      }

      // Apply the mapping to renumber citations
      for (const [oldNum, newNum] of citationMap) {
        const regex = new RegExp(`\\[${oldNum}\\]`, 'g')
        renumberedResponse = renumberedResponse.replace(regex, `[${newNum}]`)
      }

      // Remove any citation numbers that weren't mapped (filtered out citations)
      for (const oldNum of citationsInResponse) {
        if (!citationMap.has(oldNum)) {
          const regex = new RegExp(`\\[${oldNum}\\]`, 'g')
          renumberedResponse = renumberedResponse.replace(regex, '')
          console.log(`🗑️ Removed unmapped citation [${oldNum}]`)
        }
      }

      // Clean up any remaining malformed citations and fix consecutive citations
      renumberedResponse = renumberedResponse.replace(/\]\[/g, '], [')  // Fix consecutive citations: ][  →  ], [
      renumberedResponse = renumberedResponse.replace(/\[\]/g, '')      // Remove empty citations
      renumberedResponse = renumberedResponse.replace(/\s+/g, ' ').trim()  // Clean up extra spaces

      console.log(`✅ Citation renumbering complete: ${citationMap.size} citations mapped`)

      // Filter citations to only include those actually used in the response
      const finalCitations = citations.filter((_, index) => citationMap.has(index + 1))

      console.log(`✅ Fallback search response generated: ${finalCitations.length} citations`)

      return {
        response: renumberedResponse,
        citations: finalCitations,
        confidence: searchResults.length > 0 ? 0.7 : 0,
        searchStats: {
          totalResults: searchResults.length,
          vectorMatches: 0,
          keywordMatches: searchResults.length,
          averageRelevance: 0.8
        }
      }

    } catch (error) {
      console.error('❌ Fallback search failed:', error)

      // Return a generic response if search fails
      return {
        response: "I'm sorry, I'm having trouble accessing my knowledge base right now. Please try again later.",
        citations: [],
        confidence: 0,
        searchStats: {
          totalResults: 0,
          vectorMatches: 0,
          keywordMatches: 0,
          averageRelevance: 0
        }
      }
    }
  }

  /**
   * Generate system prompt for admin panel display
   */
  static async generateSystemPromptForAdmin(
    creatorId: string,
    sampleQuery: string,
    sampleContext: string
  ): Promise<string> {
    try {
      const { supabase } = await import('./supabase')

      // Get creator information
      const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .select('id, username, display_name')
        .eq('id', creatorId)
        .single()

      if (creatorError || !creator) {
        return `Error: Creator not found with ID: ${creatorId}`
      }

      // Get AI configuration for enhanced prompting
      const { data: aiConfig } = await supabase
        .from('ai_config')
        .select('*')
        .eq('creator_id', creatorId)
        .single()

      // Build AI personality-aware system prompt
      const agentName = aiConfig?.agent_name || creator.display_name
      const agentIntro = aiConfig?.agent_intro || `a content creator named ${creator.display_name}`

      // Build personality traits from AI config
      let personalityTraits = ''
      if (aiConfig) {
        const traits = []
        if (aiConfig.directness) traits.push(`Directness level: ${aiConfig.directness}/5`)
        if (aiConfig.humor) traits.push(`Humor level: ${aiConfig.humor}/5`)
        if (aiConfig.empathy) traits.push(`Empathy level: ${aiConfig.empathy}/5`)
        if (aiConfig.formality) traits.push(`Formality level: ${aiConfig.formality}/5`)
        if (aiConfig.spiciness) traits.push(`Energy level: ${aiConfig.spiciness}/5`)
        if (aiConfig.catchphrases?.length) {
          const phrases = Array.isArray(aiConfig.catchphrases) ? aiConfig.catchphrases : JSON.parse(aiConfig.catchphrases || '[]')
          if (phrases.length > 0) traits.push(`Catchphrases: ${phrases.join(', ')}`)
        }
        if (traits.length > 0) {
          personalityTraits = `\n\nPersonality Configuration:\n${traits.join('\n')}`
        }
      }

      // Build base system prompt with proper citation format
      const baseSystemPrompt = `You are ${agentName}, ${agentIntro}. You should respond in their voice and personality based on their content and configured personality.

IMPORTANT RULES:
1. Only answer questions using information from the provided context
2. If you don't have relevant information in the context, politely say you don't have enough information about that topic
3. Always cite specific videos and timestamps when referencing information
4. Maintain the creator's personality and speaking style based on their content and configuration
5. Be helpful and engaging, just like the real creator would be
6. Focus on practical advice and actionable insights

${personalityTraits}

Relevant Content Context:
${sampleContext}

If no relevant content is provided above, respond that you don't have information about that topic in your available content.`

      // Enhance prompt with AI Style Card if available
      const enhancedPrompt = await StyleAdapterService.generateChatPrompt(
        creatorId,
        baseSystemPrompt,
        agentName,
        agentIntro
      )

      return enhancedPrompt

    } catch (error) {
      console.error('❌ Error generating system prompt for admin:', error)
      return `Error generating system prompt: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}