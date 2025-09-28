import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { EnhancedRAGService } from '@/lib/enhanced-rag-service'
import { GraphRAGService } from '@/lib/graphrag-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, creatorId, roomName } = await request.json()

    if (!query || !creatorId) {
      return NextResponse.json({ error: 'Query and creator ID are required' }, { status: 400 })
    }

    console.log('🎙️ Voice Agent Processing Query:', { query, creatorId, roomName })

    // Get creator info for personalized responses
    const creator = await db.creator.findUnique({
      where: { id: creatorId }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Fetch related data separately
    const voiceSettings = await db.voiceSettings.findUnique({
      where: { creatorId: creator.id }
    })
    
    const aiConfig = await db.aiConfig.findUnique({
      where: { creatorId: creator.id }
    })

    // Combine data for compatibility
    const creatorWithRelations = {
      ...creator,
      voiceSettings,
      aiConfig
    }

    // Determine which RAG system to use (same logic as chat)
    const queryComplexity = query.split(' ').length > 10 || 
                           query.includes('relationship') || 
                           query.includes('connected') ||
                           query.includes('together') ||
                           query.includes('compared to')
    
    const isGraphRagAvailable = await GraphRAGService.isAvailable()
    const useGraphRag = isGraphRagAvailable && queryComplexity

    console.log('🧠 Voice Agent RAG Selection:', { 
      useGraphRag, 
      isGraphRagAvailable, 
      queryComplexity,
      system: useGraphRag ? 'GraphRAG' : 'Traditional RAG'
    })

    let ragResponse

    if (useGraphRag) {
      console.log('🧠 Voice Agent using GraphRAG system')
      
      // Use GraphRAG service
      const graphragResponse = await GraphRAGService.generateResponse(
        creatorId,
        creatorWithRelations.displayName,
        query,
        [] // No conversation history for voice
      )

      // Convert to legacy format for compatibility
      ragResponse = GraphRAGService.convertToLegacyFormat(graphragResponse)
    } else {
      console.log('🔍 Voice Agent using Enhanced RAG system')

      // Generate AI response using Enhanced RAG service
      ragResponse = await EnhancedRAGService.generateResponse(
        creatorId,
        creatorWithRelations.displayName,
        query,
        [] // No conversation history for voice
      )
    }

    // Clean text for voice synthesis (remove citations and markdown)
    let cleanText = ragResponse.response
      .replace(/\[(\d+)\]/g, '') // Remove citation numbers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove code backticks
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\n+/g, '. ') // Line breaks to periods
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .trim()

    // Ensure proper sentence endings
    if (cleanText && !cleanText.match(/[.!?]$/)) {
      cleanText += '.'
    }

    // Generate TTS audio if voice settings are available
    let audioData = null
    if (creatorWithRelations.voiceSettings?.isEnabled && creatorWithRelations.voiceSettings.elevenlabsVoiceId) {
      try {
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
        if (elevenLabsApiKey) {
          const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${creatorWithRelations.voiceSettings.elevenlabsVoiceId}`, {
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

          if (ttsResponse.ok) {
            const audioBuffer = await ttsResponse.arrayBuffer()
            audioData = Buffer.from(audioBuffer).toString('base64')
            console.log('🎵 Generated voice response audio, size:', audioBuffer.byteLength, 'bytes')
          }
        }
      } catch (error) {
        console.error('❌ TTS generation failed:', error)
      }
    }

    console.log('✅ Voice Agent Response Generated')

    return NextResponse.json({
      response: ragResponse.response,
      cleanText,
      audioData, // Base64 encoded audio
      audioFormat: 'audio/mpeg',
      citations: ragResponse.citations,
      metadata: {
        creatorName: creatorWithRelations.displayName,
        hasCustomVoice: !!creatorWithRelations.voiceSettings?.elevenlabsVoiceId,
        roomName,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Voice Agent Error:', error)
    return NextResponse.json({ 
      error: 'Voice agent processing failed' 
    }, { status: 500 })
  }
}

// Get voice agent status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 })
    }

    const creator = await db.creator.findUnique({
      where: { id: creatorId }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    const voiceSettings = await db.voiceSettings.findUnique({
      where: { creatorId: creator.id }
    })

    return NextResponse.json({
      status: 'ready',
      creatorName: creator.displayName,
      hasVoiceClone: !!voiceSettings?.elevenlabsVoiceId,
      voiceEnabled: voiceSettings?.isEnabled || false,
      capabilities: [
        'text_response',
        'citation_support',
        'voice_synthesis'
      ]
    })

  } catch (error) {
    console.error('❌ Voice Agent Status Error:', error)
    return NextResponse.json({ 
      error: 'Failed to get voice agent status' 
    }, { status: 500 })
  }
}