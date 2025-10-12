/**
 * Test Unified Prompt Generation
 * Tests the new prompt system with actual creator data
 */

import { UnifiedPromptService } from '../lib/unified-prompt-service'

const TANNER_CREATOR_ID = '5864ded5-edfa-4e63-b131-582fe844fa43'

async function testPromptGeneration() {
  console.log('🧪 Testing Unified Prompt Generation\n')
  console.log('=' .repeat(80))

  try {
    // Test 1: Generate prompt with sample citations
    console.log('\n📝 Test 1: Generate prompt with sample citations\n')

    const sampleCitations = [
      {
        videoTitle: 'Getting Started with Pickleball',
        timestamp: '2:15',
        content: 'The most important thing for beginners is to start with the basics and build confidence. Focus on your grip and stance first.',
        citationNumber: 1
      },
      {
        videoTitle: 'Common Mistakes to Avoid',
        timestamp: '0:45',
        content: 'Many beginners make these common mistakes that can be easily avoided. First, don\'t stand too close to the net. Second, always keep your paddle up.',
        citationNumber: 2
      },
      {
        videoTitle: 'Tournament Strategy Guide',
        timestamp: '3:30',
        content: 'When you\'re playing a tournament tomorrow, you need to have the exact strategy ready. Make sure you focus on positioning and communication with your partner.',
        citationNumber: 3
      }
    ]

    const prompt = await UnifiedPromptService.generateCreatorPrompt({
      creatorId: TANNER_CREATOR_ID,
      creatorName: 'Tanner',
      relevantContent: sampleCitations
    })

    console.log(prompt)
    console.log('\n' + '=' .repeat(80))

    // Test 2: Verify speech patterns are included
    console.log('\n✅ Test 2: Verify speech patterns are included\n')

    const requiredPatterns = [
      'pickleball',
      'tournament',
      'strategy',
      'you need to',
      'level',
      'focus on',
      'here\'s what',
      'make sure'
    ]

    const foundPatterns = requiredPatterns.filter(pattern =>
      prompt.toLowerCase().includes(pattern.toLowerCase())
    )

    console.log(`Found ${foundPatterns.length}/${requiredPatterns.length} signature phrases:`)
    foundPatterns.forEach(pattern => console.log(`  ✓ "${pattern}"`))

    const missingPatterns = requiredPatterns.filter(pattern =>
      !prompt.toLowerCase().includes(pattern.toLowerCase())
    )
    if (missingPatterns.length > 0) {
      console.log(`\nMissing patterns:`)
      missingPatterns.forEach(pattern => console.log(`  ✗ "${pattern}"`))
    }

    // Test 3: Verify AI config is included
    console.log('\n✅ Test 3: Verify AI configuration is included\n')

    const requiredConfig = [
      'Directness level: 3/5',
      'Humor level: 3/5',
      'Empathy level: 3/5',
      'Formality level: 3/5',
      'PERSONALITY',
      'CONTENT STYLE'
    ]

    const foundConfig = requiredConfig.filter(config =>
      prompt.includes(config)
    )

    console.log(`Found ${foundConfig.length}/${requiredConfig.length} configuration elements:`)
    foundConfig.forEach(config => console.log(`  ✓ ${config}`))

    // Test 4: Verify citation structure
    console.log('\n✅ Test 4: Verify citation structure\n')

    const citationMatches = prompt.match(/\[Source \d+\]:/g)
    console.log(`Found ${citationMatches ? citationMatches.length : 0}/3 citations`)

    const hasCitationRules = prompt.includes('RESPONSE RULES')
    const hasCitationRequirements = prompt.includes('FINAL REMINDER - CITATION REQUIREMENTS')

    console.log(`  ${hasCitationRules ? '✓' : '✗'} Citation rules section`)
    console.log(`  ${hasCitationRequirements ? '✓' : '✗'} Citation requirements section`)

    // Test 5: Check prompt structure
    console.log('\n✅ Test 5: Check prompt structure\n')

    const sections = [
      'You are Tanner',
      'IMPORTANT RULES:',
      'Personality Configuration:',
      'SPEECH PATTERNS',
      'Relevant Content Context:',
      'RESPONSE RULES:',
      'FINAL REMINDER - CITATION REQUIREMENTS:'
    ]

    sections.forEach(section => {
      const found = prompt.includes(section)
      console.log(`  ${found ? '✓' : '✗'} ${section}`)
    })

    console.log('\n' + '=' .repeat(80))
    console.log('\n✅ All tests completed!\n')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testPromptGeneration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
