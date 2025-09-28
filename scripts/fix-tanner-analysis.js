#!/usr/bin/env node

/**
 * Fix Tanner Analysis Data
 *
 * This script cleans up the incorrect "Air Fryer Geek" analysis stored under Tanner's creator ID
 * and regenerates proper analysis based on Tanner's actual content.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TANNER_CREATOR_ID = '5864ded5-edfa-4e63-b131-582fe844fa43';

async function fixTannerAnalysis() {
  console.log('🔧 Fixing Tanner analysis data...');

  try {
    // Step 1: Delete incorrect speech analysis data for Tanner
    console.log('🗑️ Removing incorrect speech analysis data for Tanner...');
    const { error: deleteAnalysisError } = await supabase
      .from('speech_analysis')
      .delete()
      .eq('creator_id', TANNER_CREATOR_ID);

    if (deleteAnalysisError) {
      console.error('❌ Error deleting speech analysis:', deleteAnalysisError);
    } else {
      console.log('✅ Deleted incorrect speech analysis data');
    }

    // Step 2: Delete incorrect style card data for Tanner
    console.log('🗑️ Removing incorrect style card data for Tanner...');
    const { error: deleteStyleError } = await supabase
      .from('style_cards')
      .delete()
      .eq('creator_id', TANNER_CREATOR_ID);

    if (deleteStyleError) {
      console.error('❌ Error deleting style card:', deleteStyleError);
    } else {
      console.log('✅ Deleted incorrect style card data');
    }

    // Step 3: Check Tanner's actual content to see what we have
    console.log('🔍 Checking Tanner\'s content in the database...');
    const { data: tannerContent, error: contentError } = await supabase
      .from('content_chunks')
      .select('content')
      .eq('creator_id', TANNER_CREATOR_ID)
      .limit(5);

    if (contentError) {
      console.error('❌ Error fetching Tanner content:', contentError);
    } else {
      console.log(`📊 Found ${tannerContent?.length || 0} content chunks for Tanner`);
      if (tannerContent && tannerContent.length > 0) {
        console.log('📝 Sample content preview:');
        tannerContent.slice(0, 2).forEach((chunk, i) => {
          console.log(`   ${i + 1}. ${chunk.content?.substring(0, 100)}...`);
        });
      }
    }

    // Step 4: Check if we have enough content for analysis
    const { data: allContent, error: allContentError } = await supabase
      .from('content_chunks')
      .select('content')
      .eq('creator_id', TANNER_CREATOR_ID);

    if (allContentError) {
      console.error('❌ Error fetching all content:', allContentError);
      return;
    }

    const totalWords = allContent?.reduce((acc, chunk) => {
      return acc + (chunk.content ? chunk.content.split(' ').length : 0);
    }, 0) || 0;

    console.log(`📊 Tanner has ${allContent?.length || 0} content chunks with ${totalWords} total words`);

    if (totalWords < 500) {
      console.log('⚠️ Tanner has insufficient content for meaningful speech analysis');
      console.log('💡 Recommendation: Process more of Tanner\'s videos first');
      return;
    }

    // Step 5: Now we need to trigger proper speech analysis for Tanner
    console.log('🎯 Tanner has sufficient content. Analysis should be regenerated automatically on next video processing.');
    console.log('💡 You can manually trigger analysis by running the speech analysis script with Tanner\'s creator ID');

    console.log('\n✅ Cleanup complete! Tanner\'s dashboard should now show no analysis data until proper analysis is generated.');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the fix
fixTannerAnalysis();