/**
 * Migration Script: Create semantic chunks from existing video transcripts
 * This script processes videos that have transcripts but no content chunks
 */

const { createClient } = require('@supabase/supabase-js')
const { SemanticChunkingService } = require('./semantic-chunking-service')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Simple embedding service to generate embeddings using DeepInfra
async function generateEmbedding(text) {
  try {
    const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'deepinfra'

    if (EMBEDDING_PROVIDER === 'deepinfra') {
      // Use DeepInfra Qwen3-Embedding-8B
      const response = await fetch('https://api.deepinfra.com/v1/inference/Qwen/Qwen3-Embedding-8B', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPINFRA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: [text.replace(/\n/g, ' ').trim()],
          dimensions: 2000,
          encoding_format: 'float'
        })
      })

      if (!response.ok) {
        throw new Error(`DeepInfra API error: ${response.status}`)
      }

      const data = await response.json()
      const embedding = data.embeddings?.[0]

      if (!embedding) {
        return null
      }

      return embedding
    } else {
      // Fallback to OpenAI
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-large'
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      return data.data?.[0]?.embedding || null
    }
  } catch (error) {
    console.error('Error generating embedding:', error)
    return null
  }
}

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
        minChunkDuration: 60,
        maxChunkDuration: 90,
        overlapDuration: 8,
        minWordsPerChunk: 50
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

    // Generate embeddings and create content chunks
    const contentChunks = []

    for (let i = 0; i < validChunks.length; i++) {
      const chunk = validChunks[i]

      console.log(`🔄 Generating embedding for chunk ${i + 1}/${validChunks.length}`)

      // Generate embedding for this chunk
      const embedding = await generateEmbedding(chunk.content)

      if (!embedding) {
        console.error(`❌ Failed to generate embedding for chunk ${i + 1}`)
        continue
      }

      contentChunks.push({
        creator_id: video.creator_id,
        video_id: video.id,
        video_title: video.title,
        video_url: `https://youtube.com/watch?v=${video.youtube_id}`,
        content: chunk.content,
        start_time: chunk.start_time,
        end_time: chunk.end_time,
        chunk_index: i,
        embedding: embedding,
        metadata: {
          semantic_chunk_id: chunk.chunk_id,
          sentence_count: chunk.sentence_count,
          word_count: chunk.word_count,
          confidence_score: chunk.confidence_score,
          chunk_type: 'semantic',
          created_from_transcript: true,
          created_at: new Date().toISOString()
        }
      })
    }

    console.log(`💾 Inserting ${contentChunks.length} content chunks with embeddings`)

    // Insert chunks in batches
    const batchSize = 10
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

      // Small delay between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Mark video as synced now that chunks and embeddings are complete
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        synced_to_graph_rag: true,
        synced_at: new Date().toISOString()
      })
      .eq('id', video.id)

    if (updateError) {
      console.error(`❌ Error updating video sync status for ${video.id}:`, updateError)
    } else {
      console.log(`✅ Video ${video.id} marked as fully synced`)
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
    console.log('🚀 Starting transcript-to-chunks migration...')

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
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log('\n🎉 Migration completed!')
    console.log(`✅ Successfully processed: ${successCount} videos`)
    console.log(`❌ Failed: ${errorCount} videos`)

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
      console.error('❌ Please provide a YouTube ID: node create-chunks-from-transcripts.js video YOUTUBE_ID')
      process.exit(1)
    }
    processSpecificVideo(argument)
    break
  default:
    console.log(`
🧠 Transcript-to-Chunks Migration Tool

Usage:
  node create-chunks-from-transcripts.js all           # Process all videos with transcripts
  node create-chunks-from-transcripts.js video <id>    # Process specific video by YouTube ID

Examples:
  node create-chunks-from-transcripts.js all
  node create-chunks-from-transcripts.js video faixmd1uwKk
`)
    break
}