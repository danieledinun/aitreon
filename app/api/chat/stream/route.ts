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
  anonymousSessionId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { message, creatorId, sessionId, anonymousSessionId } = chatSchema.parse(body)

    // Check if this is an authenticated user or anonymous user
    const isAuthenticated = !!session?.user?.id
    const userId = session?.user?.id || null

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      return new Response('Creator not found', { status: 404 })
    }

    // Check user's subscription tier and monthly usage limits (for authenticated users only)
    if (isAuthenticated) {
      const now = new Date()
      // Get first day of current month
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`

      // Check if user is a paid subscriber for this creator
      const { data: paidSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('creator_id', creatorId)
        .eq('status', 'ACTIVE')
        .single()

      // Check if user is following this creator (free follow)
      const { data: followSubscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .single()

      // Determine user tier and message limits
      let messageLimit = 2 // Free tier: 2 messages per month
      let userTier = 'free'

      if (paidSubscription) {
        messageLimit = -1 // Unlimited for paid subscribers
        userTier = 'paid'
      } else if (followSubscription) {
        messageLimit = 5 // Follower tier: 5 messages per month
        userTier = 'follower'
      }

      console.log('🔍 Stream API Debug:', {
        userId,
        creatorId,
        isPaidSubscriber: !!paidSubscription,
        isFollowing: !!followSubscription,
        userTier,
        messageLimit,
        monthKey
      })

      // Check monthly usage only if not unlimited (paid subscriber)
      if (messageLimit > 0) {
        // Get this month's usage
        const { data: monthlyUsage } = await supabase
          .from('daily_usage')
          .select('*')
          .eq('user_id', userId)
          .eq('creator_id', creatorId)
          .eq('date', monthKey)
          .single()

        const currentUsage = monthlyUsage?.message_count || 0

        console.log('📊 Usage Check:', {
          currentUsage,
          messageLimit,
          monthlyUsageRecord: monthlyUsage,
          monthKey,
          shouldBlock: currentUsage >= messageLimit
        })

        if (currentUsage >= messageLimit) {
          const upgradeMessage = userTier === 'free'
            ? 'You\'ve reached your monthly limit of 2 messages. Follow this creator to get 5 messages per month, or upgrade to a paid subscription for unlimited messages!'
            : 'You\'ve reached your monthly limit of 5 messages. Upgrade to a paid subscription for unlimited messages!'

          return new Response(JSON.stringify({
            error: 'Monthly limit reached',
            errorType: 'LIMIT_REACHED',
            userTier,
            currentUsage,
            messageLimit,
            upgradeMessage,
            showUpgradeModal: true
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }

    // Get or create chat session
    let chatSession

    if (sessionId && isAuthenticated) {
      // For authenticated users, check for existing session
      const { data: existingSession } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single()
      chatSession = existingSession
    }

    if (!chatSession) {
      if (isAuthenticated) {
        // Create authenticated session
        const { data: newSession, error: sessionError } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: userId,
            creator_id: creatorId
          })
          .select()
          .single()

        if (sessionError) {
          console.error('Failed to create chat session:', sessionError)
          return new Response('Failed to create chat session', { status: 500 })
        }
        chatSession = newSession
      } else {
        // For anonymous users, create a temporary session object (not stored in DB)
        chatSession = {
          id: anonymousSessionId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: null,
          creator_id: creatorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    }

    // Get recent messages for this session (only for authenticated users)
    let messages = []
    if (isAuthenticated) {
      const { data: dbMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', chatSession.id)
        .order('created_at', { ascending: false })
        .limit(10)
      messages = dbMessages || []
    }

    chatSession.messages = messages

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
          // Save user message first (only for authenticated users)
          let userMessage: any = null
          if (isAuthenticated) {
            const { data: savedUserMessage, error: userMessageError } = await supabase
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
            userMessage = savedUserMessage
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
            // Ensure response content is properly cleaned for JSON
            const cleanResponse = typeof ragResponse.response === 'string'
              ? ragResponse.response.replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
              : ragResponse.response

            const responseData = {
              type: 'complete',
              response: cleanResponse,
              citations: ragResponse.citations,
              confidence: ragResponse.confidence
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(responseData)}\n\n`)
            )
          } catch (error) {
            console.error('Stream complete error:', error)
            // Send error response if JSON serialization fails
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'error',
                  error: 'Failed to serialize response'
                })}\n\n`)
              )
            } catch (fallbackError) {
              console.log('Fallback error (controller closed):', fallbackError instanceof Error ? fallbackError.message : String(fallbackError))
            }
          }

          // Save AI message to database (only for authenticated users)
          let aiMessage: any = null
          if (isAuthenticated) {
            const { data: savedAiMessage, error: aiMessageError } = await supabase
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
            aiMessage = savedAiMessage

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
          }

          // Update monthly usage (only for authenticated users)
          if (isAuthenticated && userId) {
            const now = new Date()
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`

            const { data: existingUsage, error: usageSelectError } = await supabase
              .from('daily_usage')
              .select('message_count')
              .eq('user_id', userId)
              .eq('creator_id', creatorId)
              .eq('date', monthKey)
              .single()

            if (existingUsage) {
              const { error: updateError } = await supabase
                .from('daily_usage')
                .update({ message_count: existingUsage.message_count + 1 })
                .eq('user_id', userId)
                .eq('creator_id', creatorId)
                .eq('date', monthKey)

              if (updateError) {
                console.error('Failed to update monthly usage:', (updateError as any).message)
              }
            } else {
              const { error: insertError } = await supabase
                .from('daily_usage')
                .insert({
                  user_id: userId,
                  creator_id: creatorId,
                  date: monthKey,
                  message_count: 1
                })

              if (insertError) {
                console.error('Failed to create monthly usage:', (insertError as any).message)
              }
            }
          }

          // Send final message ID (only for authenticated users)
          if (isAuthenticated && aiMessage) {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'message_saved',
                  messageId: aiMessage.id,
                  createdAt: aiMessage.created_at
                })}\n\n`)
              )
            } catch (error) {
              console.log('Stream message_saved error (controller closed):', error instanceof Error ? error.message : String(error))
            }
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