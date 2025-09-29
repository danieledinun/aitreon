# Vercel Deployment Guide

## Required Environment Variables

Your build is failing because `SUPABASE_URL` is missing. Here are the **minimum required** environment variables for deployment:

### 🚨 Critical (Build will fail without these):

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXTAUTH_URL=https://your-vercel-app.vercel.app
NEXTAUTH_SECRET=your-32-char-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
YOUTUBE_API_KEY=AIza...your-youtube-api-key
OPENAI_API_KEY=sk-...your-openai-api-key
```

### 📦 Optional (Can be empty for basic deployment):

```
EMBEDDING_PROVIDER=deepinfra
DEEPINFRA_API_KEY=
ELEVENLABS_API_KEY=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
HF_TOKEN=
```

## Quick Setup Steps:

1. **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. **Add the critical variables above** (with your actual values)

3. **Set for all environments**: Production, Preview, Development

4. **Redeploy** your project

## Getting Your Values:

- **Supabase**: Dashboard → Project Settings → API
- **Google OAuth**: Google Cloud Console → APIs & Services → Credentials
- **OpenAI**: platform.openai.com → API Keys
- **NextAuth Secret**: Generate with `openssl rand -base64 32`

## Build Error Fix:

The specific error you're seeing is:
```
Error: Missing env.SUPABASE_URL
```

This means Vercel doesn't have the `SUPABASE_URL` environment variable set. Add it in your Vercel project settings and redeploy.