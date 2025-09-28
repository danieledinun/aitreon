'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Users, Calendar, ExternalLink } from 'lucide-react'

interface CreatorProfileProps {
  creator: {
    id: string
    username: string
    displayName: string
    bio?: string | null
    profileImage?: string | null
    youtubeChannelUrl?: string | null
    createdAt: Date
    videos: Array<{
      id: string
      title: string
      thumbnail?: string | null
      publishedAt?: Date | null
    }>
  }
  subscriberCount: number
  isSubscribed: boolean
  session: any
}

export default function CreatorProfile({ 
  creator, 
  subscriberCount, 
  isSubscribed, 
  session 
}: CreatorProfileProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <div className="relative w-32 h-32 mx-auto mb-6">
          {creator.profileImage ? (
            <Image
              src={creator.profileImage}
              alt={creator.displayName}
              fill
              className="rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              <span className="text-white text-3xl font-bold">
                {creator.displayName.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
            <span className="text-white text-xs font-bold">✓</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          {creator.displayName}
        </h1>
        
        <p className="text-lg text-gray-600 mb-6">AI Creator</p>
        
        {creator.bio && (
          <div className="text-left max-w-md mx-auto mb-8">
            <p className="text-gray-700 leading-relaxed text-base">
              {creator.bio}
            </p>
          </div>
        )}

        {/* Suggested Questions */}
        <div className="text-left max-w-md mx-auto mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Ask me about:</h3>
          <div className="space-y-2">
            <button 
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-sm text-gray-700"
              onClick={() => {
                const chatInput = document.querySelector('textarea[placeholder="Ask me anything..."]') as HTMLTextAreaElement
                if (chatInput) {
                  chatInput.value = "What's your best advice for content creators?"
                  chatInput.focus()
                }
              }}
            >
              "What's your best advice for content creators?"
            </button>
            <button 
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-sm text-gray-700"
              onClick={() => {
                const chatInput = document.querySelector('textarea[placeholder="Ask me anything..."]') as HTMLTextAreaElement
                if (chatInput) {
                  chatInput.value = "How do I grow my YouTube channel?"
                  chatInput.focus()
                }
              }}
            >
              "How do I grow my YouTube channel?"
            </button>
            <button 
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-sm text-gray-700"
              onClick={() => {
                const chatInput = document.querySelector('textarea[placeholder="Ask me anything..."]') as HTMLTextAreaElement
                if (chatInput) {
                  chatInput.value = "What tools do you recommend?"
                  chatInput.focus()
                }
              }}
            >
              "What tools do you recommend?"
            </button>
            <button 
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-sm text-gray-700"
              onClick={() => {
                const chatInput = document.querySelector('textarea[placeholder="Ask me anything..."]') as HTMLTextAreaElement
                if (chatInput) {
                  chatInput.value = "Share your creative process"
                  chatInput.focus()
                }
              }}
            >
              "Share your creative process"
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 mb-6">
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{subscriberCount} supporters</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>Joined {new Date(creator.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        {session?.user ? (
          <div className="space-y-3">
            {isSubscribed ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-green-800 font-semibold">Premium Supporter</p>
                </div>
                <p className="text-green-600 text-sm">
                  Unlimited conversations • Voice features
                </p>
              </div>
            ) : (
              <Link href={`/subscribe/${creator.username}`}>
                <Button className="w-full">
                  Support for $5/month
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <Link href="/auth/signin">
            <Button className="w-full">
              Sign in to Chat
            </Button>
          </Link>
        )}
      </div>
      
      {creator.youtubeChannelUrl && (
        <div className="border-t pt-6">
          <a 
            href={creator.youtubeChannelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm">View YouTube Channel</span>
          </a>
        </div>
      )}
      
      {creator.videos.length > 0 && (
        <div className="border-t pt-6 mt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Content</h3>
          <div className="space-y-3">
            {creator.videos.slice(0, 3).map((video) => (
              <div key={video.id} className="flex space-x-3">
                <div className="relative w-16 h-12 flex-shrink-0">
                  <Image
                    src={video.thumbnail || '/default-thumbnail.png'}
                    alt={video.title}
                    fill
                    className="rounded object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">
                    {video.title}
                  </p>
                  {video.publishedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(video.publishedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}