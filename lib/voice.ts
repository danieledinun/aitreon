// @ts-ignore
const ElevenLabs = require('elevenlabs-node')
import { db } from './database'
import { StyleAdapterService } from './style-adapter'

let elevenlabs: any
try {
  elevenlabs = new ElevenLabs({
    apiKey: process.env.ELEVENLABS_API_KEY!,
  })
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
        const voiceSettings = await db.voiceSettings.findUnique({
          where: { creatorId }
        })
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