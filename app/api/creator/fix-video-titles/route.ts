import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the creator for the current user
    const creator = await db.creator.findUnique({
      where: { userId: session.user.id }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    console.log(`🔧 Starting video title fix for creator: ${creator.displayName}`)

    // Get videos with problematic titles or specific video
    const { videoId, fixAll } = await request.json()

    let videosToFix
    if (videoId) {
      // Fix specific video
      videosToFix = await db.video.findMany({
        where: {
          creatorId: creator.id,
          youtubeId: videoId
        }
      })
    } else if (fixAll) {
      // Fix all videos with problematic titles
      videosToFix = await db.video.findMany({
        where: {
          creatorId: creator.id,
          OR: [
            { title: { contains: 'Test Video' } },
            { title: { contains: 'g8TQtlAIPG0' } },
            { title: { equals: '' } },
            { title: { equals: null } }
          ]
        }
      })
    } else {
      return NextResponse.json({ error: 'Must specify videoId or fixAll' }, { status: 400 })
    }

    console.log(`🔍 Found ${videosToFix.length} videos to fix`)

    const results = {
      totalVideos: videosToFix.length,
      fixedVideos: 0,
      errors: [] as string[],
      fixedTitles: [] as Array<{ youtubeId: string; oldTitle: string; newTitle: string }>
    }

    // Process each video
    for (const video of videosToFix) {
      try {
        console.log(`🔄 Fixing title for video: ${video.youtubeId} (current: "${video.title}")`)

        // Use Python script to get correct metadata
        const command = `./scripts/transcript_env/bin/python scripts/youtube_transcript_extractor.py metadata ${video.youtubeId}`
        const { stdout, stderr } = await execAsync(command)

        if (stderr) {
          console.log(`⚠️ Python script stderr:`, stderr)
        }

        const metadata = JSON.parse(stdout)

        if (metadata.success && metadata.title && metadata.title !== video.title) {
          const oldTitle = video.title
          
          // Update the video record with correct title and other metadata
          await db.video.update({
            where: { id: video.id },
            data: {
              title: metadata.title,
              description: metadata.description || video.description,
              duration: metadata.duration || video.duration,
              thumbnail: metadata.thumbnail || video.thumbnail,
            }
          })

          results.fixedVideos++
          results.fixedTitles.push({
            youtubeId: video.youtubeId,
            oldTitle,
            newTitle: metadata.title
          })

          console.log(`✅ Fixed title for ${video.youtubeId}: "${oldTitle}" → "${metadata.title}"`)
        } else if (metadata.success) {
          console.log(`ℹ️ Title already correct for ${video.youtubeId}: "${video.title}"`)
        } else {
          const errorMsg = `Failed to get metadata: ${metadata.message || 'Unknown error'}`
          results.errors.push(`${video.youtubeId}: ${errorMsg}`)
          console.log(`❌ Error for ${video.youtubeId}: ${errorMsg}`)
        }

        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        const errorMsg = `Error processing ${video.youtubeId}: ${error instanceof Error ? error.message : error}`
        results.errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }

    console.log(`🎉 Title fix complete: ${results.fixedVideos}/${results.totalVideos} videos fixed`)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Video title fix error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fix video titles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get videos that need title fixes
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
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Get videos with problematic titles
    const problematicVideos = await db.video.findMany({
      where: {
        creatorId: creator.id,
        OR: [
          { title: { contains: 'Test Video' } },
          { title: { contains: 'g8TQtlAIPG0' } },
          { title: { equals: '' } },
          { title: { equals: null } }
        ]
      },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        createdAt: true,
        isProcessed: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        problematicVideos,
        count: problematicVideos.length
      }
    })

  } catch (error) {
    console.error('Error getting problematic videos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}