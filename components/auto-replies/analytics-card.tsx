'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Send, Clock, AlertTriangle, SkipForward, Activity, BarChart3 } from 'lucide-react'
import type { SocialReplyAnalytics, SessionStatus } from '@/lib/types/social'

interface AnalyticsCardProps {
  creatorId: string
}

const sessionStatusColors: Record<SessionStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const metricIcons = [MessageSquare, Send, Clock, Clock, AlertTriangle, SkipForward]
const metricColors = [
  'from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20',
  'from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20',
  'from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20',
  'from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20',
  'from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20',
  'from-gray-50 to-gray-100/50 dark:from-gray-950/30 dark:to-gray-900/20',
]

export function AnalyticsCard({ creatorId }: AnalyticsCardProps) {
  const [analytics, setAnalytics] = useState<SocialReplyAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    try {
      const analyticsRes = await fetch('/api/social/analytics')
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data)
      } else {
        setAnalytics({
          totalComments: 0,
          totalReplies: 0,
          repliesPostedToday: 0,
          pendingReplies: 0,
          failedReplies: 0,
          skippedReplies: 0,
          sessionStatus: null,
          lastPollAt: null,
        })
      }
    } catch {
      setAnalytics({
        totalComments: 0,
        totalReplies: 0,
        repliesPostedToday: 0,
        pendingReplies: 0,
        failedReplies: 0,
        skippedReplies: 0,
        sessionStatus: null,
        lastPollAt: null,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!analytics) return null

  const hasData = analytics.totalComments > 0 || analytics.totalReplies > 0

  const metrics = [
    { label: 'Total Comments', value: analytics.totalComments },
    { label: 'Replies Posted', value: analytics.totalReplies },
    { label: "Today's Replies", value: analytics.repliesPostedToday },
    { label: 'Pending', value: analytics.pendingReplies },
    { label: 'Failed', value: analytics.failedReplies },
    { label: 'Skipped', value: analytics.skippedReplies },
  ]

  return (
    <div className="space-y-6">
      {/* Session Health */}
      <Card className="bg-gradient-to-br from-tandym-cobalt/5 to-tandym-lilac/5 dark:from-tandym-cobalt/20 dark:to-tandym-lilac/20 border-tandym-cobalt/20 dark:border-tandym-cobalt/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-tandym-cobalt" />
            Session Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Browser Session</p>
              {analytics.sessionStatus ? (
                <Badge className={sessionStatusColors[analytics.sessionStatus]}>
                  {analytics.sessionStatus}
                </Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
            <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Last Poll</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {analytics.lastPollAt
                  ? new Date(analytics.lastPollAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      {!hasData ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold font-poppins text-gray-900 dark:text-white mb-1">
              No analytics yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-sm mx-auto">
              Analytics will appear here once the automation service starts processing comments on your videos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metrics.map((metric, i) => {
            const Icon = metricIcons[i]
            return (
              <Card key={metric.label} className={`bg-gradient-to-br ${metricColors[i]}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-gray-500 dark:text-neutral-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</p>
                  </div>
                  <p className="text-2xl font-bold font-poppins text-tandym-cobalt">{metric.value}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
