const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const schemaSql = `
-- Create users table (NextAuth core)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    email_verified TIMESTAMPTZ,
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create accounts table (NextAuth OAuth)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    UNIQUE(provider, provider_account_id)
);

-- Create sessions table (NextAuth)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
);

-- Create creators table
CREATE TABLE IF NOT EXISTS creators (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT,
    profile_image TEXT,
    youtube_channel_id TEXT,
    youtube_channel_url TEXT,
    is_active BOOLEAN DEFAULT true,
    commission_rate DECIMAL DEFAULT 0.10,
    stripe_account_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    youtube_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail TEXT,
    duration INTEGER,
    published_at TIMESTAMPTZ,
    transcript TEXT,
    is_processed BOOLEAN DEFAULT false,
    synced_to_graph_rag BOOLEAN DEFAULT false,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create content_chunks table
CREATE TABLE IF NOT EXISTS content_chunks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    start_time DECIMAL,
    end_time DECIMAL,
    chunk_index INTEGER DEFAULT 0,
    embedding JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    status TEXT DEFAULT 'ACTIVE',
    tier TEXT DEFAULT 'BASIC',
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, creator_id)
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create citations table
CREATE TABLE IF NOT EXISTS citations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL,
    video_title TEXT NOT NULL,
    start_time DECIMAL,
    end_time DECIMAL,
    content TEXT NOT NULL
);

-- Create daily_usage table
CREATE TABLE IF NOT EXISTS daily_usage (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL,
    date DATE NOT NULL,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, creator_id, date)
);

-- Create voice_settings table
CREATE TABLE IF NOT EXISTS voice_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    elevenlabs_voice_id TEXT,
    voice_name TEXT,
    is_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_config table
CREATE TABLE IF NOT EXISTS ai_config (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    
    -- Identity & Framing
    agent_name TEXT,
    agent_intro TEXT,
    ai_label_style TEXT DEFAULT 'SUBTLE',
    
    -- Audience & Goals
    primary_audiences JSONB,
    top_outcomes JSONB,
    cta_preferences JSONB,
    
    -- Voice & Style - Tone sliders (1-5)
    directness INTEGER DEFAULT 3,
    humor INTEGER DEFAULT 3,
    empathy INTEGER DEFAULT 3,
    formality INTEGER DEFAULT 3,
    spiciness INTEGER DEFAULT 3,
    
    -- Content preferences
    sentence_length TEXT DEFAULT 'MEDIUM',
    use_rhetorical_qs TEXT DEFAULT 'SOMETIMES',
    format_default TEXT DEFAULT 'BULLETS',
    max_bullets_per_answer INTEGER DEFAULT 5,
    use_headers BOOLEAN DEFAULT true,
    use_emojis TEXT DEFAULT 'SOMETIMES',
    
    -- Language & phrases
    go_to_verbs JSONB,
    catchphrases JSONB,
    avoid_words JSONB,
    open_patterns JSONB,
    close_patterns JSONB,
    
    -- Content policy & safety
    sensitive_domains JSONB,
    red_lines JSONB,
    competitor_policy TEXT DEFAULT 'NEUTRAL',
    misinfo_handling BOOLEAN DEFAULT true,
    
    -- Evidence & citations
    citation_policy TEXT DEFAULT 'FACTUAL',
    citation_format TEXT DEFAULT 'INLINE',
    recency_bias TEXT DEFAULT 'BALANCED',
    
    -- Answer patterns
    default_template TEXT DEFAULT 'STANCE_BULLETS',
    length_limit TEXT DEFAULT 'MEDIUM',
    
    -- Behavior under uncertainty
    uncertainty_handling TEXT DEFAULT 'NEAREST',
    follow_up_style TEXT DEFAULT 'ONE_QUESTION',
    
    -- Multilingual
    supported_languages JSONB,
    translate_display BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create creator_suggested_questions table
CREATE TABLE IF NOT EXISTS creator_suggested_questions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_creators_user_id ON creators(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_creator_id ON videos(creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);
CREATE INDEX IF NOT EXISTS idx_content_chunks_video_id ON content_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id ON subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_creator_id ON chat_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_citations_message_id ON citations(message_id);
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_creator_date ON daily_usage(user_id, creator_id, date);

-- Add updated_at trigger functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_creators_updated_at BEFORE UPDATE ON creators FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_content_chunks_updated_at BEFORE UPDATE ON content_chunks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_daily_usage_updated_at BEFORE UPDATE ON daily_usage FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_voice_settings_updated_at BEFORE UPDATE ON voice_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_ai_config_updated_at BEFORE UPDATE ON ai_config FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_creator_suggested_questions_updated_at BEFORE UPDATE ON creator_suggested_questions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
`

async function setupDatabase() {
  try {
    console.log('🔄 Setting up Supabase database schema...')
    
    // Split schema into individual statements and execute them one by one
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`📝 Executing statement ${i + 1}/${statements.length}...`)
      
      const { data, error } = await supabase.rpc('exec', {
        sql: statement
      })

      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error)
        console.error('Statement:', statement)
        throw error
      }
    }
    
    console.log('✅ Database schema setup complete!')
    
    // Test the connection by listing tables
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (tableError) {
      console.error('❌ Error listing tables:', tableError)
    } else {
      console.log('📋 Created tables:', tables?.map(t => t.table_name))
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error)
    process.exit(1)
  }
}

setupDatabase()