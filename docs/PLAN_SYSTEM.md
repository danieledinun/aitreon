# Plan & Subscription System Documentation

## Overview

This document describes the complete plan and subscription system implemented for Tandym.ai. The system provides tiered access control, usage tracking, and seamless upgrade/downgrade flows.

## Plan Tiers

### FREE
- **Price**: $0/month
- **Videos**: Up to 5 videos
- **Messages**: Up to 50/month
- **Sync**: Manual only
- **Features**: Basic AI twin, Tandym page
- **Trial**: N/A

### LITE (Creator Lite)
- **Price**: $29/month or $24/month (yearly)
- **Videos**: Up to 10 videos
- **Messages**: Up to 500/month
- **Sync**: Manual only
- **Features**: Everything in Free + embed widget, better tone consistency, basic analytics
- **Trial**: 14 days

### PRO (Creator Pro) ⭐ Most Popular
- **Price**: $69/month or $58/month (yearly)
- **Videos**: Up to 100 videos
- **Messages**: Up to 2,500/month
- **Sync**: Weekly automatic
- **Features**: Everything in Lite + no branding, advanced personality, full analytics, priority processing
- **Trial**: 14 days

### ULTIMATE (Creator Ultimate)
- **Price**: $149/month or $124/month (yearly)
- **Videos**: Unlimited
- **Messages**: Up to 10,000/month
- **Sync**: Real-time
- **Features**: Everything in Pro + custom domain, highest concurrency, extended memory
- **Trial**: 14 days

### ENTERPRISE
- **Price**: Custom
- **Videos**: Unlimited
- **Messages**: Unlimited
- **Features**: Full platform + API access, team seats, white labeling, SLAs, dedicated support

## Architecture

### Core Files

#### 1. Plan Configuration (`/lib/plans.ts`)
The single source of truth for all plan definitions and limits.

**Key exports**:
- `PLANS`: Object containing all plan configurations
- `getPlanConfig(tier)`: Get config for a specific tier
- `canAddVideos(count, tier)`: Check if creator can add more videos
- `canSendMessages(count, tier)`: Check if messages can be sent
- `hasFeatureAccess(tier, feature)`: Check feature availability
- `getUpgradeRecommendation()`: Suggest upgrade path

**Example usage**:
```typescript
import { getPlanConfig, canAddVideos } from '@/lib/plans'

const plan = getPlanConfig('PRO')
const canAdd = canAddVideos(50, 'PRO') // true (limit is 100)
```

#### 2. Plan Enforcement Middleware (`/lib/middleware/plan-enforcement.ts`)
Server-side enforcement of plan limits before critical operations.

**Key functions**:
- `enforceVideoLimit(creatorId)`: Check before adding videos
- `enforceMessageLimit(creatorId)`: Check before sending messages
- `enforceFeatureAccess(creatorId, feature)`: Check before using features
- `enforceActiveSubscription(creatorId)`: Verify subscription status
- `canCreatorAddVideo(creatorId)`: Comprehensive check
- `canCreatorReceiveMessage(creatorId)`: Comprehensive check

**Example usage**:
```typescript
import { canCreatorAddVideo } from '@/lib/middleware/plan-enforcement'

const result = await canCreatorAddVideo(creatorId)
if (!result.allowed) {
  return NextResponse.json(
    { error: result.reason, upgradeRequired: result.upgradeRequired },
    { status: 403 }
  )
}
```

#### 3. React Hooks (`/lib/hooks/use-plan-limits.ts`)
Client-side hooks for plan data and enforcement.

**Hooks**:
- `usePlanLimits(creatorId)`: Get usage status and remaining quotas
- `useFeatureAccess(creatorId, feature)`: Check feature availability
- `useCreatorPlan(creatorId)`: Get full plan info with refetch

**Example usage**:
```typescript
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'

function VideoUpload({ creatorId }) {
  const { canAddVideos, remainingVideos, isLoading } = usePlanLimits(creatorId)

  if (!canAddVideos) {
    return <PlanUpgradeBanner reason="videos" />
  }

  return <UploadForm remaining={remainingVideos} />
}
```

### Database Schema

New columns added to `creators` table:

