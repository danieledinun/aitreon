const { PrismaClient } = require('@prisma/client')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)
const prisma = new PrismaClient()

async function fixVideoTitles() {
  try {
    console.log('🔧 Starting video title fix...')

    // Find videos with problematic titles
    const problematicVideos = await prisma.video.findMany({
      where: {
        OR: [
          { title: { contains: 'Test Video' } },
          { title: { contains: 'g8TQtlAIPG0' } },
          { title: { equals: '' } }
        ]
      },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        description: true,
        thumbnail: true,
        duration: true
      }
    })

    console.log(`🔍 Found ${problematicVideos.length} videos with problematic titles`)

    let fixedCount = 0
    const results = []

    for (const video of problematicVideos) {
      try {
        console.log(`🔄 Fixing video: ${video.youtubeId} (current: "${video.title}")`)
        
        // Use Python script to get correct metadata
        const command = `./scripts/transcript_env/bin/python scripts/youtube_transcript_extractor.py metadata ${video.youtubeId}`
        const { stdout, stderr } = await execAsync(command)

        if (stderr) {
          console.log(`⚠️ Python stderr:`, stderr)
        }

        const metadata = JSON.parse(stdout)

        if (metadata.success && metadata.title && metadata.title !== video.title) {
          const oldTitle = video.title
          
          // Update video with correct metadata
          await prisma.video.update({
            where: { id: video.id },
            data: {
              title: metadata.title,
              description: metadata.description || video.description,
              duration: metadata.duration || video.duration,
              thumbnail: metadata.thumbnail || video.thumbnail,
            }
          })

          fixedCount++
          const result = {
            youtubeId: video.youtubeId,
            oldTitle,
            newTitle: metadata.title
          }
          results.push(result)

          console.log(`✅ Fixed: "${oldTitle}" → "${metadata.title}"`)
        } else if (metadata.success) {
          console.log(`ℹ️ Title already correct for ${video.youtubeId}: "${video.title}"`)
        } else {
          console.log(`❌ Failed to get metadata for ${video.youtubeId}: ${metadata.message}`)
        }

        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`❌ Error processing ${video.youtubeId}:`, error.message)
      }
    }

    console.log(`\n🎉 Fix complete: ${fixedCount}/${problematicVideos.length} videos fixed`)
    console.log('Fixed videos:')
    results.forEach(r => console.log(`  • ${r.youtubeId}: "${r.oldTitle}" → "${r.newTitle}"`))

  } catch (error) {
    console.error('Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixVideoTitles()