/**
 * Speech Analysis Trigger Helper
 * Reusable function to trigger speech analysis automation after content processing
 */

import { spawn } from 'child_process'
import path from 'path'

export interface SpeechAnalysisTriggerResult {
  speechAnalysisTriggered: boolean
  forceAnalysisTriggered: boolean
  errors: string[]
}

/**
 * Trigger automatic speech analysis after content has been processed
 * This includes both the regular post-sync analysis and forced style card analysis
 */
export async function triggerSpeechAnalysis(
  processedVideos: number,
  context: string = 'content processing'
): Promise<SpeechAnalysisTriggerResult> {
  const result: SpeechAnalysisTriggerResult = {
    speechAnalysisTriggered: false,
    forceAnalysisTriggered: false,
    errors: []
  }

  // Only trigger if content was actually processed
  if (processedVideos === 0) {
    console.log(`⏭️ No videos processed in ${context}, skipping speech analysis automation`)
    return result
  }

  console.log(`🎤 Triggering speech analysis automation after ${context}...`)

  // Trigger post-sync speech analysis
  try {
    console.log('🔍 Triggering post-sync speech analysis...')
    const speechAnalysisPath = path.join(process.cwd(), 'scripts', 'post-sync-speech-analysis.js')

    const speechAnalysisProcess = spawn('node', [speechAnalysisPath], {
      detached: true,
      stdio: 'ignore'
    })

    speechAnalysisProcess.unref()
    result.speechAnalysisTriggered = true
    console.log('✅ Post-sync speech analysis triggered successfully')
  } catch (error) {
    const errorMsg = `Failed to trigger post-sync speech analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error('⚠️', errorMsg)
    result.errors.push(errorMsg)
  }

  // Trigger forced style card analysis for immediate updates
  try {
    console.log('🎨 Triggering FORCED style card analysis for auto-update...')
    const forceAnalysisPath = path.join(process.cwd(), 'scripts', 'force-speech-analysis.js')

    const forceAnalysisProcess = spawn('node', [forceAnalysisPath], {
      detached: true,
      stdio: 'ignore'
    })

    forceAnalysisProcess.unref()
    result.forceAnalysisTriggered = true
    console.log('✅ FORCED style card analysis triggered for auto-update')
  } catch (error) {
    const errorMsg = `Failed to trigger forced style card analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error('⚠️', errorMsg)
    result.errors.push(errorMsg)
  }

  console.log(`🎯 Speech analysis automation complete for ${context}:`, {
    processedVideos,
    speechAnalysisTriggered: result.speechAnalysisTriggered,
    forceAnalysisTriggered: result.forceAnalysisTriggered,
    errorsCount: result.errors.length
  })

  return result
}