```sql
-- Plan and billing
plan_tier TEXT NOT NULL DEFAULT 'FREE'
  CHECK (plan_tier IN ('FREE', 'LITE', 'PRO', 'ULTIMATE', 'ENTERPRISE'))

billing_period TEXT
  CHECK (billing_period IN ('monthly', 'yearly') OR billing_period IS NULL)

subscription_status TEXT NOT NULL DEFAULT 'active'
  CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid'))

-- Dates
trial_ends_at TIMESTAMPTZ
current_period_ends_at TIMESTAMPTZ

-- Stripe integration
stripe_subscription_id TEXT UNIQUE
stripe_customer_id TEXT UNIQUE
```

### API Endpoints

#### Get Plan Limits
```
GET /api/creators/[creatorId]/plan-limits
```
Returns current plan, usage, and quotas.

**Response**:
```json
{
  "planTier": "PRO",
  "billingPeriod": "yearly",
  "subscriptionStatus": "active",
  "trialEndsAt": null,
  "currentPeriodEndsAt": "2025-12-29T00:00:00Z",
  "videoCount": 45,
  "monthlyMessageCount": 1230
}
```

#### Upgrade/Change Plan
```
POST /api/creators/[creatorId]/subscription/upgrade
```

**Request**:
```json
{
  "targetTier": "PRO",
  "billingPeriod": "yearly"
}
```

**Response** (requires payment):
```json
{
  "success": true,
  "requiresPayment": true,
  "checkoutUrl": "/api/creators/.../subscription/checkout?tier=PRO&billing=yearly",
  "targetPlan": {
    "tier": "PRO",
    "name": "Creator Pro",
    "price": 58,
    "billingPeriod": "yearly"
  }
}
```

**Response** (downgrade to FREE):
```json
{
  "success": true,
  "message": "Downgraded to Free plan",
  "planTier": "FREE"
}
```

#### Cancel Subscription
```
POST /api/creators/[creatorId]/subscription/cancel
```

**Request**:
```json
{
  "cancelImmediately": false
}
```

**Response**:
```json
{
  "success": true,
  "message": "Subscription will cancel at the end of your billing period...",
  "effectiveDate": "2025-12-29T00:00:00Z"
}
```

### UI Components

#### 1. PlanUpgradeBanner (`/components/plan-upgrade-banner.tsx`)
Display upgrade prompts when limits are reached.

**Props**:
```typescript
interface PlanUpgradeBannerProps {
  creatorId: string
  currentTier: PlanTier
  reason: 'videos' | 'messages' | 'feature'
  featureName?: string
  upgradeTo?: PlanTier
}
```

**Usage**:
```tsx
<PlanUpgradeBanner
  creatorId={creatorId}
  currentTier="FREE"
  reason="videos"
  upgradeTo="LITE"
/>
```

#### 2. UsageMeter (`/components/usage-meter.tsx`)
Display usage progress for videos or messages.

**Props**:
```typescript
interface UsageMeterProps {
  creatorId: string
  type: 'videos' | 'messages'
}
```

**Usage**:
```tsx
<UsageMeter creatorId={creatorId} type="videos" />
<UsageMeter creatorId={creatorId} type="messages" />
```

#### 3. Subscription Management Page (`/app/creator/subscription/page.tsx`)
Full-page plan management interface with:
- Current plan display
- Usage statistics
- Plan comparison cards
- Upgrade/downgrade buttons
- Billing period toggle
- Cancellation flow

## Implementation Guide

### 1. Enforce Video Limits

In your video upload/sync API:

```typescript
import { canCreatorAddVideo } from '@/lib/middleware/plan-enforcement'

export async function POST(request: NextRequest) {
  // ... get creatorId ...

  const check = await canCreatorAddVideo(creatorId)
  if (!check.allowed) {
    return NextResponse.json(
      {
        error: check.reason,
        upgradeRequired: check.upgradeRequired
      },
      { status: 403 }
    )
  }

  // Proceed with video addition
}
```

### 2. Enforce Message Limits

In your chat API:

```typescript
import { canCreatorReceiveMessage } from '@/lib/middleware/plan-enforcement'

export async function POST(request: NextRequest) {
  // ... get creatorId ...

  const check = await canCreatorReceiveMessage(creatorId)
  if (!check.allowed) {
    return NextResponse.json(
      {
        error: check.reason,
        upgradeRequired: check.upgradeRequired
      },
      { status: 403 }
    )
  }

  // Proceed with message processing
}
```

