import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  console.log('🔍 Debug: Checking LiveKit environment variables')
  
  const livekitUrl = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const elevenlabsKey = process.env.ELEVENLABS_API_KEY

  return NextResponse.json({
    livekit: {
      url: livekitUrl ? '✅ Present' : '❌ Missing',
      apiKey: apiKey ? '✅ Present' : '❌ Missing',
      apiSecret: apiSecret ? '✅ Present' : '❌ Missing'
    },
    elevenlabs: {
      apiKey: elevenlabsKey ? '✅ Present' : '❌ Missing'
    },
    test: {
      timestamp: new Date().toISOString(),
      message: 'Voice debug endpoint is working'
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    console.log('🔍 Debug: Testing TTS with text:', text)
    
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key missing' }, { status: 500 })
    }

    // Use a simple default voice for testing
    const voiceId = 'pNInz6obpgDQGcFmaJgB' // Adam voice
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: text || 'This is a test of the voice system.',
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ElevenLabs error:', response.status, errorText)
      return NextResponse.json({ 
        error: 'ElevenLabs API error',
        status: response.status,
        details: errorText
      }, { status: response.status })
    }

    const audioBuffer = await response.arrayBuffer()
    const audioData = Buffer.from(audioBuffer).toString('base64')
    
    console.log('✅ TTS generated successfully, size:', audioBuffer.byteLength, 'bytes')

    return NextResponse.json({
      success: true,
      audioData,
      audioFormat: 'audio/mpeg',
      audioSize: audioBuffer.byteLength,
      text: text || 'This is a test of the voice system.'
    })

  } catch (error) {
    console.error('❌ Debug TTS error:', error)
    return NextResponse.json({ 
      error: 'Debug TTS failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}