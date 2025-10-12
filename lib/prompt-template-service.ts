/**
 * Unified Prompt Template Service
 * Production-ready prompt generation with speech patterns and AI configuration
 */

export interface PromptTemplateData {
  // Core Identity
  agentName: string
  agentIntro: string

  // Personality Traits (1-5 scale)
  directness: number
  humor: number
  empathy: number
  formality: number

  // Content Style
  sentenceLength: 'SHORT' | 'MEDIUM' | 'LONG'
  formatDefault: 'BULLETS' | 'PARAGRAPH' | 'MIXED'
  useEmojis: 'NEVER' | 'SOMETIMES' | 'OFTEN'

  // Signature Elements
  catchphrases: string[]
  avoidWords: string[]

  // Speech Patterns (from speech_analysis)
  signaturePhrases: Record<string, number>
  communicationMetrics: Record<string, number>

  // Tone & Style (from style_cards)
  toneDescription?: string
  responseStyle?: string

  // Content Boundaries
  redLines: string[]
  competitorPolicy: 'NEUTRAL' | 'SUPPORTIVE' | 'AVOID'

  // Context (dynamic)
  relevantContent: Array<{
    videoTitle: string
    timestamp: string
    content: string
    citationNumber: number
  }>
}

export class PromptTemplateService {
  /**
   * Generate complete system prompt with all configuration
   */
  static generateSystemPrompt(data: PromptTemplateData): string {
    const sections = [
      this.buildIdentitySection(data),
      this.buildPersonalitySection(data),
      this.buildContentStyleSection(data),
      this.buildSpeechPatternsSection(data),
      this.buildContentBoundariesSection(data),
      this.buildContentCitationsSection(data),
      this.buildResponseRulesSection(data),
      this.buildCitationRequirementsSection(data)
    ]

    return sections.filter(Boolean).join('\n\n')
  }

  /**
   * SECTION 1: Core Identity
   */
  private static buildIdentitySection(data: PromptTemplateData): string {
    return `You are ${data.agentName}, ${data.agentIntro}. You should respond in their voice and personality based on their content and configured personality.

IMPORTANT RULES:
1. Only answer questions using information from the provided context
2. If you don't have relevant information in the context, politely say you don't have enough information about that topic
3. Always cite specific videos and timestamps when referencing information
4. Maintain the creator's personality and speaking style based on their content and configuration
5. Be helpful and engaging, just like the real creator would be
6. Focus on practical advice and actionable insights`
  }

  /**
   * SECTION 2: Personality Configuration
   */
  private static buildPersonalitySection(data: PromptTemplateData): string {
    const traits = this.describePersonalityTraits(data)

    if (traits.length === 0) return ''

    return `Personality Configuration:
Directness level: ${data.directness}/5
Humor level: ${data.humor}/5
Empathy level: ${data.empathy}/5
Formality level: ${data.formality}/5

PERSONALITY: ${traits.join(', ')}.`
  }

  /**
   * SECTION 3: Content Style Preferences
   */
  private static buildContentStyleSection(data: PromptTemplateData): string {
    const styleRules: string[] = []

    // Sentence length
    switch (data.sentenceLength) {
      case 'SHORT':
        styleRules.push('Use short, punchy sentences (5-10 words when possible)')
        break
      case 'LONG':
        styleRules.push('Provide detailed explanations with longer sentences (20+ words)')
        break
      case 'MEDIUM':
        styleRules.push('Use medium-length sentences (10-20 words)')
        break
    }

    // Format preference
    switch (data.formatDefault) {
      case 'BULLETS':
        styleRules.push('Format responses using bullet points when listing information')
        break
      case 'PARAGRAPH':
        styleRules.push('Format responses in paragraph form')
        break
      case 'MIXED':
        styleRules.push('Mix paragraphs and bullet points as appropriate')
        break
    }

    // Emoji usage
    switch (data.useEmojis) {
      case 'NEVER':
        styleRules.push('Never use emojis')
        break
      case 'OFTEN':
        styleRules.push('Use emojis frequently to enhance expression')
        break
      case 'SOMETIMES':
        styleRules.push('Occasionally use emojis when they add value')
        break
    }

    if (styleRules.length === 0) return ''

    return `CONTENT STYLE: ${styleRules.join('. ')}.`
  }

  /**
   * SECTION 4: Speech Patterns & Signature Phrases
   */
  private static buildSpeechPatternsSection(data: PromptTemplateData): string {
    const sections: string[] = []

    // Signature phrases from speech analysis
    if (data.signaturePhrases && Object.keys(data.signaturePhrases).length > 0) {
      const phrases = Object.entries(data.signaturePhrases)
        .sort(([, a], [, b]) => b - a) // Sort by frequency
        .slice(0, 10) // Top 10 phrases
        .map(([phrase]) => `"${phrase}"`)

      sections.push(`SPEECH PATTERNS - Use these signature phrases naturally in your responses:
${phrases.map(p => `• ${p}`).join('\n')}`)
    }

    // Catchphrases from AI config
    if (data.catchphrases && data.catchphrases.length > 0) {
      const validPhrases = data.catchphrases.filter(p => p && p.trim())
      if (validPhrases.length > 0) {
        sections.push(`SIGNATURE CATCHPHRASES: ${validPhrases.map(p => `"${p}"`).join(', ')}`)
      }
    }

    // Tone description from style card
    if (data.toneDescription) {
      sections.push(`TONE: ${data.toneDescription}`)
    }

    // Response style from style card
    if (data.responseStyle) {
      sections.push(`RESPONSE STYLE: ${data.responseStyle}`)
    }

    // Authenticity reminder
    if (sections.length > 0) {
      sections.push(`AUTHENTICITY: Sound natural and genuine like ${data.agentName}. Incorporate the speech patterns above organically - don't force them, but use them when they fit naturally into your response.`)
    }

    return sections.join('\n\n')
  }

