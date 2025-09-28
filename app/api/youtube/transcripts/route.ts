import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'

// Helper function to add transcript to RAG memory
async function addTranscriptToRAG(videoId: string, transcriptResult: TranscriptResult) {
  try {
    if (!transcriptResult.success || !transcriptResult.segments) {
      return // Skip if transcript extraction failed
    }

    console.log(`🧠 Adding transcript to RAG memory for video: ${videoId}`)
    
    // Format transcript content with timestamps
    const transcriptContent = transcriptResult.segments
      .map(segment => {
        const timestamp = `[${Math.floor(segment.start / 60)}:${String(Math.floor(segment.start % 60)).padStart(2, '0')}]`
        return `${timestamp} ${segment.text}`
      })
      .join('\n')

    const episodeContent = `Video ID: ${videoId}
URL: https://youtube.com/watch?v=${videoId}
Language: ${transcriptResult.language}
Transcript Quality: ${transcriptResult.is_generated ? 'Auto-generated' : 'Manual'} (${Math.round((transcriptResult.confidence || 0) * 100)}% confidence)

Transcript:
${transcriptContent}`

    // Skip RAG integration for direct transcript calls
    // The sync-content route handles RAG integration properly with creator context
    console.log(`ℹ️ Skipping RAG integration for direct transcript call - video ${videoId}`)
    return // Skip RAG for standalone transcript calls
  } catch (error) {
    console.error(`❌ Failed to add transcript to RAG memory for video ${videoId}:`, error)
    throw error
  }
}

interface TranscriptSegment {
  start: number
  duration: number
  end: number
  text: string
  confidence: number
}

interface TranscriptResult {
  success: boolean
  video_id?: string
  language?: string
  is_generated?: boolean
  segments_count?: number
  segments?: TranscriptSegment[]
  obtained_via?: string
  confidence?: number
  processing_date?: string
  error?: string
  message?: string
}

interface BatchTranscriptResult {
  [videoId: string]: TranscriptResult
}

// Helper function to execute Python script
function executePythonScript(command: string, args: string[]): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    // Use the virtual environment Python interpreter
    const pythonPath = process.env.PYTHON_PATH || join(process.cwd(), 'scripts', 'transcript_env', 'bin', 'python')
    const scriptPath = join(process.cwd(), 'scripts', 'youtube_transcript_extractor.py')
    
    const pythonProcess = spawn(pythonPath, [scriptPath, command, ...args])
    
    let stdout = ''
    let stderr = ''
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`Python script exited with code ${code}. stderr: ${stderr}`))
      }
    })
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`))
    })
    
    // Set timeout for long-running requests (15 minutes for large batches)
    setTimeout(() => {
      pythonProcess.kill('SIGTERM')
      reject(new Error('Python script timed out after 15 minutes'))
    }, 15 * 60 * 1000)
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoIds, languages = ['en'], preserveFormatting = false } = body

    if (!videoIds || (!Array.isArray(videoIds) && typeof videoIds !== 'string')) {
      return NextResponse.json({
        success: false,
        error: 'invalid_input',
        message: 'videoIds must be a string (single video) or array (multiple videos)'
      }, { status: 400 })
    }

    const isMultiple = Array.isArray(videoIds)
    const videoIdList = isMultiple ? videoIds : [videoIds]

    // Validate video IDs format
    const validVideoIdRegex = /^[a-zA-Z0-9_-]{11}$/
    for (const videoId of videoIdList) {
      if (!validVideoIdRegex.test(videoId)) {
        return NextResponse.json({
          success: false,
          error: 'invalid_video_id',
          message: `Invalid video ID format: ${videoId}`
        }, { status: 400 })
      }
    }

    console.log(`🎥 Processing ${videoIdList.length} video(s) for transcript extraction`)
    
    try {
      let result: TranscriptResult | BatchTranscriptResult

      if (isMultiple) {
        // Multiple videos
        const args = [videoIds.join(','), ...languages]
        const { stdout } = await executePythonScript('multiple', args)
        result = JSON.parse(stdout) as BatchTranscriptResult
        
        // Add processing date to each result
        const processingDate = new Date().toISOString()
        Object.keys(result).forEach(videoId => {
          if (result[videoId].success) {
            result[videoId].processing_date = processingDate
          }
        })

        // Add successful transcripts to RAG memory
        for (const [videoId, transcriptResult] of Object.entries(result)) {
          if (transcriptResult.success) {
            try {
              await addTranscriptToRAG(videoId, transcriptResult)
            } catch (error) {
              console.error(`❌ Failed to add transcript to RAG for video ${videoId}:`, error)
              // Don't fail the batch if individual RAG additions fail
            }
          }
        }
      } else {
        // Single video
        const args = [videoIds, ...languages]
        const { stdout } = await executePythonScript('single', args)
        result = JSON.parse(stdout) as TranscriptResult
        
        // Add processing date
        if (result.success) {
          result.processing_date = new Date().toISOString()
          
          // Add to RAG memory if transcript was successfully fetched
          try {
            await addTranscriptToRAG(videoIds, result)
          } catch (error) {
            console.error(`❌ Failed to add transcript to RAG for video ${videoIds}:`, error)
            // Don't fail the request if RAG addition fails
          }
        }
      }

      return NextResponse.json(result)

    } catch (pythonError: any) {
      console.error('❌ Python script error:', pythonError.message)
      
      return NextResponse.json({
        success: false,
        error: 'script_execution_failed',
        message: 'Failed to execute transcript extraction script',
        details: pythonError.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'internal_server_error',
      message: 'An unexpected error occurred',
      details: error.message
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    const action = searchParams.get('action') || 'transcript'

    if (!videoId) {
      return NextResponse.json({
        success: false,
        error: 'missing_video_id',
        message: 'videoId parameter is required'
      }, { status: 400 })
    }

    // Validate video ID format
    const validVideoIdRegex = /^[a-zA-Z0-9_-]{11}$/
    if (!validVideoIdRegex.test(videoId)) {
      return NextResponse.json({
        success: false,
        error: 'invalid_video_id',
        message: `Invalid video ID format: ${videoId}`
      }, { status: 400 })
    }

    console.log(`🎥 Processing single video: ${videoId} (action: ${action})`)

    try {
      let result: any

      if (action === 'info') {
        // Get transcript availability info
        const { stdout } = await executePythonScript('info', [videoId])
        result = JSON.parse(stdout)
      } else {
        // Get transcript with default language preferences
        const languages = searchParams.get('languages')?.split(',') || ['en']
        const { stdout } = await executePythonScript('single', [videoId, ...languages])
        result = JSON.parse(stdout)
        
        // Add processing date
        if (result.success) {
          result.processing_date = new Date().toISOString()
        }
      }

      return NextResponse.json(result)

    } catch (pythonError: any) {
      console.error('❌ Python script error:', pythonError.message)
      
      return NextResponse.json({
        success: false,
        error: 'script_execution_failed',
        message: 'Failed to execute transcript extraction script',
        details: pythonError.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'internal_server_error',
      message: 'An unexpected error occurred',
      details: error.message
    }, { status: 500 })
  }
}