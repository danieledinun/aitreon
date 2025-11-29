-- Migration: Add Plan Tier and Billing Columns to Creators Table
-- Run this in Supabase SQL Editor or via supabase migration

-- Add plan_tier column
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'FREE';

-- Add CHECK constraint for plan_tier
ALTER TABLE creators
ADD CONSTRAINT plan_tier_check
CHECK (plan_tier IN ('FREE', 'LITE', 'PRO', 'ULTIMATE', 'ENTERPRISE'));

-- Add billing_period column
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS billing_period TEXT;

-- Add CHECK constraint for billing_period
ALTER TABLE creators
ADD CONSTRAINT billing_period_check
CHECK (billing_period IN ('monthly', 'yearly') OR billing_period IS NULL);

-- Add subscription_status column
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';

-- Add CHECK constraint for subscription_status
ALTER TABLE creators
ADD CONSTRAINT subscription_status_check
CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid'));

-- Add trial_ends_at column
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Add current_period_ends_at column
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS current_period_ends_at TIMESTAMPTZ;

-- Add stripe_subscription_id column
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;

-- Add stripe_customer_id column
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Create index on plan_tier for faster queries
CREATE INDEX IF NOT EXISTS idx_creators_plan_tier ON creators(plan_tier);

-- Create index on subscription_status
CREATE INDEX IF NOT EXISTS idx_creators_subscription_status ON creators(subscription_status);

-- Comment on columns
COMMENT ON COLUMN creators.plan_tier IS 'The subscription plan tier: FREE, LITE, PRO, ULTIMATE, or ENTERPRISE';
COMMENT ON COLUMN creators.billing_period IS 'Billing period: monthly or yearly';
COMMENT ON COLUMN creators.subscription_status IS 'Current subscription status';
COMMENT ON COLUMN creators.trial_ends_at IS 'When the trial period ends (if applicable)';
COMMENT ON COLUMN creators.current_period_ends_at IS 'When the current billing period ends';
COMMENT ON COLUMN creators.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN creators.stripe_customer_id IS 'Stripe customer ID';
