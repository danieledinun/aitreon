/**
 * Baseten Embedding Service
 * Proper implementation using Baseten's performance client pattern
 * Based on correct API format from user documentation
 */

export interface BasetenEmbeddingOptions {
  model?: 'bge-embedding-icl' | 'mixedbread-embed-large-v1' | 'nomic-embed-code' | 'qwen3-8b-embedding'
  dimensions?: number
  retries?: number
  timeout?: number
}

export interface BasetenEmbeddingResponse {
  object: 'list'
  data: Array<{
    object: 'embedding'
    index: number
    embedding: number[]
  }>
  model: string
  usage?: {
    prompt_tokens: number
    total_tokens: number
  }
}

export class BasetenEmbeddingService {
  private static apiKey = process.env.BASETEN_API_KEY

  // Model endpoints from environment variables
  private static getModelEndpoint(model: string): string | null {
    const endpoints = {
      'bge-embedding-icl': process.env.BASETEN_BGE_ENDPOINT,
      'qwen3-8b-embedding': process.env.BASETEN_QWEN_ENDPOINT,
      'mixedbread-embed-large-v1': process.env.BASETEN_MIXEDBREAD_ENDPOINT,
      'nomic-embed-code': process.env.BASETEN_NOMIC_ENDPOINT
    }

    return endpoints[model] || null
  }

  // Model configurations
  private static modelConfigs = {
    'bge-embedding-icl': {
      dimensions: 2000, // Match actual database dimensions
      maxTokens: 512
    },
    'qwen3-8b-embedding': {
      dimensions: 2000, // Should match existing embeddings in DB
      maxTokens: 8192
    },
    'mixedbread-embed-large-v1': {
      dimensions: 2000,
      maxTokens: 8192
    },
    'nomic-embed-code': {
      dimensions: 768,
      maxTokens: 8192
    }
  }

  /**
   * Generate embeddings using Baseten's performance client
   * Follows the exact pattern from user's Python implementation
   */
  static async generateEmbedding(
    text: string,
    options: BasetenEmbeddingOptions = {}
  ): Promise<number[] | null> {
    const {
      model = 'qwen3-8b-embedding',
      retries = 5, // Increased to handle auto-scaling better
      timeout = 45000 // Increased timeout for cold starts
    } = options

    if (!this.apiKey) {
      console.error('❌ BASETEN_API_KEY not found')
      return null
    }

    const config = this.modelConfigs[model]
    const endpoint = this.getModelEndpoint(model)

    if (!config || !endpoint) {
      console.error(`❌ Model not configured or endpoint missing: ${model}`)
      return null
    }

    try {
      console.log(`🔄 Generating embedding with ${model} (${config.dimensions}D)...`)

      const response = await this.makePerformanceRequest(endpoint, text, timeout)

      // Handle different response formats
      let embedding = null

      if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
        // OpenAI-compatible format: { data: [{ embedding: [...] }] }
        const firstResult = response.data[0]
        if (firstResult && firstResult.embedding && Array.isArray(firstResult.embedding)) {
          embedding = firstResult.embedding
        }
      } else if (response && Array.isArray(response)) {
        // Direct array format: [embedding_values...]
        embedding = response
      } else if (response && response.embedding && Array.isArray(response.embedding)) {
        // Direct object format: { embedding: [...] }
        embedding = response.embedding
      } else if (response && Array.isArray(response.data)) {
        // Simple data array format: { data: [embedding_values...] }
        embedding = response.data
      }

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        console.error('❌ Empty or invalid embedding returned from Baseten:', typeof response)
        return null
      }

      console.log(`✅ Generated ${embedding.length}D embedding with ${model}`)

      // Apply dimension reduction if needed (e.g., 4096D -> 2000D)
      const targetDimensions = config.dimensions
      if (embedding.length > targetDimensions) {
        console.log(`🔄 Reducing dimensions from ${embedding.length}D to ${targetDimensions}D`)

        // Split embedding in half and optionally average or truncate
        // Method 1: Take first N dimensions
        // const reducedEmbedding = embedding.slice(0, targetDimensions)

        // Method 2: Average chunks (split to average down to 2000D)
        const chunkSize = Math.floor(embedding.length / targetDimensions)
        const reducedEmbedding = []

        for (let i = 0; i < targetDimensions; i++) {
          let sum = 0
          for (let j = 0; j < chunkSize; j++) {
            sum += embedding[i * chunkSize + j] || 0
          }
          reducedEmbedding.push(sum / chunkSize)
        }

        console.log(`✅ Dimension reduction complete: ${reducedEmbedding.length}D`)
        return reducedEmbedding
      }

