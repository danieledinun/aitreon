import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ExtendedYouTubeService } from '@/lib/youtube-extended'
import { supabase } from '@/lib/supabase'
import { SupabaseVectorService } from '@/lib/supabase-vector-service'
import { triggerSpeechAnalysis } from '@/lib/speech-analysis-trigger'

interface SyncContentRequest {
  type: 'single' | 'playlist' | 'channel'
  videoId?: string
  playlistId?: string
  channelUrl?: string
  maxVideos?: number
  languages?: string[]
}

// Helper to create streaming response
function createStreamingResponse() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array>
  let isClosed = false
  
  const stream = new ReadableStream({
    start(c) {
      controller = c
    }
  })

  const sendProgress = (data: any) => {
    if (isClosed) {
      console.warn('Attempted to send progress after controller was closed')
      return
    }
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`
      controller.enqueue(encoder.encode(message))
    } catch (error) {
      console.error('Error sending progress:', error)
      isClosed = true
    }
  }

  const close = () => {
    if (isClosed) {
      console.warn('Attempted to close controller multiple times')
      return
    }
    try {
      controller.close()
      isClosed = true
    } catch (error) {
      console.error('Error closing controller:', error)
      isClosed = true
    }
  }

  return { stream, sendProgress, close }
}

export async function POST(request: NextRequest) {
  try {
    // Check for internal requests first
    const isInternalRequest = request.headers.get('X-Internal-Request') === 'true'
    const internalCreatorId = request.headers.get('X-Creator-Id')
    
    let creator: any = null
    
    if (isInternalRequest && internalCreatorId) {
      // Internal request - get creator directly by ID
      const { data: creatorData, error } = await supabase
        .from('creators')
        .select('id, user_id, username')
        .eq('id', internalCreatorId)
        .single()
      
      if (error || !creatorData) {
        console.error('Internal request - creator not found:', error)
        return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
      }
      
      creator = creatorData
    } else {
      // Regular request - check session
      const session = await getServerSession(authOptions)
      
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get user and creator using Supabase
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (userError || !userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const { data: creatorData, error: creatorError } = await supabase
        .from('creators')
        .select('id, user_id, username')
        .eq('user_id', userData.id)
        .single()

      if (creatorError || !creatorData) {
        return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
      }
      
      creator = creatorData
    }

    const body: SyncContentRequest = await request.json()
    const { type, videoId, playlistId, channelUrl, maxVideos = 10, languages = ['en'] } = body

    // Create streaming response
    const { stream, sendProgress, close } = createStreamingResponse()

    // Process in background
    processContentSync(creator.id, body, sendProgress, close)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Sync content error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function processContentSync(
  creatorId: string,
  request: SyncContentRequest,
  sendProgress: (data: any) => void,
  close: () => void
) {
  const { type, videoId, playlistId, channelUrl, maxVideos = 10, languages = ['en'] } = request
  
  let videosFound = 0
  let transcriptsExtracted = 0
  let segmentsProcessed = 0
  let errors: string[] = []

  try {
    sendProgress({
      type: 'progress',
      stage: 'discovery',
      current: 0,
      total: 1,
      message: 'Starting content discovery...'
    })

    let videoIds: string[] = []
    let videoTitles: { [key: string]: string } = {}

    // Stage 1: Video Discovery
    switch (type) {
      case 'single':
        if (!videoId) {
          throw new Error('Video ID is required for single video sync')
        }
        
        sendProgress({
          type: 'progress',
          stage: 'discovery',
          current: 0,
          total: 1,
          message: 'Fetching video metadata...'
        })
        
        // Fetch actual video metadata instead of using placeholder
        try {
          const videoMetadata = await ExtendedYouTubeService.getVideoMetadata(videoId)
          
          if (videoMetadata && videoMetadata.title) {
            videoIds = [videoId]
            videoTitles[videoId] = videoMetadata.title
            videosFound = 1
            
            sendProgress({
              type: 'progress',
              stage: 'discovery',
              current: 1,
              total: 1,
              message: `Found video: ${videoMetadata.title}`
            })
          } else {
            throw new Error('Could not fetch video metadata')
          }
        } catch (metadataError) {
          console.warn('Failed to fetch video metadata, using fallback title:', metadataError)
          
          // Fallback to basic title if metadata fetch fails
          videoIds = [videoId]
          videoTitles[videoId] = `Video ${videoId}`
          videosFound = 1
          
          sendProgress({
            type: 'progress',
            stage: 'discovery',
            current: 1,
            total: 1,
            message: `Found video: ${videoTitles[videoId]}`
          })
        }
        break

      case 'playlist':
        throw new Error('Playlist sync is not supported in production. Please use channel sync instead.')

      case 'channel':
        if (!channelUrl) {
          throw new Error('Channel URL is required for channel sync')
        }
        
        sendProgress({
          type: 'progress',
          stage: 'discovery',
          current: 0,
          total: 1,
          message: 'Discovering videos from channel...'
        })
        
        // Use dynamic channel discovery
        const channelDiscovery = await ExtendedYouTubeService.discoverChannelVideos(channelUrl, maxVideos)
        
        if (!channelDiscovery.success) {
          throw new Error(channelDiscovery.error || 'Failed to discover channel videos')
        }
        
        videoIds = channelDiscovery.videoIds
        videoTitles = channelDiscovery.videoTitles
        videosFound = videoIds.length
        
        sendProgress({
          type: 'progress',
          stage: 'discovery',
          current: 1,
          total: 1,
          message: `Found ${videosFound} videos from ${channelDiscovery.channelTitle || 'channel'}`
        })
        break
    }

    // Only send general discovery progress if not already sent by channel case
    if (type !== 'channel') {
      sendProgress({
        type: 'progress',
        stage: 'discovery',
        current: 1,
        total: 1,
        message: `Found ${videosFound} videos`
      })
    }

    // Stage 2: Transcript Extraction
    sendProgress({
      type: 'progress',
      stage: 'transcripts',
      current: 0,
      total: videoIds.length,
      message: 'Extracting transcripts...'
    })

    const transcriptResults = await ExtendedYouTubeService.extractMultipleTranscripts(videoIds, languages)
    
    let currentVideo = 0
    for (const [vId, result] of Object.entries(transcriptResults)) {
      currentVideo++
      
      sendProgress({
        type: 'progress',
        stage: 'transcripts',
        current: currentVideo,
        total: videoIds.length,
        currentItem: videoTitles[vId] || vId,
        message: `Processing transcript ${currentVideo}/${videoIds.length}`
      })

      if (result.success) {
        transcriptsExtracted++
        segmentsProcessed += result.segments_count || 0

        // Stage 3: traditional RAG and Supabase Processing
        try {
          // Get user ID for logging
          let userId: string | undefined
          try {
            const { data: creatorData } = await supabase
              .from('creators')
              .select('user_id')
              .eq('id', creatorId)
              .single()
            
            if (creatorData) {
              userId = creatorData.user_id
            }
          } catch (err) {
            console.warn('Could not get user ID for logging:', err)
          }

          // Add processing log for video start
          if (userId) {
            try {
              const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
              await fetch(`${baseUrl}/api/processing-logs`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  message: `🎥 Processing video for traditional RAG and Supabase: ${videoTitles[vId] || vId} (${vId})`,
                  userId: userId
                })
              })
            } catch (logError) {
              console.warn('Failed to create start processing log:', logError)
            }
          }

          await processTranscriptForRAG(creatorId, vId, result, videoTitles[vId])
          
          // Add completion log
          if (userId) {
            try {
              const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
              await fetch(`${baseUrl}/api/processing-logs`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  message: `✅ Video processed for traditional RAG and Supabase: ${videoTitles[vId] || vId} (${vId})`,
                  userId: userId
                })
              })
            } catch (logError) {
              console.warn('Failed to create completion processing log:', logError)
            }
          }
        } catch (ragError) {
          console.error('traditional RAG processing failed for video', vId, ragError)
          errors.push(`traditional RAG processing failed for ${vId}: ${ragError instanceof Error ? ragError.message : 'Unknown error'}`)
        }
      } else {
        errors.push(`Transcript extraction failed for ${vId}: ${result.message || 'Unknown error'}`)
      }

      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Trigger speech analysis automation if content was processed
    if (transcriptsExtracted > 0) {
      try {
        console.log('🎤 Triggering speech analysis automation after sync-content...')
        await triggerSpeechAnalysis(transcriptsExtracted, 'content sync')
      } catch (speechError) {
        console.error('⚠️ Failed to trigger speech analysis:', speechError)
        // Don't fail the sync if speech analysis trigger fails
      }
    }

    // Send completion
    const successRate = videosFound > 0 ? (transcriptsExtracted / videosFound) * 100 : 0

    sendProgress({
      type: 'complete',
      stage: 'complete',
      current: videoIds.length,
      total: videoIds.length,
      videosFound,
      transcriptsExtracted,
      segmentsProcessed,
      successRate,
      errors
    })

  } catch (error) {
    console.error('Content sync processing error:', error)
    sendProgress({
      type: 'complete',
      stage: 'complete',
      current: 0,
      total: 1,
      videosFound,
      transcriptsExtracted,
      segmentsProcessed,
      successRate: 0,
      errors: [error instanceof Error ? error.message : 'Unknown processing error']
    })
  } finally {
    close()
  }
}

async function processTranscriptForRAG(
  creatorId: string,
  videoId: string,
  transcriptResult: any,
  videoTitle: string
) {
  if (!transcriptResult.success || !transcriptResult.segments) {
    return
  }

  // Create segments text for traditional RAG
  const segmentsText = transcriptResult.segments
    .map((segment: any) => {
      const timestamp = `[${Math.floor(segment.start / 60)}:${String(Math.floor(segment.start % 60)).padStart(2, '0')}]`
      return `${timestamp} ${segment.text}`
    })
    .join('\n')

  const episodeContent = `Video: ${videoTitle}
URL: https://youtube.com/watch?v=${videoId}
Language: ${transcriptResult.language}
Duration: ${Math.floor(transcriptResult.segments[transcriptResult.segments.length - 1]?.end / 60)} minutes
Transcript Quality: ${transcriptResult.is_generated ? 'Auto-generated' : 'Manual'} (${Math.round(transcriptResult.confidence * 100)}% confidence)

Transcript:
${segmentsText}`

  try {
    // Store transcript data to traditional RAG memory using internal API
    console.log(`📝 Adding video ${videoId} to traditional RAG memory system`)
    
    console.log(`📝 Transcript content prepared for traditional RAG:`)
    console.log(`   - Video Title: ${videoTitle}`)
    console.log(`   - Creator ID: ${creatorId}`)
    console.log(`   - Content Length: ${episodeContent.length} characters`)
    console.log(`   - Language: ${transcriptResult.language}`)
    console.log(`   - Segments: ${transcriptResult.segments_count}`)
    console.log(`   - Quality: ${transcriptResult.is_generated ? 'Auto-generated' : 'Manual'}`)

    // Get user ID for logging (need to fetch from creator)
    let userId: string | undefined
    try {
      const { data: creatorData } = await supabase
        .from('creators')
        .select('user_id')
        .eq('id', creatorId)
        .single()
      
      if (creatorData) {
        userId = creatorData.user_id
      }
    } catch (err) {
      console.warn('Could not get user ID for logging:', err)
    }
    
    // Call internal traditional RAG API
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const ragResponse = await fetch(`${baseUrl}/api/rag/memory/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true'  // Mark this as an internal server request
        },
        body: JSON.stringify({
          name: `YouTube Video: ${videoTitle}`,
          episode_body: episodeContent,
          group_id: `creator_${creatorId}`,
          source: 'text',
          source_description: `YouTube video transcript from ${videoTitle}`,
          creatorId: creatorId  // Pass creator ID for internal auth
        })
      })
      
      if (ragResponse.ok) {
        const ragResult = await ragResponse.json()
        console.log(`✅ Video ${videoId} successfully added to traditional RAG: ${ragResult.message}`)
        
        // Add processing log for AI learning status component
        if (userId && ragResult.episode_id) {
          try {
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
            await fetch(`${baseUrl}/api/processing-logs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                message: `✅ Episode queued for MCP traditional RAG processing: YouTube Video: ${videoTitle} (ID: ${ragResult.episode_id})`,
                userId: userId
              })
            })
            console.log(`📝 Processing log created for video: ${videoTitle}`)
          } catch (logError) {
            console.warn('Failed to create processing log:', logError)
          }
        }

        // Video processed successfully - no additional queue processing needed
        console.log(`✅ Video ${videoId} processed directly by production traditional RAG service`)
      } else {
        const ragError = await ragResponse.json()
        console.error(`❌ Failed to add video ${videoId} to traditional RAG: ${ragError.error}`)
        // Don't fail the entire process - just log the error
      }
    } catch (ragError) {
      console.error(`❌ traditional RAG API error for video ${videoId}:`, ragError)
      // Don't fail the entire process - just log the error
    }
    
    console.log(`✅ Video ${videoId} processed and queued for traditional RAG`)

    // Also store in database for tracking using Supabase
    let video: any
    
    // Check if video exists
    const { data: existingVideo } = await supabase
      .from('videos')
      .select('id, title, is_processed, transcript')
      .eq('youtube_id', videoId)
      .single()

    if (existingVideo) {
      // Update existing video
      const { data: updatedVideo, error: updateError } = await supabase
        .from('videos')
        .update({
          title: videoTitle,
          is_processed: true,
          transcript: segmentsText,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingVideo.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('Failed to update video:', updateError)
        throw updateError
      }
      
      video = updatedVideo
    } else {
      // Create new video
      const { data: newVideo, error: createError } = await supabase
        .from('videos')
        .insert({
          youtube_id: videoId,
          title: videoTitle,
          creator_id: creatorId,
          is_processed: true,
          transcript: segmentsText
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Failed to create video:', createError)
        throw createError
      }
      
      video = newVideo
    }

    // Process video with enhanced semantic chunking
    console.log(`🔄 Processing video ${videoId} with enhanced semantic chunking`)

    if (transcriptResult.segments && transcriptResult.segments.length > 0) {
      try {
        // Use the semantic chunking script to process this video directly
        const { exec } = require('child_process')
        const util = require('util')
        const execPromise = util.promisify(exec)

        const env = {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'openai',
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          BASETEN_API_KEY: process.env.BASETEN_API_KEY
        }

        const command = `node scripts/create-chunks-from-transcripts.js video ${videoId}`
        console.log(`📝 Running semantic chunking: ${command}`)

        const { stdout, stderr } = await execPromise(command, {
          cwd: process.cwd(),
          env,
          timeout: 300000 // 5 minute timeout
        })

        if (stdout) console.log(`📝 Semantic chunking output:`, stdout.substring(0, 500) + (stdout.length > 500 ? '...' : ''))
        if (stderr) console.warn(`📝 Semantic chunking warnings:`, stderr.substring(0, 500) + (stderr.length > 500 ? '...' : ''))

        // Check if semantic chunks were created successfully
        const { data: semanticChunks } = await supabase
          .from('content_chunks')
          .select('id, content, start_time, end_time')
          .eq('video_id', video.id)

        if (semanticChunks && semanticChunks.length > 0) {
          console.log(`✅ Successfully created ${semanticChunks.length} semantic chunks for video ${videoId}`)
          console.log(`📊 Semantic chunks: ${semanticChunks.length} meaningful segments (60-90 seconds each)`)
        } else {
          console.log(`⚠️ No semantic chunks created, falling back to semantic chunking script`)

          // Fallback to semantic chunking script instead of granular chunks
          try {
            const { exec } = require('child_process')
            const util = require('util')
            const execPromise = util.promisify(exec)

            const env = {
              ...process.env,
              NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
              EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'deepinfra',
              OPENAI_API_KEY: process.env.OPENAI_API_KEY,
              DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY
            }

            const command = `node scripts/create-chunks-from-transcripts.js video ${videoId}`
            console.log(`📝 Fallback: Running semantic chunking script: ${command}`)

            const { stdout, stderr } = await execPromise(command, {
              cwd: process.cwd(),
              env
            })

            if (stdout) console.log(stdout)
            if (stderr) console.error(stderr)

            // Check if chunks were created successfully
            const { data: chunks } = await supabase
              .from('content_chunks')
              .select('*')
              .eq('video_id', video.id)

            if (chunks && chunks.length > 0) {
              console.log(`✅ Fallback: Created ${chunks.length} semantic chunks for video ${videoId}`)
            } else {
              console.log(`⚠️ Fallback semantic chunking produced no chunks for video ${videoId}`)
            }
          } catch (fallbackError) {
            console.error(`❌ Fallback semantic chunking failed for video ${videoId}:`, fallbackError)
          }
        }

      } catch (semanticError) {
        console.error(`❌ Semantic chunking failed for video ${videoId}:`, semanticError)

        // Fallback to semantic chunking script
        console.log(`🔄 Falling back to semantic chunking script for video ${videoId}`)

        try {
          const { exec } = require('child_process')
          const util = require('util')
          const execPromise = util.promisify(exec)

          const env = {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
            EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'deepinfra',
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY
          }

          const command = `node scripts/create-chunks-from-transcripts.js video ${videoId}`
          console.log(`📝 Fallback: Running semantic chunking script: ${command}`)

          const { stdout, stderr } = await execPromise(command, {
            cwd: process.cwd(),
            env
          })

          if (stdout) console.log(stdout)
          if (stderr) console.error(stderr)

          // Check if chunks were created successfully
          const { data: chunks } = await supabase
            .from('content_chunks')
            .select('*')
            .eq('video_id', video.id)

          if (chunks && chunks.length > 0) {
            console.log(`✅ Fallback: Created ${chunks.length} semantic chunks for video ${videoId}`)
          } else {
            console.log(`⚠️ Fallback semantic chunking produced no chunks for video ${videoId}`)
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback semantic chunking also failed for video ${videoId}:`, fallbackError)
          // Don't fail the entire process if even fallback fails
        }
      }
    } else {
      console.warn(`⚠️ No transcript segments found for video ${videoId}, skipping chunking`)
    }

    console.log(`✅ Processed video ${videoId} for both traditional RAG and Supabase`)

  } catch (error) {
    console.error(`❌ Failed to process video ${videoId} for traditional RAG:`, error)
    throw error
  }
}