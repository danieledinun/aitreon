'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare } from 'lucide-react'
import type { SocialComment, CommentStatus } from '@/lib/types/social'

interface RecentRepliesFeedProps {
  creatorId: string
}

const statusColors: Record<CommentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  generating: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ready: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  posted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  skipped: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
}

export function RecentRepliesFeed({ creatorId }: RecentRepliesFeedProps) {
  const [comments, setComments] = useState<SocialComment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      })
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const res = await fetch(`/api/social/comments?creatorId=${creatorId}&${params}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
      }
    } catch {
      console.error('Failed to fetch comments')
    } finally {
      setLoading(false)
    }
  }, [creatorId, statusFilter, page])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.substring(0, maxLen) + '...' : text

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-tandym-cobalt" />
          Recent Comments & Replies
        </CardTitle>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="generating">Generating</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold font-poppins text-gray-900 dark:text-white mb-1">
              No comments yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-sm mx-auto">
              Comments will appear here once the automation service starts polling your YouTube videos.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Author</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>AI Reply</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell className="font-medium text-sm whitespace-nowrap">
                      {comment.authorName || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      {truncate(comment.commentText, 80)}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      {comment.aiReplyText
                        ? truncate(comment.aiReplyText, 80)
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px]">
                      {comment.videoTitle
                        ? truncate(comment.videoTitle, 40)
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[comment.status]}>
                        {comment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={comments.length < pageSize}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
