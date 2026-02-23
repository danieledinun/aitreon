'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

export function AnalyticsCard({ creatorId }: AnalyticsCardProps) {
  const [analytics, setAnalytics] = useState<SocialReplyAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/social/settings?analytics=true`)
      if (res.ok) {
        // Analytics is embedded in settings response or fetched separately
        // For now we use the settings endpoint data
      }

      // Fetch analytics from a dedicated endpoint
      const analyticsRes = await fetch(`/api/social/analytics`)
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data)
      } else {
        // Provide default values when endpoint doesn't exist yet
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
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

  const metrics = [
    {
      label: 'Total Comments',
      value: analytics.totalComments,
    },
    {
      label: 'Replies Posted',
      value: analytics.totalReplies,
    },
    {
      label: 'Today\'s Replies',
      value: analytics.repliesPostedToday,
    },
    {
      label: 'Pending',
      value: analytics.pendingReplies,
    },
    {
      label: 'Failed',
      value: analytics.failedReplies,
    },
    {
      label: 'Skipped',
      value: analytics.skippedReplies,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Session Health */}
      <Card>
        <CardHeader>
          <CardTitle>Session Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Browser Session</p>
              {analytics.sessionStatus ? (
                <Badge className={sessionStatusColors[analytics.sessionStatus]}>
                  {analytics.sessionStatus}
                </Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last Poll</p>
              <p className="text-sm font-medium">
                {analytics.lastPollAt
                  ? new Date(analytics.lastPollAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</p>
              <p className="text-2xl font-bold font-poppins mt-1">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
