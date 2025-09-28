# YouTube Transcript Extraction System

This system combines the YouTube official API for video discovery with the `youtube-transcript-api` Python library for transcript extraction, minimizing YouTube API quota usage while maximizing transcript access.

## Architecture Overview

### Two-Phase Approach:
1. **Video Discovery**: Use YouTube official API to get video IDs (minimal quota usage)
2. **Transcript Extraction**: Use `youtube-transcript-api` for transcripts (no quota usage)

### Benefits:
- ✅ **Quota Efficient**: Only use YouTube API for video discovery
- ✅ **No Transcript Limits**: Extract unlimited transcripts without quota concerns
- ✅ **Better Reliability**: Direct access to YouTube's transcript data
- ✅ **Multiple Languages**: Support for auto-translated transcripts
- ✅ **Batch Processing**: Process multiple videos efficiently

## API Endpoints

### 1. Single Video Transcript
```http
GET /api/youtube/transcripts?videoId=VIDEO_ID&languages=en,es,fr
```

**Response:**
```json
{
  "success": true,
  "video_id": "dQw4w9WgXcQ",
  "language": "en",
  "is_generated": false,
  "segments_count": 45,
  "segments": [
    {
      "start": 0.0,
      "duration": 2.5,
      "end": 2.5,
      "text": "We're no strangers to love",
      "confidence": 0.95
    }
  ],
  "obtained_via": "youtube_transcript_api",
  "confidence": 0.95,
  "processing_date": "2025-08-31T00:00:00.000Z"
}
```

### 2. Multiple Video Transcripts
```http
POST /api/youtube/transcripts
Content-Type: application/json

{
  "videoIds": ["dQw4w9WgXcQ", "jNQXAC9IVRw"],
  "languages": ["en", "es"],
  "preserveFormatting": false
}
```

**Response:**
```json
{
  "dQw4w9WgXcQ": {
    "success": true,
    "video_id": "dQw4w9WgXcQ",
    "language": "en",
    "segments": [...],
    "confidence": 0.95
  },
  "jNQXAC9IVRw": {
    "success": false,
    "error": "no_transcript_found",
    "message": "No transcript available for this video"
  }
}
```

### 3. Transcript Availability Info
```http
GET /api/youtube/transcripts?videoId=VIDEO_ID&action=info
```

**Response:**
```json
{
  "success": true,
  "video_id": "dQw4w9WgXcQ",
  "transcripts": [
    {
      "language": "English",
      "language_code": "en",
      "is_generated": false,
      "is_translatable": true
    },
    {
      "language": "Spanish",
      "language_code": "es",
      "is_generated": false,
      "is_translatable": true
    }
  ],
  "count": 2
}
```

## TypeScript Usage Examples

### Basic Transcript Extraction
```typescript
import { ExtendedYouTubeService } from '@/lib/youtube-extended'

// Extract transcript for a single video
const result = await ExtendedYouTubeService.extractTranscript(
  'dQw4w9WgXcQ', 
  ['en', 'es']
)

if (result.success) {
  console.log(`Found ${result.segments_count} segments`)
  result.segments?.forEach(segment => {
    console.log(`${segment.start}s: ${segment.text}`)
  })
}
```

### Batch Transcript Extraction
```typescript
// Extract transcripts for multiple videos
const videoIds = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', 'oHg5SJYRHA0']
const results = await ExtendedYouTubeService.extractMultipleTranscripts(
  videoIds, 
  ['en']
)

Object.entries(results).forEach(([videoId, result]) => {
  if (result.success) {
    console.log(`✅ ${videoId}: ${result.segments_count} segments`)
  } else {
    console.log(`❌ ${videoId}: ${result.message}`)
  }
})
```

### Channel Processing with Progress
```typescript
// Process entire channel with progress tracking
const channelResults = await ExtendedYouTubeService.processChannelTranscripts(
  accessToken,
  {
    maxVideos: 100,
    languages: ['en', 'es'],
    onProgress: (processed, total, currentVideo) => {
      console.log(`Progress: ${processed}/${total} (${currentVideo})`)
    },
    onVideoProcessed: (videoId, result) => {
      if (result.success) {
        console.log(`✅ Processed ${videoId}: ${result.segments_count} segments`)
      } else {
        console.log(`❌ Failed ${videoId}: ${result.message}`)
      }
    }
  }
)

console.log(`
Channel Processing Complete:
- Total Videos: ${channelResults.totalVideos}
- Processed: ${channelResults.processedVideos}
- Successful: ${channelResults.successfulExtractions}
- Success Rate: ${(channelResults.successfulExtractions / channelResults.processedVideos * 100).toFixed(1)}%
`)
```

