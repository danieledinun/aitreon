const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addUserActivityTables() {
  console.log('🚀 Adding user activity tracking tables...')

  try {
    // Create user_activity table
    const { error: activityError } = await supabase.rpc('exec', {
      sql: `
        -- Create user_activity table to track recently visited creators
        CREATE TABLE IF NOT EXISTS user_activity (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
            activity_type TEXT NOT NULL CHECK (activity_type IN ('visit', 'chat', 'subscribe', 'unsubscribe')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create indexes for efficient querying
        CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_activity_creator_id ON user_activity(creator_id);
        CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
        CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
      `
    })

    if (activityError) {
      console.error('❌ Error creating user_activity table:', activityError)
      return
    }

    // Create user_subscriptions table
    const { error: subscriptionsError } = await supabase.rpc('exec', {
      sql: `
        -- Create user_subscriptions table for tracking following/subscriptions
        CREATE TABLE IF NOT EXISTS user_subscriptions (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
            subscription_type TEXT NOT NULL DEFAULT 'follow' CHECK (subscription_type IN ('follow', 'premium')),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),

            -- Prevent duplicate subscriptions
            UNIQUE(user_id, creator_id)
        );

        -- Create indexes for subscriptions
        CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_subscriptions_creator_id ON user_subscriptions(creator_id);
        CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(is_active);
      `
    })

    if (subscriptionsError) {
      console.error('❌ Error creating user_subscriptions table:', subscriptionsError)
      return
    }

    console.log('✅ Successfully created user activity tracking tables')

    // Add some sample data
    console.log('📝 Adding sample user activity data...')

    // Get some existing users and creators
    const { data: users } = await supabase.from('users').select('id').limit(3)
    const { data: creators } = await supabase.from('creators').select('id').limit(5)

    if (users && users.length > 0 && creators && creators.length > 0) {
      // Add sample visits
      for (let i = 0; i < users.length; i++) {
        for (let j = 0; j < Math.min(3, creators.length); j++) {
          const user = users[i]
          const creator = creators[j]

          // Add visit activity
          await supabase.from('user_activity').upsert({
            user_id: user.id,
            creator_id: creator.id,
            activity_type: 'visit'
          }, { onConflict: 'user_id,creator_id,activity_type' })

          // Add some chat activities
          if (Math.random() > 0.5) {
            await supabase.from('user_activity').upsert({
              user_id: user.id,
              creator_id: creator.id,
              activity_type: 'chat'
            }, { onConflict: 'user_id,creator_id,activity_type' })
          }

          // Add some subscriptions
          if (Math.random() > 0.7) {
            await supabase.from('user_subscriptions').upsert({
              user_id: user.id,
              creator_id: creator.id,
              subscription_type: 'follow'
            }, { onConflict: 'user_id,creator_id' })
          }
        }
      }
      console.log('✅ Added sample user activity data')
    }

  } catch (error) {
    console.error('❌ Error in migration:', error)
  }
}

addUserActivityTables()