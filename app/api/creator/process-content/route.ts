import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { SupabaseVectorService } from '@/lib/supabase-vector-service'
import { triggerSpeechAnalysis } from '@/lib/speech-analysis-trigger'

/**
 * Process videos with semantic chunking and sync to Supabase
 */
async function processCreatorVideosWithSemanticChunking(creatorId: string) {
  console.log(`🔄 Starting semantic chunking and Supabase sync for creator ${creatorId}`)

  // Get all processed videos that have transcripts
  const videos = await db.video.findMany({
    where: {
      creator_id: creatorId,
      is_processed: true,
      transcript: {
        not: null
      }
    }
  })

  console.log(`📹 Found ${videos.length} videos with transcripts to process`)

  let processedVideos = 0
  let totalChunks = 0

  for (const video of videos) {
    try {
      console.log(`🔄 Processing video: ${video.title}`)

      // Use the semantic chunking script to process this video
      const { exec } = require('child_process')
      const util = require('util')
      const execPromise = util.promisify(exec)

      const env = {
        ...process.env,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'deepinfra',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY
      }

      const command = `node scripts/create-chunks-from-transcripts.js video ${video.youtube_id}`
      console.log(`📝 Running: ${command}`)

      const { stdout, stderr } = await execPromise(command, {
        cwd: process.cwd(),
        env
      })

      if (stdout) console.log(stdout)
      if (stderr) console.error(stderr)

      // Check if chunks were created successfully
      const { createClient } = require('@supabase/supabase-js')
      const supabaseChecker = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: chunks } = await supabaseChecker.from('content_chunks').select('*').eq('video_id', video.id)

      if (chunks && chunks.length > 0) {
        processedVideos++
        totalChunks += chunks.length
        console.log(`   ✅ Created ${chunks.length} semantic chunks for: ${video.title}`)
      } else {
        console.log(`   ⚠️ No chunks created for: ${video.title}`)
      }

    } catch (error) {
      console.error(`   ❌ Error processing video ${video.title}:`, error)
    }

    // Small delay between videos
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log(`✅ Semantic chunking complete: ${processedVideos}/${videos.length} videos, ${totalChunks} total chunks`)
  return { processedVideos, totalChunks, totalVideos: videos.length }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the creator profile for this user
    const creator = await db.creator.findUnique({
      where: { userId: session.user.id }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    // Get the user's access token
    const account = await db.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google'
      }
    })

    if (!account?.access_token) {
      return NextResponse.json({ 
        error: 'YouTube access token not found. Please reconnect your YouTube account.' 
      }, { status: 400 })
    }

    // Check if token needs refresh
    let accessToken = account.access_token
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = account.expires_at || 0

    // Debug token information
    console.log(`🔍 Token Debug Info:`)
    console.log(`   • Current time: ${now}`)
    console.log(`   • Token expires at: ${expiresAt}`)
    console.log(`   • Token expired: ${expiresAt <= now}`)
    console.log(`   • Has refresh token: ${!!account.refresh_token}`)
    console.log(`   • Access token length: ${account.access_token?.length || 0}`)

    if (expiresAt <= now && account.refresh_token) {
      console.log('🔄 Access token expired, attempting refresh...')
      try {
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: account.refresh_token,
          }),
        })

        const responseText = await refreshResponse.text()
        console.log(`🔄 Refresh response status: ${refreshResponse.status}`)
        console.log(`🔄 Refresh response: ${responseText}`)

        if (refreshResponse.ok) {
          const tokens = JSON.parse(responseText)
          accessToken = tokens.access_token

          // Update the access token in the database
          await db.account.update({
            where: { id: account.id },
            data: {
              access_token: tokens.access_token,
              expires_at: now + tokens.expires_in,
              refresh_token: tokens.refresh_token || account.refresh_token,
            }
          })
          console.log('✅ Token refreshed successfully')
        } else {
          console.error('❌ Token refresh failed:', responseText)
          return NextResponse.json({ 
            error: 'Failed to refresh access token. Please reconnect your YouTube account.',
            debug: {
              status: refreshResponse.status,
              response: responseText,
              hasRefreshToken: !!account.refresh_token,
              expiresAt: expiresAt,
              currentTime: now
            }
          }, { status: 400 })
        }
      } catch (refreshError) {
        console.error('❌ Token refresh error:', refreshError)
        return NextResponse.json({ 
          error: 'Failed to refresh access token. Please reconnect your YouTube account.',
          debug: { refreshError: refreshError instanceof Error ? refreshError.message : 'Unknown error' }
        }, { status: 400 })
      }
    } else if (expiresAt <= now && !account.refresh_token) {
      console.log('❌ Token expired but no refresh token available')
      return NextResponse.json({ 
        error: 'Access token expired and no refresh token available. Please reconnect your YouTube account.',
        debug: {
          hasRefreshToken: false,
          expiresAt: expiresAt,
          currentTime: now
        }
      }, { status: 400 })
    }

    // Start knowledge base processing with quota-conscious limits
    console.log(`🧠 Starting manual knowledge base processing for creator: ${creator.display_name}`)
    console.log(`🔑 Using access token (length: ${accessToken.length})`)
    console.log(`⏰ Token expires at: ${account.expires_at ? new Date(account.expires_at * 1000) : 'unknown'}`)
    
    // Get processing limit from query params (default: 5 videos for better understanding)
    const url = new URL(request.url)
    const maxVideos = parseInt(url.searchParams.get('maxVideos') || '5')
    
    console.log(`🧠 Processing creator content with enhanced semantic chunking system`)
    const result = await processCreatorVideosWithSemanticChunking(creator.id)

    if (result.processedVideos > 0) {
      console.log(`✅ Semantic chunking completed successfully for creator ${creator.id}`)
      console.log(`📊 Processed ${result.processedVideos}/${result.totalVideos} videos with ${result.totalChunks} semantic chunks`)

      // Trigger speech analysis automation
      const speechAnalysisResult = await triggerSpeechAnalysis(result.processedVideos, 'manual content processing')

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${result.processedVideos} videos with ${result.totalChunks} semantic chunks using enhanced RAG pipeline`,
        processedVideos: result.processedVideos,
        totalChunks: result.totalChunks,
        totalVideos: result.totalVideos,
        speechAnalysis: {
          triggered: speechAnalysisResult.speechAnalysisTriggered || speechAnalysisResult.forceAnalysisTriggered,
          errors: speechAnalysisResult.errors
        }
      })
    } else {
      console.log(`⚠️ No videos processed for creator ${creator.id}`)
      return NextResponse.json({
        success: false,
        error: 'No videos were processed. Check that videos have transcripts and are marked as processed.',
        debug: {
          totalVideos: result.totalVideos,
          processedVideos: result.processedVideos
        }
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Content processing error:', error)
    return NextResponse.json({ 
      error: 'Failed to process content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get processing status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const creator = await db.creator.findUnique({
      where: { userId: session.user.id }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    // Get video processing statistics
    const videos = await db.video.findMany({
      where: { creator_id: creator.id },
    })

    const stats = {
      totalVideos: videos.length,
      processedVideos: videos.filter(v => v.is_processed).length,
      syncedVideos: videos.filter(v => v.synced_to_graph_rag).length,
      pendingVideos: videos.filter(v => v.is_processed && !v.synced_to_graph_rag).length
    }

    return NextResponse.json({ stats })

  } catch (error) {
    console.error('Error getting content stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}