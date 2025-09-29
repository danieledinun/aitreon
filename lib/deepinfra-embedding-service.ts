/**
 * DeepInfra Embedding & Reranking Service
 * Cost-effective alternative to Baseten using Qwen models
 */

export interface DeepInfraEmbeddingOptions {
  model?: 'Qwen/Qwen3-Embedding-8B'
  dimensions?: number
  retries?: number
  timeout?: number
}

export interface DeepInfraRerankingOptions {
  model?: 'Qwen/Qwen3-Reranker-8B'
  topK?: number
  retries?: number
  timeout?: number
}

export interface DeepInfraEmbeddingResponse {
  embeddings: number[][]
  usage?: {
    prompt_tokens: number
    total_tokens: number
  }
}

export interface DeepInfraRerankingResponse {
  results: Array<{
    index: number
    relevance_score: number
    document: {
      text: string
    }
  }>
  usage?: {
    prompt_tokens: number
    total_tokens: number
  }
}

export interface RerankCandidate {
  text: string
  metadata?: any
}

export class DeepInfraEmbeddingService {
  private static apiKey = process.env.DEEPINFRA_API_KEY
  private static baseUrl = 'https://api.deepinfra.com/v1/inference'

  /**
   * Generate embeddings using DeepInfra Qwen3-Embedding-8B
   */
  static async generateEmbedding(
    text: string,
    options: DeepInfraEmbeddingOptions = {}
  ): Promise<number[] | null> {
    const {
      model = 'Qwen/Qwen3-Embedding-8B',
      retries = 3,
      timeout = 30000
    } = options

    if (!this.apiKey) {
      console.error('❌ DEEPINFRA_API_KEY not found')
      return null
    }

    try {
      console.log(`🔄 Generating embedding with DeepInfra ${model}...`)

      const response = await this.makeRequest(`${this.baseUrl}/${model}`, {
        inputs: [text.replace(/\n/g, ' ').trim()], // DeepInfra expects 'inputs' array
        dimensions: 2000, // Match database schema dimension
        encoding_format: 'float'
      }, timeout)

      if (!response || !response.embeddings || !Array.isArray(response.embeddings)) {
        console.error('❌ Invalid embedding response from DeepInfra:', typeof response)
        return null
      }

      const embedding = response.embeddings[0]
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        console.error('❌ Empty or invalid embedding returned from DeepInfra')
        return null
      }

      console.log(`✅ Generated ${embedding.length}D embedding with DeepInfra`)
      return embedding

    } catch (error) {
      console.error(`❌ Error generating embedding with DeepInfra:`, error)

      if (retries > 0) {
        console.log(`🔄 Retrying DeepInfra embedding (${retries} retries left)...`)
        await new Promise(resolve => setTimeout(resolve, 1000))

        return this.generateEmbedding(text, {
          ...options,
          retries: retries - 1
        })
      }

      return null
    }
  }

  /**
   * Rerank search results using DeepInfra Qwen3-Reranker-8B
   */
  static async rerankResults(
    query: string,
    candidates: RerankCandidate[],
    options: DeepInfraRerankingOptions = {}
  ): Promise<Array<{ index: number; score: number; candidate: RerankCandidate }> | null> {
    const {
      model = 'Qwen/Qwen3-Reranker-8B',
      topK = candidates.length,
      retries = 3,
      timeout = 30000
    } = options

    if (!this.apiKey) {
      console.error('❌ DEEPINFRA_API_KEY not found')
      return null
    }

    if (!candidates || candidates.length === 0) {
      console.warn('⚠️ No candidates provided for reranking')
      return []
    }

    try {
      console.log(`🔄 Reranking ${candidates.length} results with DeepInfra ${model}...`)

      const response = await this.makeRequest(`${this.baseUrl}/${model}`, {
        queries: [query.trim()], // DeepInfra expects 'queries' array, not 'query' string
        documents: candidates.map(c => c.text),
        top_k: Math.min(topK, candidates.length),
        return_documents: true
      }, timeout)

      if (!response || !response.scores || !Array.isArray(response.scores)) {
        console.error('❌ Invalid reranking response from DeepInfra:', typeof response)
        console.error('❌ Full response:', JSON.stringify(response, null, 2))
        return null
      }

      // DeepInfra returns scores array directly, create results with indices
      const rerankedResults = response.scores
        .map((score: number, index: number) => ({
          index,
          score,
          candidate: candidates[index]
        }))
        .sort((a: any, b: any) => b.score - a.score) // Sort by score descending
        .slice(0, topK) // Take only topK results

      console.log(`✅ Reranked to top ${rerankedResults.length} results with DeepInfra`)
      return rerankedResults

    } catch (error) {
      console.error(`❌ Error reranking with DeepInfra:`, error)

      if (retries > 0) {
        console.log(`🔄 Retrying DeepInfra reranking (${retries} retries left)...`)
        await new Promise(resolve => setTimeout(resolve, 1000))

        return this.rerankResults(query, candidates, {
          ...options,
          retries: retries - 1
        })
      }

      return null
    }
  }

  /**
   * Batch embedding generation for multiple texts
   */
  static async generateBatchEmbeddings(
    texts: string[],
    options: DeepInfraEmbeddingOptions = {}
  ): Promise<Array<{ text: string; embedding: number[] | null }>> {
    const results = []

    // Process in chunks to avoid rate limits
    const chunkSize = 5
    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize)

      const chunkPromises = chunk.map(async (text) => {
        const embedding = await this.generateEmbedding(text, options)
        return { text, embedding }
      })

      const chunkResults = await Promise.all(chunkPromises)
      results.push(...chunkResults)

      console.log(`📊 Processed ${Math.min(i + chunkSize, texts.length)}/${texts.length} embeddings`)

      // Small delay between chunks
      if (i + chunkSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  /**
   * Make HTTP request to DeepInfra API
   */
  private static async makeRequest(
    url: string,
    payload: any,
    timeout: number
  ): Promise<any> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      return await response.json()

    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Test connectivity and performance
   */
  static async testConnection(): Promise<{
    success: boolean
    latency: number
    dimensions: number
  }> {
    const testText = "This is a test embedding for DeepInfra connectivity."
    const startTime = Date.now()

    try {
      const embedding = await this.generateEmbedding(testText)
      const latency = Date.now() - startTime

      return {
        success: !!embedding,
        latency,
        dimensions: embedding?.length || 0
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        dimensions: 0
      }
    }
  }
}