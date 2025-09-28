const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getProcessedVideos() {
  try {
    console.log('🔍 Getting processed videos from database...');
    
    const processedVideos = await prisma.video.findMany({
      where: {
        isProcessed: true
      },
      select: {
        youtubeId: true,
        title: true,
        transcript: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            user: {
              select: {
                name: true
              }
            }
          }
        }
      },
      take: 5
    });
    
    console.log(`📋 Found ${processedVideos.length} processed videos:`);
    
    processedVideos.forEach((video, index) => {
      console.log(`\n${index + 1}. ${video.title}`);
      console.log(`   YouTube ID: ${video.youtubeId}`);
      console.log(`   Creator: ${video.creator?.user?.name || 'Unknown'}`);
      console.log(`   Transcript Length: ${video.transcript?.length || 0} characters`);
      console.log(`   Created: ${video.createdAt}`);
      
      if (video.transcript && video.transcript.length > 0) {
        // Show first 200 characters of transcript
        console.log(`   Transcript Preview: ${video.transcript.substring(0, 200)}...`);
      }
    });
    
    // Return the first video with transcript for GraphRAG testing
    const videoWithTranscript = processedVideos.find(v => v.transcript && v.transcript.length > 0);
    if (videoWithTranscript) {
      console.log(`\n🎯 Selected video for GraphRAG testing: ${videoWithTranscript.title}`);
      console.log(JSON.stringify({
        youtubeId: videoWithTranscript.youtubeId,
        title: videoWithTranscript.title,
        transcript: videoWithTranscript.transcript,
        creatorId: videoWithTranscript.creator?.id
      }, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error getting processed videos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getProcessedVideos();