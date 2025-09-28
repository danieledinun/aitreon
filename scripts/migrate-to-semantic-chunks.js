/**
 * Migration Script: Convert existing videos from granular chunks to semantic chunks
 * This script will reprocess all existing videos with the new semantic chunking algorithm
 */

const { createClient } = require('@supabase/supabase-js')
const { SemanticChunkingService } = require('./semantic-chunking-service')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function migrateVideoToSemanticChunks(video) {
  try {
    console.log(`🔄 Processing video: ${video.title} (${video.youtube_id})`)

    // Get all existing chunks for this video (ordered by chunk_index)
    const { data: existingChunks, error: chunksError } = await supabase
      .from('content_chunks')
      .select('*')
      .eq('video_id', video.id)
      .order('chunk_index', { ascending: true })

    if (chunksError) {
      console.error(`❌ Error fetching chunks for video ${video.id}:`, chunksError)
      return false
    }

    if (!existingChunks || existingChunks.length === 0) {
      console.log(`⚠️ No chunks found for video ${video.id}`)
      return false
    }

    console.log(`📊 Found ${existingChunks.length} existing chunks`)

    // Check if this video already uses semantic chunking
    const hasSemanticChunks = existingChunks.some(chunk =>
      chunk.metadata && chunk.metadata.chunk_type === 'semantic'
    )

    if (hasSemanticChunks) {
      console.log(`✅ Video ${video.id} already uses semantic chunking, skipping`)
      return true
    }

    // Convert existing chunks back to transcript segments
    const transcriptSegments = existingChunks.map(chunk => ({
      start: chunk.start_time || 0,
      end: chunk.end_time || (chunk.start_time + 5) || 5,
      duration: (chunk.end_time - chunk.start_time) || 5,
      text: chunk.content || ''
    }))

    console.log(`🧠 Generating semantic chunks from ${transcriptSegments.length} segments`)

    // Generate semantic chunks using the new service
    const semanticChunks = SemanticChunkingService.createSemanticChunks(
      transcriptSegments,
      video.id,
      {
        minChunkDuration: 15,
        maxChunkDuration: 40,
        overlapDuration: 4,
        minWordsPerChunk: 20
      }
    )

    // Filter out low-quality chunks
    const validChunks = semanticChunks.filter(chunk =>
      SemanticChunkingService.validateChunk(chunk)
    )

    console.log(`📈 Generated ${semanticChunks.length} semantic chunks, ${validChunks.length} passed validation`)

    if (validChunks.length === 0) {
      console.log(`⚠️ No valid semantic chunks generated for video ${video.id}`)
      return false
    }

    // Delete existing chunks for this video
    console.log(`🗑️ Removing ${existingChunks.length} old chunks`)
    const { error: deleteError } = await supabase
      .from('content_chunks')
      .delete()
      .eq('video_id', video.id)

    if (deleteError) {
      console.error(`❌ Error deleting old chunks for video ${video.id}:`, deleteError)
      return false
    }

    // Insert new semantic chunks
    const newChunks = validChunks.map((chunk, i) => ({
      creator_id: video.creator_id,
      video_id: video.id,
      video_title: video.title,
      video_url: `https://youtube.com/watch?v=${video.youtube_id}`,
      content: chunk.content,
      start_time: chunk.start_time,
      end_time: chunk.end_time,
      chunk_index: i,
      metadata: {
        semantic_chunk_id: chunk.chunk_id,
        sentence_count: chunk.sentence_count,
        word_count: chunk.word_count,
        confidence_score: chunk.confidence_score,
        chunk_type: 'semantic',
        migrated_at: new Date().toISOString()
      }
    }))

    console.log(`💾 Inserting ${newChunks.length} new semantic chunks`)

    // Insert chunks in batches
    const batchSize = 50
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize)

      const { error: insertError } = await supabase
        .from('content_chunks')
        .insert(batch)

      if (insertError) {
        console.error(`❌ Error inserting chunk batch ${i}-${i + batch.length} for video ${video.id}:`, insertError)
        return false
      }

      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newChunks.length / batchSize)}`)
    }

    console.log(`✅ Successfully migrated video ${video.id} to semantic chunking`)
    return true

  } catch (error) {
    console.error(`❌ Error migrating video ${video.id}:`, error)
    return false
  }
}

async function migrateAllVideos() {
  try {
    console.log('🚀 Starting semantic chunking migration...')

    // Get all videos that have content chunks
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select(`
        id,
        creator_id,
        youtube_id,
        title,
        is_processed
      `)
      .eq('is_processed', true)
      .order('created_at', { ascending: true })

    if (videosError) {
      console.error('❌ Error fetching videos:', videosError)
      return
    }

    if (!videos || videos.length === 0) {
      console.log('ℹ️ No processed videos found')
      return
    }

    console.log(`📊 Found ${videos.length} processed videos to migrate`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i]
      console.log(`\n[${i + 1}/${videos.length}] Processing video: ${video.title}`)

      const result = await migrateVideoToSemanticChunks(video)

      if (result === true) {
        successCount++
      } else if (result === 'skip') {
        skipCount++
      } else {
        errorCount++
      }

      // Add a small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('\n🎉 Migration completed!')
    console.log(`✅ Successfully migrated: ${successCount} videos`)
    console.log(`⏭️ Skipped (already semantic): ${skipCount} videos`)
    console.log(`❌ Failed: ${errorCount} videos`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

// Allow running specific video by YouTube ID
async function migrateSpecificVideo(youtubeId) {
  try {
    console.log(`🎯 Migrating specific video: ${youtubeId}`)

    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        id,
        creator_id,
        youtube_id,
        title,
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

    const result = await migrateVideoToSemanticChunks(video)

    if (result) {
      console.log(`✅ Successfully migrated video: ${youtubeId}`)
    } else {
      console.log(`❌ Failed to migrate video: ${youtubeId}`)
    }

  } catch (error) {
    console.error(`❌ Error migrating specific video ${youtubeId}:`, error)
  }
}

// Check migration status
async function checkMigrationStatus() {
  try {
    console.log('📊 Checking migration status...')

    // Count total videos
    const { count: totalCount, error: totalError } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('is_processed', true)

    if (totalError) {
      console.error('❌ Error counting total videos:', totalError)
      return
    }

    // Count videos with semantic chunks (get unique video_ids)
    const { data: semanticChunks, error: semanticError } = await supabase
      .from('content_chunks')
      .select('video_id')
      .contains('metadata', { chunk_type: 'semantic' })

    if (semanticError) {
      console.error('❌ Error counting semantic videos:', semanticError)
      return
    }

    // Get unique video IDs that have semantic chunks
    const uniqueSemanticVideos = new Set(semanticChunks?.map(chunk => chunk.video_id) || [])
    const semanticCount = uniqueSemanticVideos.size
    const remainingCount = (totalCount || 0) - semanticCount

    console.log(`\n📈 Migration Status:`)
    console.log(`📺 Total processed videos: ${totalCount || 0}`)
    console.log(`🧠 Videos with semantic chunks: ${semanticCount}`)
    console.log(`⏳ Videos remaining to migrate: ${remainingCount}`)
    console.log(`📊 Progress: ${totalCount > 0 ? Math.round((semanticCount / totalCount) * 100) : 0}%`)

    // Show some examples of videos that need migration
    if (remainingCount > 0) {
      console.log(`\n📋 Sample videos that need migration:`)

      const { data: sampleVideos, error: sampleError } = await supabase
        .from('videos')
        .select('id, title, youtube_id')
        .eq('is_processed', true)
        .limit(5)

      if (sampleVideos && !sampleError) {
        for (const video of sampleVideos) {
          // Check if this video has semantic chunks
          const hasSemanticChunks = uniqueSemanticVideos.has(video.id)
          const status = hasSemanticChunks ? '✅ Migrated' : '⏳ Needs migration'
          console.log(`  ${status}: ${video.title} (${video.youtube_id})`)
        }
      }
    }

  } catch (error) {
    console.error('❌ Error checking migration status:', error)
  }
}

// Command line interface
const command = process.argv[2]
const argument = process.argv[3]

switch (command) {
  case 'all':
    migrateAllVideos()
    break
  case 'video':
    if (!argument) {
      console.error('❌ Please provide a YouTube ID: node migrate-to-semantic-chunks.js video YOUTUBE_ID')
      process.exit(1)
    }
    migrateSpecificVideo(argument)
    break
  case 'status':
    checkMigrationStatus()
    break
  default:
    console.log(`
🧠 Semantic Chunking Migration Tool

Usage:
  node migrate-to-semantic-chunks.js all           # Migrate all videos
  node migrate-to-semantic-chunks.js video <id>    # Migrate specific video by YouTube ID
  node migrate-to-semantic-chunks.js status        # Check migration status

Examples:
  node migrate-to-semantic-chunks.js all
  node migrate-to-semantic-chunks.js video dQw4w9WgXcQ
  node migrate-to-semantic-chunks.js status
`)
    break
}