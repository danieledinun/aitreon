import OpenAI from 'openai'
import { db } from './database'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface SuggestedQuestion {
  question: string
  category: string
  confidence: number
  basedOn: string[] // Video titles or topics this question is based on
}

export class SuggestedQuestionsGenerator {
  
  // Generate personalized suggested questions for a creator
  static async generateSuggestedQuestions(creatorId: string, count: number = 5): Promise<SuggestedQuestion[]> {
    try {
      console.log(`🔍 Generating ${count} suggested questions for creator ${creatorId}`)

      // Get creator info
      const creator = await db.creator.findUnique({
        where: { id: creatorId }
      })

      if (!creator) {
        console.error(`❌ Creator not found: ${creatorId}`)
        console.error('Cannot generate questions for non-existent creator')
        return this.getFallbackQuestions()
      }

      // Get recent video topics and titles
      const videos = await db.video.findMany({
        where: {
          creatorId: creatorId,
          isProcessed: true
        },
        orderBy: { publishedAt: 'desc' },
        take: 20 // Use recent videos
      })

      if (videos.length === 0) {
        console.warn('⚠️  PRODUCTION ISSUE: No processed videos found for creator:', creatorId)
        console.warn('Creator needs to sync their YouTube content before AI questions can be generated')
        console.warn('Using creator-specific fallback questions (better than generic, but not ideal)')
        return this.getCreatorSpecificFallback(creator)
      }

      // Get top knowledge chunks for context
      const chunks = await db.contentChunk.findMany({
        where: {
          video: { creator_id: creatorId }
        },
        orderBy: { created_at: 'desc' },
        take: 50 // Sample of recent chunks
      })

      console.log(`📊 Found ${videos.length} videos and ${chunks.length} knowledge chunks`)

      // Extract detailed expertise and topics
      const analysis = await this.extractTopicsAndExpertise(videos, chunks)
      console.log(`🎯 Extracted analysis:`, analysis)
      
      // Generate questions using AI with detailed context
      const questions = await this.generateQuestionsWithAI(creator, analysis, videos, count)

      console.log(`✅ Generated ${questions.length} personalized questions`)
      return questions

    } catch (error) {
      console.error('❌ Error generating suggested questions:', error)
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
      console.error(`Creator ID: ${creatorId}`)

      // Log the error to monitoring/alerting system if available
      // This indicates a critical failure in question generation
      return this.getFallbackQuestions()
    }
  }

