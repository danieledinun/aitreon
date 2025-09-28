import OpenAI from 'openai'
import { db } from "./database"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface SpeechPatterns {
  catchphrases: string[]
  openingPatterns: string[]
  closingPatterns: string[]
  goToVerbs: string[]
  avoidWords: string[]
  speakingStyle: {
    sentenceStructure: string
    energyLevel: string
    tonality: string
    pacing: string
  }
}

export interface AnalysisResult {
  patterns: SpeechPatterns
  confidence: number
  totalWords: number
  videosAnalyzed: number
}

export class SpeechPatternAnalyzer {
  // Analyze creator's speaking patterns from their video transcripts
  static async analyzeCreatorSpeechPatterns(creatorId: string): Promise<AnalysisResult | null> {
    try {
      console.log(`🎯 Analyzing speech patterns for creator ${creatorId}`)

      // Get processed videos with transcripts
      const videos = await db.video.findMany({
        where: {
          creatorId,
          isProcessed: true,
          transcript: { not: null }
        },
        select: {
          id: true,
          title: true,
          transcript: true,
          publishedAt: true
        },
        orderBy: { publishedAt: 'desc' },
        take: 10 // Analyze most recent 10 videos
      })

      if (videos.length === 0) {
        console.log('❌ No processed videos with transcripts found')
        return null
      }

      console.log(`📹 Analyzing ${videos.length} videos...`)

      // Extract text content from all transcripts
      const allTranscripts = videos
        .map(video => video.transcript)
        .filter(Boolean)
        .join('\n\n--- NEW VIDEO ---\n\n')

      const totalWords = allTranscripts.split(' ').length
      console.log(`📊 Total words to analyze: ${totalWords}`)

      // Analyze speech patterns using AI
      const patterns = await this.extractSpeechPatternsWithAI(allTranscripts, videos.map(v => v.title))

      const result: AnalysisResult = {
        patterns,
        confidence: this.calculateConfidence(videos.length, totalWords),
        totalWords,
        videosAnalyzed: videos.length
      }

      console.log(`✅ Speech pattern analysis complete:`)
      console.log(`   • Catchphrases: ${patterns.catchphrases.length}`)
      console.log(`   • Opening patterns: ${patterns.openingPatterns.length}`)
      console.log(`   • Closing patterns: ${patterns.closingPatterns.length}`)
      console.log(`   • Go-to verbs: ${patterns.goToVerbs.length}`)
      console.log(`   • Confidence: ${result.confidence}%`)

      return result

    } catch (error) {
      console.error('❌ Error analyzing speech patterns:', error)
      return null
    }
  }

  // Use AI to extract speech patterns from transcripts
  private static async extractSpeechPatternsWithAI(transcripts: string, videoTitles: string[]): Promise<SpeechPatterns> {
    const prompt = `You are a linguistic analyst specializing in creator speech patterns. Analyze the following video transcripts from a content creator and extract their unique speaking style patterns.

VIDEO TITLES FOR CONTEXT:
${videoTitles.map((title, i) => `${i + 1}. ${title}`).join('\n')}

TRANSCRIPTS:
${transcripts.substring(0, 15000)} ${transcripts.length > 15000 ? '[TRUNCATED]' : ''}

Extract the following speech patterns in JSON format:

{
  "catchphrases": [
    // Signature phrases this creator uses repeatedly (3-10 words each)
    // Examples: "What's up guys!", "Let's dive right in", "That being said"
  ],
  "openingPatterns": [
    // How they typically start videos/segments (2-8 words)
    // Examples: "Hey everyone", "So today we're going to", "Alright guys"
  ],
  "closingPatterns": [
    // How they end videos/segments (2-8 words) 
    // Examples: "Thanks for watching", "See you next time", "Peace out"
  ],
  "goToVerbs": [
    // Verbs and adjectives they use frequently
    // Examples: "amazing", "incredible", "let's dive", "check out"
  ],
  "avoidWords": [
    // Words that seem absent from their vocabulary (technical terms they avoid, overly formal words, etc.)
    // Examples: "utilize" (if they say "use"), "purchase" (if they say "buy")
  ],
  "speakingStyle": {
    "sentenceStructure": "short and punchy" | "long and detailed" | "mixed with emphasis",
    "energyLevel": "high" | "moderate" | "calm" | "variable",
    "tonality": "conversational" | "educational" | "entertaining" | "professional",
    "pacing": "fast" | "moderate" | "slow" | "variable"
  }
}

IMPORTANT GUIDELINES:
- Only include patterns that appear multiple times across different videos
- Focus on authentic, natural phrases this creator actually uses
- Catchphrases should be distinctive to this creator's style
- Avoid generic phrases everyone uses
- Opening/closing patterns should be specific to how THIS creator starts/ends
- Go-to verbs should reflect their preferred vocabulary choices
- Avoid words should be words they consistently don't use (not just missing words)
- Base speakingStyle on overall patterns across all transcripts

Return only the JSON object, no additional text.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent analysis
      })

      const content = response.choices[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('No response from AI')
      }

      // Parse the JSON response - handle markdown formatting
      let jsonContent = content
      if (content.startsWith('```json')) {
        jsonContent = content.replace(/```json\s*/, '').replace(/\s*```$/, '')
      } else if (content.startsWith('```')) {
        jsonContent = content.replace(/```\s*/, '').replace(/\s*```$/, '')
      }
      
