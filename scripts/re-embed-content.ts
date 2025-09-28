/**
 * Re-embed all content chunks with DeepInfra embeddings
 * This script updates existing database content with new embeddings
 */

import { createClient } from '@supabase/supabase-js'
import { DeepInfraEmbeddingService } from '../lib/deepinfra-embedding-service'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function reEmbedContent() {
  try {
    console.log('🚀 Starting re-embedding process with DeepInfra...')

    // Get all content chunks for Tanner
    const creatorId = '5864ded5-edfa-4e63-b131-582fe844fa43'

    console.log(`📋 Fetching content chunks for creator ${creatorId}...`)
    const { data: chunks, error: fetchError } = await supabase
      .from('content_chunks')
      .select('id, content, video_id')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('❌ Error fetching chunks:', fetchError)
      return
    }

    console.log(`📊 Found ${chunks.length} content chunks to re-embed`)

    let successCount = 0
    let errorCount = 0

    // Process in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)

      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}...`)

      const batchPromises = batch.map(async (chunk) => {
        try {
          console.log(`  🔄 Re-embedding chunk ${chunk.id.substring(0, 8)}...`)

          // Generate new embedding with DeepInfra
          const embedding = await DeepInfraEmbeddingService.generateEmbedding(chunk.content)

          if (!embedding) {
            console.error(`  ❌ Failed to generate embedding for chunk ${chunk.id}`)
            errorCount++
            return
          }

          // Update the chunk with new embedding
          const { error: updateError } = await supabase
            .from('content_chunks')
            .update({ embedding: embedding })
            .eq('id', chunk.id)

          if (updateError) {
            console.error(`  ❌ Failed to update chunk ${chunk.id}:`, updateError.message)
            errorCount++
            return
          }

          console.log(`  ✅ Updated chunk ${chunk.id.substring(0, 8)} with ${embedding.length}D embedding`)
          successCount++

        } catch (error: any) {
          console.error(`  ❌ Error processing chunk ${chunk.id}:`, error.message)
          errorCount++
        }
      })

      await Promise.all(batchPromises)

      // Small delay between batches
      if (i + batchSize < chunks.length) {
        console.log('  ⏳ Waiting 2 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log('\n🎉 Re-embedding complete!')
    console.log(`✅ Successfully updated: ${successCount} chunks`)
    console.log(`❌ Failed to update: ${errorCount} chunks`)

    if (errorCount === 0) {
      console.log('\n🚀 All content has been re-embedded with DeepInfra!')
      console.log('Vector search should now return multiple results.')
    }

  } catch (error: any) {
    console.error('❌ Fatal error during re-embedding:', error)
  }
}

// Run the script
reEmbedContent()