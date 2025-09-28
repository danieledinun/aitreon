import ElevenLabs from 'elevenlabs-node'
import twilio from 'twilio'
import { db } from './database'
import { StyleAdapterService } from './style-adapter'

const elevenlabs = new ElevenLabs({
  apiKey: process.env.ELEVENLABS_API_KEY!,
})

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export class VoiceService {
  static async generateSpeech(text: string, creatorId?: string, voiceId?: string): Promise<Buffer> {
    try {
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
      let voiceSettings = {}

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
          stability: voiceSettings.stability || 0.75,
          similarity_boost: voiceSettings.similarity_boost || 0.8,
          speaking_rate: voiceSettings.speaking_rate || 1.0,
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

  static async sendVoiceMessage(to: string, audioUrl: string, message?: string) {
    try {
      const call = await twilioClient.calls.create({
        to,
        from: process.env.TWILIO_PHONE_NUMBER!,
        url: audioUrl, // TwiML URL that plays the audio
      })

      return call
    } catch (error) {
      console.error('Error sending voice message:', error)
      throw error
    }
  }

  static async sendSMS(to: string, message: string) {
    try {
      const sms = await twilioClient.messages.create({
        to,
        from: process.env.TWILIO_PHONE_NUMBER!,
        body: message,
      })

      return sms
    } catch (error) {
      console.error('Error sending SMS:', error)
      throw error
    }
  }

  static generateTwiML(audioUrl: string, message?: string): string {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?>'
    twiml += '<Response>'
    
    if (message) {
      twiml += `<Say>${message}</Say>`
    }
    
    twiml += `<Play>${audioUrl}</Play>`
    twiml += '</Response>'
    
    return twiml
  }
}