import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { VoiceService } from '@/lib/voice'
import { z } from 'zod'

const voiceSchema = z.object({
  text: z.string().min(1).max(500),
  creatorId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { text, creatorId } = voiceSchema.parse(body)

    const creator = await db.creator.findUnique({
      where: { id: creatorId }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    const voiceSettings = await db.voiceSettings.findUnique({
      where: { creatorId: creator.id }
    })

    // Check if user has subscription for voice features
    const subscription = await db.subscription.findFirst({
      where: {
        userId: session.user.id,
        creatorId
      }
    })

    if (!subscription || subscription.status !== 'ACTIVE') {
      return NextResponse.json({ 
        error: 'Voice features require an active subscription' 
      }, { status: 403 })
    }

    if (!voiceSettings?.is_enabled) {
      return NextResponse.json({ 
        error: 'Voice features not enabled for this creator' 
      }, { status: 400 })
    }

    const voiceId = voiceSettings?.elevenlabs_voice_id
    const audioBuffer = await VoiceService.generateSpeech(text, voiceId || undefined)

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Voice generation error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}