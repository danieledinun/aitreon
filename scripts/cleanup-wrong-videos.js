const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupWrongVideos() {
  try {
    console.log('🔍 Finding wrong videos in database...');
    
    // List of wrong video IDs that were hardcoded
    const wrongVideoIds = [
      'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up
      'jNQXAC9IVRw', // Charlie bit my finger - again!
      'oHg5SJYRHA0', // David After Dentist
      'L_jWHffIx5E', // Chocolate Rain Original Song by Tay Zonday
      'fJ9rUzIMcZQ'  // Evolution of Dance - By Judson Laipply
    ];

    // First, let's see what videos are currently in the database
    const allVideos = await prisma.video.findMany({
      select: {
        id: true,
        youtubeId: true,
        title: true,
        createdAt: true
      }
    });
    
    console.log('📋 Current videos in database:');
    allVideos.forEach(video => {
      const isWrong = wrongVideoIds.includes(video.youtubeId);
      console.log(`${isWrong ? '❌' : '✅'} ${video.youtubeId}: ${video.title}`);
    });
    
    // Find wrong videos in database
    const wrongVideos = await prisma.video.findMany({
      where: {
        youtubeId: {
          in: wrongVideoIds
        }
      }
    });
    
    console.log(`\n🗑️ Found ${wrongVideos.length} wrong videos to delete:`);
    wrongVideos.forEach(video => {
      console.log(`   - ${video.youtubeId}: ${video.title}`);
    });
    
    if (wrongVideos.length > 0) {
      // Delete the wrong videos
      const deleteResult = await prisma.video.deleteMany({
        where: {
          youtubeId: {
            in: wrongVideoIds
          }
        }
      });
      
      console.log(`\n✅ Successfully deleted ${deleteResult.count} wrong videos from database`);
    } else {
      console.log('\n✅ No wrong videos found in database');
    }
    
    // Show remaining videos
    const remainingVideos = await prisma.video.findMany({
      select: {
        youtubeId: true,
        title: true
      }
    });
    
    console.log(`\n📋 Remaining videos in database (${remainingVideos.length}):`);
    remainingVideos.forEach(video => {
      console.log(`   ✅ ${video.youtubeId}: ${video.title}`);
    });
    
  } catch (error) {
    console.error('❌ Error cleaning up videos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupWrongVideos();