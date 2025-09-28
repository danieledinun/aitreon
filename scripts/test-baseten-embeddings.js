/**
 * Test Script: Compare Baseten embedding models
 * Tests different models for performance, quality, and compatibility
 */

const { BasetenEmbeddingService } = require('../lib/baseten-embedding-service')
const { SupabaseVectorService } = require('../lib/supabase-vector-service')

// Test sample texts representative of your content
const testTexts = [
  "Welcome to my channel where I talk about entrepreneurship and business strategy.",
  "In today's video, I'll explain how to optimize your marketing funnel for better conversions.",
  "The key to successful investing is understanding market dynamics and timing your entries correctly.",
  "Let's dive into the technical aspects of building scalable web applications with modern frameworks.",
  "Personal development starts with understanding your core values and aligning your actions with them."
]

async function testBasetenModels() {
  console.log('🚀 Testing Baseten embedding models...\n')

  // Test model comparison
  console.log('📊 Comparing model performance:')
  const comparisonResults = await BasetenEmbeddingService.compareModels()
  console.log('\n')

  // Test embedding generation with each model
  const models = ['bge-embedding-icl', 'mixedbread-embed-large-v1', 'nomic-embed-code']
  const modelResults = {}

  for (const model of models) {
    console.log(`🔄 Testing ${model}...`)

    try {
      const startTime = Date.now()
      const embeddings = []

      // Test with sample texts
      for (const text of testTexts) {
        const embedding = await BasetenEmbeddingService.generateEmbedding(text, { model })
        embeddings.push(embedding)
      }

      const endTime = Date.now()
      const avgLatency = (endTime - startTime) / testTexts.length

      const validEmbeddings = embeddings.filter(e => e !== null)
      const dimensions = validEmbeddings[0]?.length || 0

      modelResults[model] = {
        success: validEmbeddings.length === testTexts.length,
        dimensions,
        avgLatency,
        successRate: (validEmbeddings.length / testTexts.length) * 100
      }

      console.log(`✅ ${model}: ${dimensions}D, ${avgLatency.toFixed(0)}ms avg, ${modelResults[model].successRate}% success`)

    } catch (error) {
      console.error(`❌ ${model} failed:`, error.message)
      modelResults[model] = {
        success: false,
        dimensions: 0,
        avgLatency: 0,
        successRate: 0
      }
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n📋 Test Results Summary:')
  console.log('=' * 50)

  for (const [model, results] of Object.entries(modelResults)) {
    console.log(`${model}:`)
    console.log(`  Success Rate: ${results.successRate}%`)
    console.log(`  Dimensions: ${results.dimensions}`)
    console.log(`  Avg Latency: ${results.avgLatency.toFixed(0)}ms`)
    console.log(`  Status: ${results.success ? '✅ Working' : '❌ Failed'}`)
    console.log('')
  }

  // Recommend best model
  const workingModels = Object.entries(modelResults).filter(([model, results]) => results.success)

  if (workingModels.length > 0) {
    const bestModel = workingModels.reduce((best, current) => {
      const [currentModel, currentResults] = current
      const [bestModel, bestResults] = best

      // Prioritize: success rate > dimensions > latency
      if (currentResults.successRate > bestResults.successRate) return current
      if (currentResults.successRate === bestResults.successRate) {
        if (currentResults.dimensions > bestResults.dimensions) return current
        if (currentResults.dimensions === bestResults.dimensions && currentResults.avgLatency < bestResults.avgLatency) return current
      }

      return best
    })

    console.log(`🏆 RECOMMENDED MODEL: ${bestModel[0]}`)
    console.log(`   ${bestModel[1].dimensions}D embeddings, ${bestModel[1].avgLatency.toFixed(0)}ms avg latency`)
    console.log(`   ${bestModel[1].successRate}% success rate`)

    console.log('\n🔧 Environment Variables to Set:')
    console.log(`EMBEDDING_PROVIDER=baseten`)
    console.log(`BASETEN_EMBEDDING_MODEL=${bestModel[0]}`)
    console.log(`BASETEN_API_KEY=your_api_key_here`)

    if (bestModel[0] === 'bge-embedding-icl') {
      console.log('BASETEN_BGE_ENDPOINT=your_bge_endpoint_here')
    } else if (bestModel[0] === 'mixedbread-embed-large-v1') {
      console.log('BASETEN_MIXEDBREAD_ENDPOINT=your_mixedbread_endpoint_here')
    } else if (bestModel[0] === 'nomic-embed-code') {
      console.log('BASETEN_NOMIC_ENDPOINT=your_nomic_endpoint_here')
    }

  } else {
    console.log('❌ No working models found. Check your Baseten configuration.')
  }
}

async function testEmbeddingQuality() {
  console.log('\n🧪 Testing embedding quality with semantic similarity...')

  const semanticPairs = [
    ["business strategy", "strategic planning"],
    ["marketing funnel", "sales process"],
    ["web development", "software engineering"],
    ["personal growth", "self improvement"],
    ["investment advice", "financial guidance"]
  ]

  for (const model of ['bge-embedding-icl', 'mixedbread-embed-large-v1']) {
    console.log(`\n🔍 Testing semantic similarity with ${model}:`)

    for (const [text1, text2] of semanticPairs) {
      try {
        const [embedding1, embedding2] = await Promise.all([
          BasetenEmbeddingService.generateEmbedding(text1, { model }),
          BasetenEmbeddingService.generateEmbedding(text2, { model })
        ])

        if (embedding1 && embedding2) {
          // Calculate cosine similarity
          const similarity = cosineSimilarity(embedding1, embedding2)
          console.log(`  "${text1}" ↔ "${text2}": ${(similarity * 100).toFixed(1)}%`)
        }
      } catch (error) {
        console.log(`  ❌ Failed to compare "${text1}" and "${text2}"`)
      }
    }
  }
}

function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}

async function testSupabaseIntegration() {
  console.log('\n🔗 Testing Supabase integration...')

  try {
    // Test with current configuration
    const testText = "This is a test for Supabase vector integration."

    console.log('🔄 Testing current embedding configuration...')
    const embedding = await SupabaseVectorService.generateEmbedding(testText)

    if (embedding) {
      console.log(`✅ Supabase integration working: ${embedding.length}D embedding generated`)
    } else {
      console.log('❌ Supabase integration failed to generate embedding')
    }

  } catch (error) {
    console.error('❌ Supabase integration test failed:', error.message)
  }
}

// Main execution
async function main() {
  console.log('🎯 Baseten Embedding Model Test Suite')
  console.log('=' * 40)

  try {
    await testBasetenModels()
    await testEmbeddingQuality()
    await testSupabaseIntegration()

    console.log('\n✅ Test suite completed!')
    console.log('\n📝 Next Steps:')
    console.log('1. Set the recommended environment variables')
    console.log('2. Update your .env file with Baseten credentials')
    console.log('3. Run the migration script with: npm run migrate:semantic')
    console.log('4. Test the enhanced RAG system with semantic chunks')

  } catch (error) {
    console.error('❌ Test suite failed:', error)
    process.exit(1)
  }
}

// Command line handling
const command = process.argv[2]

switch (command) {
  case 'models':
    testBasetenModels()
    break
  case 'quality':
    testEmbeddingQuality()
    break
  case 'supabase':
    testSupabaseIntegration()
    break
  default:
    main()
    break
}