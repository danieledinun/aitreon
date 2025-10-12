/**
 * Unified Prompt Service
 * Loads creator data from database and generates production-ready prompts
 */

import { supabase } from './supabase'
import { PromptTemplateService, type PromptTemplateData } from './prompt-template-service'

export interface CreatorPromptConfig {
  creatorId: string
  creatorName: string
  relevantContent?: Array<{
    videoTitle: string
    timestamp: string
    content: string
    citationNumber: number
  }>
}

export class UnifiedPromptService {
  /**
   * Generate complete system prompt for a creator
   * Loads all configuration from database and uses template service
   */
  static async generateCreatorPrompt(config: CreatorPromptConfig): Promise<string> {
    // Load creator data from database
    const promptData = await this.loadCreatorData(config.creatorId, config.creatorName)

    // Add dynamic relevant content
    if (config.relevantContent) {
      promptData.relevantContent = config.relevantContent
    }

    // Generate prompt using template service
    return PromptTemplateService.generateSystemPrompt(promptData)
  }

  /**
   * Load all creator configuration from database
   */
  private static async loadCreatorData(
    creatorId: string,
    fallbackName: string
  ): Promise<PromptTemplateData> {
    // Load AI config
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('*')
      .eq('creator_id', creatorId)
      .single()

    // Load speech patterns
    const { data: speechAnalysis } = await supabase
      .from('speech_analysis')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Load style card
    const { data: styleCard } = await supabase
      .from('style_cards')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('is_active', true)
      .single()

    // Build template data
    return {
      // Core Identity
      agentName: aiConfig?.agent_name || fallbackName,
      agentIntro: aiConfig?.agent_intro || `a content creator named ${fallbackName}`,

      // Personality Traits (1-5 scale)
      directness: aiConfig?.directness || 3,
      humor: aiConfig?.humor || 3,
      empathy: aiConfig?.empathy || 3,
      formality: aiConfig?.formality || 3,

      // Content Style
      sentenceLength: (aiConfig?.sentence_length as 'SHORT' | 'MEDIUM' | 'LONG') || 'MEDIUM',
      formatDefault: (aiConfig?.format_default as 'BULLETS' | 'PARAGRAPH' | 'MIXED') || 'BULLETS',
      useEmojis: (aiConfig?.use_emojis as 'NEVER' | 'SOMETIMES' | 'OFTEN') || 'SOMETIMES',

      // Signature Elements from AI config
      catchphrases: this.parseJsonArray(aiConfig?.catchphrases),
      avoidWords: this.parseJsonArray(aiConfig?.avoid_words),

      // Speech Patterns from speech_analysis
      signaturePhrases: speechAnalysis?.signature_phrases || {},
      communicationMetrics: speechAnalysis?.communication_metrics || {},

      // Tone & Style from style_cards
      toneDescription: this.extractToneDescription(styleCard),
      responseStyle: this.extractResponseStyle(styleCard),

      // Content Boundaries
      redLines: this.parseJsonArray(aiConfig?.red_lines),
      competitorPolicy: (aiConfig?.competitor_policy as 'NEUTRAL' | 'SUPPORTIVE' | 'AVOID') || 'NEUTRAL',

      // Relevant Content (will be set dynamically)
      relevantContent: []
    }
  }

  /**
   * Parse JSON array fields safely
   */
  private static parseJsonArray(value: any): string[] {
    if (!value) return []
    if (Array.isArray(value)) return value.filter((v: any) => v && typeof v === 'string' && v.trim())
    return []
  }

  /**
   * Extract tone description from style card
   */
  private static extractToneDescription(styleCard: any): string | undefined {
    if (!styleCard) return undefined

    // Look for tone in AI prompting guidelines or style card text
    const text = styleCard.style_card_text || ''

    // Extract tone section from markdown
    const toneMatch = text.match(/\*\*Tone & Personality:\*\*\n([\s\S]*?)(?=\n\*\*|$)/)
    if (toneMatch && toneMatch[1]) {
      const toneLines = toneMatch[1]
        .split('\n')
        .filter((line: string) => line.trim().startsWith('•'))
        .map((line: string) => line.replace(/^•\s*/, '').trim())
        .filter(Boolean)

      if (toneLines.length > 0) {
        return `Maintain a ${toneLines.join(', ').toLowerCase()} tone throughout your responses.`
      }
    }

    return undefined
  }

  /**
   * Extract response style from style card
   */
  private static extractResponseStyle(styleCard: any): string | undefined {
    if (!styleCard) return undefined

    const text = styleCard.style_card_text || ''

    // Look for communication style or response approach
    const styleMatch = text.match(/\*\*Communication Style:\*\*\n([\s\S]*?)(?=\n\*\*|$)/)
    if (styleMatch && styleMatch[1]) {
      const styleLines = styleMatch[1]
        .split('\n')
        .filter((line: string) => line.trim().startsWith('•'))
        .map((line: string) => line.replace(/^•\s*/, '').trim())
        .filter(Boolean)

      if (styleLines.length > 0) {
        return `Structure your answers in a ${styleLines[0].toLowerCase()} format.`
      }
    }

    return undefined
  }

  /**
   * Generate prompt for debugging/preview (admin use)
   */
  static async generateDebugPrompt(
    creatorId: string,
    creatorName: string,
    sampleQuery: string,
    sampleContext: string
  ): Promise<string> {
    // If creator name not provided, load from database
    if (!creatorName) {
      const { data: creator } = await supabase
        .from('creators')
        .select('display_name')
        .eq('id', creatorId)
        .single()

      creatorName = creator?.display_name || 'Creator'
    }

    // Parse sample context into citations
    const contextLines = sampleContext.split('\n\n').filter(Boolean)
    const relevantContent = contextLines.map((block, index) => {
      // Try to extract video title and content
      const videoMatch = block.match(/Video:\s*"([^"]+)"\s*\(([^)]+)\)/)
      const contentMatch = block.match(/Content:\s*(.+)$/s)

      return {
        videoTitle: videoMatch ? videoMatch[1] : 'Sample Video',
        timestamp: videoMatch ? videoMatch[2] : '0:00',
        content: contentMatch ? contentMatch[1].trim() : block,
        citationNumber: index + 1
      }
    })

    return this.generateCreatorPrompt({
      creatorId,
      creatorName,
      relevantContent
    })
  }
}
