import { createClient as createSupabaseClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL) {
  throw new Error('Missing env.SUPABASE_URL')
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY')
}

// Create a single supabase client for interacting with your database
export const supabase = createSupabaseClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Export the createClient function for other components
export function createClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Database type definitions based on our schema
export interface User {
  id: string
  name?: string
  email: string
  password?: string
  email_verified?: Date
  image?: string
  created_at: Date
  updated_at: Date
}

export interface Creator {
  id: string
  user_id: string
  username: string
  display_name: string
  bio?: string
  profile_image?: string
  youtube_channel_id?: string
  youtube_channel_url?: string
  is_active: boolean
  commission_rate: number
  created_at: Date
  updated_at: Date
  // Relations
  user?: User
  videos?: Video[]
  subscriptions?: Subscription[]
  chat_sessions?: ChatSession[]
  voice_settings?: VoiceSettings
  ai_config?: AiConfig
  suggested_questions?: CreatorSuggestedQuestions
  _count?: {
    subscriptions?: number
    videos?: number
    chat_sessions?: number
  }
}

export interface Video {
  id: string
  creator_id: string
  youtube_id: string
  title: string
  description?: string
  thumbnail?: string
  duration?: number
  published_at?: Date
  transcript?: string
  is_processed: boolean
  synced_to_graph_rag?: boolean
  synced_at?: Date
  created_at: Date
  updated_at: Date
  // Relations
  creator?: Creator
}

export interface Account {
  id: string
  user_id: string
  type: string
  provider: string
  provider_account_id: string
  refresh_token?: string
  access_token?: string
  expires_at?: number
  token_type?: string
  scope?: string
  id_token?: string
  session_state?: string
}

export interface Subscription {
  id: string
  user_id: string
  creator_id: string
  status: string
  tier: string
  current_period_start: Date
  current_period_end: Date
  cancel_at_period_end: boolean
  created_at: Date
  updated_at: Date
  // Relations
  user?: User
  creator?: Creator
}

export interface ChatSession {
  id: string
  user_id: string
  creator_id: string
  created_at: Date
  updated_at: Date
}

export interface VoiceSettings {
  id: string
  creator_id: string
  elevenlabs_voice_id?: string
  voice_name?: string
  is_enabled: boolean
  created_at: Date
  updated_at: Date
}

export interface AiConfig {
  id: string
  creator_id: string
  // Identity & Framing
  agent_name?: string
  agent_intro?: string
  ai_label_style?: string
  // Audience & Goals
  primary_audiences?: any[]
  top_outcomes?: any[]
  cta_preferences?: any[]
  // Voice & Style - Tone sliders (1-5)
  directness?: number
  humor?: number
  empathy?: number
  formality?: number
  spiciness?: number
  // Content preferences
  sentence_length?: string
  use_rhetorical_qs?: string
  format_default?: string
  max_bullets_per_answer?: number
  use_headers?: boolean
  use_emojis?: string
  // Language & phrases
  go_to_verbs?: any[]
  catchphrases?: any[]
  avoid_words?: any[]
  open_patterns?: any[]
  close_patterns?: any[]
  // Content policy & safety
  sensitive_domains?: any[]
  red_lines?: any[]
  competitor_policy?: string
  misinfo_handling?: boolean
  // Evidence & citations
  citation_policy?: string
  citation_format?: string
  recency_bias?: string
  // Answer patterns
  default_template?: string
  length_limit?: string
  // Behavior under uncertainty
  uncertainty_handling?: string
  follow_up_style?: string
  // Multilingual
  supported_languages?: any[]
  translate_display?: boolean
  created_at: Date
  updated_at: Date
}

export interface CreatorSuggestedQuestions {
  id: string
  creator_id: string
  questions: any // JSON array of SuggestedQuestion objects
  created_at: Date
  updated_at: Date
}

// Schema setup function
export async function setupDatabaseSchema() {
  const { error } = await supabase.rpc('setup_schema', {
    schema_sql: `
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
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  })

  if (error) {
    console.error('Error setting up database schema:', error)
    throw error
  }
}

// Execute raw SQL (for schema setup)
export async function executeSQL(sql: string) {
  const { data, error } = await supabase.rpc('exec', {
    sql
  })

  if (error) {
    console.error('Error executing SQL:', error)
    throw error
  }

  return data
}