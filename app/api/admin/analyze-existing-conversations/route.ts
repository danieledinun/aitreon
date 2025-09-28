import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { sentimentAnalyzer } from '@/lib/sentiment'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a creator (for production security)
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

    if (!creator) {
      return NextResponse.json({ error: 'Only creators can analyze conversations' }, { status: 403 })
    }

    console.log(`🔍 Analyzing existing conversations for creator ${creator.id}...`)

    // Get sessions for this creator that have user messages but no sentiment analysis
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('creator_id', creator.id)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No chat sessions found for this creator',
        processed: 0
      })
    }

    const sessionIds = sessions.map(s => s.id)

    // Get user messages that haven't been analyzed
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, content, session_id')
      .in('session_id', sessionIds)
      .in('role', ['user', 'USER'])
      .is('sentiment', null)
      .not('content', 'is', null)
      .neq('content', '')

    if (fetchError) {
      console.error('❌ Error fetching messages:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unanalyzed user messages found',
        processed: 0
      })
    }

    console.log(`📊 Found ${messages.length} unanalyzed user messages`)

    // Process messages in smaller batches to avoid timeouts
    const batchSize = 10
    let processed = 0
    let errors = 0
    const results = []

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)

      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messages.length / batchSize)}...`)

      for (const message of batch) {
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
            errors++
          } else {
            processed++
            results.push({
              messageId: message.id,
              sessionId: message.session_id,
              content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
              sentiment: sentimentResult.sentiment,
              confidence: sentimentResult.confidence
            })
          }

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 200))

        } catch (error) {
          console.error(`❌ Error analyzing message ${message.id}:`, error)
          errors++
        }
      }

      // Longer delay between batches
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`✅ Sentiment analysis complete: ${processed} processed, ${errors} errors`)

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total: messages.length,
      results: results.slice(0, 10), // Return first 10 results as sample
      message: `Analyzed ${processed} messages with ${errors} errors`,
      creatorId: creator.id
    })

  } catch (error) {
    console.error('❌ Error in sentiment analysis:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check status
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Only creators can check status' }, { status: 403 })
    }

    // Get session IDs for this creator
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('creator_id', creator.id)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { total: 0, analyzed: 0, pending: 0 }
      })
    }

    const sessionIds = sessions.map(s => s.id)

    // Get message counts
    const { count: totalUserMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds)
      .in('role', ['user', 'USER'])

    const { count: analyzedMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds)
      .in('role', ['user', 'USER'])
      .not('sentiment', 'is', null)

    return NextResponse.json({
      success: true,
      stats: {
        total: totalUserMessages || 0,
        analyzed: analyzedMessages || 0,
        pending: (totalUserMessages || 0) - (analyzedMessages || 0)
      },
      creatorId: creator.id
    })

  } catch (error) {
    console.error('❌ Error checking status:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}