      const patterns = JSON.parse(jsonContent) as SpeechPatterns
      
      // Validate the structure
      this.validatePatterns(patterns)
      
      return patterns

    } catch (error) {
      console.error('❌ Error extracting patterns with AI:', error)
      // Return default structure if AI fails
      return {
        catchphrases: [],
        openingPatterns: [],
        closingPatterns: [],
        goToVerbs: [],
        avoidWords: [],
        speakingStyle: {
          sentenceStructure: 'mixed with emphasis',
          energyLevel: 'moderate',
          tonality: 'conversational',
          pacing: 'moderate'
        }
      }
    }
  }

  // Validate extracted patterns structure
  private static validatePatterns(patterns: SpeechPatterns): void {
    const requiredFields = ['catchphrases', 'openingPatterns', 'closingPatterns', 'goToVerbs', 'avoidWords', 'speakingStyle']
    
    for (const field of requiredFields) {
      if (!(field in patterns)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // Validate arrays
    const arrayFields = ['catchphrases', 'openingPatterns', 'closingPatterns', 'goToVerbs', 'avoidWords']
    for (const field of arrayFields) {
      if (!Array.isArray(patterns[field as keyof SpeechPatterns])) {
        throw new Error(`Field ${field} must be an array`)
      }
    }

    // Validate speakingStyle
    if (typeof patterns.speakingStyle !== 'object') {
      throw new Error('speakingStyle must be an object')
    }
  }

  // Calculate confidence score based on data volume
  private static calculateConfidence(videoCount: number, totalWords: number): number {
    let confidence = 0

    // Video count contribution (0-40 points)
    if (videoCount >= 10) confidence += 40
    else if (videoCount >= 5) confidence += 30
    else if (videoCount >= 3) confidence += 20
    else confidence += 10

    // Word count contribution (0-40 points) 
    if (totalWords >= 50000) confidence += 40
    else if (totalWords >= 25000) confidence += 30
    else if (totalWords >= 10000) confidence += 20
    else confidence += 10

    // Base analysis quality (0-20 points)
    confidence += 20

    return Math.min(confidence, 100)
  }

  // Auto-update AI configuration with extracted patterns
  static async updateAIConfigWithSpeechPatterns(creatorId: string, patterns: SpeechPatterns): Promise<boolean> {
    try {
      console.log(`🔄 Updating AI config with extracted speech patterns...`)

      // Get existing AI config or create new one
      const aiConfig = await db.aiConfig.upsert({
        where: { creatorId },
        update: {
          catchphrases: JSON.stringify(patterns.catchphrases),
          openPatterns: JSON.stringify(patterns.openingPatterns),
          closePatterns: JSON.stringify(patterns.closingPatterns),
          goToVerbs: JSON.stringify(patterns.goToVerbs),
          avoidWords: JSON.stringify(patterns.avoidWords),
          // Update sentence length based on speaking style
          sentenceLength: patterns.speakingStyle.sentenceStructure.includes('short') ? 'SHORT' :
                          patterns.speakingStyle.sentenceStructure.includes('long') ? 'LONG' : 'MEDIUM'
        },
        create: {
          creatorId,
          catchphrases: JSON.stringify(patterns.catchphrases),
          openPatterns: JSON.stringify(patterns.openingPatterns),
          closePatterns: JSON.stringify(patterns.closingPatterns),
          goToVerbs: JSON.stringify(patterns.goToVerbs),
          avoidWords: JSON.stringify(patterns.avoidWords),
          sentenceLength: patterns.speakingStyle.sentenceStructure.includes('short') ? 'SHORT' :
                          patterns.speakingStyle.sentenceStructure.includes('long') ? 'LONG' : 'MEDIUM'
        }
      })

      console.log(`✅ AI config updated with speech patterns`)
      return true

    } catch (error) {
      console.error('❌ Error updating AI config:', error)
      return false
    }
  }

  // Get speech pattern analysis for a creator (cached result)
  static async getSpeechPatterns(creatorId: string): Promise<SpeechPatterns | null> {
    try {
      const aiConfig = await db.aiConfig.findUnique({
        where: { creatorId }
      })

      if (!aiConfig) return null

      return {
        catchphrases: aiConfig.catchphrases ? JSON.parse(aiConfig.catchphrases) : [],
        openingPatterns: aiConfig.openPatterns ? JSON.parse(aiConfig.openPatterns) : [],
        closingPatterns: aiConfig.closePatterns ? JSON.parse(aiConfig.closePatterns) : [],
        goToVerbs: aiConfig.goToVerbs ? JSON.parse(aiConfig.goToVerbs) : [],
        avoidWords: aiConfig.avoidWords ? JSON.parse(aiConfig.avoidWords) : [],
        speakingStyle: {
          sentenceStructure: aiConfig.sentenceLength === 'SHORT' ? 'short and punchy' :
                            aiConfig.sentenceLength === 'LONG' ? 'long and detailed' : 'mixed with emphasis',
          energyLevel: 'moderate', // Could be enhanced later
          tonality: 'conversational', // Could be enhanced later  
          pacing: 'moderate' // Could be enhanced later
        }
      }
    } catch (error) {
      console.error('❌ Error getting speech patterns:', error)
      return null
    }
  }
}