'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, Phone, Clock, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface ActivityItem {
  id: string
  type: 'chat' | 'voice_call'
  sessionId: string
  creatorId: string
  creatorName: string
  creatorUsername: string
  creatorImage?: string
  timestamp: string
  messageCount: number
  lastMessage?: string
}

interface RecentActivityFeedProps {
  userId: string
}

export default function RecentActivityFeed({ userId }: RecentActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentActivity()
  }, [userId])

  const fetchRecentActivity = async () => {
    try {
      setLoading(true)

      // Fetch recent chat sessions with their messages
      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          creator_id,
          updated_at,
          creators (
            id,
            display_name,
            username,
            profile_image
          ),
          messages (
            id,
            content,
            message_type,
            created_at,
            role
          )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching recent activity:', error)
        setLoading(false)
        return
      }

      // Transform sessions into activity items
      const activityItems: ActivityItem[] = []

      sessions?.forEach((session: any) => {
        if (!session.creators || !session.messages || session.messages.length === 0) return

        const creator = session.creators
        const messages = session.messages

        // Check if this session has voice messages
        const hasVoiceMessages = messages.some((m: any) => m.message_type === 'voice_transcript')
        const textMessages = messages.filter((m: any) => m.message_type === 'text' || !m.message_type)

        // Get the last user message for preview
        const lastUserMessage = messages
          .filter((m: any) => m.role === 'user')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

        // Create activity items for voice calls
        if (hasVoiceMessages) {
          activityItems.push({
            id: `${session.id}-voice`,
            type: 'voice_call',
            sessionId: session.id,
            creatorId: creator.id,
            creatorName: creator.display_name,
            creatorUsername: creator.username,
            creatorImage: creator.profile_image,
            timestamp: session.updated_at,
            messageCount: messages.filter((m: any) => m.message_type === 'voice_transcript').length,
            lastMessage: lastUserMessage?.content
          })
        }

        // Create activity items for text chats
        if (textMessages.length > 0) {
          activityItems.push({
            id: `${session.id}-chat`,
            type: 'chat',
            sessionId: session.id,
            creatorId: creator.id,
            creatorName: creator.display_name,
            creatorUsername: creator.username,
            creatorImage: creator.profile_image,
            timestamp: session.updated_at,
            messageCount: textMessages.length,
            lastMessage: lastUserMessage?.content
          })
        }
      })

      // Sort all activities by timestamp
      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setActivities(activityItems.slice(0, 15))
      setLoading(false)
    } catch (error) {
      console.error('Error fetching recent activity:', error)
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMinutes = Math.floor(diffInMs / 60000)
    const diffInHours = Math.floor(diffInMs / 3600000)
    const diffInDays = Math.floor(diffInMs / 86400000)

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    return date.toLocaleDateString()
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  if (loading) {
    return (
      <Card className="border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Recent Activity
          </CardTitle>
          <CardDescription>Loading your recent interactions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Recent Activity
          </CardTitle>
          <CardDescription>Your recent chats and calls will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Activity Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Start chatting with creators to see your activity here
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Recent Activity
          </div>
          <Badge variant="secondary" className="text-sm">
            {activities.length} {activities.length === 1 ? 'Activity' : 'Activities'}
          </Badge>
        </CardTitle>
        <CardDescription>Your recent chats and phone calls with AI creators</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {activities.map((activity, index) => (
            <Link
              key={activity.id}
              href={`/${activity.creatorUsername}`}
              className="block"
            >
              <div className="group flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                {/* Timeline indicator */}
                <div className="relative flex flex-col items-center">
                  <Avatar className={`h-12 w-12 ring-2 ${
                    activity.type === 'voice_call'
                      ? 'ring-green-500/30'
                      : 'ring-blue-500/30'
                  }`}>
                    <AvatarImage src={activity.creatorImage || undefined} />
                    <AvatarFallback className={`font-semibold ${
                      activity.type === 'voice_call'
                        ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                        : 'bg-gradient-to-br from-blue-500 to-purple-500'
                    } text-white`}>
                      {getInitials(activity.creatorName)}
                    </AvatarFallback>
                  </Avatar>
                  {index < activities.length - 1 && (
                    <div className="absolute top-12 w-0.5 h-16 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-600"></div>
                  )}
                </div>

                {/* Activity content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {activity.type === 'voice_call' ? (
                          <span className="flex items-center">
                            <Phone className="h-4 w-4 mr-1.5 text-green-600" />
                            Phone call with {activity.creatorName}
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <MessageCircle className="h-4 w-4 mr-1.5 text-blue-600" />
                            Chat with {activity.creatorName}
                          </span>
                        )}
                      </p>
                      {activity.lastMessage && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-1">
                          {activity.lastMessage}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all ml-2 flex-shrink-0" />
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTimestamp(activity.timestamp)}
                    </span>
                    <span>•</span>
                    <span>{activity.messageCount} {activity.messageCount === 1 ? 'message' : 'messages'}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {activities.length >= 15 && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm" className="text-sm">
              Load More Activity
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
