import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('*')
      .eq('creator_id', creator.id)
      .single()
    if (!aiConfig) {
      return NextResponse.json({ config: null })
    }

    // Transform database fields to client format
    const config = {
      // Identity & Framing
      agentName: aiConfig.agent_name,
      agentIntro: aiConfig.agent_intro,
      aiLabelStyle: aiConfig.ai_label_style,
      
      // Audience & Goals
      primaryAudiences: Array.isArray(aiConfig.primary_audiences) ? aiConfig.primary_audiences : [],
      topOutcomes: Array.isArray(aiConfig.top_outcomes) ? aiConfig.top_outcomes : [],
      ctaPreferences: Array.isArray(aiConfig.cta_preferences) ? aiConfig.cta_preferences : [],
      
      // Voice & Style
      directness: aiConfig.directness,
      humor: aiConfig.humor,
      empathy: aiConfig.empathy,
      formality: aiConfig.formality,
      spiciness: aiConfig.spiciness,
      
      // Content preferences
      sentenceLength: aiConfig.sentence_length,
      useRhetoricalQs: aiConfig.use_rhetorical_qs,
      formatDefault: aiConfig.format_default,
      maxBulletsPerAnswer: aiConfig.max_bullets_per_answer,
      useHeaders: aiConfig.use_headers,
      useEmojis: aiConfig.use_emojis,
      
      // Language & phrases
      goToVerbs: Array.isArray(aiConfig.go_to_verbs) ? aiConfig.go_to_verbs : [],
      catchphrases: Array.isArray(aiConfig.catchphrases) ? aiConfig.catchphrases : [],
      avoidWords: Array.isArray(aiConfig.avoid_words) ? aiConfig.avoid_words : [],
      openPatterns: Array.isArray(aiConfig.open_patterns) ? aiConfig.open_patterns : [],
      closePatterns: Array.isArray(aiConfig.close_patterns) ? aiConfig.close_patterns : [],
      
      // Content policy & safety
      sensitiveDomains: Array.isArray(aiConfig.sensitive_domains) ? aiConfig.sensitive_domains : [],
      redLines: Array.isArray(aiConfig.red_lines) ? aiConfig.red_lines : [],
      competitorPolicy: aiConfig.competitor_policy,
      misinfoHandling: aiConfig.misinfo_handling,
      
      // Evidence & citations
      citationPolicy: aiConfig.citation_policy,
      citationFormat: aiConfig.citation_format,
      recencyBias: aiConfig.recency_bias,
      
      // Answer patterns
      defaultTemplate: aiConfig.default_template,
      lengthLimit: aiConfig.length_limit,
      uncertaintyHandling: aiConfig.uncertainty_handling,
      followUpStyle: aiConfig.follow_up_style,
      
      // Multilingual
      supportedLanguages: Array.isArray(aiConfig.supported_languages) ? aiConfig.supported_languages : ['en'],
      translateDisplay: aiConfig.translate_display
    }

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Error fetching AI config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    const configData = await request.json()

    // Transform client data to database format
    const aiConfigData = {
      // Identity & Framing
      agent_name: configData.agentName || null,
      agent_intro: configData.agentIntro || null,
      ai_label_style: configData.aiLabelStyle || 'SUBTLE',
      
      // Audience & Goals
      primary_audiences: configData.primaryAudiences || [],
      top_outcomes: configData.topOutcomes || [],
      cta_preferences: configData.ctaPreferences || [],
      
      // Voice & Style
      directness: configData.directness || 3,
      humor: configData.humor || 3,
      empathy: configData.empathy || 3,
      formality: configData.formality || 3,
      spiciness: configData.spiciness || 3,
      
      // Content preferences
      sentence_length: configData.sentenceLength || 'MEDIUM',
      use_rhetorical_qs: configData.useRhetoricalQs || 'SOMETIMES',
      format_default: configData.formatDefault || 'BULLETS',
      max_bullets_per_answer: configData.maxBulletsPerAnswer || 5,
      use_headers: configData.useHeaders !== undefined ? configData.useHeaders : true,
      use_emojis: configData.useEmojis || 'SOMETIMES',
      
      // Language & phrases
      go_to_verbs: configData.goToVerbs ? configData.goToVerbs.filter(Boolean) : [],
      catchphrases: configData.catchphrases ? configData.catchphrases.filter(Boolean) : [],
      avoid_words: configData.avoidWords ? configData.avoidWords.filter(Boolean) : [],
      open_patterns: configData.openPatterns ? configData.openPatterns.filter(Boolean) : [],
      close_patterns: configData.closePatterns ? configData.closePatterns.filter(Boolean) : [],
      
      // Content policy & safety
      sensitive_domains: configData.sensitiveDomains || [],
      red_lines: configData.redLines || [],
      competitor_policy: configData.competitorPolicy || 'NEUTRAL',
      misinfo_handling: configData.misinfoHandling !== undefined ? configData.misinfoHandling : true,
      
      // Evidence & citations
      citation_policy: configData.citationPolicy || 'FACTUAL',
      citation_format: configData.citationFormat || 'INLINE',
      recency_bias: configData.recencyBias || 'BALANCED',
      
      // Answer patterns
      default_template: configData.defaultTemplate || 'STANCE_BULLETS',
      length_limit: configData.lengthLimit || 'MEDIUM',
      uncertainty_handling: configData.uncertaintyHandling || 'NEAREST',
      follow_up_style: configData.followUpStyle || 'ONE_QUESTION',
      
      // Multilingual
      supported_languages: configData.supportedLanguages || ['en'],
      translate_display: configData.translateDisplay !== undefined ? configData.translateDisplay : false
    }

    // Upsert AI configuration
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .upsert({
        creator_id: creator.id,
        ...aiConfigData
      })
      .select()
      .single()

    return NextResponse.json({ success: true, config: aiConfig })
  } catch (error) {
    console.error('Error saving AI config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}