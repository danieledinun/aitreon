/**
 * Test script for Baseten Qwen 2000-dimension vector search functionality
 * Tests embedding generation, storage, and cosine similarity search on JSONB embeddings
 */

import { createClient } from '@supabase/supabase-js'
import { BasetenEmbeddingService } from '../lib/baseten-embedding-service.js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Test queries to evaluate search quality
const testQueries = [
  {
    query: "How do I improve my serve?",
    description: "Sports technique question"
  },
  {
    query: "What's the best strategy for beginners?",
    description: "Beginner advice question"
  },
  {
    query: "Tell me about tournament preparation",
    description: "Competition preparation question"
  },
  {
    query: "How to handle pressure during games?",
    description: "Mental game question"
  },
  {
    query: "Equipment recommendations for starters",
    description: "Equipment advice question"
  }
]

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

/**
 * Test Baseten embedding generation
 */
async function testEmbeddingGeneration() {
  console.log('🧪 Testing Baseten embedding generation...\n')

  const testText = "This is a test text for embedding generation with Baseten Qwen model."

  try {
    const startTime = Date.now()
    const embedding = await BasetenEmbeddingService.generateEmbedding(testText, {
      model: 'qwen3-8b-embedding'
    })
    const duration = Date.now() - startTime

    if (!embedding) {
      console.error('❌ Failed to generate embedding')
      return false
    }

    console.log(`✅ Embedding generated successfully`)
    console.log(`📊 Dimensions: ${embedding.length}`)
    console.log(`⏱️ Duration: ${duration}ms`)
    console.log(`📈 Sample values: [${embedding.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}, ...]`)

    // Verify dimensions
    if (embedding.length !== 2000) {
      console.error(`❌ Expected 2000 dimensions, got ${embedding.length}`)
      return false
    }

    // Verify values are normalized (roughly between -1 and 1)
    const maxAbs = Math.max(...embedding.map(Math.abs))
    if (maxAbs > 2) {
      console.warn(`⚠️ Large embedding values detected (max abs: ${maxAbs.toFixed(4)})`)
    }

    console.log(`✅ Embedding generation test passed\n`)
    return true

  } catch (error) {
    console.error('❌ Embedding generation failed:', error)
    return false
  }
}

/**
 * Test storing content chunks with embeddings
 */
async function testContentChunkStorage() {
  console.log('🧪 Testing content chunk storage...\n')

  const testChunk = {
    creator_id: 'test_creator_id',
    video_id: 'test_video_id',
    video_title: 'Test Video for Embedding Storage',
    video_url: 'https://youtube.com/watch?v=test123',
    content: 'This is a test content chunk for verifying that we can store 2000-dimension embeddings in the content_chunks table.',
    start_time: 120.5,
    end_time: 135.0,
    chunk_index: 1,
    metadata: {
      test_chunk: true,
      embedding_model: 'qwen3-8b-embedding',
      embedding_dimensions: 2000,
      created_by_test: true
    }
  }

  try {
    // Generate embedding
    console.log('🔄 Generating embedding for test chunk...')
    const embedding = await BasetenEmbeddingService.generateEmbedding(testChunk.content, {
      model: 'qwen3-8b-embedding'
    })

    if (!embedding) {
      console.error('❌ Failed to generate embedding for test chunk')
      return false
    }

    console.log(`✅ Generated ${embedding.length}D embedding`)

    // Store in database
    console.log('🔄 Storing content chunk in database...')
    const { data, error } = await supabase
      .from('content_chunks')
      .insert({
        creator_id: testChunk.creator_id,
        video_id: testChunk.video_id,
        content: testChunk.content,
        start_time: testChunk.start_time,
        end_time: testChunk.end_time,
        chunk_index: testChunk.chunk_index,
        embedding: embedding, // Store as JSONB array
        metadata: testChunk.metadata
      })
      .select()

    if (error) {
      console.error('❌ Failed to store content chunk:', error)
      return false
    }

    console.log('✅ Content chunk stored successfully')
    console.log(`📄 Stored chunk ID: ${data[0]?.id}`)

    // Test retrieval
    console.log('🔄 Testing chunk retrieval...')
    const { data: retrievedChunk, error: retrievalError } = await supabase
      .from('content_chunks')
      .select('*')
      .eq('id', data[0].id)
      .single()

    if (retrievalError) {
      console.error('❌ Failed to retrieve chunk:', retrievalError)
      return false
    }

    // Verify embedding was stored correctly
    const storedEmbedding = retrievedChunk.embedding
    if (!storedEmbedding || !Array.isArray(storedEmbedding)) {
      console.error('❌ Embedding not stored as array')
      return false
    }

    if (storedEmbedding.length !== 2000) {
      console.error(`❌ Stored embedding has wrong dimensions: ${storedEmbedding.length}`)
      return false
    }

    console.log(`✅ Stored embedding verified: ${storedEmbedding.length} dimensions`)
    console.log(`✅ Content chunk storage test passed\n`)

    // Store the test chunk ID for cleanup later
    return data[0].id

  } catch (error) {
    console.error('❌ Content chunk storage failed:', error)
    return false
  }
}

