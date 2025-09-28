import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    console.log('🎙️ Transcribing audio file:', audioFile.name, audioFile.size, 'bytes')

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    })

    console.log('✅ Transcription completed:', transcription)

    return NextResponse.json({
      transcription: transcription.trim(),
      success: true
    })

  } catch (error) {
    console.error('❌ Transcription error:', error)
    return NextResponse.json({
      error: 'Transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}