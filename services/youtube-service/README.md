# YouTube Service

Microservice for YouTube data extraction using yt-dlp. Deployed on Railway.

## Features

- Extract channel information from @username or video URLs
- Get channel videos with metadata (thumbnails, durations, etc.)
- Get video information including transcripts/subtitles
- Uses rotating proxy to avoid YouTube rate limits

## API Endpoints

### `POST /api/channel/info`
Extract channel ID and metadata from URL.

**Request:**
```json
{
  "url": "https://www.youtube.com/@LanceHedrick"
}
```

**Response:**
```json
{
  "channelId": "UCxxxxx",
  "channelName": "Lance Hedrick",
  "channelThumbnail": "https://..."
}
```

### `POST /api/channel/videos`
Get videos for a channel.

**Request:**
```json
{
  "channelId": "UCxxxxx",
  "limit": 10
}
```

**Response:**
```json
{
  "channelName": "Lance Hedrick",
  "channelThumbnail": "https://...",
  "totalVideos": 100,
  "subscriberCount": 50000,
  "videos": [
    {
      "id": "videoId",
      "title": "Video Title",
      "description": "...",
      "thumbnail": "https://...",
      "duration": "12:34",
      "publishedAt": "2025-01-15",
      "viewCount": 1000,
      "url": "https://..."
    }
  ]
}
```

### `POST /api/video/info`
Get detailed video information including subtitles.

**Request:**
```json
{
  "videoId": "dQw4w9WgXcQ"
}
```

## Deployment to Railway

1. **Create new project on Railway:**
   ```bash
   railway login
   railway init
   ```

2. **Add environment variables:**
   - `PROXY_URL`: Your Webshare rotating proxy URL

3. **Deploy:**
   ```bash
   railway up
   ```

4. **Get service URL:**
   Railway will provide a URL like: `https://youtube-service-production.up.railway.app`

5. **Add to Vercel environment:**
   Add `YOUTUBE_SERVICE_URL` to your Vercel environment variables.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Service will run on `http://localhost:3001`

## Environment Variables

- `PORT`: Service port (default: 3001)
- `PROXY_URL`: Rotating proxy URL for yt-dlp requests
