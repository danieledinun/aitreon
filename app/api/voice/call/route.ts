import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { VoiceService } from '@/lib/voice'
import { z } from 'zod'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('id', creatorId)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    const { data: voiceSettings } = await supabase
      .from('voice_settings')
      .select('*')
      .eq('creator_id', creator.id)
      .single()

    // Check if user has subscription for voice features
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('creator_id', creatorId)
      .single()

    if (!subscription || subscription.status !== 'ACTIVE') {
      return NextResponse.json({ 
        error: 'Voice calling requires an active subscription' 
      }, { status: 403 })
    }

    if (!voiceSettings?.is_enabled) {
      return NextResponse.json({ 
        error: 'Voice features not enabled for this creator' 
      }, { status: 400 })
    }

    // Generate speech
    const voiceId = voiceSettings?.elevenlabs_voice_id
    const audioBuffer = await VoiceService.generateSpeech(message, creatorId, voiceId || undefined)

    // Voice calling feature not implemented - return the audio buffer for download
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Content-Disposition': 'attachment; filename="voice-message.mp3"',
      },
    })
  } catch (error) {
    console.error('Voice call error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}