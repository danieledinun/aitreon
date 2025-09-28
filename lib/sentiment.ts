interface SentimentResult {
  label: string
  score: number
}

interface SentimentAnalysisResponse {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  confidence: number
  rawResult: SentimentResult[]
}

export class SentimentAnalyzer {
  private apiKey: string
  private baseUrl = 'https://api-inference.huggingface.co/models/tabularisai/multilingual-sentiment-analysis'

  constructor() {
    this.apiKey = process.env.HF_TOKEN || ''
    if (!this.apiKey) {
      throw new Error('HF_TOKEN environment variable is required')
    }
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysisResponse> {
    if (!text || text.trim().length === 0) {
      return {
        sentiment: 'NEUTRAL',
        confidence: 0,
        rawResult: []
      }
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text.trim()
        })
      })

      if (!response.ok) {
        console.error('HuggingFace API error:', response.status, response.statusText)
        throw new Error(`HuggingFace API error: ${response.status}`)
      }

      const result = await response.json() as SentimentResult[]

      if (!Array.isArray(result) || result.length === 0) {
        console.warn('Invalid sentiment analysis result:', result)
        return {
          sentiment: 'NEUTRAL',
          confidence: 0,
          rawResult: []
        }
      }

      // Find the highest confidence result
      const topResult = result.reduce((prev, current) =>
        current.score > prev.score ? current : prev
      )

      // Map HuggingFace labels to our standardized format
      let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
      switch (topResult.label.toUpperCase()) {
        case 'POSITIVE':
          sentiment = 'POSITIVE'
          break
        case 'NEGATIVE':
          sentiment = 'NEGATIVE'
          break
        case 'NEUTRAL':
          sentiment = 'NEUTRAL'
          break
        default:
          // Handle potential variations in label naming
          if (topResult.label.toLowerCase().includes('pos')) {
            sentiment = 'POSITIVE'
          } else if (topResult.label.toLowerCase().includes('neg')) {
            sentiment = 'NEGATIVE'
          } else {
            sentiment = 'NEUTRAL'
          }
      }

      return {
        sentiment,
        confidence: Math.round(topResult.score * 100) / 100, // Round to 2 decimal places
        rawResult: result
      }

    } catch (error) {
      console.error('Error analyzing sentiment:', error)
      // Return neutral sentiment on error to avoid breaking the flow
      return {
        sentiment: 'NEUTRAL',
        confidence: 0,
        rawResult: []
      }
    }
  }

  async batchAnalyzeSentiment(texts: string[]): Promise<SentimentAnalysisResponse[]> {
    // Process in batches to avoid rate limits
    const batchSize = 10
    const results: SentimentAnalysisResponse[] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      // Process batch in parallel
      const batchPromises = batch.map(text => this.analyzeSentiment(text))
      const batchResults = await Promise.all(batchPromises)

      results.push(...batchResults)

      // Add small delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer()