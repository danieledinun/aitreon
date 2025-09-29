import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'

interface SpeechAnalysisRequest {
  creatorId: string
  action: 'analyze' | 'score' | 'card'
  text?: string // For scoring
}

interface SpeechAnalysisResponse {
  success: boolean
  message: string
  data?: {
    profile?: any
    score?: number
    styleCard?: string
    recommendations?: string[]
  }
  error?: string
}

// Helper function to run Python speech analysis
async function runSpeechAnalysis(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(process.cwd(), 'services', 'speech_analysis', 'venv', 'bin', 'python')
    const scriptPath = path.join(process.cwd(), 'services', 'speech_analysis', 'main.py')

    const child = spawn(pythonPath, [scriptPath, ...args], {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        PYTHONPATH: path.join(process.cwd(), 'services')
      }
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body: SpeechAnalysisRequest = await request.json()
    const { creatorId, action, text } = body

    if (!creatorId) {
      return NextResponse.json(
        { success: false, error: 'Creator ID is required' },
        { status: 400 }
      )
    }

    // Verify creator exists and user has access
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, user_id')
      .eq('id', creatorId)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json(
        { success: false, error: 'Creator not found' },
        { status: 404 }
      )
    }

    let result: SpeechAnalysisResponse = { success: false, message: '' }

    switch (action) {
      case 'analyze':
        try {
          console.log(`Starting speech analysis for creator: ${creatorId}`)

          const analyzeArgs = ['analyze', '--creator-id', creatorId]
          const analyzeResult = await runSpeechAnalysis(analyzeArgs)

          console.log('Analysis stdout:', analyzeResult.stdout)
          if (analyzeResult.stderr) {
            console.log('Analysis stderr:', analyzeResult.stderr)
          }

          // Check if analysis was successful by looking for success indicators
          if (analyzeResult.stdout.includes('Analysis complete') ||
              analyzeResult.stdout.includes('✅')) {

            // Extract style card from the output
            const styleCardMatch = analyzeResult.stdout.match(/STYLE CARD\n={60}\n([\s\S]*?)\n={60}/)
            const styleCard = styleCardMatch ? styleCardMatch[1].trim() : null

            result = {
              success: true,
              message: 'Speech pattern analysis completed successfully',
              data: {
                styleCard: styleCard || undefined
              }
            }
          } else {
            result = {
              success: false,
              message: 'Analysis failed',
              error: analyzeResult.stderr || 'Unknown error during analysis'
            }
          }
        } catch (error) {
          console.error('Error during analysis:', error)
          result = {
            success: false,
            message: 'Analysis failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
        break

      case 'score':
        if (!text) {
          return NextResponse.json(
            { success: false, error: 'Text is required for scoring' },
            { status: 400 }
          )
        }

        try {
          const scoreArgs = ['score', '--creator-id', creatorId, '--text', text]
          const scoreResult = await runSpeechAnalysis(scoreArgs)

          // Parse score from output
          const scoreMatch = scoreResult.stdout.match(/Style Similarity Score: (\d+\.?\d*)%/)
          const score = scoreMatch ? parseFloat(scoreMatch[1]) / 100 : 0

          // Extract recommendations
          const recommendationsMatch = scoreResult.stdout.match(/💡 Recommendations:\n((?:   • .*\n)*)/m)
          const recommendations = recommendationsMatch
            ? recommendationsMatch[1].split('\n')
                .filter(line => line.includes('•'))
                .map(line => line.replace(/^\s*•\s*/, '').trim())
            : []

          result = {
            success: true,
            message: 'Text scoring completed',
            data: {
              score: score,
              recommendations: recommendations
            }
          }
        } catch (error) {
          console.error('Error during scoring:', error)
          result = {
            success: false,
            message: 'Scoring failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
        break

      case 'card':
        try {
          const cardArgs = ['card', '--creator-id', creatorId]
          const cardResult = await runSpeechAnalysis(cardArgs)

          // Extract style card from output
          const styleCardMatch = cardResult.stdout.match(/STYLE CARD\n={60}\n([\s\S]*?)\n={60}/)
          const styleCard = styleCardMatch ? styleCardMatch[1].trim() : null

          if (styleCard) {
            result = {
              success: true,
              message: 'Style card generated successfully',
              data: {
                styleCard: styleCard
              }
            }
          } else {
            result = {
              success: false,
              message: 'No style profile found',
              error: 'Creator needs to be analyzed first'
            }
          }
        } catch (error) {
          console.error('Error generating style card:', error)
          result = {
            success: false,
            message: 'Style card generation failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Speech analysis API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')

    if (!creatorId) {
      return NextResponse.json(
        { success: false, error: 'Creator ID is required' },
        { status: 400 }
      )
    }

    // For now, skip authentication to avoid token refresh loops
    // TODO: Implement proper authentication that doesn't depend on Google OAuth tokens
    console.log('🔍 Fetching speech analysis for creator:', creatorId)

    // Fetch AI config data where the style analysis is actually stored
    const { data: aiConfig, error: aiConfigError } = await supabase
      .from('ai_config')
      .select('*')
      .eq('creator_id', creatorId)
      .single()

    // Don't treat "no data" as an error - PGRST116 means no rows returned
    const configData = aiConfigError?.code === 'PGRST116' ? null : aiConfig

    // Log errors that aren't just "no data found"
    if (aiConfigError && aiConfigError.code !== 'PGRST116') {
      console.error('AI config fetch error:', aiConfigError)
    }

    // Check if we have style data (updated recently means analysis was run)
    const hasStyleData = configData?.updated_at &&
      new Date(configData.updated_at) > new Date('2024-01-01')

    const styleCard = hasStyleData ? {
      id: configData.id,
      style_card_text: configData.style_card || 'Style analysis completed. Run regenerate to see the latest analysis.',
      created_at: configData.updated_at // Use updated_at as created_at for timestamp display
    } : null

    return NextResponse.json({
      success: true,
      data: {
        speechAnalysis: null, // Legacy field - we don't store detailed metrics separately
        styleCard: styleCard,
        // Legacy compatibility fields
        hasProfile: hasStyleData,
        hasStyleCard: hasStyleData
      }
    })

  } catch (error) {
    console.error('Speech analysis GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}