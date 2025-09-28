import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import { VoiceService } from '@/lib/voice'
import { z } from 'zod'

const callSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
  message: z.string().min(1).max(500),
  creatorId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { phoneNumber, message, creatorId } = callSchema.parse(body)

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
        error: 'Voice calling requires an active subscription' 
      }, { status: 403 })
    }

    if (!voiceSettings?.isEnabled) {
      return NextResponse.json({ 
        error: 'Voice features not enabled for this creator' 
      }, { status: 400 })
    }

    // Generate speech
    const voiceId = voiceSettings?.elevenlabsVoiceId
    const audioBuffer = await VoiceService.generateSpeech(message, voiceId || undefined)

    // For MVP, we'll send an SMS with the message instead of a voice call
    // In production, you'd upload the audio to a CDN and create a TwiML endpoint
    const sms = await VoiceService.sendSMS(
      phoneNumber,
      `Message from ${creator.displayName}: ${message}. Voice calls coming soon!`
    )

    return NextResponse.json({ 
      success: true,
      messageSid: sms.sid,
      message: 'SMS sent successfully. Voice calls coming soon!'
    })
  } catch (error) {
    console.error('Voice call error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}