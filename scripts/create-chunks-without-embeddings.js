/**
 * Migration Script: Create semantic chunks from existing video transcripts (without embeddings)
 * This creates content chunks that can be used immediately, embeddings will be added later
 */

const { createClient } = require('@supabase/supabase-js')
const { SemanticChunkingService } = require('./semantic-chunking-service')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Parse transcript text into segments with timestamps
function parseTranscript(transcriptText) {
  const segments = []
  const lines = transcriptText.split('\n').filter(line => line.trim())

  for (const line of lines) {
    // Match format: [timestamp] text
    const match = line.match(/^\[(\d+:\d+)\]\s*(.+)$/)
    if (match) {
      const [, timeStr, text] = match
      const [minutes, seconds] = timeStr.split(':').map(Number)
      const startTime = minutes * 60 + seconds

      segments.push({
        start: startTime,
        end: startTime + 5, // Default 5-second segments
        duration: 5,
        text: text.trim()
      })
    }
  }

  // Adjust end times to connect segments properly
  for (let i = 0; i < segments.length - 1; i++) {
    segments[i].end = segments[i + 1].start
    segments[i].duration = segments[i].end - segments[i].start
  }

  return segments
}

async function createChunksFromTranscript(video) {
  try {
    console.log(`🔄 Processing video: ${video.title} (${video.youtube_id})`)

    if (!video.transcript) {
      console.log(`⚠️ No transcript found for video ${video.id}`)
      return false
    }

    // Parse transcript into segments
    const segments = parseTranscript(video.transcript)
    console.log(`📊 Parsed ${segments.length} transcript segments`)

    if (segments.length === 0) {
      console.log(`⚠️ No valid segments found in transcript for video ${video.id}`)
      return false
    }

    // Generate semantic chunks
    const semanticChunks = SemanticChunkingService.createSemanticChunks(
      segments,
      video.id,
      {
        minChunkDuration: 15,
        maxChunkDuration: 40,
        overlapDuration: 4,
        minWordsPerChunk: 20
      }
    )

    // Filter valid chunks
    const validChunks = semanticChunks.filter(chunk =>
      SemanticChunkingService.validateChunk(chunk)
    )

    console.log(`📈 Generated ${semanticChunks.length} semantic chunks, ${validChunks.length} passed validation`)

    if (validChunks.length === 0) {
      console.log(`⚠️ No valid semantic chunks generated for video ${video.id}`)
      return false
    }

    // Create content chunks without embeddings (will be added later)
    const contentChunks = validChunks.map((chunk, i) => ({
      creator_id: video.creator_id,
      video_id: video.id,
      video_title: video.title,
      video_url: `https://youtube.com/watch?v=${video.youtube_id}`,
      content: chunk.content,
      start_time: chunk.start_time,
      end_time: chunk.end_time,
      chunk_index: i,
      // No embedding field - will be added later
      metadata: {
        semantic_chunk_id: chunk.chunk_id,
        sentence_count: chunk.sentence_count,
        word_count: chunk.word_count,
        confidence_score: chunk.confidence_score,
        chunk_type: 'semantic',
        created_from_transcript: true,
        embedding_pending: true, // Flag to indicate embeddings need to be generated
        created_at: new Date().toISOString()
      }
    }))

    console.log(`💾 Inserting ${contentChunks.length} content chunks (embeddings will be added later)`)

    // Insert chunks in batches
    const batchSize = 20
    for (let i = 0; i < contentChunks.length; i += batchSize) {
      const batch = contentChunks.slice(i, i + batchSize)

      const { error: insertError } = await supabase
        .from('content_chunks')
        .insert(batch)

      if (insertError) {
        console.error(`❌ Error inserting chunk batch ${i}-${i + batch.length} for video ${video.id}:`, insertError)
        return false
      }

      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(contentChunks.length / batchSize)}`)
    }

    console.log(`✅ Successfully created ${contentChunks.length} content chunks for video ${video.id}`)
    return true

  } catch (error) {
    console.error(`❌ Error processing video ${video.id}:`, error)
    return false
  }
}

async function processAllVideos() {
  try {
    console.log('🚀 Starting transcript-to-chunks migration (without embeddings)...')

    // Get all videos that have transcripts but no content chunks
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select(`
        id,
        creator_id,
        youtube_id,
        title,
        transcript,
        is_processed
      `)
      .eq('is_processed', true)
      .not('transcript', 'is', null)
      .order('created_at', { ascending: true })

    if (videosError) {
      console.error('❌ Error fetching videos:', videosError)
      return
    }

    if (!videos || videos.length === 0) {
      console.log('ℹ️ No videos with transcripts found')
      return
    }

    console.log(`📊 Found ${videos.length} videos with transcripts to process`)

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i]
      console.log(`\n[${i + 1}/${videos.length}] Processing: ${video.title}`)

      const result = await createChunksFromTranscript(video)

      if (result) {
        successCount++
      } else {
        errorCount++
      }

      // Small delay between videos
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('\n🎉 Migration completed!')
    console.log(`✅ Successfully processed: ${successCount} videos`)
    console.log(`❌ Failed: ${errorCount} videos`)
    console.log('\n📝 Next steps:')
    console.log('1. Embeddings can be generated later using the existing AI services')
    console.log('2. The semantic chunks are ready for immediate use in the RAG system')
    console.log('3. Citations will now point to meaningful 15-40 second semantic chunks')

  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

async function processSpecificVideo(youtubeId) {
  try {
    console.log(`🎯 Processing specific video: ${youtubeId}`)

    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        id,
        creator_id,
        youtube_id,
        title,
        transcript,
        is_processed
      `)
      .eq('youtube_id', youtubeId)
      .single()

    if (videoError || !video) {
      console.error(`❌ Video not found: ${youtubeId}`)
      return
    }

    if (!video.is_processed) {
      console.error(`❌ Video ${youtubeId} is not processed yet`)
      return
    }

    if (!video.transcript) {
      console.error(`❌ Video ${youtubeId} has no transcript`)
      return
    }

    const result = await createChunksFromTranscript(video)

    if (result) {
      console.log(`✅ Successfully processed video: ${youtubeId}`)
    } else {
      console.log(`❌ Failed to process video: ${youtubeId}`)
    }

  } catch (error) {
    console.error(`❌ Error processing specific video ${youtubeId}:`, error)
  }
}

// Command line interface
const command = process.argv[2]
const argument = process.argv[3]

switch (command) {
  case 'all':
    processAllVideos()
    break
  case 'video':
    if (!argument) {
      console.error('❌ Please provide a YouTube ID: node create-chunks-without-embeddings.js video YOUTUBE_ID')
      process.exit(1)
    }
    processSpecificVideo(argument)
    break
  default:
    console.log(`
🧠 Transcript-to-Chunks Migration Tool (Without Embeddings)

Usage:
  node create-chunks-without-embeddings.js all           # Process all videos with transcripts
  node create-chunks-without-embeddings.js video <id>    # Process specific video by YouTube ID

Examples:
  node create-chunks-without-embeddings.js all
  node create-chunks-without-embeddings.js video faixmd1uwKk

Note: This creates semantic chunks without embeddings.
Embeddings can be generated later using the existing AI services.
`)
    break
}