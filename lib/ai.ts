import OpenAI from 'openai'
import { db } from "./database"
import { StyleAdapterService } from './style-adapter'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}

export interface Citation {
  videoTitle: string
  videoId: string
  startTime?: number
  endTime?: number
  content: string
}

export class AIReplicaService {
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      })
      return response.data[0].embedding
    } catch (error) {
      console.error('Error generating embedding:', error)
      throw error
    }
  }

  static async findRelevantContent(
    creatorId: string, 
    query: string, 
    limit: number = 5
  ): Promise<Array<{ chunk: any; similarity: number }>> {
    try {
      const queryEmbedding = await this.generateEmbedding(query)
      
      // For MVP, we'll use simple text matching. In production, use vector search
      const chunks = await db.contentChunk.findMany({
        where: {
          video: {
            creator_id: creatorId
          }
        },
        include: {
          video: true
        },
        take: 50
      })

      // Simple text-based relevance scoring for MVP
      const relevantChunks = chunks
        .map(chunk => {
          const similarity = this.calculateTextSimilarity(query.toLowerCase(), chunk.content.toLowerCase())
          return { chunk, similarity }
        })
        .filter(item => item.similarity > 0.1)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

      return relevantChunks
    } catch (error) {
      console.error('Error finding relevant content:', error)
      return []
    }
  }

  static calculateTextSimilarity(query: string, content: string): number {
    const queryWords = query.split(' ').filter(word => word.length > 2)
    const contentWords = content.split(' ')
    
    let matches = 0
    for (const queryWord of queryWords) {
      if (contentWords.some(contentWord => 
        contentWord.includes(queryWord) || queryWord.includes(contentWord)
      )) {
        matches++
      }
    }
    
    return matches / queryWords.length
  }

  static async generateResponse(
    creatorId: string,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<{ response: string; citations: Citation[] }> {
    try {
      const creator = await db.creator.findUnique({
        where: { id: creatorId },
        include: { user: true }
      })

      if (!creator) {
        throw new Error('Creator not found')
      }

      // Load AI configuration for this creator
      const aiConfig = await db.aiConfig.findUnique({
        where: { creatorId: creatorId }
      })

      const relevantContent = await this.findRelevantContent(creatorId, userMessage)
      
      const contextualInfo = relevantContent
        .map(({ chunk }) => 
          `From "${chunk.video.title}" (${this.formatTime(chunk.startTime)} - ${this.formatTime(chunk.endTime)}): ${chunk.content}`
        )
        .join('\n\n')

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
        if (aiConfig.catchphrases?.length) traits.push(`Catchphrases: ${aiConfig.catchphrases.join(', ')}`)
        if (traits.length > 0) {
          personalityTraits = `\n\nPersonality Configuration:\n${traits.join('\n')}`
        }
      }

      // Build base system prompt
      const baseSystemPrompt = `You are ${agentName}, ${agentIntro}. You should respond in their voice and personality based on their content and configured personality.

IMPORTANT RULES:
1. Only answer questions using information from the provided context
2. If you don't have relevant information in the context, politely say you don't have enough information about that topic
3. Always cite specific videos and timestamps when referencing information
4. Maintain the creator's personality and speaking style based on their content and configuration
5. Be helpful and engaging, just like the real creator would be

Creator Bio: ${creator.bio || 'No bio available'}${personalityTraits}

Relevant Content Context:
${contextualInfo}

If no relevant content is provided above, respond that you don't have information about that topic in your available content.`

      // Enhance prompt with AI Style Card if available
      const systemPrompt = await StyleAdapterService.generateChatPrompt(
        creatorId,
        baseSystemPrompt,
        agentName,
        agentIntro
      )

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ]

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      })

      const response = completion.choices[0]?.message?.content || 'I apologize, but I cannot generate a response right now.'

      const citations: Citation[] = relevantContent.map(({ chunk }) => ({
        videoTitle: chunk.video.title,
        videoId: chunk.video.youtubeId,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        content: chunk.content.substring(0, 200) + '...'
      }))

      return { response, citations }
    } catch (error) {
      console.error('Error generating AI response:', error)
      throw error
    }
  }

  static formatTime(seconds?: number): string {
    if (!seconds) return '0:00'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  static async processContentChunks(creatorId: string) {
    try {
      const chunks = await db.contentChunk.findMany({
        where: {
          video: { creator_id: creatorId },
          embedding: { isEmpty: true }
        },
        take: 100
      })

      for (const chunk of chunks) {
        try {
          const embedding = await this.generateEmbedding(chunk.content)
          // Note: contentChunk.update method needs to be implemented in database service
          console.log(`Generated embedding for chunk ${chunk.id}, but update method is not implemented`)
        } catch (error) {
          console.error(`Error processing chunk ${chunk.id}:`, error)
        }
      }
    } catch (error) {
      console.error('Error processing content chunks:', error)
    }
  }
}