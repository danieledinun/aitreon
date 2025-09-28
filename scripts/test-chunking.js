/**
 * Test script to verify chunking behavior
 */

const { SemanticChunkingService } = require('./semantic-chunking-service')

// Create a simulated transcript with many short segments (like the problematic video)
function createTestTranscript() {
  const segments = []

  // Simulate 175 segments (5 seconds each = ~14.5 minute video)
  for (let i = 0; i < 175; i++) {
    const startTime = i * 5
    segments.push({
      start: startTime,
      end: startTime + 5,
      duration: 5,
      text: `This is segment ${i + 1} with some pickleball content about forehand techniques and strategy.`
    })
  }

  return segments
}

console.log('🧪 Testing chunking with 175 segments...')

const segments = createTestTranscript()
console.log(`📊 Input: ${segments.length} segments covering ${segments[segments.length-1].end} seconds`)

const chunks = SemanticChunkingService.createSemanticChunks(
  segments,
  'test-video',
  {
    minChunkDuration: 60,
    maxChunkDuration: 120,
    overlapDuration: 5,
    minWordsPerChunk: 50
  }
)

console.log(`\n📈 Result: ${chunks.length} chunks created`)

// Show first few chunks details
chunks.slice(0, 5).forEach((chunk, i) => {
  const duration = chunk.end_time - chunk.start_time
  console.log(`  Chunk ${i + 1}: ${duration.toFixed(1)}s, ${chunk.word_count} words`)
})

if (chunks.length > 5) {
  console.log(`  ... and ${chunks.length - 5} more chunks`)
}

console.log(`\n✅ Expected: ~10-15 chunks (60-90s each)`)
console.log(`🔍 Actual: ${chunks.length} chunks`)

if (chunks.length > 20) {
  console.log(`❌ PROBLEM: Too many chunks created! Should be ~10-15, got ${chunks.length}`)
} else if (chunks.length === 0) {
  console.log(`❌ PROBLEM: No chunks created! Should be ~10-15, got ${chunks.length}`)
} else if (chunks.length < 8) {
  console.log(`❌ PROBLEM: Too few chunks created! Should be ~10-15, got ${chunks.length}`)
} else {
  console.log(`✅ SUCCESS: Reasonable number of chunks created`)
}