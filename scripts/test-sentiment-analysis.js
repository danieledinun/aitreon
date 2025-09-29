#!/usr/bin/env node

/**
 * Test script for sentiment analysis system
 * Usage: node scripts/test-sentiment-analysis.js [sessionId]
 */

const VERCEL_URL = process.env.VERCEL_URL || 'https://aitreon.vercel.app'

async function testSentimentAnalysis(sessionId) {
  console.log('🧪 Testing Sentiment Analysis System')
  console.log('=====================================\n')

  if (!sessionId) {
    // Get a recent session ID
    console.log('🔍 Finding recent chat session...')
    const response = await fetch(`${VERCEL_URL}/api/debug/users`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('❌ Failed to fetch recent sessions')
      return
    }

    const data = await response.json()
    // This would need to be implemented to return recent sessions
    sessionId = 'a2a305c2-44e0-41fe-bdac-e7fc56cbde37' // Use the recent session we found
  }

  console.log(`📝 Using session ID: ${sessionId}\n`)

  // Test 1: Check current sentiment status
  console.log('📊 Step 1: Checking current sentiment status...')
  try {
    const statusResponse = await fetch(`${VERCEL_URL}/api/admin/trigger-sentiment-analysis?sessionId=${sessionId}`)
    const statusData = await statusResponse.json()
    console.log('Current status:', JSON.stringify(statusData, null, 2))
  } catch (error) {
    console.log('Status check failed (expected for first run):', error.message)
  }

  console.log('\n🚀 Step 2: Triggering immediate sentiment analysis...')

  // Test 2: Trigger immediate sentiment analysis
  try {
    const triggerResponse = await fetch(`${VERCEL_URL}/api/admin/trigger-sentiment-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        immediate: true,
        reanalyze: true // Force re-analysis even if already done
      })
    })

    const triggerData = await triggerResponse.json()
    console.log('✅ Immediate analysis result:')
    console.log(JSON.stringify(triggerData, null, 2))

    if (triggerData.success && triggerData.processed > 0) {
      console.log(`\n🎉 Success! Processed ${triggerData.processed} messages`)

      // Test 3: Check results
      console.log('\n📈 Step 3: Checking sentiment results...')
      const resultsResponse = await fetch(`${VERCEL_URL}/api/admin/trigger-sentiment-analysis?sessionId=${sessionId}`)
      const resultsData = await resultsResponse.json()

      console.log('Final sentiment stats:')
      console.log(`- Total messages analyzed: ${resultsData.sentimentStats.total}`)
      console.log(`- Positive: ${resultsData.sentimentStats.positive}`)
      console.log(`- Negative: ${resultsData.sentimentStats.negative}`)
      console.log(`- Neutral: ${resultsData.sentimentStats.neutral}`)
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }

  console.log('\n📋 Step 4: Testing scheduled analysis...')

  // Test 4: Schedule sentiment analysis for later
  try {
    const scheduleResponse = await fetch(`${VERCEL_URL}/api/admin/trigger-sentiment-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        immediate: false
      })
    })

    const scheduleData = await scheduleResponse.json()
    console.log('Scheduled analysis result:')
    console.log(JSON.stringify(scheduleData, null, 2))

  } catch (error) {
    console.error('❌ Scheduling test failed:', error.message)
  }

  console.log('\n✅ Sentiment analysis test complete!')
  console.log('\n📝 Next steps:')
  console.log('1. Add HF_TOKEN to Vercel environment variables')
  console.log('2. Add CRON_SECRET to Vercel environment variables')
  console.log('3. The cron job will run every 5 minutes to process scheduled jobs')
}

// Run the test
const sessionId = process.argv[2]
testSentimentAnalysis(sessionId).catch(console.error)