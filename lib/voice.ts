import { createClient } from '@supabase/supabase-js'
import { StyleAdapterService } from './style-adapter'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ElevenLabs service using fetch API for better compatibility
class ElevenLabsClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async textToSpeech(params: {
    text: string
    voice: string
    model_id: string
    voice_settings: any
  }): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured')
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${params.voice}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey
      },
      body: JSON.stringify({
        text: params.text,
        model_id: params.model_id,
        voice_settings: params.voice_settings
      })
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
    }

    return response.arrayBuffer()
  }

  async getVoices(): Promise<{ voices: any[] }> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured')
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': this.apiKey
      }
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }
}

let elevenlabs: ElevenLabsClient | null = null
try {
  if (process.env.ELEVENLABS_API_KEY) {
    elevenlabs = new ElevenLabsClient(process.env.ELEVENLABS_API_KEY)
  }
} catch (error) {
  console.warn('ElevenLabs initialization failed:', error)
  elevenlabs = null
}

export class VoiceService {
  static async generateSpeech(text: string, creatorId?: string, voiceId?: string): Promise<Buffer> {
    try {
      if (!elevenlabs) {
        throw new Error('ElevenLabs service not available')
      }
      let voice = voiceId

      // If no voice ID provided, try to load from creator's voice settings
      if (!voice && creatorId) {
        const { data: voiceSettings } = await supabase
          .from('voice_settings')
          .select('elevenlabs_voice_id')
          .eq('creator_id', creatorId)
          .single()
        voice = voiceSettings?.elevenlabs_voice_id
      }

      // Fallback to default voice
      voice = voice || 'pNInz6obpgDQGcFmaJgB'

      // Apply style adaptation if creator ID is provided
      let enhancedText = text
      let voiceSettings: any = {}

      if (creatorId) {
        const styleEnhancement = await StyleAdapterService.generateVoicePrompt(creatorId, text)
        enhancedText = styleEnhancement.enhancedText
        voiceSettings = styleEnhancement.voiceSettings
      }

      const audio = await elevenlabs.textToSpeech({
        text: enhancedText,
        voice,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: (voiceSettings as any).stability || 0.75,
          similarity_boost: (voiceSettings as any).similarity_boost || 0.8,
          speaking_rate: (voiceSettings as any).speaking_rate || 1.0,
          ...voiceSettings
        }
      })

      return Buffer.from(audio)
    } catch (error) {
      console.error('Error generating speech:', error)
      throw error
    }
  }

  static async getAvailableVoices() {
    try {
      if (!elevenlabs) {
        throw new Error('ElevenLabs service not available')
      }
      const voices = await elevenlabs.getVoices()
      return voices.voices
    } catch (error) {
      console.error('Error fetching voices:', error)
      throw error
    }
  }

  static async cloneVoice(name: string, audioFiles: Buffer[]): Promise<string> {
    try {
      // This would require implementing voice cloning with ElevenLabs
      // For MVP, we'll use preset voices
      throw new Error('Voice cloning not implemented in MVP')
    } catch (error) {
      console.error('Error cloning voice:', error)
      throw error
    }
  }

}