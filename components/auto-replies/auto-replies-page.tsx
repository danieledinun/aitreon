'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SettingsForm } from './settings-form'
import { CommentsDashboard } from './comments-dashboard'
import { AnalyticsCard } from './analytics-card'
import { YouTubeConnectCard } from './youtube-connect-card'
import { Loader2, MessageCircle, ArrowLeft, Settings, MessageSquare, BarChart3, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface AutoRepliesPageProps {
  creatorId: string
}

export default function AutoRepliesPage({ creatorId }: AutoRepliesPageProps) {
  const [activeTab, setActiveTab] = useState('settings')
  const [youtubeConnected, setYoutubeConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    async function checkYouTubeStatus() {
      try {
        const res = await fetch('/api/social/youtube-status')
        if (res.ok) {
          const data = await res.json()
          setYoutubeConnected(data.connected)
        } else {
          setYoutubeConnected(false)
        }
      } catch {
        setYoutubeConnected(false)
      } finally {
        setLoading(false)
      }
    }

    checkYouTubeStatus()
  }, [])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/social/sync', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Sync failed')
        return
      }

      alert(`Fetched ${data.commentsFetched} comments, generated ${data.repliesGenerated} replies`)
    } catch {
      alert('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-tandym-cobalt" />
          <p className="text-gray-600 dark:text-neutral-400">Loading auto-replies...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/creator" className="text-gray-600 dark:text-neutral-400 hover:text-tandym-cobalt dark:hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold font-poppins flex items-center gap-3 text-gray-900 dark:text-white">
              <MessageCircle className="h-7 w-7 text-tandym-cobalt" />
              Auto-Replies
            </h1>
          </div>
          <p className="text-gray-600 dark:text-neutral-400 text-lg">
            Let your AI twin automatically reply to YouTube comments
          </p>
        </div>
        {youtubeConnected && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="border-tandym-cobalt/30 text-tandym-cobalt hover:bg-tandym-cobalt/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Badge className="bg-tandym-cobalt text-white">
              YouTube Connected
            </Badge>
          </div>
        )}
      </div>

      {/* Gate: YouTube not connected */}
      {!youtubeConnected ? (
        <YouTubeConnectCard />
      ) : (
        /* Connected: show tabs */
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mb-8 bg-gray-100 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700">
            <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="replies" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
              <MessageSquare className="h-4 w-4" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <SettingsForm creatorId={creatorId} />
          </TabsContent>

          <TabsContent value="replies">
            <CommentsDashboard creatorId={creatorId} />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsCard creatorId={creatorId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
