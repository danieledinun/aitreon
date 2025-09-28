#!/usr/bin/env node

/**
 * Post-Sync Speech Analysis Trigger
 *
 * This script runs after video sync completion to automatically trigger
 * speech pattern analysis for creators who have sufficient content.
 */

const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Check if creator has enough content for meaningful speech analysis
 */
async function hasEnoughContentForAnalysis(creatorId) {
  try {
    // Check for minimum content requirements
    const { data: chunks, error } = await supabase
      .from('content_chunks')
      .select('id, content')
      .eq('creator_id', creatorId);

    if (error) {
      console.error('Error checking content chunks:', error);
      return false;
    }

    if (!chunks || chunks.length < 10) {
      console.log(`⚠️ Creator ${creatorId} has insufficient content chunks (${chunks?.length || 0} < 10 required)`);
      return false;
    }

    // Check total word count
    const totalWords = chunks.reduce((acc, chunk) => {
      return acc + (chunk.content ? chunk.content.split(' ').length : 0);
    }, 0);

    if (totalWords < 500) {
      console.log(`⚠️ Creator ${creatorId} has insufficient content (${totalWords} < 500 words required)`);
      return false;
    }

    console.log(`✅ Creator ${creatorId} has sufficient content: ${chunks.length} chunks, ${totalWords} words`);
    return true;

  } catch (error) {
    console.error('Error checking content requirements:', error);
    return false;
  }
}

/**
 * Check if speech analysis already exists for creator
 */
async function hasExistingSpeechAnalysis(creatorId) {
  try {
    const { data: existingAnalysis, error } = await supabase
      .from('speech_analysis')
      .select('id, created_at')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking existing analysis:', error);
      return false;
    }

    if (existingAnalysis && existingAnalysis.length > 0) {
      const lastAnalysis = existingAnalysis[0];
      const daysSinceLastAnalysis = (Date.now() - new Date(lastAnalysis.created_at).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLastAnalysis < 7) {
        console.log(`⏰ Creator ${creatorId} already has recent speech analysis (${daysSinceLastAnalysis.toFixed(1)} days ago)`);
        return true;
      } else {
        console.log(`🔄 Creator ${creatorId} has outdated speech analysis (${daysSinceLastAnalysis.toFixed(1)} days ago), will regenerate`);
        return false;
      }
    }

    console.log(`🆕 No existing speech analysis found for creator ${creatorId}`);
    return false;

  } catch (error) {
    console.error('Error checking existing analysis:', error);
    return false;
  }
}

/**
 * Run speech analysis for a creator
 */
