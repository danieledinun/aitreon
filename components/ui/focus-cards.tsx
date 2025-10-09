'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MessageCircle, Users, Heart, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface Creator {
  id: string
  display_name: string
  bio?: string
  avatar_url?: string
  profile_image?: string
  youtube_channel_url?: string
  verification_status?: string
  subscriber_count?: number
  conversation_count?: number
  category?: string
  username?: string
  is_active?: boolean
}

interface CreatorCardProps {
  creator: Creator
  index: number
  hovered: number | null
  setHovered: React.Dispatch<React.SetStateAction<number | null>>
  onStartChat: (creatorId: string) => void
  onToggleFollow: (creatorId: string) => void
  isFollowed: boolean
}

interface FocusCardsProps {
  creators: Creator[]
  onStartChat: (creatorId: string) => void
  onToggleFollow: (creatorId: string) => void
  isFollowed: (creatorId: string) => boolean
}

function CreatorCard({
  creator,
  index,
  hovered,
  setHovered,
  onStartChat,
  onToggleFollow,
  isFollowed
}: CreatorCardProps) {
  const isBlurred = hovered !== null && hovered !== index
  const avatarUrl = creator.avatar_url || creator.profile_image

  const formatCount = (count: number | undefined) => {
    if (!count) return '0'
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M'
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K'
    }
    return count.toString()
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden bg-gradient-to-br from-white via-white to-gray-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900/50 border-0 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-[1.02] cursor-pointer",
        isBlurred ? "opacity-50 blur-[2px] scale-95" : "opacity-100 blur-none scale-100"
      )}
      onMouseEnter={() => setHovered(index)}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Gradient overlay for hover effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500" />

      {/* Animated border */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
           style={{ padding: '1px', borderRadius: '12px' }}>
        <div className="w-full h-full bg-white dark:bg-gray-800 rounded-[11px]" />
      </div>

      <div className="relative z-10">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="h-16 w-16 ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-4 group-hover:ring-purple-500/30 transition-all duration-300">
                  <AvatarImage src={avatarUrl} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold text-lg">
                    {getInitials(creator.display_name)}
                  </AvatarFallback>
                </Avatar>
                {creator.verification_status === 'verified' && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center ring-3 ring-white dark:ring-gray-800 shadow-lg">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl font-bold group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300 line-clamp-1">
                  {creator.display_name}
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="mt-2 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 text-blue-700 dark:text-blue-300 border-0"
                >
                  {creator.category || 'Creator'}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          <CardDescription className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-6 leading-relaxed">
            {creator.bio || 'Passionate creator sharing amazing content and connecting with the community.'}
          </CardDescription>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50">
              <div className="flex items-center justify-center mb-1">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                {formatCount(creator.subscriber_count)}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Followers</div>
            </div>

            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-100 dark:border-purple-800/50">
              <div className="flex items-center justify-center mb-1">
                <MessageCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {formatCount(creator.conversation_count)}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Conversations</div>
            </div>
          </div>

          <div className="flex items-center justify-center mb-4">
            <div className="px-4 py-2 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-800/50">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">AI Available 24/7</span>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-0 pb-6">
          <div className="w-full space-y-3">
            <Link
              href={`/${creator.username || creator.display_name.toLowerCase().replace(/\s+/g, '')}`}
              className="block"
              onClick={() => onStartChat(creator.id)}
            >
              <Button className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 text-base font-semibold py-3">
                <MessageCircle className="h-5 w-5 mr-2" />
                Start AI Chat
              </Button>
            </Link>

            <Button
              variant={isFollowed ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleFollow(creator.id)}
              className={cn(
                "w-full transition-all duration-300",
                isFollowed
                  ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg"
                  : "border-2 border-gray-200 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/20"
              )}
            >
              <Heart className={cn("h-4 w-4 mr-2", isFollowed && "fill-current")} />
              {isFollowed ? 'Following' : 'Follow'}
            </Button>
          </div>
        </CardFooter>
      </div>
    </Card>
  )
}

export function FocusCards({ creators, onStartChat, onToggleFollow, isFollowed }: FocusCardsProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (creators.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
          <MessageCircle className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Creators Found</h3>
        <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filters to discover amazing creators.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {creators.map((creator, index) => (
        <CreatorCard
          key={creator.id}
          creator={creator}
          index={index}
          hovered={hovered}
          setHovered={setHovered}
          onStartChat={onStartChat}
          onToggleFollow={onToggleFollow}
          isFollowed={isFollowed(creator.id)}
        />
      ))}
    </div>
  )
}