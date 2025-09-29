import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { sentimentAnalyzer } from '@/lib/sentiment'

// Manual trigger for sentiment analysis (for testing and admin use)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, immediate = false } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    console.log(`🔧 Manual trigger: ${immediate ? 'Immediate' : 'Scheduled'} sentiment analysis for session ${sessionId}`)

    // Verify the session exists
    const { data: chatSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, creator_id, user_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !chatSession) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    if (immediate) {
      // Process immediately
      console.log(`⚡ Processing sentiment analysis immediately for session ${sessionId}`)

      // Get user messages from this session
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('id, content, role, sentiment')
        .eq('session_id', sessionId)
        .in('role', ['user', 'USER'])
        .not('content', 'is', null)
        .neq('content', '')

      if (fetchError) {
        console.error('❌ Error fetching messages:', fetchError)
        return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 })
      }

      if (!messages || messages.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No messages to analyze',
          sessionId,
          processed: 0,
          total: 0
        })
      }

      console.log(`📊 Found ${messages.length} messages to analyze`)

      // Process each message
      let processed = 0
      let alreadyAnalyzed = 0
      let errors = 0

      for (const message of messages) {
        try {
          // Skip if already analyzed (unless we want to re-analyze)
          if (message.sentiment && !body.reanalyze) {
            alreadyAnalyzed++
            continue
          }

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
            errors++
          } else {
            processed++
            console.log(`✅ Message ${message.id}: "${message.content.substring(0, 50)}..." → ${sentimentResult.sentiment} (${sentimentResult.confidence})`)
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          console.error(`❌ Error analyzing message ${message.id}:`, error)
          errors++
        }
      }

      return NextResponse.json({
        success: true,
        sessionId,
        processed,
        alreadyAnalyzed,
        errors,
        total: messages.length,
        message: `Processed ${processed} messages, ${alreadyAnalyzed} already analyzed, ${errors} errors`
      })

    } else {
      // Schedule for later processing
      const scheduledFor = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now

      // Check if job already exists
      const { data: existingJob } = await supabase
        .from('background_jobs')
        .select('id, status')
        .eq('type', 'sentiment_analysis')
        .eq('payload->sessionId', sessionId)
        .in('status', ['pending', 'processing'])
        .single()

      if (existingJob) {
        return NextResponse.json({
          success: true,
          message: 'Sentiment analysis job already scheduled',
          sessionId,
          existingJobId: existingJob.id,
          status: existingJob.status
        })
      }

      // Create new background job
      const { data: job, error: jobError } = await supabase
        .from('background_jobs')
        .insert({
          type: 'sentiment_analysis',
          payload: {
            sessionId,
            creatorId: chatSession.creator_id
          },
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        })
        .select()
        .single()

      if (jobError) {
        console.error('❌ Error creating background job:', jobError)
        return NextResponse.json({ error: 'Failed to schedule job' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Sentiment analysis scheduled',
        sessionId,
        jobId: job.id,
        scheduledFor: scheduledFor.toISOString()
      })
    }

  } catch (error) {
    console.error('❌ Error in manual sentiment trigger:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get sentiment analysis status for a session
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId query parameter is required' }, { status: 400 })
    }

    // Get sentiment analysis job status
    const { data: job } = await supabase
      .from('background_jobs')
      .select('id, status, scheduled_for, created_at, attempts, payload')
      .eq('type', 'sentiment_analysis')
      .eq('payload->sessionId', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get message sentiment stats
    const { data: sentimentStats } = await supabase
      .from('messages')
      .select('sentiment')
      .eq('session_id', sessionId)
      .in('role', ['user', 'USER'])
      .not('sentiment', 'is', null)

    const stats = {
      total: 0,
      positive: 0,
      negative: 0,
      neutral: 0
    }

    if (sentimentStats) {
      stats.total = sentimentStats.length
      stats.positive = sentimentStats.filter(m => m.sentiment === 'POSITIVE').length
      stats.negative = sentimentStats.filter(m => m.sentiment === 'NEGATIVE').length
      stats.neutral = sentimentStats.filter(m => m.sentiment === 'NEUTRAL').length
    }

    return NextResponse.json({
      sessionId,
      job: job || null,
      sentimentStats: stats
    })

  } catch (error) {
    console.error('❌ Error getting sentiment status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}