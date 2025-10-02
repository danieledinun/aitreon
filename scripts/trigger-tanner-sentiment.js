#!/usr/bin/env node

/**
 * Script to manually trigger sentiment analysis for Tanner's past conversations
 * Usage: node scripts/trigger-tanner-sentiment.js
 */

const VERCEL_URL = process.env.VERCEL_URL || 'https://aitreon.vercel.app'

const sessions = [
  'a2a305c2-44e0-41fe-bdac-e7fc56cbde37',
  'd377f59d-0d59-47a0-9ead-7f6ed3bfbfa0'
]

async function triggerSentimentAnalysis() {
  console.log('🧪 Triggering Sentiment Analysis for Tanner\'s Past Conversations')
  console.log('==================================================================\n')

  for (const sessionId of sessions) {
    console.log(`📝 Processing session: ${sessionId}`)

    try {
      const response = await fetch(`${VERCEL_URL}/api/admin/trigger-sentiment-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: This requires authentication - run this from an authenticated browser context
          // or implement API key authentication
        },
        body: JSON.stringify({
          sessionId,
          immediate: true,
          reanalyze: true
        })
      })

      const data = await response.json()

      if (response.ok) {
        console.log(`✅ Success for ${sessionId}:`)
        console.log(`   Processed: ${data.processed || 0}`)
        console.log(`   Already analyzed: ${data.alreadyAnalyzed || 0}`)
        console.log(`   Errors: ${data.errors || 0}`)
      } else {
        console.log(`❌ Failed for ${sessionId}: ${data.error}`)
        if (data.error === 'Unauthorized') {
          console.log('   💡 Tip: This API requires authentication. You may need to:')
          console.log('   1. Log in to the website in your browser')
          console.log('   2. Use browser dev tools to copy authenticated request')
          console.log('   3. Or implement API key authentication')
        }
      }
    } catch (error) {
      console.log(`❌ Network error for ${sessionId}: ${error.message}`)
    }

    console.log('')
  }

  console.log('✅ Script completed!')
  console.log('\n📋 Next steps:')
  console.log('1. If unauthorized, try running from authenticated browser context')
  console.log('2. Check sentiment badges in the UI after successful processing')
  console.log('3. Verify results in database or via status API')
}

triggerSentimentAnalysis().catch(console.error)