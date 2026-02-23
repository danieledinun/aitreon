export type ToneOverride = 'casual' | 'professional' | 'enthusiastic' | 'default'
export type VideoFilter = 'all' | 'recent' | 'selected'
export type CommentStatus = 'pending' | 'generating' | 'ready' | 'posted' | 'failed' | 'skipped'
export type SessionStatus = 'active' | 'degraded' | 'expired' | 'error'

export interface SocialReplySettings {
  id: string
  creatorId: string
  isEnabled: boolean
  platform: string
  maxRepliesPerDay: number
  minDelaySeconds: number
  maxDelaySeconds: number
  toneOverride: ToneOverride
  maxReplyLength: number
  filterKeywords: string[]
  requireKeywords: string[]
  skipNegative: boolean
  videoFilter: VideoFilter
  videoIds: string[]
  recentDays: number
  createdAt: string
  updatedAt: string
}

export interface SocialComment {
  id: string
  creatorId: string
  platform: string
  platformCommentId: string
  videoId: string | null
  videoTitle: string | null
  authorName: string | null
  authorChannelId: string | null
  commentText: string
  commentPublishedAt: string | null
  parentCommentId: string | null
  aiReplyText: string | null
  status: CommentStatus
  failureReason: string | null
  postedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SocialPlatformSession {
  id: string
  creatorId: string
  platform: string
  sessionStatus: SessionStatus
  lastPollAt: string | null
  lastError: string | null
  commentsFetchedToday: number
  repliesPostedToday: number
  dayResetAt: string
  createdAt: string
  updatedAt: string
}

export interface SocialReplyAnalytics {
  totalComments: number
  totalReplies: number
  repliesPostedToday: number
  pendingReplies: number
  failedReplies: number
  skippedReplies: number
  sessionStatus: SessionStatus | null
  lastPollAt: string | null
}

// Helper to map DB row (snake_case) to app type (camelCase)
export function mapSettingsFromDb(row: Record<string, unknown>): SocialReplySettings {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    isEnabled: row.is_enabled as boolean,
    platform: row.platform as string,
    maxRepliesPerDay: row.max_replies_per_day as number,
    minDelaySeconds: row.min_delay_seconds as number,
    maxDelaySeconds: row.max_delay_seconds as number,
    toneOverride: row.tone_override as ToneOverride,
    maxReplyLength: row.max_reply_length as number,
    filterKeywords: (row.filter_keywords as string[]) || [],
    requireKeywords: (row.require_keywords as string[]) || [],
    skipNegative: row.skip_negative as boolean,
    videoFilter: row.video_filter as VideoFilter,
    videoIds: (row.video_ids as string[]) || [],
    recentDays: row.recent_days as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function mapCommentFromDb(row: Record<string, unknown>): SocialComment {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    platform: row.platform as string,
    platformCommentId: row.platform_comment_id as string,
    videoId: row.video_id as string | null,
    videoTitle: row.video_title as string | null,
    authorName: row.author_name as string | null,
    authorChannelId: row.author_channel_id as string | null,
    commentText: row.comment_text as string,
    commentPublishedAt: row.comment_published_at as string | null,
    parentCommentId: row.parent_comment_id as string | null,
    aiReplyText: row.ai_reply_text as string | null,
    status: row.status as CommentStatus,
    failureReason: row.failure_reason as string | null,
    postedAt: row.posted_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function mapSessionFromDb(row: Record<string, unknown>): SocialPlatformSession {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    platform: row.platform as string,
    sessionStatus: row.session_status as SessionStatus,
    lastPollAt: row.last_poll_at as string | null,
    lastError: row.last_error as string | null,
    commentsFetchedToday: row.comments_fetched_today as number,
    repliesPostedToday: row.replies_posted_today as number,
    dayResetAt: row.day_reset_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