### 3. Enforce Feature Access

In your embed widget settings:

```typescript
import { enforceFeatureAccess } from '@/lib/middleware/plan-enforcement'

export async function POST(request: NextRequest) {
  const { removeBranding } = await request.json()

  if (removeBranding) {
    const check = await enforceFeatureAccess(creatorId, 'removeBranding')
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: check.reason,
          upgradeRequired: check.upgradeRequired
        },
        { status: 403 }
      )
    }
  }

  // Proceed with settings update
}
```

### 4. Show Upgrade Prompts

In your UI when limits are reached:

```tsx
import PlanUpgradeBanner from '@/components/plan-upgrade-banner'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'

export default function VideoManager({ creatorId }) {
  const { canAddVideos } = usePlanLimits(creatorId)

  return (
    <div>
      {!canAddVideos && (
        <PlanUpgradeBanner
          creatorId={creatorId}
          currentTier={currentTier}
          reason="videos"
          upgradeTo="LITE"
        />
      )}
      {/* Rest of UI */}
    </div>
  )
}
```

## Stripe Integration (TODO)

### Setup Required:
1. Add Stripe secret key to environment variables
2. Create Stripe products and prices for each tier
3. Implement webhook handler at `/api/webhooks/stripe`
4. Handle subscription events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### Files to Update:
- `/app/api/creators/[creatorId]/subscription/upgrade/route.ts` - Add Stripe checkout session creation
- `/app/api/creators/[creatorId]/subscription/cancel/route.ts` - Add Stripe subscription cancellation
- `/app/api/webhooks/stripe/route.ts` - Create webhook handler

## Testing

### Manual Testing Checklist:
- [ ] FREE tier blocks video addition at 5 videos
- [ ] FREE tier blocks messages at 50/month
- [ ] Upgrade from FREE to LITE works
- [ ] Upgrade from LITE to PRO works
- [ ] Downgrade to FREE cancels subscription
- [ ] Feature enforcement blocks premium features
- [ ] Usage meters display correctly
- [ ] Subscription page shows accurate data
- [ ] Trial period is respected

### Test Users:
Create test creators at each tier to verify limits and features.

## Migration Notes

To apply the database migration:

1. Run the SQL in Supabase SQL Editor:
   ```bash
   # File: /migrations/add_plan_tier_columns.sql
   ```

2. Verify columns exist:
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'creators'
   AND column_name IN (
     'plan_tier', 'billing_period', 'subscription_status',
     'trial_ends_at', 'current_period_ends_at',
     'stripe_subscription_id', 'stripe_customer_id'
   );
   ```

3. All existing creators will default to FREE tier with active status.

## Future Enhancements

1. **Analytics Dashboard**
   - Track plan distribution
   - Monitor upgrade conversion rates
   - Analyze usage patterns

2. **Automated Trials**
   - Auto-start 14-day trials for paid plans
   - Email notifications before trial ends
   - Auto-downgrade to FREE if no payment

3. **Usage Alerts**
   - Email creators at 80% quota usage
   - In-app notifications
   - Recommend upgrades proactively

4. **Granular Controls**
   - Custom enterprise plans
   - Add-on features (voice chat, API access)
   - Usage-based pricing options

5. **Admin Dashboard**
   - Override plan limits
   - Grant trial extensions
   - View platform-wide metrics

## Support & Troubleshooting

### Common Issues:

**Q: Creator can't add videos despite being under limit**
- Check `subscription_status` is 'active' or 'trialing'
- Verify `current_period_ends_at` hasn't passed
- Check for grace period (7 days)

**Q: Usage meter shows incorrect count**
- Refetch plan data with `refetch()` from hook
- Verify message count query uses correct month start

**Q: Upgrade button doesn't work**
- Check console for API errors
- Verify creator ownership in auth session
- Ensure Stripe integration is configured

## Contact

For questions or issues with the plan system:
- Technical Lead: [Your Name]
- Documentation: This file
- Code Location: `/lib/plans.ts`, `/lib/middleware/plan-enforcement.ts`
