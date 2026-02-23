'use client'

import { signIn } from 'next-auth/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Youtube } from 'lucide-react'

export function YouTubeConnectCard() {
  return (
    <Card className="bg-gradient-to-br from-tandym-cobalt/5 to-tandym-lilac/5 dark:from-tandym-cobalt/20 dark:to-tandym-lilac/20 border-tandym-cobalt/20 dark:border-tandym-cobalt/30">
      <div className="p-8 md:p-12 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <Youtube className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-bold font-poppins text-gray-900 dark:text-white">
            Connect Your YouTube Account
          </h2>
          <p className="text-gray-600 dark:text-neutral-400 text-lg max-w-lg mx-auto">
            Auto-replies require access to your YouTube channel so your AI twin can read
            comments and post replies on your behalf.
          </p>
        </div>

        <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 max-w-md mx-auto text-left space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">
            This connection allows your AI twin to:
          </p>
          <ul className="text-sm text-gray-600 dark:text-neutral-400 space-y-1">
            <li>• Read new comments on your videos</li>
            <li>• Generate and post replies as you</li>
            <li>• Filter comments based on your preferences</li>
          </ul>
        </div>

        <Button
          size="lg"
          className="bg-gradient-to-r from-tandym-cobalt to-tandym-lilac text-white hover:opacity-90 transition-opacity px-8"
          onClick={() => signIn('google', { callbackUrl: '/creator/auto-replies' })}
        >
          <Youtube className="h-5 w-5 mr-2" />
          Connect YouTube
        </Button>

        <p className="text-xs text-gray-500 dark:text-neutral-500">
          You&apos;ll be redirected to Google to authorize access to your YouTube channel.
        </p>
      </div>
    </Card>
  )
}
