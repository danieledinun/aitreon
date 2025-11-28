import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { supabase } from '@/lib/supabase'
import { SemanticChunkingService } from '@/lib/semantic-chunking-service'
import type { Creator, Video } from '@/lib/supabase'


// Helper function to call Python transcript extractor
async function callPythonExtractor(command: string, args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(process.cwd(), 'scripts', 'transcript_env', 'bin', 'python')
    const scriptPath = path.join(process.cwd(), 'scripts', 'youtube_transcript_extractor.py')

    const child = spawn(pythonPath, [scriptPath, command, ...args])

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout)
          resolve(result)
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${stdout}`))
        }
      } else {
        reject(new Error(`Python script failed: ${stderr}`))
      }
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const { videoIds, creatorId } = await request.json()

    // Require creatorId to be provided directly
    if (!creatorId) {
      return NextResponse.json({ error: 'creatorId is required' }, { status: 400 })
    }

    console.log('🔄 Processing specific videos for creator:', creatorId, 'Videos:', videoIds)

    // Get creator by ID using Supabase client
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, username')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      console.error('Creator fetch error:', creatorError)
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Process the specified videos
    let newVideos = 0
    let processedVideos = 0
    const videoIds_array = Array.isArray(videoIds) ? videoIds : [videoIds]

    for (const videoId of videoIds_array) {
      try {
        // Check if video already exists
        const { data: existingVideo } = await supabase
          .from('videos')
          .select('id')
          .eq('youtube_id', videoId)
          .single()

        if (existingVideo) {
          console.log(`📺 Video ${videoId} already exists, skipping...`)
          continue
        }

        console.log(`📺 Processing video: ${videoId}`)

        // Get video metadata using Python extractor
        const metadata = await callPythonExtractor('metadata', [videoId])

        if (!metadata.success) {
          console.error(`❌ Failed to get metadata for ${videoId}:`, metadata.error)
          continue
        }

        // Get transcript using Python extractor
        const transcriptResult = await callPythonExtractor('single', [videoId])

        let transcriptText = ''
        let segments = []

        if (transcriptResult.success) {
          console.log(`✅ Got transcript for ${videoId} in ${transcriptResult.language}`)
          segments = transcriptResult.segments || []
          transcriptText = segments.map((s: any) => s.text).join(' ')
        } else {
          console.warn(`⚠️ No transcript available for ${videoId}:`, transcriptResult.error)
        }

        newVideos++

        // Create video record using Supabase client
        const { data: videoRecord, error: videoError } = await supabase
          .from('videos')
          .insert({
            creator_id: creator.id,
            youtube_id: videoId,
            title: metadata.title || 'Unknown Title',
            description: metadata.description || '',
            thumbnail: metadata.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: metadata.duration || 0,
            published_at: metadata.upload_date ? new Date(metadata.upload_date).toISOString() : new Date().toISOString(),
            transcript: transcriptText,
            is_processed: !!transcriptText,
            synced_at: transcriptText ? new Date().toISOString() : null
          })
          .select()
          .single()

        if (videoError || !videoRecord) {
          console.error(`❌ Failed to create video record for ${videoId}:`, videoError)
          continue
        }

        console.log(`✅ Created video record: ${videoRecord.id}`)

        // Process transcript into semantic chunks if available
        if (transcriptText && segments.length > 0) {
          console.log(`📝 Creating semantic chunks from ${segments.length} transcript segments for video ${videoRecord.id}`)

          // Convert segments to required format for semantic chunking
          const transcriptSegments = segments.map((segment: any) => ({
            start: segment.start || 0,
            end: segment.end || (segment.start + segment.duration) || 0,
            duration: segment.duration || 0,
            text: segment.text || ''
          }))

          // Generate semantic chunks using the new service
          const semanticChunks = SemanticChunkingService.createSemanticChunks(
            transcriptSegments,
            videoRecord.id,
            {
              minChunkDuration: 15,  // 15-40 second chunks for better context
              maxChunkDuration: 40,
              overlapDuration: 4,    // 4 second overlap between chunks
              minWordsPerChunk: 20   // Minimum 20 words per chunk
            }
          )

          // Filter out low-quality chunks
          const validChunks = semanticChunks.filter(chunk =>
            SemanticChunkingService.validateChunk(chunk)
          )

          console.log(`📊 Generated ${semanticChunks.length} semantic chunks, ${validChunks.length} passed quality validation`)

          if (validChunks.length > 0) {
            // Convert to database format
            const chunks = validChunks.map((chunk, i) => ({
              creator_id: creator.id,
              video_id: videoRecord.id,
              video_title: metadata.title,
              video_url: `https://www.youtube.com/watch?v=${videoId}`,
              content: chunk.content,
              start_time: chunk.start_time,
              end_time: chunk.end_time,
              chunk_index: i,
              metadata: {
                semantic_chunk_id: chunk.chunk_id,
                sentence_count: chunk.sentence_count,
                word_count: chunk.word_count,
                confidence_score: chunk.confidence_score,
                chunk_type: 'semantic'
              }
            }))

            // Insert chunks in batches to avoid overwhelming Supabase
            const batchSize = 50  // Smaller batches since chunks are larger
            for (let i = 0; i < chunks.length; i += batchSize) {
              const batch = chunks.slice(i, i + batchSize)

              const { error: chunkError } = await supabase
                .from('content_chunks')
                .insert(batch)

              if (chunkError) {
                console.error(`❌ Failed to create semantic chunk batch ${i}-${i + batch.length} for video ${videoId}:`, chunkError)
              } else {
                console.log(`✅ Created semantic chunks ${i + 1}-${Math.min(i + batchSize, chunks.length)} of ${chunks.length}`)
              }
            }
          } else {
            console.warn(`⚠️ No valid semantic chunks generated for video ${videoId}`)
          }

          processedVideos++

          console.log(`✅ Video ${videoId} synced and ready for AI responses`)
        }
      } catch (error) {
        console.error(`❌ Error processing video ${videoId}:`, error)
      }
    }

    // Trigger post-sync speech analysis if we processed any videos
    if (processedVideos > 0) {
      try {
        console.log('🎤 Triggering post-sync speech analysis...')
        const speechAnalysisPath = path.join(process.cwd(), 'scripts', 'post-sync-speech-analysis.js')

        // Spawn the speech analysis script in the background
        const speechAnalysisProcess = spawn('node', [speechAnalysisPath], {
          detached: true,
          stdio: 'ignore'
        })

        // Allow the process to run independently
        speechAnalysisProcess.unref()

        console.log('✅ Post-sync speech analysis triggered')
      } catch (error) {
        console.error('⚠️ Failed to trigger speech analysis:', error)
        // Don't fail the sync if speech analysis trigger fails
      }

      // Also trigger FORCED style card analysis for automatic updates (ignores cooldowns)
      try {
        console.log('🎨 Triggering FORCED style card analysis for auto-update...')
        const forceAnalysisPath = path.join(process.cwd(), 'scripts', 'force-speech-analysis.js')

        // Spawn the forced analysis script in the background
        const forceAnalysisProcess = spawn('node', [forceAnalysisPath], {
          detached: true,
          stdio: 'ignore'
        })

        // Allow the process to run independently
        forceAnalysisProcess.unref()

        console.log('✅ FORCED style card analysis triggered for auto-update')
      } catch (error) {
        console.error('⚠️ Failed to trigger forced style card analysis:', error)
        // Don't fail the sync if style analysis trigger fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sync: {
          totalVideos: videoIds_array.length,
          newVideos,
          processedVideos,
        },
        creator: {
          id: creator.id,
          username: creator.username,
          profileUrl: `${process.env.NEXTAUTH_URL}/${creator.username}`
        }
      }
    })
  } catch (error) {
    console.error('YouTube sync error:', error)
    return NextResponse.json({
      error: 'Failed to sync YouTube data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}