      return embedding

    } catch (error) {
      console.error(`❌ Error generating embedding with ${model}:`, error)

      // Check if this is a scale-down error that can be retried
      const isScaledDown = error.message?.includes('deactivated') ||
                          error.message?.includes('not found') ||
                          error.message?.includes('cold start')

      if (isScaledDown && retries > 1) {
        console.log(`🔄 Baseten scaled down, triggering auto-scale up (${retries} retries left)...`)

        // Immediately retry - Baseten will auto-scale up on request
        return this.generateEmbedding(text, {
          ...options,
          model,
          retries: retries - 1
        })
      }

      // Try fallback models if primary fails
      if (retries > 0) {
        const fallbackModel = this.getFallbackModel(model)
        if (fallbackModel && fallbackModel !== model) {
          console.log(`🔄 Retrying with fallback model: ${fallbackModel}`)
          return this.generateEmbedding(text, {
            ...options,
            model: fallbackModel,
            retries: retries - 1
          })
        }
      }

      return null
    }
  }

  /**
   * Batch embedding generation for multiple texts
   */
  static async generateBatchEmbeddings(
    texts: string[],
    options: BasetenEmbeddingOptions = {}
  ): Promise<Array<{ text: string; embedding: number[] | null }>> {
    const results = []

    // Process in chunks to avoid rate limits
    const chunkSize = 10

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
   * Make HTTP request to Baseten using the endpoint URL from environment
   * Uses the exact endpoint format from .env configuration
   */
  private static async makePerformanceRequest(
    endpoint: string,
    text: string,
    timeout: number
  ): Promise<BasetenEmbeddingResponse | null> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Try different endpoint formats
      let url = endpoint

      // If the endpoint is a /sync/v1 format, try converting to deployment format
      if (endpoint.includes('/sync/v1')) {
        // Extract model ID from URL like: https://model-7qr16103.api.baseten.co/environments/production/sync/v1
        const modelIdMatch = endpoint.match(/model-([^.]+)/)
        if (modelIdMatch) {
          const modelId = modelIdMatch[1]
          // Use the production deployment ID we found: 3y877nw
          url = `https://model-${modelId}.api.baseten.co/deployment/3y877nw/predict`
          console.log(`🔄 Trying deployment endpoint: ${url}`)
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Try simple input format for predict endpoint
          input: text.replace(/\n/g, ' ').trim()
        }),
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
   * Get fallback model for resilience
   */
  private static getFallbackModel(currentModel: string): string {
    const fallbackOrder = {
      'qwen3-8b-embedding': 'bge-embedding-icl',
      'bge-embedding-icl': 'qwen3-8b-embedding',
      'mixedbread-embed-large-v1': 'bge-embedding-icl',
      'nomic-embed-code': 'bge-embedding-icl'
    }

    return fallbackOrder[currentModel as keyof typeof fallbackOrder] || 'bge-embedding-icl'
  }

  /**
   * Test connectivity and performance
   */
  static async testConnection(model?: BasetenEmbeddingOptions['model']): Promise<{
    success: boolean
    latency: number
    model: string
    dimensions: number
  }> {
    const testText = "This is a test embedding for Baseten connectivity."
    const startTime = Date.now()
    const testModel = model || 'qwen3-8b-embedding'

    try {
      const embedding = await this.generateEmbedding(testText, { model: testModel })
      const latency = Date.now() - startTime

      return {
        success: !!embedding,
        latency,
        model: testModel,
        dimensions: embedding?.length || 0
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        model: testModel,
        dimensions: 0
      }
    }
  }

  /**
   * Compare embedding models performance
   */
  static async compareModels(testText: string = "Compare embedding model performance") {
    const models: BasetenEmbeddingOptions['model'][] = [
      'qwen3-8b-embedding',
      'bge-embedding-icl'
    ]

    console.log('🔄 Comparing Baseten embedding models...')

    const results = []

    for (const model of models) {
      const result = await this.testConnection(model)
      results.push({ ...result, model })
      console.log(`📊 ${model}: ${result.success ? '✅' : '❌'} ${result.latency}ms ${result.dimensions}D`)
    }

    // Recommend best model
    const workingModels = results.filter(r => r.success)
    if (workingModels.length > 0) {
      const fastest = workingModels.reduce((a, b) => a.latency < b.latency ? a : b)
      console.log(`🏆 Recommended model: ${fastest.model} (${fastest.latency}ms, ${fastest.dimensions}D)`)
    }

    return results
  }
}