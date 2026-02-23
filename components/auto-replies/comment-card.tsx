'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Sparkles,
  Check,
  RotateCcw,
  User,
  Clock,
  Video,
} from 'lucide-react'
import type { SocialComment, CommentStatus } from '@/lib/types/social'

interface CommentCardProps {
  comment: SocialComment
  onStatusChange: () => void
}

const statusConfig: Record<CommentStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  generating: { label: 'Generating...', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  ready: { label: 'Ready to Post', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  posted: { label: 'Posted', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
}

export function CommentCard({ comment, onStatusChange }: CommentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const config = statusConfig[comment.status]
  const hasReply = comment.aiReplyText && (comment.status === 'ready' || comment.status === 'posted')

  async function handleApprove() {
    setLoading(true)
    try {
      const res = await fetch('/api/social/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate reply')
      }

      onStatusChange()
    } catch (err) {
      console.error('Approve failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to generate reply')
    } finally {
      setLoading(false)
    }
  }

  async function handlePostReply() {
    setLoading(true)
    try {
      const res = await fetch('/api/social/post-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to post reply')
      }

      onStatusChange()
    } catch (err) {
      console.error('Post reply failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to post reply')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card className="border border-gray-200 dark:border-neutral-700 hover:border-tandym-cobalt/30 dark:hover:border-tandym-cobalt/40 transition-colors">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Author and metadata */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {comment.authorName || 'Unknown'}
                </span>
              </div>
              {comment.commentPublishedAt && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  {formatDate(comment.commentPublishedAt)}
                </div>
              )}
              {comment.videoTitle && (
                <div className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-[200px]">
                  <Video className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{comment.videoTitle}</span>
                </div>
              )}
            </div>

            {/* Comment text */}
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              {comment.commentText}
            </p>
          </div>

          {/* Status badge and actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={config.className}>{config.label}</Badge>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          {comment.status === 'pending' && (
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={loading}
              className="bg-tandym-cobalt hover:bg-tandym-cobalt/90 text-white"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              Generate Reply
            </Button>
          )}

          {comment.status === 'ready' && (
            <>
              <Button
                size="sm"
                onClick={handlePostReply}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Post to YouTube
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                className="text-gray-500"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                )}
                Preview
              </Button>
            </>
          )}

          {comment.status === 'posted' && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                Posted {comment.postedAt ? formatDate(comment.postedAt) : ''}
              </div>
              {comment.aiReplyText && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(!expanded)}
                  className="text-gray-500"
                >
                  {expanded ? (
                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                  )}
                  View Reply
                </Button>
              )}
            </>
          )}

          {comment.status === 'failed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleApprove}
              disabled={loading}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Retry
            </Button>
          )}

          {comment.status === 'generating' && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating AI reply...
            </div>
          )}
        </div>

        {/* Expandable reply preview */}
        {expanded && comment.aiReplyText && (
          <div className="mt-3 p-3 bg-tandym-cobalt/5 dark:bg-tandym-cobalt/10 rounded-lg border border-tandym-cobalt/10 dark:border-tandym-cobalt/20">
            <p className="text-xs font-medium text-tandym-cobalt mb-1">AI Reply</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{comment.aiReplyText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
