import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, creatorId } = await request.json()

    if (!query || !creatorId) {
      return NextResponse.json({ error: 'Query and creator ID are required' }, { status: 400 })
    }

    console.log('🧪 Voice Test API:', { query, creatorId })


    // Get creator info for voice settings
    const { data: creator } = await supabase
      .from('creator')
      .select('*')
      .eq('id', creatorId)
      .single()

    // Get voice settings separately
    const { data: voiceSettings } = await supabase
      .from('voice_settings')
      .select('*')
      .eq('creator_id', creatorId)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Simple test response
    const testResponse = `Hello! I'm ${creator.display_name || creator.display_name}. You asked: "${query}". This is a test voice response to check if the TTS is working properly.`

    // Generate TTS audio if voice settings are available
    let audioData = null
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    
    if (voiceSettings?.is_enabled && voiceSettings?.elevenlabs_voice_id && elevenLabsApiKey) {
      console.log('🎵 Generating TTS with voice ID:', voiceSettings.elevenlabs_voice_id)

      try {
        const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceSettings.elevenlabs_voice_id}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: testResponse,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
              style: 0.0,
              use_speaker_boost: true
            }
          }),
        })

        if (ttsResponse.ok) {
          const audioBuffer = await ttsResponse.arrayBuffer()
          audioData = Buffer.from(audioBuffer).toString('base64')
          console.log('✅ TTS generated successfully, size:', audioBuffer.byteLength, 'bytes')
        } else {
          const errorText = await ttsResponse.text()
          console.error('❌ ElevenLabs TTS error:', ttsResponse.status, errorText)
        }
      } catch (ttsError) {
        console.error('❌ TTS generation failed:', ttsError)
      }
    } else {
      console.log('🔇 No voice settings or API key available')
    }

    return NextResponse.json({
      response: testResponse,
      cleanText: testResponse,
      audioData,
      audioFormat: 'audio/mpeg',
      hasCustomVoice: !!voiceSettings?.elevenlabs_voice_id,
      metadata: {
        creatorName: creator.display_name,
        voiceEnabled: voiceSettings?.is_enabled || false,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Voice Test API Error:', error)
    return NextResponse.json({ 
      error: 'Voice test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'Voice test API is running',
    endpoints: ['POST /api/voice-test']
  })
}