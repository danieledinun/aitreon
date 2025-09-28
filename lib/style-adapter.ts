import { supabase } from './supabase'

export interface StyleCard {
  id: string
  creator_id: string
  style_card_text: string
  signature_phrases?: Record<string, number>
  communication_metrics?: {
    speaking_rate_wpm?: number
    avg_sentence_length?: number
    enthusiasm_ratio?: number
    instructional_ratio?: number
    pov_analysis?: {
      first_person_ratio?: number
      second_person_ratio?: number
      direct_address?: boolean
    }
  }
  ai_prompting_guidelines?: string
  is_active: boolean
  created_at: string
}

export interface ChatStyleAdaptation {
  signature_phrases: string[]
  speaking_patterns: string[]
  personality_notes: string[]
  tone_guidance: string
  response_style: string
}

export interface VoiceStyleAdaptation {
  speaking_pace: string
  emphasis_words: string[]
  vocal_patterns: string[]
  pronunciation_notes: string[]
  inflection_guidance: string
}

export class StyleAdapterService {
  /**
   * Get the active style card for a creator
   */
  static async getCreatorStyleCard(creatorId: string): Promise<StyleCard | null> {
    try {
      const { data: styleCard, error } = await supabase
        .from('style_cards')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !styleCard) {
        console.log(`No active style card found for creator ${creatorId}`)
        return null
      }

      return styleCard
    } catch (error) {
      console.error('Error fetching style card:', error)
      return null
    }
  }

  /**
   * Adapt style card content for chat AI prompting
   */
  static adaptForChat(styleCard: StyleCard): ChatStyleAdaptation {
    const signaturePhrases: string[] = []
    const speakingPatterns: string[] = []
    const personalityNotes: string[] = []

    // Extract signature phrases from the style card
    if (styleCard.signature_phrases) {
      const topPhrases = Object.entries(styleCard.signature_phrases)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([phrase]) => phrase)

      signaturePhrases.push(...topPhrases)
    }

    // Extract communication patterns from metrics
    if (styleCard.communication_metrics) {
      const metrics = styleCard.communication_metrics

      if (metrics.avg_sentence_length && metrics.avg_sentence_length < 10) {
        speakingPatterns.push('Uses short, concise sentences')
      } else if (metrics.avg_sentence_length && metrics.avg_sentence_length > 15) {
        speakingPatterns.push('Uses detailed, explanatory sentences')
      }

      if (metrics.enthusiasm_ratio && metrics.enthusiasm_ratio > 0.02) {
        personalityNotes.push('Highly enthusiastic and energetic')
      }

      if (metrics.instructional_ratio && metrics.instructional_ratio > 0.015) {
        personalityNotes.push('Teaching-oriented, explains step-by-step')
      }

      if (metrics.pov_analysis?.direct_address) {
        personalityNotes.push('Directly addresses audience with "you"')
      }

      if (metrics.pov_analysis?.first_person_ratio && metrics.pov_analysis.first_person_ratio > 0.03) {
        personalityNotes.push('Shares personal experiences and opinions')
      }
    }

    // Extract tone guidance from style card text
    let toneGuidance = 'conversational and authentic'
    if (styleCard.style_card_text.toLowerCase().includes('enthusiastic')) {
      toneGuidance = 'enthusiastic and energetic'
    } else if (styleCard.style_card_text.toLowerCase().includes('instructional')) {
      toneGuidance = 'instructional and helpful'
    } else if (styleCard.style_card_text.toLowerCase().includes('friendly')) {
      toneGuidance = 'friendly and approachable'
    }

    // Determine response style
    let responseStyle = 'natural conversation'
    if (styleCard.style_card_text.toLowerCase().includes('step-by-step')) {
      responseStyle = 'structured, step-by-step guidance'
    } else if (styleCard.style_card_text.toLowerCase().includes('casual')) {
      responseStyle = 'casual and relatable'
    }

    return {
      signature_phrases: signaturePhrases,
      speaking_patterns: speakingPatterns,
      personality_notes: personalityNotes,
      tone_guidance: toneGuidance,
      response_style: responseStyle
    }
  }

  /**
   * Adapt style card content for voice AI generation
   */
  static adaptForVoice(styleCard: StyleCard): VoiceStyleAdaptation {
    const emphasisWords: string[] = []
    const vocalPatterns: string[] = []
    const pronunciationNotes: string[] = []

    // Extract emphasis words from signature phrases
    if (styleCard.signature_phrases) {
      const topPhrases = Object.entries(styleCard.signature_phrases)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([phrase]) => phrase)

      emphasisWords.push(...topPhrases)
    }

    // Determine speaking pace from metrics
    let speakingPace = 'moderate pace'
    if (styleCard.communication_metrics?.speaking_rate_wpm) {
      const wpm = styleCard.communication_metrics.speaking_rate_wpm
      if (wpm < 150) {
        speakingPace = 'slow, deliberate pace'
      } else if (wpm > 200) {
        speakingPace = 'fast, energetic pace'
      } else {
        speakingPace = 'conversational pace'
      }
    }

    // Extract vocal patterns from communication style
    if (styleCard.communication_metrics) {
      const metrics = styleCard.communication_metrics

      if (metrics.enthusiasm_ratio && metrics.enthusiasm_ratio > 0.02) {
        vocalPatterns.push('Enthusiastic tone with energy variations')
        vocalPatterns.push('Occasional pitch elevation for excitement')
      }

      if (metrics.instructional_ratio && metrics.instructional_ratio > 0.015) {
        vocalPatterns.push('Clear, teaching-style delivery')
        vocalPatterns.push('Pause between key points for emphasis')
      }

      if (metrics.avg_sentence_length && metrics.avg_sentence_length < 10) {
        vocalPatterns.push('Natural pauses between short phrases')
      }
    }

    // Add pronunciation notes for signature phrases
    if (emphasisWords.includes("i'm gonna")) {
      pronunciationNotes.push("Pronounce 'gonna' as /ˈɡənə/ (casual contraction)")
    }
    if (emphasisWords.includes("super easy")) {
      pronunciationNotes.push("Emphasize 'super' with slight stress")
    }
    if (emphasisWords.includes("all right")) {
      pronunciationNotes.push("'All right' as transition phrase with falling tone")
    }

    // Determine inflection guidance
    let inflectionGuidance = 'natural conversational inflection'
    if (styleCard.style_card_text.toLowerCase().includes('enthusiastic')) {
      inflectionGuidance = 'upward inflection for enthusiasm, varied pitch'
    } else if (styleCard.style_card_text.toLowerCase().includes('instructional')) {
      inflectionGuidance = 'clear, explanatory tone with emphasis on key words'
    }

    return {
      speaking_pace: speakingPace,
      emphasis_words: emphasisWords,
      vocal_patterns: vocalPatterns,
      pronunciation_notes: pronunciationNotes,
      inflection_guidance: inflectionGuidance
    }
  }

  /**
   * Generate enhanced chat prompt with style adaptation
   */
  static async generateChatPrompt(
    creatorId: string,
    basePrompt: string,
    agentName: string,
    agentIntro: string
  ): Promise<string> {
    const styleCard = await this.getCreatorStyleCard(creatorId)

    if (!styleCard) {
      return basePrompt
    }

    const chatStyle = this.adaptForChat(styleCard)

    // Build enhanced prompt with style elements
    let enhancedPrompt = basePrompt

    // Add signature phrases guidance
    if (chatStyle.signature_phrases.length > 0) {
      enhancedPrompt += `\n\nSPEECH PATTERNS - Use these signature phrases naturally in your responses:
${chatStyle.signature_phrases.map(phrase => `• "${phrase}"`).join('\n')}`
    }

    // Add speaking patterns
    if (chatStyle.speaking_patterns.length > 0) {
      enhancedPrompt += `\n\nCOMMUNICATION STYLE:
${chatStyle.speaking_patterns.map(pattern => `• ${pattern}`).join('\n')}`
    }

    // Add personality notes
    if (chatStyle.personality_notes.length > 0) {
      enhancedPrompt += `\n\nPERSONALITY TRAITS:
${chatStyle.personality_notes.map(note => `• ${note}`).join('\n')}`
    }

    // Add tone and response style guidance
    enhancedPrompt += `\n\nTONE: Maintain a ${chatStyle.tone_guidance} tone throughout your responses.`
    enhancedPrompt += `\nRESPONSE STYLE: Structure your answers in a ${chatStyle.response_style} format.`

    // Add authenticity reminder
    enhancedPrompt += `\n\nAUTHENTICITY: Sound natural and genuine like ${agentName}. Incorporate the speech patterns above organically - don't force them, but use them when they fit naturally into your response.`

    // CRITICAL: Reinforce citation requirements at the end
    enhancedPrompt += `\n\n🔴 FINAL REMINDER - CITATION REQUIREMENTS:
- You MUST use numbered citations [1], [2], [3] when referencing content
- NEVER write "check out my video" or "in my video" - use [1] instead
- NEVER write video titles or descriptions - use numbered citations only
- Example: "Practice your serve consistently [1] and work on positioning [2]."
- This is MANDATORY - no exceptions!`

    return enhancedPrompt
  }

  /**
   * Generate enhanced voice prompt with style adaptation
   */
  static async generateVoicePrompt(
    creatorId: string,
    textToSpeak: string
  ): Promise<{ enhancedText: string; voiceSettings: any }> {
    const styleCard = await this.getCreatorStyleCard(creatorId)

    if (!styleCard) {
      return {
        enhancedText: textToSpeak,
        voiceSettings: {}
      }
    }

    const voiceStyle = this.adaptForVoice(styleCard)

    // Enhance text with pronunciation and emphasis markers
    let enhancedText = textToSpeak

    // Add emphasis markers for signature phrases
    for (const phrase of voiceStyle.emphasis_words) {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      enhancedText = enhancedText.replace(regex, `<emphasis level="strong">${phrase}</emphasis>`)
    }

    // Add pause markers for instructional content
    if (voiceStyle.vocal_patterns.some(pattern => pattern.includes('teaching'))) {
      enhancedText = enhancedText.replace(/\. /g, '. <break time="0.5s"/> ')
    }

    // Generate voice settings based on style
    const voiceSettings = {
      stability: 0.75, // Stable but natural
      similarity_boost: 0.8, // High similarity to original voice
      speaking_rate: voiceStyle.speaking_pace.includes('fast') ? 1.1 :
                    voiceStyle.speaking_pace.includes('slow') ? 0.9 : 1.0,
      pitch_variation: voiceStyle.vocal_patterns.some(p => p.includes('enthusiasm')) ? 1.2 : 1.0
    }

    return {
      enhancedText,
      voiceSettings
    }
  }

  /**
   * Update AI config with style card reference
   */
  static async updateAiConfigWithStyleCard(creatorId: string, styleCardId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_config')
        .upsert({
          creator_id: creatorId,
          style_card_id: styleCardId,
          style_enabled: true,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error updating AI config with style card:', error)
      } else {
        console.log(`✅ Updated AI config for creator ${creatorId} with style card ${styleCardId}`)
      }
    } catch (error) {
      console.error('Error updating AI config:', error)
    }
  }
}