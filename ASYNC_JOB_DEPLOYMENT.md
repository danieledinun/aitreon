# Async YouTube Channel Analysis - Deployment Guide

## 🎯 What This Solves

**Problem**: Railway has a 60-second HTTP timeout, which kills requests for fetching 10 YouTube videos (~120s).

**Solution**: Async background job system using Supabase as the job queue and Railway as the processor.

## 🏗️ Architecture

### Components:
1. **Supabase** (`youtube_analysis_jobs` table) - Persistent job queue
2. **Railway Service** (job-processor.js) - Background job worker (polls every 3s)
3. **Next.js API** (/api/youtube/start-analysis, /api/youtube/job-status/[jobId]) - Job management
4. **Frontend** (useYouTubeJobPolling hook) - Real-time progress updates

### Flow:
```
User clicks "Analyze Channel"
↓
POST /api/youtube/start-analysis
↓
Creates job in Supabase (status: pending)
↓
Returns job ID immediately (202 Accepted)
↓
Frontend starts polling /api/youtube/job-status/{jobId}
↓
Railway service picks up job (status: processing)
↓
Fetches channel info (10% progress)
↓
Fetches 10 videos (20-90% progress, updates every video)
↓
Job completes (status: completed, 100% progress)
↓
Frontend receives complete result
↓
User moves to Step 2 with all 10 videos
```

## 📦 Deployment Steps

### 1. Run SQL Migration in Supabase

Go to: https://supabase.com/dashboard/project/gyuhljkilispdhetwalj/sql/new

Paste and run the SQL from: `scripts/migrations/create-youtube-jobs-table.sql`

### 2. Update Railway Environment Variables

Add these to your Railway youtube-service:

```bash
SUPABASE_URL=https://gyuhljkilispdhetwalj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dWhsamtpbGlzcGRoZXR3YWxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA3MzgyNiwiZXhwIjoyMDcxNjQ5ODI2fQ.Ys_bhwzEeAxRjMteMM2GKff1ikspaoYr5RQRlZJzmg4
```

### 3. Install Supabase Dependency on Railway

SSH into Railway or update package.json:

```bash
cd services/youtube-service
npm install @supabase/supabase-js
```

### 4. Deploy Changes

Commit and push all changes:

```bash
git add .
git commit -m "Implement async YouTube analysis job system

- Add youtube_analysis_jobs table to Supabase
- Create job processor for Railway service
- Add job polling hook for frontend
- Update onboarding flow to use async jobs
- Support fetching 10 videos without timeout issues"
git push
```

Railway will auto-deploy the youtube-service.
Vercel will auto-deploy the Next.js app.

## 🧪 Testing

### Test Flow:
1. Go to creator onboarding: `/creator/onboarding`
2. Fill in username, display name, YouTube channel URL
3. Click "Analyze Channel"
4. Watch the progress: "Analyzing... 0%" → "Analyzing... 50%" → "Analyzing... 100%"
5. Should automatically proceed to Step 2 with 10 videos loaded

### Monitor Jobs:
```sql
-- See all jobs
SELECT * FROM youtube_analysis_jobs ORDER BY created_at DESC;

-- See active jobs
SELECT * FROM youtube_analysis_jobs WHERE status IN ('pending', 'processing');

-- See failed jobs
SELECT * FROM youtube_analysis_jobs WHERE status = 'failed';
```

## 📊 Performance

- **Before**: 3 videos in 35s (limited by Railway timeout)
- **After**: 10 videos in ~120s (no timeout issues)
- **User Experience**: Immediate response + progress updates every 2s

## 🔧 Troubleshooting

### Job stuck in "pending":
- Check Railway logs: `railway logs`
- Ensure job processor is running
- Check Supabase connection

### Job stuck in "processing":
- Check Railway logs for errors
- Verify yt-dlp is working: GET /test-ytdlp
- Check proxy configuration

### Frontend not updating:
- Check browser console for polling errors
- Verify /api/youtube/job-status/{jobId} returns data
- Check session auth token

## 🚀 Production Ready Features

✅ **Scalable**: Can handle multiple concurrent jobs
✅ **Resilient**: Jobs survive Railway restarts (stored in Supabase)
✅ **Observable**: Full job history and error tracking
✅ **User-Friendly**: Real-time progress updates
✅ **Production-Grade**: Proper error handling, retries, timeouts

## 📁 Files Changed

### New Files:
- `scripts/migrations/create-youtube-jobs-table.sql`
- `services/youtube-service/job-processor.js`
- `app/api/youtube/start-analysis/route.ts`
- `app/api/youtube/job-status/[jobId]/route.ts`
- `hooks/useYouTubeJobPolling.ts`
- `ASYNC_JOB_DEPLOYMENT.md` (this file)

### Modified Files:
- `services/youtube-service/server.js` (added job processor)
- `services/youtube-service/package.json` (added @supabase/supabase-js)
- `components/creator-onboarding-flow.tsx` (uses async jobs)
- `app/api/youtube/channel-info/route.ts` (kept for backwards compat, now fetches 3 videos)

## 🎉 Benefits

1. **No More Timeouts**: Bypasses Railway's 60s HTTP limit completely
2. **Better UX**: Users see real-time progress instead of waiting blindly
3. **Scalable**: Can handle any channel size (100+ videos, just takes longer)
4. **Production-Ready**: Proper error handling, job tracking, retry logic
5. **Future-Proof**: Easy to add more background tasks (transcript processing, etc.)