async function runSpeechAnalysisForCreator(creatorId, creatorName) {
  return new Promise((resolve) => {
    console.log(`🎯 Starting speech analysis for ${creatorName} (${creatorId})`);

    const speechAnalysisPath = path.join(__dirname, '..', 'services', 'speech_analysis');
    const pythonScript = path.join(speechAnalysisPath, 'demo_results.py');
    const venvPython = path.join(speechAnalysisPath, 'venv', 'bin', 'python');

    // Check if python script exists
    const fs = require('fs');
    if (!fs.existsSync(pythonScript)) {
      console.error(`❌ Speech analysis script not found: ${pythonScript}`);
      resolve({ success: false, error: 'Script not found' });
      return;
    }

    if (!fs.existsSync(venvPython)) {
      console.error(`❌ Python virtual environment not found: ${venvPython}`);
      resolve({ success: false, error: 'Python venv not found' });
      return;
    }

    const child = spawn(venvPython, [pythonScript], {
      cwd: speechAnalysisPath,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', async (code) => {
      if (code === 0) {
        console.log(`✅ Speech analysis completed successfully for ${creatorName}`);

        try {
          // Parse output to extract results if available
          if (output.includes('Analysis complete')) {
            console.log(`🔍 Parsing analysis results for ${creatorName}...`);

            // Extract style card with improved regex pattern
            const styleCardMatch = output.match(/STYLE CARD FOR AI PROMPTING\n={60}\n([\s\S]*?)(?=\n💾|$)/);

            // Extract analysis data for speech_analysis table
            const analysisDataMatch = output.match(/📊 ANALYSIS RESULTS:([\s\S]*?)(?=\n={60})/);

            let analysisData = {};
            let signaturePhrases = {};
            let communicationMetrics = {};

            // Parse signature phrases
            const phrasesMatch = output.match(/🎯 TOP SIGNATURE PHRASES:\n([\s\S]*?)(?=\n💬)/);
            if (phrasesMatch) {
              const phrasesText = phrasesMatch[1];
              const phraseLines = phrasesText.split('\n').filter(line => line.trim().startsWith('•'));
              phraseLines.forEach(line => {
                const match = line.match(/• '([^']+)': (\d+) times/);
                if (match) {
                  signaturePhrases[match[1]] = parseInt(match[2]);
                }
              });
            }

            // Parse communication metrics
            const metricsMatch = output.match(/💬 COMMUNICATION PATTERNS:\n([\s\S]*?)(?=\n|$)/);
            if (metricsMatch) {
              const metricsText = metricsMatch[1];
              const ratioMatches = metricsText.matchAll(/• ([^:]+): ([\d.]+)%?/g);
              for (const match of ratioMatches) {
                communicationMetrics[match[1]] = parseFloat(match[2]);
              }
            }

            // Parse basic analysis data
            const statsMatch = output.match(/Total segments analyzed: (\d+)/);
            const wordsMatch = output.match(/Total words: (\d+)/);
            const rateMatch = output.match(/Speaking rate: ([\d.]+) words\/minute/);

            if (statsMatch && wordsMatch && rateMatch) {
              analysisData = {
                total_segments: parseInt(statsMatch[1]),
                total_words: parseInt(wordsMatch[1]),
                speaking_rate_wpm: parseFloat(rateMatch[1]),
                analysis_timestamp: new Date().toISOString()
              };
            }

            // Save speech analysis data to database
            if (Object.keys(analysisData).length > 0) {
              const { data: savedAnalysis, error: analysisError } = await supabase
                .from('speech_analysis')
                .upsert({
                  creator_id: creatorId,
                  analysis_data: analysisData,
                  signature_phrases: signaturePhrases,
                  communication_metrics: communicationMetrics
                })
                .select()
                .single();

              if (analysisError) {
                console.error(`❌ Failed to save speech analysis data for ${creatorName}:`, analysisError);
              } else {
                console.log(`📊 Speech analysis data saved successfully for ${creatorName}`);
              }
            }

            // Save style card if found
            if (styleCardMatch) {
              const styleCard = styleCardMatch[1].trim();
              console.log(`📝 Extracted style card (${styleCard.length} characters)`);

              // Save style card to database
              const { data: savedStyleCard, error: saveError } = await supabase
                .from('style_cards')
                .upsert({
                  creator_id: creatorId,
                  style_card_text: styleCard,
                  signature_phrases: signaturePhrases,
                  communication_metrics: communicationMetrics,
                  is_active: true,
                  version: '1.0'
                })
                .select()
                .single();

              if (saveError) {
                console.error(`❌ Failed to save style card for ${creatorName}:`, saveError);
              } else {
                console.log(`💾 Style card saved successfully for ${creatorName}`);

                // Update AI config to reference this style card
                if (savedStyleCard) {
                  const { error: configError } = await supabase
                    .from('ai_config')
                    .upsert({
                      creator_id: creatorId,
                      style_card_id: savedStyleCard.id,
                      style_enabled: true,
                      updated_at: new Date().toISOString()
                    });

                  if (configError) {
                    console.error(`⚠️ Failed to update AI config for ${creatorName}:`, configError);
                  } else {
                    console.log(`🔗 Linked style card to AI config for ${creatorName}`);
                  }
                }
              }
            } else {
              console.warn(`⚠️ Could not extract style card for ${creatorName}`);
            }

            resolve({ success: true, output: output });
          } else {
            console.log(`⚠️ Speech analysis completed but no clear success indicator for ${creatorName}`);
            resolve({ success: false, error: 'No success indicator found', output: output });
          }
        } catch (parseError) {
          console.error(`❌ Error parsing analysis results for ${creatorName}:`, parseError);
          resolve({ success: false, error: parseError.message, output: output });
        }
      } else {
        console.error(`❌ Speech analysis failed for ${creatorName} (exit code: ${code})`);
        console.error('Error output:', errorOutput);
        resolve({ success: false, error: errorOutput, code: code });
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Failed to start speech analysis for ${creatorName}:`, error);
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Get all creators who might need speech analysis
 */
async function getCreatorsForAnalysis() {
  try {
    console.log('🔍 Finding creators who might need speech analysis...');

    const { data: creators, error } = await supabase
      .from('creators')
      .select('id, display_name, user_id')
      .not('display_name', 'is', null);

    if (error) {
      console.error('Error fetching creators:', error);
      return [];
    }

    console.log(`📊 Found ${creators.length} creators to check`);
    return creators || [];

  } catch (error) {
    console.error('Error getting creators:', error);
    return [];
  }
}

/**
 * Main function to process speech analysis for eligible creators
 */
async function main() {
  console.log('🚀 Starting post-sync speech analysis process...');
  console.log('=' * 60);

  try {
    const creators = await getCreatorsForAnalysis();

    if (creators.length === 0) {
      console.log('ℹ️ No creators found for speech analysis');
      return;
    }

    let processedCount = 0;
    let successCount = 0;
    let skippedCount = 0;

    for (const creator of creators) {
      console.log(`\n📋 Processing creator: ${creator.display_name} (${creator.id})`);

      try {
        // Check if already has recent analysis
        if (await hasExistingSpeechAnalysis(creator.id)) {
          skippedCount++;
          continue;
        }

        // Check if has enough content
        if (!(await hasEnoughContentForAnalysis(creator.id))) {
          skippedCount++;
          continue;
        }

        // Run speech analysis
        const result = await runSpeechAnalysisForCreator(creator.id, creator.display_name);
        processedCount++;

        if (result.success) {
          successCount++;
          console.log(`✅ Successfully analyzed speech patterns for ${creator.display_name}`);
        } else {
          console.error(`❌ Failed to analyze speech patterns for ${creator.display_name}: ${result.error}`);
        }

        // Add small delay between processing
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error processing creator ${creator.display_name}:`, error);
        processedCount++;
      }
    }

    console.log('\n' + '=' * 60);
    console.log('📊 SPEECH ANALYSIS SUMMARY');
    console.log('=' * 60);
    console.log(`Total creators checked: ${creators.length}`);
    console.log(`Processed: ${processedCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Failed: ${processedCount - successCount}`);
    console.log('✅ Post-sync speech analysis process complete!');

  } catch (error) {
    console.error('❌ Fatal error in main process:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Received SIGINT, gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Received SIGTERM, gracefully shutting down...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  runSpeechAnalysisForCreator,
  hasEnoughContentForAnalysis,
  hasExistingSpeechAnalysis,
  main
};