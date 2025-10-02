import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sentimentAnalyzer } from '@/lib/sentiment'
import { SentimentScheduler } from '@/lib/sentiment-scheduler'

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('🚫 Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('⏰ Processing sentiment analysis cron job...')

  try {
    const now = new Date()
    const nowIso = now.toISOString()

    // Step 1: Detect inactive conversations and create background jobs for them
    await detectAndScheduleInactiveConversations(now)

    // Step 2: Get pending sentiment analysis jobs that are due for processing
    const { data: jobs, error: fetchError } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('type', 'sentiment_analysis')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
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

// Detect inactive conversations and schedule sentiment analysis for them
async function detectAndScheduleInactiveConversations(now: Date): Promise<void> {
  try {
    console.log('🔍 Detecting inactive conversations...')

    // Find chat sessions that:
    // 1. Have at least one user message
    // 2. Last message was more than 30 minutes ago
    // 3. Don't already have a pending/completed sentiment analysis job
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()

    // Get all chat sessions that have user messages
    // First get session IDs that have user messages
    const { data: sessionIds, error: sessionIdsError } = await supabase
      .from('messages')
      .select('session_id')
      .in('role', ['user', 'USER'])

    if (sessionIdsError) {
      console.error('❌ Error fetching session IDs:', sessionIdsError)
      return
    }

    if (!sessionIds || sessionIds.length === 0) {
      console.log('📋 No sessions with user messages found')
      return
    }

    // Extract unique session IDs
    const uniqueSessionIds = [...new Set(sessionIds.map(s => s.session_id))]

    // Get chat session details for these IDs
    const { data: sessionsWithUserMessages, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('id, creator_id')
      .in('id', uniqueSessionIds)

    if (fetchError) {
      console.error('❌ Error fetching inactive sessions:', fetchError)
      return
    }

    if (!sessionsWithUserMessages || sessionsWithUserMessages.length === 0) {
      console.log('📋 No sessions with user messages found')
      return
    }

    console.log(`📋 Found ${sessionsWithUserMessages.length} sessions with user messages`)

    // For each session, check if it's inactive and needs sentiment analysis
    let scheduledCount = 0
    for (const session of sessionsWithUserMessages) {
      try {
        // Check if session is actually inactive (last message > 30 min ago)
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('created_at')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!lastMessage || lastMessage.created_at > thirtyMinutesAgo) {
          // Session is still active or no messages found
          continue
        }

        // Check if job already exists
        const { data: existingJob } = await supabase
          .from('background_jobs')
          .select('id')
          .eq('type', 'sentiment_analysis')
          .eq('payload->sessionId', session.id)
          .in('status', ['pending', 'processing', 'completed'])
          .single()

        if (existingJob) {
          console.log(`📋 Job already exists for session ${session.id}`)
          continue
        }

        // Check if there are any unanalyzed user messages
        const { data: unanalyzedMessages } = await supabase
          .from('messages')
          .select('id')
          .eq('session_id', session.id)
          .in('role', ['user', 'USER'])
          .is('sentiment', null)
          .limit(1)

        if (!unanalyzedMessages || unanalyzedMessages.length === 0) {
          console.log(`📋 No unanalyzed messages for session ${session.id}`)
          continue
        }

        // Schedule sentiment analysis for inactive conversation
        try {
          const jobId = await SentimentScheduler.scheduleInactive(session.id, session.creator_id)
          if (jobId) {
            scheduledCount++
            console.log(`✅ Scheduled sentiment analysis for inactive session ${session.id}`)
          }
        } catch (error) {
          console.error(`❌ Error scheduling sentiment analysis for session ${session.id}:`, error)
        }

      } catch (error) {
        console.error(`❌ Error processing session ${session.id}:`, error)
      }
    }

    console.log(`✅ Scheduled ${scheduledCount} new sentiment analysis jobs`)

  } catch (error) {
    console.error('❌ Error detecting inactive conversations:', error)
  }
}