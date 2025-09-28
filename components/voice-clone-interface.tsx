'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mic, Upload, Play, Square, Volume2, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface Creator {
  id: string
  displayName: string
  voiceSettings?: {
    isEnabled: boolean
    elevenlabsVoiceId?: string
  } | null
}

interface VoiceCloneInterfaceProps {
  creator: Creator
}

export default function VoiceCloneInterface({ creator }: VoiceCloneInterfaceProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const recordingStartTimeRef = useRef<number | null>(null)

  // Voice cloning script optimized for ElevenLabs
  const voiceScript = `Hello, I'm excited to share my voice with you today. My name is ${creator.displayName} and I create content that I'm passionate about. 

I love connecting with my audience and helping them learn new things. Whether we're talking about exciting discoveries, practical tips, or just having a fun conversation, I always try to bring enthusiasm and clarity to every interaction.

My speaking style is conversational and engaging. I like to use everyday language that everyone can understand, while still being informative and helpful. I often use phrases like "that's amazing," "let me explain," and "here's what I think."

I'm passionate about what I do, and I hope that comes through in my voice. I want every person I talk to feel welcome and valued. That's really what it's all about - creating genuine connections and sharing knowledge in a way that's both entertaining and educational.

Thank you for taking the time to listen to me. I can't wait to help answer your questions and share more insights with you through my AI assistant!`

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording && recordingStartTimeRef.current) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current!) / 1000)
        setRecordingDuration(elapsed)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      })
      
      const chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      recordingStartTimeRef.current = Date.now()
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Could not access microphone. Please check permissions and try again.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      recordingStartTimeRef.current = null
    }
  }

  const playAudio = () => {
    const audioSrc = audioUrl || (uploadedFile ? URL.createObjectURL(uploadedFile) : null)
    if (audioSrc) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      
      audioRef.current = new Audio(audioSrc)
      audioRef.current.onended = () => setIsPlaying(false)
      audioRef.current.onerror = () => {
        console.error('Error playing audio')
        setIsPlaying(false)
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true)
      }).catch((error) => {
        console.error('Error playing audio:', error)
        setIsPlaying(false)
      })
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file type
      if (!file.type.startsWith('audio/')) {
        alert('Please select an audio file (MP3, WAV, M4A, etc.).')
        return
      }
      
      // Check file size (max 25MB for ElevenLabs)
      if (file.size > 25 * 1024 * 1024) {
        alert('File size must be less than 25MB.')
        return
      }
      
      setUploadedFile(file)
      setAudioBlob(null)
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
        setAudioUrl(null)
      }
    }
  }

  const submitVoiceClone = async () => {
    const audioData = audioBlob || uploadedFile
    if (!audioData) {
      alert('Please record or upload audio first.')
      return
    }

    // Check duration (recommend at least 30 seconds)
    if (recordingDuration > 0 && recordingDuration < 30) {
      if (!confirm('Recording is less than 30 seconds. For better quality, we recommend at least 1 minute. Continue anyway?')) {
        return
      }
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const formData = new FormData()
      formData.append('audio', audioData)
      formData.append('name', `${creator.displayName} Voice Clone`)
      formData.append('description', `Custom voice clone for ${creator.displayName}`)

      const response = await fetch('/api/voice-clone', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        setSubmitStatus('success')
        setTimeout(() => {
          window.location.href = '/creator/settings'
        }, 3000)
      } else {
        const error = await response.text()
        console.error('Voice clone error:', error)
        throw new Error('Failed to create voice clone')
      }
    } catch (error) {
      console.error('Error submitting voice clone:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/creator" className="text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <Volume2 className="h-7 w-7 text-green-400" />
              Voice Cloning
            </h1>
          </div>
          <p className="text-gray-600 dark:text-neutral-400 text-lg">Create a custom voice for your AI responses</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Instructions */}
        <Card className="p-6 mb-8 bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">How Voice Cloning Works</h2>
          <div className="space-y-3 text-sm text-gray-700 dark:text-neutral-300">
            <p>
              <strong className="text-gray-900 dark:text-white">Voice cloning</strong> creates a custom AI voice that sounds like you. This voice will be used when fans click "Read Aloud" on your AI responses.
            </p>
            <p>
              For the best results, provide a <strong className="text-gray-900 dark:text-white">1-minute audio sample</strong> that is:
            </p>
            <ul className="ml-6 space-y-1 list-disc text-gray-600 dark:text-neutral-400">
              <li>Clear and high-quality (no background noise)</li>
              <li>Conversational and natural</li>
              <li>Includes various emotions and tones</li>
              <li>Contains diverse vocabulary and sentence structures</li>
              <li>Recorded in a quiet environment</li>
            </ul>
          </div>
        </Card>

        {/* Current Voice Status */}
        {creator.voiceSettings?.elevenlabsVoiceId && (
          <Card className="p-6 mb-8 bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-800/30">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <CheckCircle className="h-5 w-5" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Voice Clone Active</h3>
            </div>
            <p className="text-sm text-green-300">
              Your custom voice is currently active and being used for AI responses.
            </p>
          </Card>
        )}

        {/* Tab Selection */}
        <div className="flex space-x-4 mb-6">
          <Button
            variant={activeTab === 'record' ? 'default' : 'outline'}
            onClick={() => setActiveTab('record')}
            className={`flex items-center gap-2 ${activeTab === 'record' ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800' : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
          >
            <Mic className="h-4 w-4" />
            Record Voice
          </Button>
          <Button
            variant={activeTab === 'upload' ? 'default' : 'outline'}
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 ${activeTab === 'upload' ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800' : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
          >
            <Upload className="h-4 w-4" />
            Upload Audio
          </Button>
        </div>

        {activeTab === 'record' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Record Your Voice</h3>
            
            {/* Script */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Please read this script clearly and naturally:</h4>
              <div className="text-sm leading-relaxed whitespace-pre-line text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-800">
                {voiceScript}
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex items-center gap-4 mb-6">
              {!isRecording ? (
                <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700">
                  <Mic className="h-4 w-4 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="outline" className="border-red-500 text-red-600">
                  <Square className="h-4 w-4 mr-2" />
                  Square Recording ({formatDuration(recordingDuration)})
                </Button>
              )}

              {audioUrl && (
                <Button
                  onClick={isPlaying ? stopAudio : playAudio}
                  variant="outline"
                >
                  {isPlaying ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Square
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Play Recording
                    </>
                  )}
                </Button>
              )}

              {audioUrl && (
                <Button
                  onClick={() => {
                    setAudioBlob(null)
                    if (audioUrl) {
                      URL.revokeObjectURL(audioUrl)
                    }
                    setAudioUrl(null)
                    setRecordingDuration(0)
                  }}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
              )}
            </div>

            {isRecording && (
              <div className="flex items-center gap-2 text-red-600 mb-4 p-3 bg-red-50 rounded-lg">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="font-medium">Recording in progress...</span>
                <span className="text-sm">Speak clearly and naturally. Try to read the entire script for best results.</span>
              </div>
            )}
            
            {recordingDuration > 0 && !isRecording && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Recording duration: {formatDuration(recordingDuration)}
                {recordingDuration < 30 && (
                  <span className="text-amber-600 ml-2">⚠ Consider recording for at least 30-60 seconds for better quality</span>
                )}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'upload' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Upload Audio File</h3>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload a high-quality audio file (WAV, MP3, M4A, FLAC) that is approximately 1-3 minutes long. 
                Maximum file size: 25MB.
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="mb-4"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Audio File
              </Button>
              
              {uploadedFile && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • {uploadedFile.type}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={isPlaying ? stopAudio : playAudio}
                      variant="outline"
                      size="sm"
                    >
                      {isPlaying ? (
                        <>
                          <Square className="h-4 w-4 mr-1" />
                          Square
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Play
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => {
                        setUploadedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Submit Section */}
        {(audioBlob || uploadedFile) && (
          <Card className="p-6 mt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create Voice Clone</h3>
            
            {submitStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-600 mb-4 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span>Voice clone created successfully! Redirecting to settings...</span>
              </div>
            )}
            
            {submitStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-600 mb-4 p-3 bg-red-50 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to create voice clone. Please check your audio file and try again.</span>
              </div>
            )}
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will create a custom voice model using your audio. Processing typically takes 1-5 minutes. 
              Your voice will be available for AI responses once processing is complete.
            </p>
            
            <Button
              onClick={submitVoiceClone}
              disabled={isSubmitting || submitStatus === 'success'}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Voice Clone...
                </>
              ) : submitStatus === 'success' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Voice Clone Created
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Create Voice Clone
                </>
              )}
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}