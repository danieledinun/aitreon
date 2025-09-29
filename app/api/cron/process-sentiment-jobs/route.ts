import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sentimentAnalyzer } from '@/lib/sentiment'

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('🚫 Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('⏰ Processing sentiment analysis cron job...')

  try {
    const now = new Date().toISOString()

    // Get pending sentiment analysis jobs that are due for processing
    const { data: jobs, error: fetchError } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('type', 'sentiment_analysis')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .lt('attempts', 3) // max attempts
      .order('scheduled_for', { ascending: true })
      .limit(50) // Process up to 50 jobs per cron run

    if (fetchError) {
      console.error('❌ Error fetching jobs:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!jobs || jobs.length === 0) {
      console.log('📋 No pending sentiment analysis jobs found')
      return NextResponse.json({
        success: true,
        message: 'No jobs to process',
        processed: 0
      })
    }

    console.log(`📋 Processing ${jobs.length} sentiment analysis jobs...`)

    let processed = 0
    let failed = 0

    for (const job of jobs) {
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

        console.log(`🔄 Processing sentiment job ${job.id} for session ${job.payload.sessionId}`)

        const success = await processSentimentAnalysisJob(job.payload)

        // Update job status
        const newStatus = success ? 'completed' : (job.attempts + 1 >= 3 ? 'failed' : 'pending')
        await supabase
          .from('background_jobs')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id)

        if (success) {
          processed++
          console.log(`✅ Completed sentiment job ${job.id}`)
        } else {
          failed++
          console.log(`❌ Failed sentiment job ${job.id}`)
        }

      } catch (error) {
        console.error(`❌ Error processing job ${job.id}:`, error)
        failed++

        // Mark as failed if max attempts reached
        const newStatus = job.attempts + 1 >= 3 ? 'failed' : 'pending'
        await supabase
          .from('background_jobs')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id)
      }
    }

    console.log(`✅ Cron job completed: ${processed} processed, ${failed} failed`)

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: jobs.length
    })

  } catch (error) {
    console.error('❌ Error in sentiment analysis cron job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Process individual sentiment analysis job
async function processSentimentAnalysisJob(payload: { sessionId: string, creatorId: string }): Promise<boolean> {
  try {
    const { sessionId, creatorId } = payload

    console.log(`🧠 Analyzing sentiment for session ${sessionId}...`)

    // Get user messages from this session that haven't been analyzed
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, content, role')
      .eq('session_id', sessionId)
      .in('role', ['user', 'USER'])
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
    let processedCount = 0
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
          processedCount++
          console.log(`✅ Analyzed sentiment for message ${message.id}: ${sentimentResult.sentiment} (${sentimentResult.confidence})`)
        }

        // Small delay to respect HuggingFace rate limits
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        console.error(`❌ Error analyzing message ${message.id}:`, error)
      }
    }

    console.log(`✅ Processed ${processedCount}/${messages.length} messages for session ${sessionId}`)
    return processedCount > 0

  } catch (error) {
    console.error('❌ Error in sentiment analysis job:', error)
    return false
  }
}