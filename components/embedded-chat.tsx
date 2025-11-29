'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Send, MessageCircle, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import InlineVideoPlayer from './inline-video-player'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  createdAt: Date
  isStreaming?: boolean
}

interface Citation {
  videoTitle: string
  videoId: string
  startTime?: number
  endTime?: number
  content: string
}

interface EmbeddedChatProps {
  creator: {
    id: string
    username: string
    displayName?: string
    display_name?: string
    bio?: string | null
    profileImage?: string | null
    profile_image?: string | null
  }
  theme?: string
  primaryColor?: string
}

export default function EmbeddedChat({
  creator,
  theme = 'light',
  primaryColor = '#6366f1'
}: EmbeddedChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const displayName = creator.display_name || creator.displayName || creator.username
  const profileImage = creator.profile_image || creator.profileImage

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      createdAt: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          creatorId: creator.id,
          sessionId,
          isEmbedded: true
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId)
      }

      const assistantMessage: ChatMessage = {
        id: data.messageId || Date.now().toString(),
        role: 'assistant',
        content: data.response,
        citations: data.citations || [],
        createdAt: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'm sorry, I'm having trouble responding right now. Please try again later.",
        createdAt: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn(
      "flex flex-col h-screen w-full",
      isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 border-b",
        isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
      )}>
        {profileImage ? (
          <Image
            src={profileImage}
            alt={displayName}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold">{displayName}</h3>
          <p className={cn(
            "text-xs",
            isDark ? "text-gray-400" : "text-gray-500"
          )}>
            AI Twin
          </p>
        </div>
        <div className="text-xs text-gray-400">
          Powered by <span className="font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Tandym.ai</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            {profileImage ? (
              <Image
                src={profileImage}
                alt={displayName}
                width={80}
                height={80}
                className="rounded-full mb-4"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            )}
            <h3 className="text-xl font-bold mb-2">Chat with {displayName}</h3>
            <p className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-500"
            )}>
              Ask me anything! I'll do my best to help based on my knowledge.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {message.role === 'assistant' && (
              profileImage ? (
                <Image
                  src={profileImage}
                  alt={displayName}
                  width={32}
                  height={32}
                  className="rounded-full shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )
            )}

            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3",
              message.role === 'user'
                ? isDark
                  ? "bg-blue-600 text-white"
                  : "text-white"
                : isDark
                ? "bg-gray-800 text-gray-100"
                : "bg-gray-100 text-gray-900"
            )} style={message.role === 'user' ? { backgroundColor: primaryColor } : {}}>
              <div className="whitespace-pre-wrap break-words">{message.content}</div>

              {/* Citations */}
              {message.citations && message.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sources:</p>
                  {message.citations.map((citation, idx) => (
                    <InlineVideoPlayer
                      key={idx}
                      videoId={citation.videoId}
                      title={citation.videoTitle}
                      startTime={citation.startTime}
                      endTime={citation.endTime}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            {profileImage ? (
              <Image
                src={profileImage}
                alt={displayName}
                width={32}
                height={32}
                className="rounded-full shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={cn(
              "rounded-2xl px-4 py-3",
              isDark ? "bg-gray-800" : "bg-gray-100"
            )}>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={cn(
        "px-4 py-3 border-t",
        isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
      )}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            disabled={loading}
            className={cn(
              "flex-1 px-4 py-2 rounded-full border focus:outline-none focus:ring-2 focus:ring-offset-1",
              isDark
                ? "bg-gray-900 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
            )}
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || loading}
            size="icon"
            className="rounded-full shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
