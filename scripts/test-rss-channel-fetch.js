/**
 * Test script to verify RSS feed + yt-dlp hybrid channel fetch
 * Tests @LanceHedrick channel analysis
 */

async function testChannelFetch() {
  const baseUrl = 'https://aitreon.vercel.app'

  console.log('🧪 Testing RSS feed channel analysis...\n')
  console.log('📍 URL:', `${baseUrl}/api/youtube/channel-info`)
  console.log('📺 Channel: @LanceHedrick\n')

  try {
    const response = await fetch(`${baseUrl}/api/youtube/channel-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://www.youtube.com/@LanceHedrick'
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('❌ Error:', data.error)
      return
    }

    console.log('✅ Channel Info:')
    console.log('   ID:', data.channel.id)
    console.log('   Name:', data.channel.name)
    console.log('   Thumbnail:', data.channel.thumbnail)
    console.log('   Subscribers:', data.channel.subscriberCount)
    console.log('   Video Count:', data.channel.videoCount)
    console.log('\n📹 Videos:')

    if (data.videos && data.videos.length > 0) {
      data.videos.slice(0, 5).forEach((video, index) => {
        console.log(`\n   [${index + 1}] ${video.title}`)
        console.log(`       ID: ${video.id}`)
        console.log(`       Duration: ${video.duration || 'N/A'}`)
        console.log(`       Published: ${video.publishedAt || 'N/A'}`)
        console.log(`       Views: ${video.viewCount?.toLocaleString() || 'N/A'}`)
        console.log(`       Thumbnail: ${video.thumbnail}`)
      })

      console.log('\n✅ RSS Feed Implementation Tests:')
      console.log('   ✓ Channel ID:', data.channel.id ? 'PASS' : 'FAIL')
      console.log('   ✓ Channel Name:', data.channel.name !== 'Unknown Channel' ? 'PASS' : 'FAIL')
      console.log('   ✓ Channel Thumbnail:', data.channel.thumbnail.includes('yt3') || data.channel.thumbnail.includes('ggpht') ? 'PASS' : 'FAIL')
      console.log('   ✓ Subscriber Count:', data.channel.subscriberCount !== 'Hidden' ? 'PASS' : 'N/A (could be hidden)')
      console.log('   ✓ Videos Found:', data.videos.length > 0 ? `PASS (${data.videos.length})` : 'FAIL')

      const firstVideo = data.videos[0]
      console.log('   ✓ Video Title:', firstVideo.title ? 'PASS' : 'FAIL')
      console.log('   ✓ Video Duration:', firstVideo.duration ? 'PASS' : 'FAIL')
      console.log('   ✓ Published Date:', firstVideo.publishedAt && firstVideo.publishedAt !== 'Invalid Date' ? 'PASS' : 'FAIL')
      console.log('   ✓ View Count:', firstVideo.viewCount > 0 ? 'PASS' : 'FAIL')

      console.log('\n🎯 Key Fixes Verified:')
      const publishedDateValid = firstVideo.publishedAt && firstVideo.publishedAt !== 'Invalid Date'
      console.log('   📅 publishedAt fixed:', publishedDateValid ? '✅ YES' : '❌ NO')
      console.log('   🖼️  Duration present:', firstVideo.duration ? '✅ YES' : '❌ NO')

    } else {
      console.log('   ⚠️  No videos found')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testChannelFetch()
