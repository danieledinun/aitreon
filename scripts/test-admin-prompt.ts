/**
 * Test Admin Prompt Generation
 * Verifies that the admin panel displays the unified prompt correctly
 */

import { RAGService } from '../lib/rag-service'

const TANNER_CREATOR_ID = '5864ded5-edfa-4e63-b131-582fe844fa43'

async function testAdminPrompt() {
  console.log('🧪 Testing Admin Prompt Generation\n')
  console.log('=' .repeat(80))

  try {
    // Test admin prompt generation (simulates what admin panel does)
    console.log('\n📝 Generating admin prompt for Tanner...\n')

    const sampleContext = `Video: "Getting Started" (at 2:15)
Content: The most important thing for beginners is to start with the basics and build confidence...
---

Video: "Common Mistakes to Avoid" (at 0:45)
Content: Many beginners make these common mistakes that can be easily avoided...
---`

    const adminPrompt = await RAGService.generateSystemPromptForAdmin(
      TANNER_CREATOR_ID,
      "What's your best advice?",
      sampleContext
    )

    console.log(adminPrompt)
    console.log('\n' + '=' .repeat(80))

    // Verify speech patterns are included
    console.log('\n✅ Verification Checks:\n')

    const checks = {
      'Has agent name (Tanner)': adminPrompt.includes('You are Tanner'),
      'Has agent intro': adminPrompt.includes('pickleball expert'),
      'Has personality config': adminPrompt.includes('Personality Configuration:'),
      'Has directness level': adminPrompt.includes('Directness level: 3/5'),
      'Has speech patterns section': adminPrompt.includes('SPEECH PATTERNS'),
      'Has "pickleball" phrase': adminPrompt.includes('"pickleball"'),
      'Has "tournament" phrase': adminPrompt.includes('"tournament"'),
      'Has "strategy" phrase': adminPrompt.includes('"strategy"'),
      'Has tone description': adminPrompt.includes('TONE:'),
      'Has authenticity reminder': adminPrompt.includes('AUTHENTICITY:'),
      'Has citation requirements': adminPrompt.includes('CITATION REQUIREMENTS'),
      'Has sample context': adminPrompt.includes('Getting Started')
    }

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${check}`)
    })

    const passedCount = Object.values(checks).filter(Boolean).length
    const totalCount = Object.keys(checks).length

    console.log(`\n📊 Results: ${passedCount}/${totalCount} checks passed`)

    if (passedCount === totalCount) {
      console.log('\n✅ All checks passed! Admin prompt is using the unified system.\n')
      process.exit(0)
    } else {
      console.log('\n❌ Some checks failed. Admin prompt may not be fully updated.\n')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testAdminPrompt()
