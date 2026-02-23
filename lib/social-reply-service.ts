import OpenAI from 'openai'
import { supabase } from './supabase'
import { StyleAdapterService } from './style-adapter'
import {
  SocialReplySettings,
  SocialComment,
  SocialReplyAnalytics,
  CommentStatus,
  mapSettingsFromDb,
  mapCommentFromDb,
} from './types/social'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export class SocialReplyService {
  /**
   * Generate a short-form YouTube reply using the creator's AI twin personality
   */
  static async generateReply(
    creatorId: string,
    commentText: string,
    videoTitle?: string
  ): Promise<string> {
    // Load creator info
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, bio')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      throw new Error('Creator not found')
    }

    // Load AI config for personality
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('*')
      .eq('creator_id', creatorId)
      .single()

    // Load reply settings for tone/length constraints
    const { data: settingsRow } = await supabase
      .from('social_reply_settings')
      .select('tone_override, max_reply_length')
      .eq('creator_id', creatorId)
      .single()

    const toneOverride = settingsRow?.tone_override || 'default'
    const maxLength = settingsRow?.max_reply_length || 300

    // Build personality traits
    const traits: string[] = []
    if (aiConfig) {
      if (aiConfig.directness) traits.push(`Directness: ${aiConfig.directness}/5`)
      if (aiConfig.humor) traits.push(`Humor: ${aiConfig.humor}/5`)
      if (aiConfig.empathy) traits.push(`Empathy: ${aiConfig.empathy}/5`)
      if (aiConfig.formality) traits.push(`Formality: ${aiConfig.formality}/5`)
      if (aiConfig.catchphrases?.length) traits.push(`Catchphrases: ${aiConfig.catchphrases.join(', ')}`)
    }

    const toneInstruction = toneOverride !== 'default'
      ? `Tone: ${toneOverride}.`
      : ''

    const agentName = aiConfig?.agent_name || creator.display_name

    let systemPrompt = `You are ${agentName}, a YouTube creator replying to a comment on your video.

RULES:
- Reply in 1-3 sentences. Keep it under ${maxLength} characters.
- Sound natural and human — like a real YouTube creator reply.
- No citations, no links, no hashtags, no emojis unless they fit your style.
- Be warm, appreciative, and engaging.
- If the comment is a question, give a brief helpful answer.
- If it's praise, thank them genuinely.
- If it's constructive feedback, acknowledge it graciously.
- Never be defensive or confrontational.
${toneInstruction}

Creator Bio: ${creator.bio || 'A YouTube content creator'}
${traits.length > 0 ? `\nPersonality:\n${traits.join('\n')}` : ''}`

    // Enhance with style card if available
    systemPrompt = await StyleAdapterService.generateSocialReplyPrompt(
      creatorId,
      systemPrompt,
      agentName
    )

    const userPrompt = videoTitle
      ? `Video: "${videoTitle}"\nComment: "${commentText}"\n\nReply:`
      : `Comment: "${commentText}"\n\nReply:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 150,
    })

    const reply = completion.choices[0]?.message?.content?.trim() || ''

    // Ensure reply is within length limit
    if (reply.length > maxLength) {
      return reply.substring(0, maxLength - 3) + '...'
    }

    return reply
  }

  /**
   * Get auto-reply settings for a creator
   */
  static async getSettings(creatorId: string): Promise<SocialReplySettings | null> {
    const { data, error } = await supabase
      .from('social_reply_settings')
      .select('*')
      .eq('creator_id', creatorId)
      .single()

    if (error || !data) return null
    return mapSettingsFromDb(data)
  }

  /**
   * Update auto-reply settings (upsert)
   */
  static async updateSettings(
    creatorId: string,
    settings: Partial<Omit<SocialReplySettings, 'id' | 'creatorId' | 'createdAt' | 'updatedAt'>>
  ): Promise<SocialReplySettings> {
    // Map camelCase to snake_case for DB
    const dbFields: Record<string, unknown> = {
      creator_id: creatorId,
      updated_at: new Date().toISOString(),
    }

    if (settings.isEnabled !== undefined) dbFields.is_enabled = settings.isEnabled
    if (settings.platform !== undefined) dbFields.platform = settings.platform
    if (settings.maxRepliesPerDay !== undefined) dbFields.max_replies_per_day = settings.maxRepliesPerDay
    if (settings.minDelaySeconds !== undefined) dbFields.min_delay_seconds = settings.minDelaySeconds
    if (settings.maxDelaySeconds !== undefined) dbFields.max_delay_seconds = settings.maxDelaySeconds
    if (settings.toneOverride !== undefined) dbFields.tone_override = settings.toneOverride
    if (settings.maxReplyLength !== undefined) dbFields.max_reply_length = settings.maxReplyLength
    if (settings.filterKeywords !== undefined) dbFields.filter_keywords = settings.filterKeywords
    if (settings.requireKeywords !== undefined) dbFields.require_keywords = settings.requireKeywords
    if (settings.skipNegative !== undefined) dbFields.skip_negative = settings.skipNegative
    if (settings.videoFilter !== undefined) dbFields.video_filter = settings.videoFilter
    if (settings.videoIds !== undefined) dbFields.video_ids = settings.videoIds
    if (settings.recentDays !== undefined) dbFields.recent_days = settings.recentDays

    const { data, error } = await supabase
      .from('social_reply_settings')
      .upsert(dbFields, { onConflict: 'creator_id' })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to update settings: ${error.message}`)
    return mapSettingsFromDb(data)
  }

  /**
   * Get comments for a creator with optional filters
   */
  static async getComments(
    creatorId: string,
    options: { status?: CommentStatus; limit?: number; offset?: number } = {}
  ): Promise<SocialComment[]> {
    const { status, limit = 50, offset = 0 } = options

    let query = supabase
      .from('social_comments')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch comments: ${error.message}`)
    return (data || []).map(mapCommentFromDb)
  }

  /**
   * Get today's reply count for a creator
   */
  static async getTodayReplyCount(creatorId: string): Promise<number> {
    const { data } = await supabase
      .from('social_platform_sessions')
      .select('replies_posted_today')
      .eq('creator_id', creatorId)
      .single()

    return data?.replies_posted_today || 0
  }

  /**
   * Get analytics summary for a creator
   */
  static async getAnalytics(creatorId: string): Promise<SocialReplyAnalytics> {
    // Total comments
    const { count: totalComments } = await supabase
      .from('social_comments')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)

    // Total posted replies
    const { count: totalReplies } = await supabase
      .from('social_comments')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('status', 'posted')

    // Pending replies
    const { count: pendingReplies } = await supabase
      .from('social_comments')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .in('status', ['pending', 'generating', 'ready'])

    // Failed replies
    const { count: failedReplies } = await supabase
      .from('social_comments')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('status', 'failed')

    // Skipped replies
    const { count: skippedReplies } = await supabase
      .from('social_comments')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('status', 'skipped')

    // Session info
    const { data: session } = await supabase
      .from('social_platform_sessions')
      .select('session_status, last_poll_at, replies_posted_today')
      .eq('creator_id', creatorId)
      .single()

    return {
      totalComments: totalComments || 0,
      totalReplies: totalReplies || 0,
      repliesPostedToday: session?.replies_posted_today || 0,
      pendingReplies: pendingReplies || 0,
      failedReplies: failedReplies || 0,
      skippedReplies: skippedReplies || 0,
      sessionStatus: session?.session_status || null,
      lastPollAt: session?.last_poll_at || null,
    }
  }
}
