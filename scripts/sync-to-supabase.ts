/**
 * Simple sync script to get video content into Supabase
 */

import dotenv from 'dotenv'
import { SupabaseVectorService } from '../lib/supabase-vector-service.js'

// Import using require to avoid module resolution issues
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

dotenv.config()

async function main() {
  console.log('🔄 SYNCING CONTENT TO SUPABASE\n')
  
  try {
    // Find creators with processed videos
    const creators = await prisma.creator.findMany({
      include: {
        videos: {
          where: { isProcessed: true },
          include: {
            chunks: true
          }
        }
      }
    })
    
    console.log(`📂 Found ${creators.length} creators`)
    
    for (const creator of creators) {
      const processedVideos = creator.videos.filter((v: any) => v.isProcessed)
      if (processedVideos.length === 0) continue
      
      console.log(`\n👤 Syncing creator: ${creator.displayName}`)
      console.log(`   Videos: ${processedVideos.length}`)
      
      for (const video of processedVideos) {
        if (video.chunks.length === 0) continue
        
        console.log(`   📹 Syncing video: ${video.title} (${video.chunks.length} chunks)`)
        
        try {
          const success = await SupabaseVectorService.syncVideoToSupabase(
            creator.id,
            video.id,
            {
              title: video.title,
              youtubeId: video.youtubeId,
              chunks: video.chunks.map((chunk: any) => ({
                content: chunk.content,
                startTime: chunk.startTime || 0,
                endTime: chunk.endTime || 0,
                chunkIndex: chunk.chunkIndex
              }))
            }
          )
          
          if (success) {
            console.log(`      ✅ Synced successfully`)
          } else {
            console.log(`      ❌ Sync failed`)
          }
          
        } catch (error) {
          console.log(`      ❌ Error: ${(error as Error).message}`)
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log('\n🎉 Sync completed!')
    
  } catch (error) {
    console.error('💥 Sync failed:', (error as Error).message)
  } finally {
    await prisma.$disconnect()
  }
}

main()