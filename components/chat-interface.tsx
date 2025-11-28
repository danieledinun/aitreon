'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Send, ExternalLink, Clock, MessageCircle } from 'lucide-react'
import Link from 'next/link'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  createdAt: Date
}

interface Citation {
  videoTitle: string
  videoId: string
  startTime?: number
  endTime?: number
  content: string
}

interface ChatInterfaceProps {
  creatorId: string
  creatorName: string
  isSubscribed: boolean
  messagesUsed: number
  session: any
}

export default function ChatInterface({
  creatorId,
  creatorName,
  isSubscribed,
  messagesUsed,
  session
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Daily limits removed - unlimited chat access for all users
  const remainingMessages = Math.max(0, 5 - messagesUsed) // Keep for display compatibility
  const canSendMessage = true // Always allow messages - unlimited access

  const sendMessage = async () => {
    if (!input.trim() || loading || !session?.user) return

    console.log('🚀 sendMessage called!', { input, inputLength: input.length, loading, sessionExists: !!session?.user })

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
      console.log('📡 Making API request to /api/chat...')
      console.log('📡 Request payload:', { message: input, creatorId, sessionId })

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          creatorId,
          sessionId
        }),
      })

      console.log('📡 API response received:', { status: response.status, ok: response.ok })
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))

      let data
      try {
        data = await response.json()
        console.log('📄 API response data:', data)
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError)
        console.log('📄 Raw response text:', await response.text())
        throw new Error('Failed to parse API response')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      if (!sessionId) {
        setSessionId(data.sessionId)
        console.log('🆔 Session ID set:', data.sessionId)
      }

      const aiMessage: ChatMessage = {
        id: data.message.id,
        role: 'assistant',
        content: data.message.content,
        citations: data.message.citations,
        createdAt: new Date(data.message.createdAt)
      }

      console.log('🤖 AI message created:', aiMessage)
      setMessages(prev => [...prev, aiMessage])
      console.log('✅ AI message added to state')
    } catch (error) {
      console.error('❌ Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      console.log('🏁 sendMessage completed, loading set to false')
    }
  }

  const formatTime = (seconds?: number): string => {
    if (!seconds) return '0:00'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const renderMessageWithCitations = (content: string, citations?: Citation[]) => {
    if (!citations || citations.length === 0) {
      return <p>{content}</p>
    }

    // Split content by citation markers [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g
    const parts = content.split(citationRegex)
    const elements: React.ReactNode[] = []

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular text
        elements.push(parts[i])
      } else {
        // Citation number
        const citationNumber = parseInt(parts[i])
        const citation = citations[citationNumber - 1]

        if (citation) {
          elements.push(
            <button
              key={`citation-${citationNumber}`}
              onClick={() => window.open(
                `https://www.youtube.com/watch?v=${citation.videoId}&t=${Math.floor(citation.startTime || 0)}s`,
                '_blank'
              )}
              className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-blue-600 bg-blue-100 border border-blue-200 rounded-full hover:bg-blue-200 transition-colors mx-0.5"
              title={`${citation.videoTitle} - ${formatTime(citation.startTime)}`}
            >
              {citationNumber}
            </button>
          )
        } else {
          elements.push(`[${citationNumber}]`)
        }
      }
    }

    return <p>{elements}</p>
  }

  if (!session?.user) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Chat with {creatorName}
        </h2>
        <p className="text-gray-600 mb-6">
          This is a demo of the chat interface. In the full version, you would sign in to chat with the AI.
        </p>
        <div className="space-y-4">
          <div className="card p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Demo Features</h3>
            <ul className="text-sm text-blue-800 space-y-1 text-left">
              <li>• AI responses based on creator content</li>
              <li>• Source citations from videos</li>
              <li>• Unlimited chat access</li>
              <li>• Real-time conversations</li>
            </ul>
          </div>
          <Link href="/auth/signin">
            <Button className="w-full">Sign In to Chat</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-lg">
              {creatorName.charAt(0)}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {creatorName}
            </h2>
            <p className="text-sm text-gray-500">AI Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Online • Unlimited Access</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Start a conversation
            </h3>
            <p className="text-gray-600 max-w-sm mx-auto">
              Ask {creatorName} anything about their content, expertise, or experiences.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
            >
              {message.role === 'assistant' ?
                renderMessageWithCitations(message.content, message.citations) :
                <p>{message.content}</p>
              }
              
              {message.citations && message.citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sources</p>
                  {message.citations.map((citation, index) => (
                    <a
                      key={index}
                      href={`https://www.youtube.com/watch?v=${citation.videoId}&t=${Math.floor(citation.startTime || 0)}s`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                        <span className="font-medium text-gray-700 truncate flex-1">
                          {citation.videoTitle}
                        </span>
                        {citation.startTime && (
                          <div className="flex items-center space-x-1 text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(citation.startTime)}</span>
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t border-gray-100">
        <div className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={`Message ${creatorName}...`}
            className="input-field flex-1"
            disabled={loading}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!input.trim() || loading}
            className="px-4"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}