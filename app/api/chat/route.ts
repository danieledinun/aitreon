import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { RAGService } from '@/lib/rag-service'
import { EnhancedRAGService } from '@/lib/enhanced-rag-service'
import { conversationTracker } from '@/lib/conversation-tracker'
import { z } from 'zod'

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  creatorId: z.string(),
  sessionId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, creatorId, sessionId } = chatSchema.parse(body)

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, username, display_name')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      console.error('Creator fetch error:', creatorError)
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Daily usage limits removed - unlimited chat access
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Note: Daily limit check has been disabled for unlimited access
    // Previous implementation limited users to 5 messages per day without subscription

    // Get or create chat session
    let chatSession
    if (sessionId) {
      const { data: existingSession } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
      chatSession = existingSession
    }

    if (!chatSession) {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: session.user.id,
          creator_id: creatorId
        })
        .select()
        .single()

      if (sessionError) {
        console.error('Failed to create chat session:', sessionError)
        return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 })
      }
      chatSession = newSession
    }

    // Get recent messages for this session
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', chatSession.id)
      .order('created_at', { ascending: false })
      .limit(10)

    chatSession.messages = messages || []

    // Get conversation history
    const conversationHistory = chatSession.messages
      .reverse()
      .map((msg: any) => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant',
        content: msg.content
      }))

    // Generate AI response using Enhanced RAG
    console.log('🤖 Generating AI response using enhanced search with reranking...')
    const { response, citations, confidence } = await EnhancedRAGService.generateResponse(
      creatorId,
      creator.display_name,
      message,
      conversationHistory
    )
    console.log('✅ Enhanced RAG Service completed successfully')

    // Save user message
    console.log('💾 Step 1: Saving user message...')
    const { data: userMessage, error: userMessageError } = await supabase
      .from('messages')
      .insert({
        session_id: chatSession.id,
        role: 'USER',
        content: message
      })
      .select()
      .single()

    if (userMessageError) {
      console.error('❌ Failed to save user message:', userMessageError)
    } else {
      console.log('✅ User message saved successfully')
      // Track user message for conversation end detection
      await conversationTracker.trackMessage(chatSession.id, creatorId, 'USER')
    }

    // Save AI response
    console.log('💾 Step 2: Saving AI message...')
    const { data: aiMessage, error: aiMessageError } = await supabase
      .from('messages')
      .insert({
        session_id: chatSession.id,
        role: 'ASSISTANT',
        content: response
      })
      .select()
      .single()

    if (aiMessageError) {
      console.error('❌ Failed to save AI message:', aiMessageError)
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
    } else {
      console.log('✅ AI message saved successfully')
      // Track AI message for conversation activity
      await conversationTracker.trackMessage(chatSession.id, creatorId, 'ASSISTANT')
    }

    // Save citations separately
    console.log('💾 Step 3: Saving citations...')
    const citationData = citations.map(citation => ({
      message_id: aiMessage.id,
      video_id: citation.videoId || 'unknown',
      video_title: citation.videoTitle,
      start_time: citation.startTime,
      end_time: citation.endTime,
      content: citation.content
    }))

    console.log(`📝 Citation data prepared: ${citationData.length} citations`)

    if (citationData.length > 0) {
      const { error: citationError } = await supabase
        .from('citations')
        .insert(citationData)

      if (citationError) {
        console.error('❌ Failed to save citations:', citationError)
      } else {
        console.log('✅ Citations saved successfully')
      }
    } else {
      console.log('ℹ️  No citations to save')
    }

    // Attach citations to the message for response
    aiMessage.citations = citationData

    // Update daily usage
    console.log('💾 Step 4: Updating daily usage...')
    const todayStr = today.toISOString().split('T')[0]
    const { data: existingUsage, error: usageSelectError } = await supabase
      .from('daily_usage')
      .select('message_count')
      .eq('user_id', session.user.id)
      .eq('creator_id', creatorId)
      .eq('date', todayStr)
      .single()

    if (usageSelectError && usageSelectError.code !== 'PGRST116') {
      console.error('❌ Error checking daily usage:', usageSelectError)
    }

    if (existingUsage) {
      console.log('📊 Updating existing daily usage count...')
      const { error: updateError } = await supabase
        .from('daily_usage')
        .update({ message_count: existingUsage.message_count + 1 })
        .eq('user_id', session.user.id)
        .eq('creator_id', creatorId)
        .eq('date', todayStr)

      if (updateError) {
        console.error('❌ Failed to update daily usage:', updateError)
      } else {
        console.log('✅ Daily usage updated successfully')
      }
    } else {
      console.log('📊 Creating new daily usage record...')
      const { error: insertError } = await supabase
        .from('daily_usage')
        .insert({
          user_id: session.user.id,
          creator_id: creatorId,
          date: todayStr,
          message_count: 1
        })

      if (insertError) {
        console.error('❌ Failed to create daily usage:', insertError)
      } else {
        console.log('✅ Daily usage created successfully')
      }
    }

    return NextResponse.json({
      sessionId: chatSession.id,
      message: {
        id: aiMessage.id,
        content: response,
        citations: aiMessage.citations,
        createdAt: aiMessage.created_at
      }
    })
  } catch (error) {
    console.error('Chat error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}