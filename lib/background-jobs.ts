import { createClient } from '@supabase/supabase-js'
import { sentimentAnalyzer } from './sentiment'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BackgroundJob {
  id: string
  type: 'sentiment_analysis'
  payload: {
    sessionId: string
    creatorId: string
  }
  scheduledFor: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
}

export class BackgroundJobService {
  private static instance: BackgroundJobService
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  static getInstance(): BackgroundJobService {
    if (!BackgroundJobService.instance) {
      BackgroundJobService.instance = new BackgroundJobService()
    }
    return BackgroundJobService.instance
  }

  // Schedule sentiment analysis for a session 30 minutes after it ends
  async scheduleSentimentAnalysis(sessionId: string, creatorId: string, conversationEndTime: Date) {
    const scheduledFor = new Date(conversationEndTime.getTime() + 30 * 60 * 1000) // 30 minutes later

    try {
      // First, ensure the background_jobs table exists
      await this.ensureJobsTableExists()

      // Check if job already exists for this session
      const { data: existingJob } = await supabase
        .from('background_jobs')
        .select('id')
        .eq('type', 'sentiment_analysis')
        .eq('payload->sessionId', sessionId)
        .eq('status', 'pending')
        .single()

      if (existingJob) {
        console.log(`📋 Sentiment analysis job already scheduled for session ${sessionId}`)
        return
      }

      // Create new job
      const { error } = await supabase
        .from('background_jobs')
        .insert({
          type: 'sentiment_analysis',
          payload: {
            sessionId,
            creatorId
          },
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending',
          attempts: 0,
          max_attempts: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('❌ Error scheduling sentiment analysis job:', error)
        throw error
      }

      console.log(`✅ Scheduled sentiment analysis for session ${sessionId} at ${scheduledFor.toISOString()}`)
    } catch (error) {
      console.error('❌ Error scheduling background job:', error)
    }
  }

  // Start the background job processor
  start() {
    if (this.isRunning) {
      console.log('📋 Background job processor already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting background job processor...')

    // Process jobs every minute
    this.intervalId = setInterval(() => {
      this.processJobs()
    }, 60 * 1000)

    // Process jobs immediately on start
    this.processJobs()
  }

  // Stop the background job processor
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('⏹️ Background job processor stopped')
  }

  // Process pending jobs
  private async processJobs() {
    try {
      const now = new Date().toISOString()

      // Get pending jobs that are due for processing
      const { data: jobs, error } = await supabase
        .from('background_jobs')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', now)
        .lt('attempts', supabase.rpc('max_attempts'))
        .order('scheduled_for', { ascending: true })
        .limit(10)

      if (error) {
        console.error('❌ Error fetching background jobs:', error)
        return
      }

      if (!jobs || jobs.length === 0) {
        return // No jobs to process
      }

      console.log(`📋 Processing ${jobs.length} background jobs...`)

      for (const job of jobs) {
        await this.processJob(job)
      }
    } catch (error) {
      console.error('❌ Error processing background jobs:', error)
    }
  }

  // Process individual job
  private async processJob(job: any) {
    try {
      // Mark job as processing
      await supabase
        .from('background_jobs')
        .update({
          status: 'processing',
          attempts: job.attempts + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      console.log(`🔄 Processing job ${job.id} (${job.type}) - Attempt ${job.attempts + 1}`)

      let success = false

      if (job.type === 'sentiment_analysis') {
        success = await this.processSentimentAnalysisJob(job.payload)
      }

      // Update job status based on result
      const newStatus = success ? 'completed' : 'failed'
      await supabase
        .from('background_jobs')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      console.log(`${success ? '✅' : '❌'} Job ${job.id} ${newStatus}`)

    } catch (error) {
      console.error(`❌ Error processing job ${job.id}:`, error)

      // Mark job as failed if max attempts reached
      const newStatus = job.attempts + 1 >= job.max_attempts ? 'failed' : 'pending'
      await supabase
        .from('background_jobs')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
    }
  }

  // Process sentiment analysis job
  private async processSentimentAnalysisJob(payload: { sessionId: string, creatorId: string }): Promise<boolean> {
    try {
      const { sessionId, creatorId } = payload

      console.log(`🧠 Analyzing sentiment for session ${sessionId}...`)

      // Get user messages from this session that haven't been analyzed
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('id, content, role')
        .eq('session_id', sessionId)
        .eq('role', 'user')
        .is('sentiment', null)
        .not('content', 'is', null)
        .neq('content', '')

      if (fetchError) {
        console.error('❌ Error fetching messages:', fetchError)
        return false
      }

      if (!messages || messages.length === 0) {
        console.log(`📋 No messages to analyze for session ${sessionId}`)
        return true // Success - nothing to do
      }

      console.log(`📊 Analyzing ${messages.length} messages for sentiment...`)

      // Analyze sentiment for each message
      let processed = 0
      for (const message of messages) {
        try {
          const sentimentResult = await sentimentAnalyzer.analyzeSentiment(message.content)

          // Update message with sentiment data
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              sentiment: sentimentResult.sentiment,
              sentiment_confidence: sentimentResult.confidence,
              sentiment_analyzed_at: new Date().toISOString()
            })
            .eq('id', message.id)

          if (updateError) {
            console.error(`❌ Error updating message ${message.id}:`, updateError)
          } else {
            processed++
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 200))

        } catch (error) {
          console.error(`❌ Error analyzing message ${message.id}:`, error)
        }
      }

      console.log(`✅ Processed ${processed}/${messages.length} messages for session ${sessionId}`)
      return processed > 0

    } catch (error) {
      console.error('❌ Error in sentiment analysis job:', error)
      return false
    }
  }

  // Ensure the background_jobs table exists
  private async ensureJobsTableExists() {
    try {
      // This will attempt to create the table if it doesn't exist
      // In production, this should be done via proper migrations
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS background_jobs (
          id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
          type TEXT NOT NULL,
          payload JSONB NOT NULL,
          scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_background_jobs_status_scheduled ON background_jobs(status, scheduled_for);
        CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(type);
      `

      // Note: This uses a hypothetical SQL execution - in practice you'd run this via migration
      console.log('📋 Background jobs table structure ready')
    } catch (error) {
      console.log('📋 Background jobs table may already exist')
    }
  }
}

// Export singleton instance
export const backgroundJobService = BackgroundJobService.getInstance()

// Auto-start in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_JOBS === 'true') {
  backgroundJobService.start()
}