### Video Discovery with Transcript Check
```typescript
// Get videos with transcript availability
const videosWithTranscripts = await ExtendedYouTubeService.getVideosWithTranscripts(
  accessToken,
  {
    maxResults: 50,
    languages: ['en'],
    includeTranscripts: true
  }
)

const availableCount = videosWithTranscripts.filter(v => v.transcriptAvailable).length
console.log(`${availableCount}/${videosWithTranscripts.length} videos have transcripts`)

videosWithTranscripts.forEach(video => {
  if (video.transcriptAvailable) {
    console.log(`✅ ${video.title} - Languages: ${video.transcriptLanguages?.join(', ')}`)
  }
})
```

## Python CLI Usage

### Direct Python Script Usage
```bash
# Navigate to scripts directory
cd scripts

# Single video
./transcript_env/bin/python youtube_transcript_extractor.py single dQw4w9WgXcQ en es

# Multiple videos
./transcript_env/bin/python youtube_transcript_extractor.py multiple dQw4w9WgXcQ,jNQXAC9IVRw en

# Check availability
./transcript_env/bin/python youtube_transcript_extractor.py info dQw4w9WgXcQ
```

## Error Handling

### Common Error Types
- `video_unavailable`: Video is private or doesn't exist
- `transcripts_disabled`: Channel has disabled transcripts
- `no_transcript_found`: No transcripts in requested languages
- `rate_limited`: Too many requests (rare with transcript API)
- `retrieval_failed`: Technical error during download
- `unexpected_error`: Unknown error

### Example Error Handling
```typescript
const result = await ExtendedYouTubeService.extractTranscript(videoId)

switch (result.error) {
  case 'video_unavailable':
    console.log('Video is private or unavailable')
    break
  case 'transcripts_disabled':
    console.log('Transcripts are disabled for this video')
    break
  case 'no_transcript_found':
    console.log('No transcripts available in requested languages')
    break
  default:
    if (!result.success) {
      console.log(`Error: ${result.message}`)
    }
}
```

## Performance Considerations

### Quota Usage Comparison
| Method | YouTube API Quota | Transcript Access |
|--------|-------------------|-------------------|
| **Old Approach** | 1 unit per video + 3-5 units per transcript | Limited by quota |
| **New Approach** | 1 unit per video (discovery only) | Unlimited |

### Batch Processing
- Process videos in batches of 10-20 for optimal performance
- Add small delays between batches to be respectful to YouTube
- Use progress callbacks for long-running operations

### Caching Strategy
```typescript
// Example caching implementation
const transcriptCache = new Map<string, TranscriptExtractionResult>()

async function getTranscriptWithCache(videoId: string) {
  if (transcriptCache.has(videoId)) {
    return transcriptCache.get(videoId)!
  }
  
  const result = await ExtendedYouTubeService.extractTranscript(videoId)
  if (result.success) {
    transcriptCache.set(videoId, result)
  }
  
  return result
}
```

## Setup Instructions

### 1. Install Python Dependencies
```bash
cd scripts
python3 -m venv transcript_env
source transcript_env/bin/activate
pip install -r requirements.txt
```

### 2. Environment Variables
```env
# Optional: Custom Python path
PYTHON_PATH=/path/to/your/python

# Existing YouTube API credentials
YOUTUBE_API_KEY=your_api_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

### 3. Test Installation
```bash
# Test the Python extractor
./transcript_env/bin/python youtube_transcript_extractor.py info dQw4w9WgXcQ

# Test the API endpoint (after starting your Next.js server)
curl "http://localhost:3000/api/youtube/transcripts?videoId=dQw4w9WgXcQ&action=info"
```

## Integration with Existing Systems

This transcript system is designed to work seamlessly with the existing `YouTubeService` class:

1. **Video Discovery**: Use existing `getAllUserVideos()` or `getUserVideos()`
2. **Transcript Enhancement**: Use `ExtendedYouTubeService` to add transcript data
3. **Processing Pipeline**: Combine both for efficient content processing

The system preserves all existing functionality while adding powerful transcript extraction capabilities without quota concerns.