import { supabase } from './supabase'

export interface SentimentScheduleOptions {
  sessionId: string
  creatorId: string
  reason?: string
  immediate?: boolean
}

export class SentimentScheduler {
  /**
   * Schedule sentiment analysis for a conversation
   * @param options - Configuration for scheduling
   * @returns Promise with job ID or null if already scheduled
   */
  static async scheduleAnalysis(options: SentimentScheduleOptions): Promise<string | null> {
    const { sessionId, creatorId, reason = 'conversation_ended', immediate = true } = options

    try {
      // Check if job already exists for this session
      const { data: existingJob } = await supabase
        .from('background_jobs')
        .select('id, status')
        .eq('type', 'sentiment_analysis')
        .eq('payload->sessionId', sessionId)
        .in('status', ['pending', 'processing'])
        .single()

      if (existingJob) {
        console.log(`📋 Sentiment analysis job already exists for session ${sessionId}`)
        return existingJob.id
      }

      // Check if there are any unanalyzed user messages
      const { data: unanalyzedMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('session_id', sessionId)
        .in('role', ['user', 'USER'])
        .is('sentiment', null)
        .limit(1)

      if (!unanalyzedMessages || unanalyzedMessages.length === 0) {
        console.log(`📋 No unanalyzed messages for session ${sessionId}`)
        return null
      }

      // Schedule for immediate processing if immediate=true, otherwise next cron run
      const scheduledFor = immediate ? new Date() : new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

      const { data: job, error: jobError } = await supabase
        .from('background_jobs')
        .insert({
          type: 'sentiment_analysis',
          payload: {
            sessionId,
            creatorId,
            reason
          },
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        })
        .select()
        .single()

      if (jobError) {
        console.error(`❌ Error scheduling sentiment analysis for ${sessionId}:`, jobError)
        throw jobError
      }

      console.log(`✅ Scheduled ${immediate ? 'immediate' : 'delayed'} sentiment analysis for session ${sessionId}`)
      return job.id

    } catch (error) {
      console.error(`❌ Error in sentiment scheduler for ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * Schedule immediate sentiment analysis for an ended conversation
   */
  static async scheduleImmediate(sessionId: string, creatorId: string, reason?: string): Promise<string | null> {
    return this.scheduleAnalysis({
      sessionId,
      creatorId,
      reason: reason || 'conversation_ended',
      immediate: true
    })
  }

  /**
   * Schedule sentiment analysis for an inactive conversation (detected by cron)
   */
  static async scheduleInactive(sessionId: string, creatorId: string): Promise<string | null> {
    return this.scheduleAnalysis({
      sessionId,
      creatorId,
      reason: 'conversation_inactive',
      immediate: true
    })
  }
}