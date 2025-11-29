'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Sparkles, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface DashboardGreetingProps {
  creator: {
    display_name?: string
    displayName?: string
    username?: string
    profile_image?: string
    profileImage?: string
  }
  stats?: {
    followers?: number
    messages?: number
    videos?: number
  }
}

export default function DashboardGreeting({ creator, stats }: DashboardGreetingProps) {
  const [greeting, setGreeting] = useState('Welcome back')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) {
      setGreeting('Good morning')
    } else if (hour < 18) {
      setGreeting('Good afternoon')
    } else {
      setGreeting('Good evening')
    }
  }, [])

  const displayName = creator.display_name || creator.displayName || 'Creator'
  const profileImage = creator.profile_image || creator.profileImage

  // Get initials for avatar
  const initials = displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'C'

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a8a] via-[#4c6ef5] to-[#7c3aed] border border-white/10 p-8">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/10" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      <div className="relative z-10 flex items-start justify-between gap-6 flex-wrap">
        {/* Left side - Greeting and info */}
        <div className="flex items-center gap-6 flex-1 min-w-0">
          {/* Avatar with glow effect */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-tandym-cobalt to-tandym-lilac rounded-full blur-lg opacity-50" />
              <Avatar className="h-20 w-20 border-4 border-white/20 relative">
                <AvatarImage src={profileImage || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-tandym-cobalt to-tandym-lilac text-white font-bold text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </motion.div>

          {/* Greeting text */}
          <div className="min-w-0 flex-1">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <p className="text-white text-sm font-medium">{greeting},</p>
                <Badge className="bg-tandym-coral text-white border-0">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Creator
                </Badge>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold font-poppins text-white mb-3 truncate drop-shadow-lg">
                {displayName}
              </h1>
              <p className="text-white/95 text-base">
                Your AI twin is active and ready to engage with your audience
              </p>
            </motion.div>

            {/* Quick stats */}
            {stats && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="flex items-center gap-6 mt-4"
              >
                {stats.followers !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold font-poppins text-lg">{stats.followers}</div>
                      <div className="text-white/90 text-xs font-medium">Followers</div>
                    </div>
                  </div>
                )}

                {stats.messages !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold font-poppins text-lg">{stats.messages}</div>
                      <div className="text-white/90 text-xs font-medium">Messages</div>
                    </div>
                  </div>
                )}

                {stats.videos !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold font-poppins text-lg">{stats.videos}</div>
                      <div className="text-white/90 text-xs font-medium">Videos</div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right side - CTA button */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex shrink-0"
        >
          <Link href={`/${creator.username}`} target="_blank">
            <Button
              size="lg"
              className="bg-white text-tandym-cobalt hover:bg-white/90 rounded-full shadow-lg shadow-white/20 whitespace-nowrap transition-all duration-300 hover:scale-105"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              View Your Page
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
