'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { MessageCircle, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import EmbeddedChat from './embedded-chat'

interface CompactWidgetProps {
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
  showAvatar?: boolean
  greetingText?: string
  welcomeMessage?: string
  customAvatar?: string
  customLogo?: string
  buttonText?: string
}

interface SuggestedQuestion {
  id: string
  question: string
  category?: string
}

export default function CompactWidget(props: CompactWidgetProps) {
  const {
    creator,
    theme = 'light',
    primaryColor = '#6366f1',
    showAvatar = true,
    buttonText = 'Chat with me'
  } = props

  const [isOpen, setIsOpen] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([])

  const isDark = theme === 'dark' || (theme === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const displayName = creator.display_name || creator.displayName || creator.username
  const profileImage = props.customAvatar || creator.profile_image || creator.profileImage

  useEffect(() => {
    // Fetch suggested questions for this creator
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`/api/creators/${creator.username}/suggested-questions`)
        if (res.ok) {
          const data = await res.json()
          // Take first 3 questions
          setSuggestedQuestions(data.questions?.slice(0, 3) || [])
        }
      } catch (error) {
        console.error('Failed to fetch suggested questions:', error)
        // Fallback to generic questions
        setSuggestedQuestions([
          { id: '1', question: `Hi there 👋` },
          { id: '2', question: `Are you interested in ${displayName}?` },
          { id: '3', question: `Chat with one of our AI Agents` }
        ])
      }
    }
    fetchQuestions()
  }, [creator.username, displayName])

  // Show full chat when opened
  if (isOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <EmbeddedChat {...props} />
      </div>
    )
  }

  // Compact mode with floating button and popup questions
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Suggested Questions Popup */}
      {showQuestions && suggestedQuestions.length > 0 && (
        <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-300">
          {suggestedQuestions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setIsOpen(true)}
              className={cn(
                "px-6 py-3 rounded-full text-sm font-medium shadow-lg transition-all hover:scale-105",
                "animate-in slide-in-from-bottom-2",
                isDark
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              )}
              style={{
                animationDelay: `${index * 50}ms`,
                maxWidth: '280px'
              }}
            >
              {q.question}
            </button>
          ))}
        </div>
      )}

      {/* Main Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setShowQuestions(true)}
        onMouseLeave={() => setShowQuestions(false)}
        className={cn(
          "group flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl transition-all hover:scale-105",
          "text-white font-semibold"
        )}
        style={{ backgroundColor: primaryColor }}
      >
        {showAvatar && profileImage ? (
          <Image
            src={profileImage}
            alt={displayName}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : showAvatar ? (
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
        <span>{buttonText}</span>
      </button>
    </div>
  )
}
