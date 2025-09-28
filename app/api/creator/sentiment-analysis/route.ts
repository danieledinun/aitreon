import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { sentimentAnalyzer } from '@/lib/sentiment'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const analyzeSentimentSchema = z.object({
  creatorId: z.string(),
  messageIds: z.array(z.string()).optional(),
  batchSize: z.number().min(1).max(100).default(50)
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { creatorId, messageIds, batchSize } = analyzeSentimentSchema.parse(body)

    // Verify user owns this creator
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!creator || creator.id !== creatorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // First, ensure the sentiment columns exist
    try {
      await supabase.rpc('exec', {
        sql: `
          ALTER TABLE messages
          ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL')),
          ADD COLUMN IF NOT EXISTS sentiment_confidence NUMERIC(3,2) CHECK (sentiment_confidence >= 0 AND sentiment_confidence <= 1),
          ADD COLUMN IF NOT EXISTS sentiment_analyzed_at TIMESTAMP WITH TIME ZONE;
        `
      })
    } catch (error) {
      console.log('Columns may already exist or using alternative approach')
    }

    // Get messages to analyze
    let query = supabase
      .from('messages')
      .select('id, content, role, created_at')
      .eq('role', 'user')
      .is('sentiment', null)
      .not('content', 'is', null)
      .neq('content', '')

    // Filter by creator through chat sessions
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('creator_id', creatorId)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No chat sessions found for this creator',
        processed: 0
      })
    }

    const sessionIds = sessions.map(s => s.id)
    query = query.in('session_id', sessionIds)

    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds)
    }

    query = query.limit(batchSize)

    const { data: messages, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching messages:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No messages found to analyze',
        processed: 0
      })
    }

    console.log(`Analyzing sentiment for ${messages.length} messages...`)

    // Analyze sentiment for each message
    const results = []
    let processed = 0
    let errors = 0

    for (const message of messages) {
      try {
        const sentimentResult = await sentimentAnalyzer.analyzeSentiment(message.content)

        // Update the message with sentiment data
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            sentiment: sentimentResult.sentiment,
            sentiment_confidence: sentimentResult.confidence,
            sentiment_analyzed_at: new Date().toISOString()
          })
          .eq('id', message.id)

        if (updateError) {
          console.error(`Error updating message ${message.id}:`, updateError)
          errors++
        } else {
          processed++
          results.push({
            messageId: message.id,
            content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
            sentiment: sentimentResult.sentiment,
            confidence: sentimentResult.confidence
          })
        }

        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error analyzing sentiment for message ${message.id}:`, error)
        errors++
      }
    }

    console.log(`✅ Sentiment analysis complete: ${processed} processed, ${errors} errors`)

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total: messages.length,
      results: results.slice(0, 10), // Return first 10 results as sample
      message: `Analyzed ${processed} messages with ${errors} errors`
    })

  } catch (error) {
    console.error('❌ Error in sentiment analysis:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid input',
        details: error.errors
      }, { status: 400 })
    }
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET endpoint to retrieve sentiment statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID required' }, { status: 400 })
    }

    // Verify user owns this creator
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!creator || creator.id !== creatorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get sentiment statistics
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('creator_id', creatorId)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { total: 0, analyzed: 0, positive: 0, negative: 0, neutral: 0 }
      })
    }

    const sessionIds = sessions.map(s => s.id)

    // Get total messages
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user')
      .in('session_id', sessionIds)

    // Get analyzed messages
    const { count: analyzedMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user')
      .in('session_id', sessionIds)
      .not('sentiment', 'is', null)

    // Get sentiment distribution
    const { data: sentimentData } = await supabase
      .from('messages')
      .select('sentiment')
      .eq('role', 'user')
      .in('session_id', sessionIds)
      .not('sentiment', 'is', null)

    const sentimentCounts = {
      positive: 0,
      negative: 0,
      neutral: 0
    }

    sentimentData?.forEach(row => {
      if (row.sentiment === 'POSITIVE') sentimentCounts.positive++
      else if (row.sentiment === 'NEGATIVE') sentimentCounts.negative++
      else if (row.sentiment === 'NEUTRAL') sentimentCounts.neutral++
    })

    return NextResponse.json({
      success: true,
      stats: {
        total: totalMessages || 0,
        analyzed: analyzedMessages || 0,
        positive: sentimentCounts.positive,
        negative: sentimentCounts.negative,
        neutral: sentimentCounts.neutral
      }
    })

  } catch (error) {
    console.error('❌ Error retrieving sentiment stats:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}