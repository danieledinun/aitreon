'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Send,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { StatCard } from './stat-card'
import { CommentCard } from './comment-card'
import type { SocialComment, CommentStats } from '@/lib/types/social'

interface CommentsDashboardProps {
  creatorId: string
}

const PAGE_SIZE = 20

export function CommentsDashboard({ creatorId }: CommentsDashboardProps) {
  const [comments, setComments] = useState<SocialComment[]>([])
  const [stats, setStats] = useState<CommentStats>({ total: 0, pending: 0, ready: 0, posted: 0, failed: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [bulkPosting, setBulkPosting] = useState(false)

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      })
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const res = await fetch(`/api/social/comments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
        if (data.stats) {
          setStats(data.stats)
        }
      }
    } catch {
      console.error('Failed to fetch comments')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  function handleFilterChange(value: string) {
    setStatusFilter(value)
    setPage(0)
  }

  async function handleBulkPost() {
    const readyComments = comments.filter((c) => c.status === 'ready')
    if (readyComments.length === 0) return

    setBulkPosting(true)
    try {
      for (const comment of readyComments) {
        await fetch('/api/social/post-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commentId: comment.id }),
        })
      }
      fetchComments()
    } catch {
      console.error('Bulk post failed')
    } finally {
      setBulkPosting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={MessageSquare}
          label="Total"
          count={stats.total}
          gradient="from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          count={stats.pending}
          gradient="from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20"
          iconColor="text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          icon={CheckCircle2}
          label="Ready to Post"
          count={stats.ready}
          gradient="from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <StatCard
          icon={Send}
          label="Posted"
          count={stats.posted}
          gradient="from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20"
          iconColor="text-green-600 dark:text-green-400"
        />
      </div>

      {/* Filter tabs + bulk action */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={statusFilter} onValueChange={handleFilterChange}>
          <TabsList className="bg-gray-100 dark:bg-neutral-900">
            <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800">
              All
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800">
              Pending
            </TabsTrigger>
            <TabsTrigger value="ready" className="data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800">
              Ready
            </TabsTrigger>
            <TabsTrigger value="posted" className="data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800">
              Posted
            </TabsTrigger>
            <TabsTrigger value="failed" className="data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Failed
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {stats.ready > 0 && (
          <Button
            size="sm"
            onClick={handleBulkPost}
            disabled={bulkPosting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {bulkPosting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            Post All Ready ({stats.ready})
          </Button>
        )}
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="py-16 text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 dark:text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold font-poppins text-gray-900 dark:text-white mb-1">
            No comments {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-sm mx-auto">
            {statusFilter !== 'all'
              ? 'Try a different filter or sync your YouTube comments.'
              : 'Comments will appear here once you sync your YouTube channel. Click "Sync Now" above to get started.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                onStatusChange={fetchComments}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={comments.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
