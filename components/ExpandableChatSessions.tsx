'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  MessageCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Mic,
  Type,
  Smile,
  Frown,
  Meh
} from 'lucide-react'

interface Message {
  id: string
  role: string
  content: string
  created_at: string
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null
  sentiment_confidence?: number | null
}

interface ChatSession {
  id: string
  created_at: string
  user?: {
    name: string
    email: string
    image?: string
  }
  messages: Message[]
}

interface ExpandableChatSessionsProps {
  sessions: ChatSession[]
}

export default function ExpandableChatSessions({ sessions }: ExpandableChatSessionsProps) {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  // Helper function to analyze session interaction types
  const getSessionInteractionTypes = (session: ChatSession) => {
    const hasVoiceOrigin = session.id.startsWith('voice-')
    const hasMessages = session.messages && session.messages.length > 0

    return {
      showVoice: hasVoiceOrigin, // Show voice tag if session originated from voice
      showChat: hasMessages, // Show chat tag if there are text messages
      isVoiceOnly: hasVoiceOrigin && !hasMessages,
      isChatOnly: !hasVoiceOrigin && hasMessages,
      isMixed: hasVoiceOrigin && hasMessages
    }
  }

  // Helper function to analyze session sentiment
  const getSessionSentiment = (session: ChatSession) => {
    const userMessages = session.messages?.filter(m => m.role === 'user' || m.role === 'USER') || []
    const messagesWithSentiment = userMessages.filter(m => m.sentiment)

    if (messagesWithSentiment.length === 0) {
      return { dominant: null, count: 0, distribution: { positive: 0, negative: 0, neutral: 0 } }
    }

    const distribution = {
      positive: messagesWithSentiment.filter(m => m.sentiment === 'POSITIVE').length,
      negative: messagesWithSentiment.filter(m => m.sentiment === 'NEGATIVE').length,
      neutral: messagesWithSentiment.filter(m => m.sentiment === 'NEUTRAL').length
    }

    // Find dominant sentiment
    let dominant: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL'
    let maxCount = distribution.neutral

    if (distribution.positive > maxCount) {
      dominant = 'POSITIVE'
      maxCount = distribution.positive
    }
    if (distribution.negative > maxCount) {
      dominant = 'NEGATIVE'
    }

    return {
      dominant,
      count: messagesWithSentiment.length,
      distribution
    }
  }

  // Helper function to get sentiment icon and color
  const getSentimentDisplay = (sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL') => {
    switch (sentiment) {
      case 'POSITIVE':
        return {
          icon: <Smile className="w-3 h-3 mr-1" />,
          label: 'Positive',
          className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
        }
      case 'NEGATIVE':
        return {
          icon: <Frown className="w-3 h-3 mr-1" />,
          label: 'Negative',
          className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }
      case 'NEUTRAL':
        return {
          icon: <Meh className="w-3 h-3 mr-1" />,
          label: 'Neutral',
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
        }
    }
  }

  const formatMessage = (message: Message) => {
    const isUser = message.role === 'USER'
    return (
      <div key={message.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
        <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
          <div className={`rounded-2xl px-4 py-2 ${
            isUser 
              ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white ml-auto' 
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white'
          }`}>
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
          <p className={`text-xs text-gray-500 dark:text-neutral-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Card className="bg-white/50 dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-400" />
          Recent Chat Sessions
        </CardTitle>
        <CardDescription className="text-gray-500 dark:text-neutral-400">
          Latest interactions with your AI replica - click to expand transcripts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sessions.slice(0, 5).map((session) => (
            <div
              key={session.id}
              className="border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50/50 dark:bg-neutral-800/50 overflow-hidden transition-all duration-200 ease-in-out hover:border-gray-300 dark:hover:border-neutral-600 hover:shadow-sm"
            >
              {/* Session Header - Always Visible */}
              <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => toggleSession(session.id)}
              >
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user?.image || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
                      {session.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {session.user?.name || 'Anonymous User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">
                      {new Date(session.created_at).toLocaleDateString()} • {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Session Type Badges */}
                  {(() => {
                    const interactionTypes = getSessionInteractionTypes(session)
                    const sentiment = getSessionSentiment(session)

                    return (
                      <>
                        {interactionTypes.showVoice && (
                          <Badge variant="default" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            <Mic className="w-3 h-3 mr-1" />
                            Voice
                          </Badge>
                        )}
                        {interactionTypes.showChat && (
                          <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <Type className="w-3 h-3 mr-1" />
                            Chat
                          </Badge>
                        )}
                        {sentiment.dominant && sentiment.count > 0 && (
                          <Badge variant="default" className={getSentimentDisplay(sentiment.dominant).className}>
                            {getSentimentDisplay(sentiment.dominant).icon}
                            {getSentimentDisplay(sentiment.dominant).label}
                          </Badge>
                        )}
                      </>
                    )
                  })()}
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {session.messages?.length || 0} messages
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {expandedSessions.has(session.id) ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Expandable Transcript */}
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                expandedSessions.has(session.id) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <Separator className="bg-gray-200 dark:bg-neutral-700" />
                <div className="p-4 bg-white/30 dark:bg-neutral-900/30">
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {session.messages && session.messages.length > 0 ? (
                      session.messages.map((message) => formatMessage(message))
                    ) : (
                      <div className="text-center py-6">
                        <MessageCircle className="w-8 h-8 mx-auto text-gray-400 dark:text-neutral-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-neutral-400">No messages in this session yet</p>
                      </div>
                    )}
                  </div>
                  
                  {session.messages && session.messages.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-neutral-700 flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-300"
                        asChild
                      >
                        <Link href="/creator/chat-sessions">
                          <Eye className="w-4 h-4 mr-2" />
                          View Full Session
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {sessions.length > 5 && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" className="border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-300" asChild>
              <Link href="/creator/chat-sessions">
                View All Sessions ({sessions.length})
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}