  // Extract detailed expertise and topics from videos and chunks
  private static async extractTopicsAndExpertise(videos: any[], chunks: any[]): Promise<{
    topics: string[],
    expertise: string[],
    specificAreas: string[],
    commonQuestions: string[]
  }> {
    // Get more comprehensive content sample
    const videoTitles = videos.map(v => v.title).join('\n- ')
    const chunkContent = chunks
      .slice(0, 30) // More chunks for better analysis
      .map(c => c.content.substring(0, 300)) // More content per chunk
      .join('\n\n')

    const prompt = `Analyze this YouTube creator's content to understand their specific expertise and the types of questions their audience would ask:

VIDEO TITLES:
- ${videoTitles}

CONTENT SAMPLES:
${chunkContent}

Based on this content, identify:
1. SPECIFIC EXPERTISE AREAS (what they're known for, their specialties)
2. MAIN TOPICS they cover regularly
3. SPECIFIC DOMAINS/INDUSTRIES they focus on
4. COMMON AUDIENCE PAIN POINTS they address

Format response as JSON:
{
  "expertise": ["specific skill/area 1", "specific skill/area 2"],
  "topics": ["topic1", "topic2"],  
  "specificAreas": ["industry/domain 1", "industry/domain 2"],
  "commonQuestions": ["type of question they typically answer"]
}

Focus on SPECIFIC, ACTIONABLE areas rather than generic terms. Look for:
- Tools/platforms they mention
- Specific strategies/frameworks  
- Industry-specific knowledge
- Technical skills
- Methodologies they teach`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.2, // Lower temperature for more focused analysis
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('No analysis response')

      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const analysis = JSON.parse(cleanContent)

      return {
        topics: Array.isArray(analysis.topics) ? analysis.topics : [],
        expertise: Array.isArray(analysis.expertise) ? analysis.expertise : [],
        specificAreas: Array.isArray(analysis.specificAreas) ? analysis.specificAreas : [],
        commonQuestions: Array.isArray(analysis.commonQuestions) ? analysis.commonQuestions : []
      }
    } catch (error) {
      console.error('Error extracting topics and expertise:', error)
      // Fallback to basic topic extraction
      const basicTopics = this.extractBasicTopics(videos, chunks)
      return {
        topics: basicTopics,
        expertise: [],
        specificAreas: [],
        commonQuestions: []
      }
    }
  }

  // Fallback method for basic topic extraction
  private static extractBasicTopics(videos: any[], chunks: any[]): string[] {
    const text = videos.map(v => v.title).join(' ') + ' ' + 
                chunks.slice(0, 10).map(c => c.content.substring(0, 100)).join(' ')
    
    // Simple keyword extraction based on frequency
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4)
      .filter(word => !['video', 'watch', 'subscribe', 'channel', 'youtube', 'content'].includes(word))

    const frequency: Record<string, number> = {}
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1
    })

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([word]) => word)
  }

  // Generate questions using AI based on detailed creator analysis
  private static async generateQuestionsWithAI(
    creator: any, 
    analysis: {
      topics: string[],
      expertise: string[],
      specificAreas: string[],
      commonQuestions: string[]
    }, 
    videos: any[], 
    count: number
  ): Promise<SuggestedQuestion[]> {
    
    const recentVideoTitles = videos.slice(0, 8).map(v => v.title).join('\n- ')
    
    const prompt = `You are generating suggested questions for a YouTube creator's AI chat interface. Create ${count} HIGHLY SPECIFIC questions that their audience would actually ask based on their content.

CREATOR PROFILE:
Name: ${creator.display_name}
Bio: ${creator.bio || 'Content creator'}

DETAILED CONTENT ANALYSIS:
Specific Expertise Areas: ${analysis.expertise.join(', ')}
Main Topics: ${analysis.topics.join(', ')}
Industry/Domain Focus: ${analysis.specificAreas.join(', ')}
Common Question Types: ${analysis.commonQuestions.join(', ')}

RECENT VIDEO TITLES:
- ${recentVideoTitles}

REQUIREMENTS:
1. Questions must be SPECIFIC to their expertise (not generic advice)
2. Reference actual tools, frameworks, or methodologies they discuss
3. Address real pain points their audience faces
4. Be actionable and practical
5. Show deep understanding of their niche
6. KEEP QUESTIONS SHORT AND CONCISE (max 60 characters when possible)
7. Use direct, conversational language

AVOID generic questions like:
- "What's your advice for beginners?"
- "How did you get started?"
- "What's your biggest mistake?"

INSTEAD focus on:
- Specific strategies/frameworks they teach
- Tools/platforms they recommend  
- Industry-specific challenges they solve
- Technical implementations they explain
- Real scenarios their audience faces

EXAMPLE SHORT QUESTIONS:
- "Best temp for crispy wings?"
- "How to make Chick-fil-A sandwich?"
- "Frozen vs fresh fries cooking time?"

Format as JSON array:
[
  {
    "question": "Best temp for crispy wings?",
    "category": "air_fryer_tips", 
    "confidence": 0.95,
    "basedOn": ["Chicken Wings Recipe", "Crispy Techniques"]
  }
]

Make each question feel like it came from someone who watches their content regularly and needs specific, actionable guidance.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more focused questions
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('No response from AI')

      console.log('🤖 Raw AI response:', content)

      // Clean up the response (remove markdown formatting)
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const questions = JSON.parse(cleanContent)

      const processedQuestions = questions.map((q: any) => ({
        question: q.question,
        category: q.category || 'general',
        confidence: q.confidence || 0.8,
        basedOn: Array.isArray(q.basedOn) ? q.basedOn : []
      }))

      console.log('✅ Generated specific questions:', processedQuestions.map((q: any) => q.question))

      return processedQuestions

    } catch (error) {
      console.error('Error generating questions with AI:', error)
      console.error('Error details:', error)
      
      // Try to generate simpler questions as fallback
      return this.generateSimpleQuestions(creator, analysis, videos, count)
    }
  }

  // Fallback method for simpler question generation
  private static async generateSimpleQuestions(
    creator: any, 
    analysis: any, 
    videos: any[], 
    count: number
  ): Promise<SuggestedQuestion[]> {
    
    const topTopics = analysis.topics.slice(0, 3)
    const topExpertise = analysis.expertise.slice(0, 2)
    
    const simpleQuestions: SuggestedQuestion[] = []
    
    // Generate topic-based questions
    topTopics.forEach((topic: any) => {
      simpleQuestions.push({
        question: `What's your approach to ${topic}?`,
        category: topic.toLowerCase().replace(/\s+/g, '_'),
        confidence: 0.7,
        basedOn: videos.slice(0, 2).map(v => v.title)
      })
    })
    
    // Generate expertise-based questions  
    topExpertise.forEach((expertise: any) => {
      simpleQuestions.push({
        question: `Can you explain your ${expertise} methodology?`,
        category: 'methodology',
        confidence: 0.8,
        basedOn: videos.slice(0, 2).map(v => v.title)
      })
    })
    
    return simpleQuestions.slice(0, count)
  }

  // Get cached questions for a creator (to avoid regenerating every time)
  static async getCachedSuggestedQuestions(creatorId: string): Promise<SuggestedQuestion[]> {
    try {
      // Check if we have cached questions from today
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const cached = await db.creatorSuggestedQuestions.findFirst({
        where: {
          creatorId: creatorId
        }
      })

      if (cached && cached.questions) {
        console.log('✅ Using cached suggested questions')
        return JSON.parse(cached.questions as string)
      }

      // Generate new questions if no cache or old cache
      console.log('🔄 Generating fresh suggested questions')
      const questions = await this.generateSuggestedQuestions(creatorId)

      // Cache the results
      await db.creatorSuggestedQuestions.upsert({
        where: { creatorId: creatorId },
        update: {
          questions: JSON.stringify(questions)
        },
        create: {
          creator_id: creatorId,
          questions: JSON.stringify(questions)
        }
      })

      return questions

    } catch (error) {
      console.error('❌ Error getting cached questions:', error)
      return this.getFallbackQuestions()
    }
  }

  // Creator-specific fallback when no content is processed yet
  private static getCreatorSpecificFallback(creator: any): SuggestedQuestion[] {
    const name = creator.display_name
    const bio = creator.bio || ''
    
    return [
      {
        question: `What's ${name}'s approach to getting started in their field?`,
        category: "getting_started",
        confidence: 0.6,
        basedOn: [bio.substring(0, 50) + '...']
      },
      {
        question: `What does ${name} think are the biggest challenges in their industry?`,
        category: "challenges", 
        confidence: 0.6,
        basedOn: ['creator profile']
      },
      {
        question: `What tools or resources does ${name} recommend?`,
        category: "resources",
        confidence: 0.6,
        basedOn: ['creator profile']
      },
      {
        question: `How does ${name} stay current with industry trends?`,
        category: "learning",
        confidence: 0.6,
        basedOn: ['creator profile']
      },
      {
        question: `What's ${name}'s advice for scaling in their field?`,
        category: "scaling",
        confidence: 0.6,
        basedOn: ['creator profile']
      }
    ]
  }

  // Fallback questions when AI generation fails
  // IMPORTANT: We return an empty array instead of generic questions
  // Generic questions are NOT production-ready and don't relate to creator content
  private static getFallbackQuestions(): SuggestedQuestion[] {
    console.warn('⚠️  CRITICAL: getFallbackQuestions() called - AI generation failed!')
    console.warn('⚠️  This means suggested questions could not be generated from creator content')
    console.warn('⚠️  Returning empty array - creator should manually set questions or fix AI generation')

    // Return empty array - no questions is better than irrelevant generic questions
    return []
  }

  // Regenerate questions (useful for admin or periodic updates)
  static async refreshSuggestedQuestions(creatorId: string): Promise<SuggestedQuestion[]> {
    console.log(`🔄 Force refreshing suggested questions for creator ${creatorId}`)
    
    // Delete existing cache
    await db.creatorSuggestedQuestions.deleteMany({
      where: { creatorId: creatorId }
    })

    // Generate fresh questions
    return this.getCachedSuggestedQuestions(creatorId)
  }
}