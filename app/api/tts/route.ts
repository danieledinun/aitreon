import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text, creatorId } = await request.json()

    if (!text || !creatorId) {
      return NextResponse.json({ error: 'Text and creatorId are required' }, { status: 400 })
    }

    // Clean the text to make it more conversational
    let cleanText = text
      // Remove citation numbers
      .replace(/\[(\d+)\]/g, '')
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1')     // Remove italic
      .replace(/`(.*?)`/g, '$1')       // Remove code backticks
      .replace(/#{1,6}\s/g, '')        // Remove headers
      // Clean up special characters for better speech
      .replace(/&/g, ' and ')          // Replace & with "and"
      .replace(/\+/g, ' plus ')        // Replace + with "plus"
      .replace(/\-/g, ' ')             // Replace hyphens with spaces
      .replace(/\//g, ' or ')          // Replace / with "or"
      .replace(/\@/g, ' at ')          // Replace @ with "at"
      .replace(/\#/g, ' hashtag ')     // Replace # with "hashtag"
      .replace(/\$/g, ' dollars ')     // Replace $ with "dollars"
      .replace(/\%/g, ' percent ')     // Replace % with "percent"
      // Clean up whitespace
      .replace(/\s+/g, ' ')            // Multiple spaces to single space
      .replace(/\n+/g, '. ')           // Line breaks to periods
      .trim()

    // Ensure proper sentence endings for natural speech
    if (cleanText && !cleanText.match(/[.!?]$/)) {
      cleanText += '.'
    }

    if (!cleanText) {
      return NextResponse.json({ error: 'No text to convert' }, { status: 400 })
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      return NextResponse.json({ error: 'ElevenLabs API not configured' }, { status: 500 })
    }

    // Get creator's custom voice if available
    const creator = await db.creator.findUnique({
      where: { id: creatorId }
    })

    const voiceSettings = creator ? await db.voiceSettings.findUnique({
      where: { creatorId: creator.id }
    }) : null

    // Use custom voice if available and enabled, otherwise use default
    const voiceId = (voiceSettings?.is_enabled && voiceSettings?.elevenlabs_voice_id)
      ? voiceSettings.elevenlabs_voice_id 
      : 'pNInz6obpgDQGcFmaJgB' // Adam voice as fallback

    console.log('🎵 Generating TTS for creator:', creatorId)
    console.log('🎵 Text length:', cleanText.length, 'characters')

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ElevenLabs API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()
    console.log('✅ Generated audio, size:', audioBuffer.byteLength, 'bytes')

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('❌ TTS API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}