  /**
   * SECTION 5: Content Boundaries
   */
  private static buildContentBoundariesSection(data: PromptTemplateData): string {
    const sections: string[] = []

    // Avoid words
    if (data.avoidWords && data.avoidWords.length > 0) {
      const words = data.avoidWords.filter(w => w && w.trim())
      if (words.length > 0) {
        sections.push(`AVOID WORDS: Don't use these words/phrases: ${words.join(', ')}.`)
      }
    }

    // Red lines
    if (data.redLines && data.redLines.length > 0) {
      const boundaries = data.redLines.filter(r => r && r.trim())
      if (boundaries.length > 0) {
        sections.push(`CONTENT BOUNDARIES: Handle these topics carefully or redirect: ${boundaries.join(', ')}.`)
      }
    }

    // Competitor policy
    switch (data.competitorPolicy) {
      case 'SUPPORTIVE':
        sections.push('COMPETITOR MENTIONS: Be supportive when discussing competitors.')
        break
      case 'AVOID':
        sections.push('COMPETITOR MENTIONS: Avoid discussing competitors, redirect to your own content.')
        break
      case 'NEUTRAL':
        sections.push('COMPETITOR MENTIONS: Stay neutral and objective when competitors are mentioned.')
        break
    }

    return sections.join('\n\n')
  }

  /**
   * SECTION 6: Relevant Content Context
   */
  private static buildContentCitationsSection(data: PromptTemplateData): string {
    if (!data.relevantContent || data.relevantContent.length === 0) {
      return `Relevant Content Context:
If no relevant content is provided above, respond that you don't have information about that topic in your available content.`
    }

    const citations = data.relevantContent.map(item =>
      `[Source ${item.citationNumber}]:
Video: "${item.videoTitle}" (at ${item.timestamp})
Content: ${item.content}
---`
    ).join('\n\n')

    return `Relevant Content Context:
${citations}`
  }

  /**
   * SECTION 7: Response Rules
   */
  private static buildResponseRulesSection(data: PromptTemplateData): string {
    const citationCount = data.relevantContent?.length || 0

    if (citationCount === 0) {
      return ''
    }

    return `RESPONSE RULES:
- Build your response ONLY from the citations above
- You MUST use ALL ${citationCount} citations provided - do not skip any
- CRITICAL: When you reference [1], only use content from citation [1]. When you reference [2], only use content from citation [2], etc.
- NEVER mix content from one citation with a different citation number
- Use citations in sequential order: [1], [2], [3], [4], [5], etc. - no gaps or jumps
- Each citation [1]-[${citationCount}] must appear at least once in your response
- Double-check that the content you're describing matches the citation number you're using`
  }

  /**
   * SECTION 8: Citation Requirements
   */
  private static buildCitationRequirementsSection(data: PromptTemplateData): string {
    return `🔴 FINAL REMINDER - CITATION REQUIREMENTS:
- You MUST use numbered citations [1], [2], [3] when referencing content
- NEVER write "check out my video" or "in my video" - use [1] instead
- NEVER write video titles or descriptions - use numbered citations only
- Example: "Practice your serve consistently [1] and work on positioning [2]."
- This is MANDATORY - no exceptions!`
  }

  /**
   * Helper: Describe personality traits in natural language
   */
  private static describePersonalityTraits(data: PromptTemplateData): string[] {
    const traits: string[] = []

    // Directness
    if (data.directness <= 2) {
      traits.push('diplomatic and gentle in delivery')
    } else if (data.directness >= 4) {
      traits.push('direct and straightforward')
    } else if (data.directness === 3) {
      traits.push('balanced in directness')
    }

    // Humor
    if (data.humor <= 2) {
      traits.push('maintaining a serious, professional tone')
    } else if (data.humor >= 4) {
      traits.push('playful and using humor when appropriate')
    } else if (data.humor === 3) {
      traits.push('occasionally lighthearted')
    }

    // Empathy
    if (data.empathy <= 2) {
      traits.push('objective and factual')
    } else if (data.empathy >= 4) {
      traits.push('warm, understanding, and empathetic')
    } else if (data.empathy === 3) {
      traits.push('considerate and supportive')
    }

    // Formality
    if (data.formality <= 2) {
      traits.push('casual and friendly')
    } else if (data.formality >= 4) {
      traits.push('professional and formal')
    } else if (data.formality === 3) {
      traits.push('conversational yet respectful')
    }

    return traits
  }

  /**
   * Helper: Format speech patterns for display
   */
  static formatSpeechPatternsForDisplay(signaturePhrases: Record<string, number>): string[] {
    return Object.entries(signaturePhrases)
      .sort(([, a], [, b]) => b - a)
      .map(([phrase, count]) => `${phrase} (${count}×)`)
  }
}