/**
 * Test vector similarity search on JSONB embeddings
 */
async function testVectorSimilaritySearch() {
  console.log('🧪 Testing vector similarity search on JSONB embeddings...\n')

  // First, let's check if we have any content chunks to search
  const { data: existingChunks, error: countError } = await supabase
    .from('content_chunks')
    .select('id, creator_id, content, embedding')
    .not('embedding', 'is', null)
    .limit(10)

  if (countError) {
    console.error('❌ Failed to count existing chunks:', countError)
    return false
  }

  console.log(`📊 Found ${existingChunks?.length || 0} chunks with embeddings`)

  if (!existingChunks || existingChunks.length === 0) {
    console.log('⚠️ No content chunks with embeddings found. Creating test chunk first...')
    const testChunkId = await testContentChunkStorage()
    if (!testChunkId) {
      console.error('❌ Failed to create test chunk for search')
      return false
    }
  }

  // Test search functionality for each query
  let passedTests = 0

  for (const testCase of testQueries) {
    console.log(`\n🔍 Testing search: "${testCase.query}"`)
    console.log(`📝 Description: ${testCase.description}`)

    try {
      const startTime = Date.now()

      // Generate query embedding
      const queryEmbedding = await BasetenEmbeddingService.generateEmbedding(testCase.query, {
        model: 'qwen3-8b-embedding'
      })

      if (!queryEmbedding) {
        console.error('❌ Failed to generate query embedding')
        continue
      }

      const embeddingTime = Date.now() - startTime

      // Get all chunks with embeddings (for similarity calculation)
      const { data: chunks, error: searchError } = await supabase
        .from('content_chunks')
        .select(`
          id,
          creator_id,
          video_id,
          content,
          start_time,
          end_time,
          chunk_index,
          embedding,
          metadata
        `)
        .not('embedding', 'is', null)
        .limit(50) // Limit for performance

      if (searchError) {
        console.error('❌ Search error:', searchError)
        continue
      }

      if (!chunks || chunks.length === 0) {
        console.log('⚠️ No chunks found for search')
        continue
      }

      // Calculate similarities
      const similarities: Array<{
        chunk: any
        similarity: number
      }> = []

      for (const chunk of chunks) {
        if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
          continue
        }

        try {
          const similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
          similarities.push({ chunk, similarity })
        } catch (error) {
          console.warn(`⚠️ Error calculating similarity for chunk ${chunk.id}:`, error instanceof Error ? error.message : String(error))
        }
      }

      // Sort by similarity (highest first)
      similarities.sort((a, b) => b.similarity - a.similarity)

      const searchTime = Date.now() - startTime
      const topResults = similarities.slice(0, 5)

      console.log(`⏱️ Total search time: ${searchTime}ms (embedding: ${embeddingTime}ms)`)
      console.log(`📊 Calculated similarities for ${similarities.length} chunks`)

      if (topResults.length > 0) {
        console.log(`🎯 Top ${Math.min(5, topResults.length)} results:`)
        topResults.forEach((result, index) => {
          console.log(`   ${index + 1}. Score: ${result.similarity.toFixed(4)} | Content: "${result.chunk.content.substring(0, 80)}${result.chunk.content.length > 80 ? '...' : ''}"`)
        })

        // Check if we found reasonable similarities
        const bestScore = topResults[0].similarity
        if (bestScore > 0.5) {
          console.log(`✅ Found good matches (best score: ${bestScore.toFixed(4)})`)
          passedTests++
        } else {
          console.log(`⚠️ Low similarity scores (best: ${bestScore.toFixed(4)})`)
        }
      } else {
        console.log('❌ No similarity results calculated')
      }

    } catch (error) {
      console.error(`❌ Search test failed for "${testCase.query}":`, error)
    }
  }

  console.log(`\n📈 Search test summary: ${passedTests}/${testQueries.length} tests passed`)
  return passedTests > 0
}

/**
 * Benchmark vector search performance
 */
