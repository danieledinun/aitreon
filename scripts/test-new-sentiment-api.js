#!/usr/bin/env node

/**
 * Script to test the new sentiment analysis APIs
 * Usage: node scripts/test-new-sentiment-api.js
 */

const VERCEL_URL = process.env.VERCEL_URL || 'https://aitreon.vercel.app'

async function testNewSentimentAPIs() {
  console.log('🧪 Testing New Sentiment Analysis APIs')
  console.log('=' .repeat(50))
  console.log(`API URL: ${VERCEL_URL}`)
  console.log('')

  // Test the manual trigger API
  console.log('📝 Testing manual trigger API...')

  try {
    const response = await fetch(`${VERCEL_URL}/api/admin/trigger-sentiment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: '992b30e3-8672-41ef-8914-c80713507f4c',
        creatorId: '5864ded5-edfa-4e63-b131-582fe844fa43',
        reason: 'manual_test'
      })
    })

    console.log(`   Status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const result = await response.json()
      console.log(`   Result:`, result)
    } else {
      const errorText = await response.text()
      console.log(`   Error: ${errorText}`)
    }
  } catch (error) {
    console.log(`   Network Error: ${error.message}`)
  }

  console.log('')

  // Test if we can access the cron endpoint (should be unauthorized without secret)
  console.log('📝 Testing cron endpoint (should be unauthorized)...')

  try {
    const response = await fetch(`${VERCEL_URL}/api/cron/process-sentiment-jobs`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer wrong-secret'
      }
    })

    console.log(`   Status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const result = await response.json()
      console.log(`   Expected unauthorized result:`, result)
    }
  } catch (error) {
    console.log(`   Network Error: ${error.message}`)
  }

  console.log('')
  console.log('✅ API tests completed!')
  console.log('')
  console.log('💡 If manual trigger shows "Unauthorized", the NextAuth session is required.')
  console.log('   You can test this in the browser console while logged in.')
}

testNewSentimentAPIs().catch(console.error)