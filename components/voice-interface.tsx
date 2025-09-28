'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Phone, Volume2, VolumeX } from 'lucide-react'

interface VoiceInterfaceProps {
  creatorId: string
  creatorName: string
  isSubscribed: boolean
}

export default function VoiceInterface({
  creatorId,
  creatorName,
  isSubscribed
}: VoiceInterfaceProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  const generateVoice = async (text: string) => {
    if (!isSubscribed) {
      alert('Voice features require a subscription!')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          creatorId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate voice')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error('Voice generation error:', error)
      alert('Failed to generate voice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const makeVoiceCall = async () => {
    if (!isSubscribed) {
      alert('Voice calling requires a subscription!')
      return
    }

    if (!phoneNumber) {
      alert('Please enter a phone number')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message: `Hi! This is ${creatorName}. Thanks for subscribing to my AI replica on Aitrion!`,
          creatorId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to make call')
      }

      alert(data.message || 'Call initiated successfully!')
      setPhoneNumber('')
    } catch (error) {
      console.error('Voice call error:', error)
      alert('Failed to make call. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  if (!isSubscribed) {
    return (
      <div className="bg-gray-100 rounded-lg p-6 text-center">
        <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Voice Features
        </h3>
        <p className="text-gray-600 mb-4">
          Subscribe to unlock voice interactions with {creatorName}
        </p>
        <p className="text-sm text-gray-500">
          • Generate voice responses<br/>
          • Receive voice messages<br/>
          • Voice calling (coming soon)
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Voice Features
      </h3>

      {/* Voice Generation */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Generate Voice Message
        </label>
        <div className="flex space-x-2">
          <Button
            onClick={() => generateVoice(`Hello! This is ${creatorName}. Thanks for being a subscriber!`)}
            disabled={loading}
            size="sm"
          >
            {loading ? 'Generating...' : 'Generate Sample'}
          </Button>
          
          {isPlaying ? (
            <Button
              onClick={stopAudio}
              variant="outline"
              size="sm"
            >
              <VolumeX className="w-4 h-4 mr-1" />
              Stop
            </Button>
          ) : (
            <div className="flex items-center text-sm text-gray-500">
              <Volume2 className="w-4 h-4 mr-1" />
              Ready to play
            </div>
          )}
        </div>
      </div>

      {/* Voice Calling */}
      <div className="border-t pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Voice Call (Beta)
        </label>
        <div className="flex space-x-2">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1234567890"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <Button
            onClick={makeVoiceCall}
            disabled={loading || !phoneNumber}
            size="sm"
          >
            <Phone className="w-4 h-4 mr-1" />
            Call
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Currently sends SMS. Voice calls coming soon!
        </p>
      </div>

      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
    </div>
  )
}