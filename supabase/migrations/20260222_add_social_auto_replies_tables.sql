-- Social Reply Settings (per-creator config)
CREATE TABLE IF NOT EXISTS social_reply_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    platform TEXT DEFAULT 'youtube',
    max_replies_per_day INTEGER DEFAULT 50,
    min_delay_seconds INTEGER DEFAULT 30,
    max_delay_seconds INTEGER DEFAULT 120,
    tone_override TEXT DEFAULT 'default' CHECK (tone_override IN ('casual', 'professional', 'enthusiastic', 'default')),
    max_reply_length INTEGER DEFAULT 300,
    filter_keywords JSONB DEFAULT '[]'::jsonb,
    require_keywords JSONB DEFAULT '[]'::jsonb,
    skip_negative BOOLEAN DEFAULT false,
    video_filter TEXT DEFAULT 'all' CHECK (video_filter IN ('all', 'recent', 'selected')),
    video_ids JSONB DEFAULT '[]'::jsonb,
    recent_days INTEGER DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(creator_id)
);

-- Social Comments (fetched comments + AI replies)
CREATE TABLE IF NOT EXISTS social_comments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    platform TEXT DEFAULT 'youtube',
    platform_comment_id TEXT NOT NULL,
    video_id TEXT,
    video_title TEXT,
    author_name TEXT,
    author_channel_id TEXT,
    comment_text TEXT NOT NULL,
    comment_published_at TIMESTAMPTZ,
    parent_comment_id TEXT,
    ai_reply_text TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'posted', 'failed', 'skipped')),
    failure_reason TEXT,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(creator_id, platform_comment_id)
);

-- Social Platform Sessions (browser session health)
CREATE TABLE IF NOT EXISTS social_platform_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    platform TEXT DEFAULT 'youtube',
    session_status TEXT DEFAULT 'active' CHECK (session_status IN ('active', 'degraded', 'expired', 'error')),
    last_poll_at TIMESTAMPTZ,
    last_error TEXT,
    comments_fetched_today INTEGER DEFAULT 0,
    replies_posted_today INTEGER DEFAULT 0,
    day_reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(creator_id, platform)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_comments_creator_status ON social_comments(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_social_comments_creator_platform ON social_comments(creator_id, platform_comment_id);
CREATE INDEX IF NOT EXISTS idx_social_platform_sessions_creator ON social_platform_sessions(creator_id, platform);