async function benchmarkVectorSearch() {
  console.log('🧪 Benchmarking vector search performance...\n')

  const benchmarkQueries = [
    "How to improve performance?",
    "Best strategies for beginners?",
    "Equipment recommendations?",
    "Training tips for advanced players?",
    "Mental game preparation?"
  ]

  let totalSearchTime = 0
  let totalEmbeddingTime = 0
  let successfulSearches = 0

  for (const query of benchmarkQueries) {
    try {
      const startTime = Date.now()

      const queryEmbedding = await BasetenEmbeddingService.generateEmbedding(query, {
        model: 'qwen3-8b-embedding'
      })

      const embeddingTime = Date.now() - startTime

      if (!queryEmbedding) continue

      const searchStart = Date.now()

      // Simulate the search process (get a sample of chunks)
      const { data: chunks } = await supabase
        .from('content_chunks')
        .select('id, embedding, content')
        .not('embedding', 'is', null)
        .limit(20)

      if (chunks && chunks.length > 0) {
        // Calculate similarities for benchmark
        const similarities = chunks
          .filter(chunk => chunk.embedding && Array.isArray(chunk.embedding))
          .map(chunk => ({
            id: chunk.id,
            similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
          }))
          .sort((a, b) => b.similarity - a.similarity)

        const searchTime = Date.now() - searchStart
        const totalTime = Date.now() - startTime

        totalSearchTime += searchTime
        totalEmbeddingTime += embeddingTime
        successfulSearches++

        console.log(`⚡ Query: "${query.substring(0, 30)}..." | Total: ${totalTime}ms | Embedding: ${embeddingTime}ms | Search: ${searchTime}ms | Results: ${similarities.length}`)
      }

    } catch (error) {
      console.warn(`⚠️ Benchmark failed for query: "${query}"`, error instanceof Error ? error.message : String(error))
    }
  }

  if (successfulSearches > 0) {
    const avgTotalTime = totalSearchTime / successfulSearches
    const avgEmbeddingTime = totalEmbeddingTime / successfulSearches

    console.log(`\n📊 Performance Summary:`)
    console.log(`   Successful searches: ${successfulSearches}/${benchmarkQueries.length}`)
    console.log(`   Average embedding time: ${avgEmbeddingTime.toFixed(1)}ms`)
    console.log(`   Average search time: ${avgTotalTime.toFixed(1)}ms`)
    console.log(`   Average total time: ${(avgTotalTime + avgEmbeddingTime).toFixed(1)}ms`)
  }

  return successfulSearches > 0
}

/**
 * Cleanup test data
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...')

  try {
    const { error } = await supabase
      .from('content_chunks')
      .delete()
      .eq('creator_id', 'test_creator_id')

    if (error) {
      console.warn('⚠️ Error cleaning up test data:', error)
    } else {
      console.log('✅ Test data cleaned up successfully')
    }
  } catch (error) {
    console.warn('⚠️ Cleanup failed:', error)
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting Baseten vector search tests...\n')
  console.log('=' .repeat(60))

  const results = {
    embeddingGeneration: false,
    contentStorage: false,
    vectorSearch: false,
    performance: false
  }

  try {
    // Test 1: Embedding Generation
    console.log('Test 1: Embedding Generation')
    console.log('-'.repeat(30))
    results.embeddingGeneration = await testEmbeddingGeneration()

    // Test 2: Content Storage
    console.log('Test 2: Content Chunk Storage')
    console.log('-'.repeat(30))
    results.contentStorage = await testContentChunkStorage()

    // Test 3: Vector Similarity Search
    console.log('Test 3: Vector Similarity Search')
    console.log('-'.repeat(30))
    results.vectorSearch = await testVectorSimilaritySearch()

    // Test 4: Performance Benchmark
    console.log('Test 4: Performance Benchmark')
    console.log('-'.repeat(30))
    results.performance = await benchmarkVectorSearch()

  } finally {
    // Always cleanup
    await cleanupTestData()
  }

  // Final Results
  console.log('\n' + '='.repeat(60))
  console.log('🎯 TEST RESULTS SUMMARY')
  console.log('='.repeat(60))

  console.log(`✅ Embedding Generation:     ${results.embeddingGeneration ? 'PASS' : 'FAIL'}`)
  console.log(`✅ Content Storage:          ${results.contentStorage ? 'PASS' : 'FAIL'}`)
  console.log(`✅ Vector Similarity Search: ${results.vectorSearch ? 'PASS' : 'FAIL'}`)
  console.log(`✅ Performance Benchmark:    ${results.performance ? 'PASS' : 'FAIL'}`)

  const passedTests = Object.values(results).filter(Boolean).length
  const totalTests = Object.keys(results).length

  console.log(`\n🏆 Overall: ${passedTests}/${totalTests} tests passed`)

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Baseten vector search is working correctly.')
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.')
  }

  console.log('\n' + '='.repeat(60))

  return passedTests === totalTests
}

// Run tests if this is the main module
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error)
      process.exit(1)
    })
}

export { runTests, testEmbeddingGeneration, testVectorSimilaritySearch, cosineSimilarity }