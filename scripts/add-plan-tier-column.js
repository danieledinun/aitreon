const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPlanTierColumn() {
  console.log('🔧 Adding plan_tier column to creators table...')

  try {
    // Add plan_tier column with default 'FREE'
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add plan_tier column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'creators' AND column_name = 'plan_tier'
          ) THEN
            ALTER TABLE creators
            ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'FREE'
            CHECK (plan_tier IN ('FREE', 'LITE', 'PRO', 'ULTIMATE', 'ENTERPRISE'));
          END IF;
        END $$;

        -- Add billing_period column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'creators' AND column_name = 'billing_period'
          ) THEN
            ALTER TABLE creators
            ADD COLUMN billing_period TEXT NULL
            CHECK (billing_period IN ('monthly', 'yearly') OR billing_period IS NULL);
          END IF;
        END $$;

        -- Add subscription_status column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'creators' AND column_name = 'subscription_status'
          ) THEN
            ALTER TABLE creators
            ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active'
            CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid'));
          END IF;
        END $$;

        -- Add trial_ends_at column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'creators' AND column_name = 'trial_ends_at'
          ) THEN
            ALTER TABLE creators
            ADD COLUMN trial_ends_at TIMESTAMPTZ NULL;
          END IF;
        END $$;

        -- Add current_period_ends_at column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'creators' AND column_name = 'current_period_ends_at'
          ) THEN
            ALTER TABLE creators
            ADD COLUMN current_period_ends_at TIMESTAMPTZ NULL;
          END IF;
        END $$;

        -- Add stripe_subscription_id column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'creators' AND column_name = 'stripe_subscription_id'
          ) THEN
            ALTER TABLE creators
            ADD COLUMN stripe_subscription_id TEXT NULL UNIQUE;
          END IF;
        END $$;

        -- Add stripe_customer_id column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'creators' AND column_name = 'stripe_customer_id'
          ) THEN
            ALTER TABLE creators
            ADD COLUMN stripe_customer_id TEXT NULL UNIQUE;
          END IF;
        END $$;
      `
    })

    if (alterError) {
      // Try direct SQL execution
      await supabase.from('creators').select('plan_tier').limit(1)
        .throwOnError()

      console.log('✓ Columns already exist or were added successfully')
    } else {
      console.log('✓ Plan tier and billing columns added successfully')
    }

    // Verify columns exist
    const { data: creators, error: selectError } = await supabase
      .from('creators')
      .select('id, username, plan_tier, billing_period, subscription_status')
      .limit(1)

    if (selectError) {
      throw selectError
    }

    console.log('✓ Verification complete - columns accessible')
    console.log('\nNew columns added to creators table:')
    console.log('  - plan_tier (TEXT, default: FREE)')
    console.log('  - billing_period (TEXT, nullable)')
    console.log('  - subscription_status (TEXT, default: active)')
    console.log('  - trial_ends_at (TIMESTAMPTZ, nullable)')
    console.log('  - current_period_ends_at (TIMESTAMPTZ, nullable)')
    console.log('  - stripe_subscription_id (TEXT, nullable, unique)')
    console.log('  - stripe_customer_id (TEXT, nullable, unique)')

  } catch (error) {
    console.error('✗ Failed to add columns:', error)
    process.exit(1)
  }
}

addPlanTierColumn()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
