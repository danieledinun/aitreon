import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { RAGService } from '@/lib/rag-service'
import { EnhancedRAGService } from '@/lib/enhanced-rag-service'
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
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { message, creatorId, sessionId } = chatSchema.parse(body)

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      return new Response('Creator not found', { status: 404 })
    }


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
        return new Response('Failed to create chat session', { status: 500 })
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

    // Create a readable stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Save user message first
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
            console.error('Failed to save user message:', userMessageError)
            throw new Error('Failed to save user message')
          }

          // Send session info first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'session', 
              sessionId: chatSession.id 
            })}\n\n`)
          )

          // Get Enhanced RAG response with reranking
          const ragResponse = await EnhancedRAGService.generateResponse(
            creatorId,
            creator.display_name,
            message,
            conversationHistory
          )

          // Send final response with citations
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete',
                response: ragResponse.response,
                citations: ragResponse.citations,
                confidence: ragResponse.confidence
              })}\n\n`)
            )
          } catch (error) {
            console.log('Stream complete error (controller closed):', error.message)
          }

          // Save AI message to database
          const { data: aiMessage, error: aiMessageError } = await supabase
            .from('messages')
            .insert({
              session_id: chatSession.id,
              role: 'ASSISTANT',
              content: ragResponse.response
            })
            .select()
            .single()

          if (aiMessageError) {
            console.error('Failed to save AI message:', aiMessageError)
            throw new Error('Failed to save AI message')
          }

          // Save citations separately
          const citationData = ragResponse.citations.map((citation: any) => ({
            message_id: aiMessage.id,
            video_id: citation.videoId || 'unknown',
            video_title: citation.videoTitle,
            start_time: citation.startTime,
            end_time: citation.endTime,
            content: citation.content
          }))

          if (citationData.length > 0) {
            const { error: citationError } = await supabase
              .from('citations')
              .insert(citationData)

            if (citationError) {
              console.error('Failed to save citations:', citationError)
            }
          }

          // Update daily usage
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const todayStr = today.toISOString().split('T')[0]

          const { data: existingUsage, error: usageSelectError } = await supabase
            .from('daily_usage')
            .select('message_count')
            .eq('user_id', session.user.id)
            .eq('creator_id', creatorId)
            .eq('date', todayStr)
            .single()

          if (existingUsage) {
            const { error: updateError } = await supabase
              .from('daily_usage')
              .update({ message_count: existingUsage.message_count + 1 })
              .eq('user_id', session.user.id)
              .eq('creator_id', creatorId)
              .eq('date', todayStr)

            if (updateError) {
              console.error('Failed to update daily usage:', (updateError as any).message)
            }
          } else {
            const { error: insertError } = await supabase
              .from('daily_usage')
              .insert({
                user_id: session.user.id,
                creator_id: creatorId,
                date: todayStr,
                message_count: 1
              })

            if (insertError) {
              console.error('Failed to create daily usage:', (insertError as any).message)
            }
          }

          // Send final message ID
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'message_saved',
                messageId: aiMessage.id,
                createdAt: aiMessage.created_at
              })}\n\n`)
            )
          } catch (error) {
            console.log('Stream message_saved error (controller closed):', error.message)
          }

        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'error',
              error: 'Failed to generate response'
            })}\n\n`)
          )
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Stream setup error:', error)
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: error.errors }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return new Response('Internal server error', { status: 500 })
  }
}