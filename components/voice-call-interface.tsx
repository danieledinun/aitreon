'use client'

// TypeScript declarations for Web Speech API and audio streaming
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
    preConnectedAudioStream?: MediaStream
  }
}

import { useState, useEffect, useRef } from 'react'
import { 
  Room, 
  RoomEvent, 
  Track,
  LocalParticipant,
  RemoteParticipant,
  AudioTrack,
  LocalAudioTrack,
  RemoteAudioTrack,
  ConnectionState,
  ParticipantEvent,
  TrackEvent
} from 'livekit-client'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Users, Loader2, MessageCircle, Send, Bot, X, Share, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Image from 'next/image'
import VOICE_CALL_CONFIG from '@/lib/voice-config'

interface VoiceCallInterfaceProps {
  creatorId: string
  creatorName: string
  creatorImage?: string | null
  userId?: string
  roomName?: string
  onClose: () => void
}

type CallState = 'connecting' | 'talking' | 'listening' | 'thinking' | 'ended'
type AIState = 'idle' | 'listening' | 'processing' | 'speaking'

interface ParticipantInfo {
  identity: string
  name: string
  isCreator: boolean
  audioEnabled: boolean
}

// Extend Room type for custom properties
interface ExtendedRoom extends Room {
  connectionHeartbeat?: NodeJS.Timeout
  lifecycleCleanup?: () => void
}

// Function to save transcription to chat history
const saveTranscriptionToHistory = async (transcriptionData: {
  roomName: string
  creatorId: string
  participantId: string
  text: string
  trackId?: string
  timestamp: Date
}) => {
  try {
    const response = await fetch('/api/voice/transcription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transcriptionData)
    })
    
    if (!response.ok) {
      throw new Error('Failed to save transcription')
    }
    
    console.log('📝✅ Transcription saved to history')
  } catch (error) {
    console.error('📝❌ Error saving transcription:', error)
  }
}

export default function VoiceCallInterface({ creatorId, creatorName, creatorImage, userId, roomName: providedRoomName, onClose }: VoiceCallInterfaceProps) {
  console.log('🎤 VoiceCallInterface component rendered with props:', { creatorId, creatorName, userId })
  const [room, setRoom] = useState<ExtendedRoom | null>(null)
  const [isConnecting, setIsConnecting] = useState(true) // Start as connecting
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [callDuration, setCallDuration] = useState(0)
  const [showAIChat, setShowAIChat] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [debugInfo, setDebugInfo] = useState('')
  
  // Transcription state
  const [transcriptions, setTranscriptions] = useState<Array<{
    id: string
    text: string
    speaker: string
    participantId: string
    isFinal: boolean
    timestamp: Date
    trackId?: string
  }>>([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [callState, setCallState] = useState<CallState>('connecting')
  const [aiState, setAIState] = useState<AIState>('idle')
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [stateChangeTimeout, setStateChangeTimeout] = useState<NodeJS.Timeout | null>(null)

  // Recording state variables
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

  // Video display state
  const [displayedVideo, setDisplayedVideo] = useState<{
    videoId: string
    videoTitle: string
    recipeName: string
    timestamp: string
  } | null>(null)
  
  const roomRef = useRef<ExtendedRoom | null>(null)
  const callStartTimeRef = useRef<number | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const isConnectingRef = useRef<boolean>(false)

  // Use provided room name or generate one as fallback - ONLY ONCE
  const [roomName] = useState(() => providedRoomName || `voice_call_${userId || 'unknown'}_${creatorId}_${Date.now()}`)

  // Debounced state change function to prevent rapid flickering
  const debouncedSetCallState = (newState: CallState, newAIState: AIState, newIsAISpeaking: boolean, delay: number = 300) => {
    // Clear any existing timeout
    if (stateChangeTimeout) {
      clearTimeout(stateChangeTimeout)
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      console.log(`🔄 Debounced state change: ${newState}, AI: ${newAIState}, Speaking: ${newIsAISpeaking}`)
      setCallState(newState)
      setAIState(newAIState)
      setIsAISpeaking(newIsAISpeaking)
      setStateChangeTimeout(null)
    }, delay)

    setStateChangeTimeout(timeout)
  }

  useEffect(() => {
    // Add error boundary to prevent component from failing silently
    const initializeCall = async () => {
      try {
        await connectToRoom()
      } catch (error) {
        console.error('❌ Failed to initialize voice call:', error)
        setConnectionError(error instanceof Error ? error.message : 'Failed to initialize voice call')
        setIsConnecting(false)
      }
    }
    
    initializeCall()
    
    return () => {
      cleanup()
    }
  }, [])

  // Poll for video displays from voice agent
  useEffect(() => {
    console.log('🎥 Setting up video polling...', { userId, isConnected })
    if (!userId || !isConnected) {
      console.log('🎥 Skipping video polling - missing userId or not connected')
      return
    }

    const pollForVideoDisplays = async () => {
      try {
        console.log('🎥 Polling for video displays...', userId)
        const response = await fetch(`/api/voice/display-video?userId=${userId}`)
        console.log('🎥 Poll response:', response.status, response.ok)
        if (response.ok) {
          const data = await response.json()
          console.log('🎥 Poll data:', data)
          if (data.hasPendingVideo) {
            setDisplayedVideo(data.videoDisplay)
            console.log('🎥 Voice agent requested video display:', data.videoDisplay)
          }
        }
      } catch (error) {
        console.error('❌ Error polling for video displays:', error)
      }
    }

    // Poll immediately, then every 2 seconds when connected
    pollForVideoDisplays()
    const pollInterval = setInterval(pollForVideoDisplays, 2000)
    
    return () => {
      clearInterval(pollInterval)
    }
  }, [userId, isConnected])

  useEffect(() => {
    if (isConnected && callStartTimeRef.current) {
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current!) / 1000)
        setCallDuration(elapsed)
        
        // Auto-end call if time limit is reached and auto-end is enabled
        if (VOICE_CALL_CONFIG.AUTO_END_CALLS && VOICE_CALL_CONFIG.isExpired(elapsed)) {
          console.log('⏰ Call time limit reached, ending call automatically')
          endCall()
        }
      }, 1000)
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    }
  }, [isConnected])

  const connectToRoom = async () => {
    try {
      // Prevent multiple connection attempts using ref for more reliable state tracking
      if (isConnectingRef.current || isConnected || roomRef.current) {
        console.log('⚠️ Connection already in progress or established, skipping')
        return
      }
      
      isConnectingRef.current = true
      setIsConnecting(true)
      setConnectionError(null)
      console.log('🎤 VoiceCallInterface: Starting connection process')
      console.log('🎤 Connecting to room:', roomName)

      // Request microphone permissions FIRST before connecting
      console.log('🎤 Requesting microphone permissions before connecting...')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        })
        console.log('✅ Microphone permissions granted')
        stream.getTracks().forEach(track => track.stop())
      } catch (micError: any) {
        console.error('❌ Microphone permission denied:', micError)
        if (micError.name === 'NotAllowedError') {
          throw new Error('Microphone access denied. Please allow microphone permissions to start voice call.')
        } else if (micError.name === 'NotFoundError') {
          throw new Error('No microphone found. Please check your audio device.')
        } else {
          throw new Error('Failed to access microphone: ' + micError.message)
        }
      }

      // Get access token from our API
      const tokenResponse = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, creatorId })
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json()
        throw new Error(error.error || 'Failed to get access token')
      }

      const { token, serverUrl } = await tokenResponse.json()

      // Create and connect to room with improved settings for voice calls
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: { width: 640, height: 480 } },
        // Reconnection settings to maintain stable connection
        reconnectPolicy: {
          nextRetryDelayInMs: (context: any) => {
            // Exponential backoff: 1s, 2s, 4s, 8s, then cap at 10s
            const retryCount = context.retryCount || 0
            return Math.min(1000 * Math.pow(2, retryCount), 10000)
          }
        },
        disconnectOnPageLeave: false,  // Don't disconnect on page navigation
        stopLocalTrackOnUnpublish: false,  // Keep tracks alive
      })

      // Pre-enable microphone access BEFORE connecting to prevent 15s timeout
      console.log('🎤 Pre-requesting microphone access...')
      // Temporarily simplified version
      // try {
      //   const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      //   (window as any).preConnectedAudioStream = stream
      // } catch (preError) {
      //   console.warn('⚠️ Pre-connection microphone access failed:', preError)
      // }

      // Connect to the room
      console.log('🔗 Attempting to connect to LiveKit room...')
      await newRoom.connect(serverUrl, token);
      
      console.log('✅ Connected to LiveKit room successfully')
      roomRef.current = newRoom as ExtendedRoom
      setRoom(newRoom as ExtendedRoom)
      setIsConnected(true)

      // Set up event listeners after connection
      setupRoomEvents(newRoom as ExtendedRoom)
      
      // Force initial state immediately and then again after delay
      setCallState('listening')
      setIsAISpeaking(false)
      setAIState('idle')
      console.log('🎤 Immediate initial state: listening')
      
      // Also set states after delay to override any interference
      setTimeout(() => {
        setCallState('listening')   // Force listening state again
        setIsAISpeaking(false)     // Ensure AI is not marked as speaking initially
        setAIState('idle')         // AI starts idle
        console.log('🎤 Delayed initial states set: listening, AI idle')
      }, 1000)
      
      // Extra safety - force listening state after even longer delay
      setTimeout(() => {
        if (!isAISpeaking) {
          setCallState('listening')
          console.log('🎤 Extra safety: forced listening state')
        }
      }, 2000)
      
      callStartTimeRef.current = Date.now()

      // Enable microphone IMMEDIATELY to prevent 15-second timeout
      console.log('🎤 Enabling microphone immediately to prevent timeout...')
      try {
        // Enable microphone as fast as possible after connection
        await newRoom.localParticipant.setMicrophoneEnabled(true)
        setIsMuted(false)
        
        // Verify microphone track was published
        const micPublication = Array.from(newRoom.localParticipant.audioTrackPublications.values())
          .find(pub => pub.source === 'microphone')
        
        if (micPublication && micPublication.track) {
          console.log('✅ Microphone track published successfully:', micPublication.trackSid)
        } else {
          console.warn('⚠️ Microphone track not found, retrying...')
          // Retry microphone enablement
          setTimeout(async () => {
            try {
              await newRoom.localParticipant.setMicrophoneEnabled(false)
              await new Promise(resolve => setTimeout(resolve, 100))
              await newRoom.localParticipant.setMicrophoneEnabled(true)
              console.log('🔄 Microphone retry completed')
            } catch (retryError) {
              console.error('❌ Microphone retry failed:', retryError)
            }
          }, 500)
        }
        
      } catch (micError) {
        console.error('❌ Failed to enable microphone:', micError)
        // Try to create and publish an audio track manually as fallback
        try {
          console.log('🎤 Creating manual audio track as fallback...')
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true,
              autoGainControl: true
            } 
          })
          const audioTrack = audioStream.getAudioTracks()[0]
          await newRoom.localParticipant.publishTrack(audioTrack, { name: 'microphone' })
          setIsMuted(false)
          console.log('✅ Manual audio track published successfully')
        } catch (fallbackError) {
          console.error('❌ Fallback audio track creation failed:', fallbackError)
        }
      }

      // Add page lifecycle listeners to prevent connection from appearing "dead"
      // Temporarily commented out due to TypeScript issues
      /*
      const handleVisibilityChange = () => {
        if (document.hidden) {
          console.log('🔔 Page becoming hidden - maintaining connection...')
        } else {
          console.log('🔔 Page becoming visible - refreshing connection state...')
          // Refresh connection state when page becomes visible
          if (newRoom.state === 'connected') {
            console.log('💓 Connection still healthy after visibility change')
          }
        }
      }

      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        console.log('🚪 Page unloading - gracefully disconnecting...')
        if (newRoom && newRoom.state === 'connected') {
          // Properly disconnect before page unload
          newRoom.disconnect()
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)

      // Store cleanup functions for later removal
      (newRoom as ExtendedRoom).lifecycleCleanup = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
      */

      console.log('🎤 Connected to LiveKit room:', roomName)

    } catch (error: any) {
      console.error('❌ Failed to connect to voice call:', error)
      setConnectionError(error.message || 'Failed to connect to voice call')
      setIsConnecting(false)
      isConnectingRef.current = false
    }
  }

  const setupRoomEvents = (room: ExtendedRoom) => {
    // Connection state monitoring to prevent 15s timeout
    const connectionHeartbeat = setInterval(() => {
      if (room.state === 'connected') {
        console.log('💓 Connection heartbeat: healthy')
        // Ensure microphone track is still published
        const micPublication = Array.from(room.localParticipant.audioTrackPublications.values())
          .find(pub => pub.source === 'microphone')
        if (!micPublication || !micPublication.track || micPublication.isMuted) {
          console.warn('⚠️ Microphone track lost, re-enabling...')
          room.localParticipant.setMicrophoneEnabled(true).catch(e => 
            console.error('❌ Failed to re-enable microphone:', e))
        }
      }
    }, 5000) // Every 5 seconds
    
    // Store heartbeat interval for cleanup
    room.connectionHeartbeat = connectionHeartbeat
    
    room.on(RoomEvent.Connected, () => {
      console.log('✅ Connected to room - connection is stable')
      setIsConnecting(false)
      setIsConnected(true)
      isConnectingRef.current = false
      
      // Set proper initial state after connection
      setTimeout(() => {
        setCallState('listening')  // Agent should be listening initially
        setIsAISpeaking(false)     // Ensure AI is not speaking
        setAIState('idle')         // AI is idle and ready to listen
        console.log('🎤 Room connected - initial state: listening')
      }, 300)
      
      updateParticipantList(room)
      
      // Track local participant (user) speaking state
      console.log('🎤 Setting up speaking detection for local participant:', room.localParticipant.identity)
      room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        console.log('🎤 User speaking changed:', speaking, 'AI Speaking:', isAISpeaking, 'Call State:', callState)
        if (speaking && !isAISpeaking) {
          // User is speaking, show listening state
          setCallState('listening')
        } else if (!speaking && !isAISpeaking) {
          // User stopped speaking - agent should process
          console.log('🧠 User stopped speaking, waiting for AI agent response...')
          setCallState('thinking')
          setAIState('processing')
          
          // Set a timeout to go back to listening if AI doesn't respond within 30 seconds
          setTimeout(() => {
            if (!isAISpeaking) {
              setCallState('listening')
              setAIState('idle')
              console.log('🧠 Thinking timeout - back to listening')
            }
          }, 30000)
        }
      })
    })

    room.on(RoomEvent.Disconnected, () => {
      console.log('👋 Disconnected from room')
      setIsConnected(false)
      setCallState('ended')
      cleanup()
    })

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('👤 Participant connected:', participant.name)
      setupParticipantEvents(participant)
      updateParticipantList(room)
      
      // Track AI agent but don't use the speaking event - we handle this through audio events instead
      const isAIAgent = participant.identity.includes('agent') || 
                       participant.name?.toLowerCase().includes('agent')
      
      if (isAIAgent) {
        console.log('🤖 AI Agent connected - audio event handling will manage state:', participant.identity)
        // Note: We rely on audio element events for more accurate state tracking
      }
    })

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('👋 Participant disconnected:', participant.name)
      updateParticipantList(room)
    })

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        const audioElement = track.attach() as HTMLAudioElement
        audioElement.autoplay = true
        if ('playsInline' in audioElement) {
          (audioElement as any).playsInline = true
        }
        audioElementsRef.current.set(participant.identity, audioElement)
        console.log('🔊 Subscribed to audio track from:', participant.name)
        
        // Check if this is the AI agent - agents typically have 'agent' in their identity
        const hasAgentInIdentity = participant.identity.includes('agent')
        const hasAgentInName = participant.name?.toLowerCase().includes('agent') || false
        const isNotUser = !participant.identity.includes('cmeggijwb') && 
                         participant.identity !== roomRef.current?.localParticipant?.identity
        const isAIAgent = hasAgentInIdentity || hasAgentInName || isNotUser
        
        console.log('🤖 DETAILED PARTICIPANT CHECK:', {
          identity: participant.identity,
          name: participant.name,
          hasAgentInIdentity,
          hasAgentInName,
          isNotUser,
          isAIAgent,
          localIdentity: roomRef.current?.localParticipant?.identity
        })
        
        if (isAIAgent) {
          console.log('🤖 Setting up SINGLE AI agent tracking method for:', participant.identity)
          
          // Use ONLY participant speaking events - simpler and more reliable
          let connectionStartTime = Date.now()
          let lastStateChange = 0
          let currentSpeakingState = false
          let stopSpeakingTimeout: NodeJS.Timeout | null = null
          
          participant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
            const timeSinceConnection = Date.now() - connectionStartTime
            const timeSinceLastChange = Date.now() - lastStateChange
            
            console.log('🤖 AI Speaking Event:', speaking, 'Time since connection:', timeSinceConnection + 'ms', 'Since last change:', timeSinceLastChange + 'ms')
            
            // Ignore events too early after connection
            if (timeSinceConnection < 2000) {
              console.log('🤖 Ignoring early speaking event (< 2s)')
              return
            }
            
            // Only change state if it's actually different
            if (speaking !== currentSpeakingState) {
              currentSpeakingState = speaking
              lastStateChange = Date.now()
              
              if (speaking) {
                // Cancel any pending stop timeout
                if (stopSpeakingTimeout) {
                  console.log('🤖 ✅ AI RESUMED SPEAKING - Canceling stop timeout')
                  clearTimeout(stopSpeakingTimeout)
                  stopSpeakingTimeout = null
                } else {
                  console.log('🤖 ✅ AI STARTED SPEAKING - Setting talking state IMMEDIATELY')
                }
                // Set talking state immediately - no delays
                setCallState('talking')
                setAIState('speaking')
                setIsAISpeaking(true)
              } else {
                console.log('🤖 ✅ AI PAUSED SPEAKING - Starting 700ms confirmation timer...')
                // Set timeout to confirm AI is really done (not just pausing)
                stopSpeakingTimeout = setTimeout(() => {
                  // Double-check if AI is still not speaking after the delay
                  if (!currentSpeakingState) {
                    console.log('🤖 ✅ AI REALLY FINISHED SPEAKING - Setting listening state')
                    setCallState('listening')
                    setAIState('idle')
                    setIsAISpeaking(false)
                    stopSpeakingTimeout = null
                  } else {
                    console.log('🤖 ⚠️ AI resumed speaking during delay - staying in talking state')
                    stopSpeakingTimeout = null
                  }
                }, 700) // 700ms delay - very responsive while still handling brief pauses
              }
            } else {
              console.log('🤖 Same state, ignoring:', speaking)
            }
          })
        }
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach()
        const audioElement = audioElementsRef.current.get(participant.identity)
        if (audioElement) {
          audioElement.remove()
          audioElementsRef.current.delete(participant.identity)
        }
      }
    })

    room.on(RoomEvent.ConnectionStateChanged, (connectionState: ConnectionState) => {
      console.log('🔗 Connection state changed:', connectionState)
      if (connectionState === ConnectionState.Connected) {
        setIsConnected(true)
        setConnectionError(null)
      } else if (connectionState === ConnectionState.Reconnecting) {
        console.log('🔄 Reconnecting to LiveKit room...')
      } else if (connectionState === ConnectionState.Disconnected) {
        console.error('❌ Connection failed')
        setConnectionError('Connection failed. Please try again.')
        setIsConnected(false)
      }
    })

    // Set up transcription handler
    room.registerTextStreamHandler('lk.transcription', async (reader, participantInfo) => {
      try {
        const message = await reader.readAll()
        const isFinal = reader.info.attributes?.['lk.transcription_final'] === 'true'
        const trackId = reader.info.attributes?.['lk.transcribed_track_id']
        
        console.log('📝 Transcription received:', {
          speaker: participantInfo.identity,
          text: message,
          isFinal,
          trackId
        })

        // Update transcriptions state
        const transcriptionId = `${participantInfo.identity}-${Date.now()}`
        const newTranscription = {
          id: transcriptionId,
          text: message,
          speaker: participantInfo.identity,
          participantId: participantInfo.identity,
          isFinal,
          timestamp: new Date(),
          trackId
        }

        setTranscriptions(prev => {
          // If it's interim, replace the last interim transcription from the same speaker
          if (!isFinal) {
            const filteredPrev = prev.filter(t => 
              !(t.participantId === participantInfo.identity && !t.isFinal)
            )
            return [...filteredPrev, newTranscription]
          }
          
          // If it's final, add it and remove any interim from same speaker
          const filteredPrev = prev.filter(t => 
            !(t.participantId === participantInfo.identity && !t.isFinal)
          )
          return [...filteredPrev, newTranscription]
        })

        // Update current transcript display
        if (!isFinal) {
          setCurrentTranscript(`${participantInfo.identity}: ${message}`)
        } else {
          setCurrentTranscript('')
          
          // Save final transcription to database
          await saveTranscriptionToHistory({
            roomName: roomName,
            creatorId: creatorId,
            participantId: participantInfo.identity,
            text: message,
            trackId,
            timestamp: new Date()
          })
        }
      } catch (error) {
        console.error('📝❌ Error handling transcription:', error)
      }
    })
  }

  const setupParticipantEvents = (participant: RemoteParticipant) => {
    participant.on(ParticipantEvent.TrackMuted, (trackPub) => {
      updateParticipantList(roomRef.current!)
    })

    participant.on(ParticipantEvent.TrackUnmuted, (trackPub) => {
      updateParticipantList(roomRef.current!)
    })
  }

  const updateParticipantList = (room: ExtendedRoom) => {
    const allParticipants: ParticipantInfo[] = []
    
    // Add local participant
    if (room.localParticipant) {
      allParticipants.push({
        identity: room.localParticipant.identity,
        name: room.localParticipant.name || 'You',
        isCreator: false, // Will be updated based on metadata
        audioEnabled: !room.localParticipant.isMicrophoneEnabled === false
      })
    }

    // Add remote participants
    room.remoteParticipants.forEach((participant) => {
      const metadata = participant.metadata ? JSON.parse(participant.metadata) : {}
      allParticipants.push({
        identity: participant.identity,
        name: participant.name || 'User',
        isCreator: metadata.isCreator || false,
        audioEnabled: participant.isMicrophoneEnabled !== false
      })
    })

    setParticipants(allParticipants)
  }

  const enableMicrophone = async (room: ExtendedRoom) => {
    try {
      console.log('🎤 Requesting microphone permissions...')
      
      // First request microphone permissions explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      console.log('✅ Microphone permissions granted')
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop())
      
      // Now enable microphone in LiveKit
      await room.localParticipant.setMicrophoneEnabled(true)
      setIsMuted(false)
      
      console.log('✅ Microphone enabled in LiveKit room')
    } catch (error) {
      console.error('❌ Failed to enable microphone:', error)
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('Microphone access denied. Please allow microphone permissions in your browser settings.')
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found. Please check your audio device settings.')
        } else {
          console.error('Microphone error details:', error.message)
        }
      }
    }
  }

  const toggleMicrophone = async () => {
    if (!room) return

    try {
      const enabled = room.localParticipant.isMicrophoneEnabled
      await room.localParticipant.setMicrophoneEnabled(!enabled)
      setIsMuted(enabled)
      console.log('🎤 Microphone', enabled ? 'disabled' : 'enabled')
    } catch (error) {
      console.error('❌ Failed to toggle microphone:', error)
    }
  }

  const toggleSpeaker = () => {
    const newMuted = !isSpeakerMuted
    setIsSpeakerMuted(newMuted)
    
    // Mute/unmute all audio elements
    audioElementsRef.current.forEach((audioElement) => {
      audioElement.muted = newMuted
    })
  }

  const endCall = async () => {
    try {
      console.log('🔴 Ending call - killing LiveKit session')
      setCallState('ended')
      
      // First disconnect locally to stop audio immediately
      if (roomRef.current) {
        roomRef.current.disconnect()
      }
      
      // Then notify backend to kill the agent session
      if (roomName) {
        try {
          console.log('🔴 Requesting server to end session:', roomName)
          const response = await fetch('/api/voice/end-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roomName: roomName,
              reason: 'User ended call'
            })
          })
          
          const result = await response.json()
          
          if (response.ok) {
            console.log('✅ Successfully ended LiveKit session:', result)
          } else {
            console.warn('⚠️ Failed to end LiveKit session:', result)
          }
        } catch (endSessionError) {
          console.error('❌ Error ending session:', endSessionError)
        }
      }
      
      // Clean up local resources
      cleanup()
    } catch (error) {
      console.error('❌ Error ending call:', error)
      // Still cleanup even if ending session fails
      cleanup()
    } finally {
      onClose()
    }
  }

  const cleanup = () => {
    console.log('🧹 Cleaning up voice call resources for room:', roomName)
    
    // Reset connection state refs
    isConnectingRef.current = false
    
    // Clean up pre-connected audio stream
    if (window.preConnectedAudioStream) {
      try {
        window.preConnectedAudioStream.getTracks().forEach(track => track.stop())
        window.preConnectedAudioStream = undefined
        console.log('✅ Pre-connected audio stream cleaned up')
      } catch (streamError) {
        console.warn('⚠️ Error cleaning up pre-connected stream:', streamError)
      }
    }
    
    // Clear any pending state change timeouts
    if (stateChangeTimeout) {
      clearTimeout(stateChangeTimeout)
      setStateChangeTimeout(null)
    }
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }


    if (roomRef.current) {
      console.log('🔌 Disconnecting from LiveKit room:', roomName)
      
      // Clear connection heartbeat interval
      if (roomRef.current.connectionHeartbeat) {
        clearInterval(roomRef.current.connectionHeartbeat)
        console.log('💓 Connection heartbeat cleared')
      }
      
      // Clean up lifecycle listeners
      if (roomRef.current.lifecycleCleanup) {
        roomRef.current.lifecycleCleanup()
        console.log('🔔 Lifecycle listeners cleaned up')
      }
      
      try {
        roomRef.current.disconnect()
      } catch (disconnectError) {
        console.warn('⚠️ Error disconnecting room:', disconnectError)
      }
      roomRef.current = null
    }

    // Clean up audio elements and their event listeners
    audioElementsRef.current.forEach((audioElement) => {
      try {
        // Call custom cleanup if it exists
        if ((audioElement as any)._cleanup) {
          (audioElement as any)._cleanup()
        }
        audioElement.pause()
        audioElement.src = ''
        audioElement.remove()
      } catch (audioError) {
        console.warn('⚠️ Error cleaning up audio element:', audioError)
      }
    })
    audioElementsRef.current.clear()

    setRoom(null)
    setIsConnected(false)
    setIsConnecting(false)
    setCallState('ended')
    setAIState('idle')
    setIsAISpeaking(false)
    callStartTimeRef.current = null
    
    console.log('✅ Voice call cleanup completed for room:', roomName)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    if (!roomRef.current || isRecording) {
      return
    }

    try {
      // Get the local audio track from LiveKit
      const localParticipant = roomRef.current.localParticipant
      const audioTrack = localParticipant.getTrackPublications().find(
        (pub) => pub.kind === Track.Kind.Audio && pub.track instanceof LocalAudioTrack
      )?.track as LocalAudioTrack | undefined

      if (!audioTrack) {
        console.error('🎙️ No local audio track found')
        return
      }

      // Get the MediaStreamTrack from LiveKit
      const mediaStreamTrack = audioTrack.mediaStreamTrack
      if (!mediaStreamTrack) {
        console.error('🎙️ No MediaStreamTrack available')
        return
      }

      // Create a MediaStream and MediaRecorder
      const stream = new MediaStream([mediaStreamTrack])
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      setMediaRecorder(recorder)
      setIsRecording(true)
      recorder.start()
      console.log('🎙️ Recording started')

    } catch (error) {
      console.error('🎙️ Error starting recording:', error)
    }
  }

  const stopRecordingAndProcess = async () => {
    if (!mediaRecorder || !isRecording) {
      console.log('🎙️ No active recording to stop')
      return
    }

    const audioChunks: Blob[] = []
    
    // Set up handlers for when recording stops
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      console.log('🎙️ Audio recording stopped, processing...')
      setIsRecording(false)
      setMediaRecorder(null)
      
      if (audioChunks.length === 0) {
        console.error('🎙️ No audio data captured')
        // Fallback
        setAiQuery('Hello, can you help me with air fryer recipes?')
        setTimeout(() => handleAIQuery(), 100)
        return
      }

      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' })
      console.log('🎙️ Audio blob created:', audioBlob.size, 'bytes')

      // Send to OpenAI Whisper for transcription
      try {
        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.webm')

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Transcription failed: ${response.statusText}`)
        }

        const result = await response.json()
        const transcript = result.transcription || result.text || result.transcript
        
        if (transcript && transcript.trim() && transcript !== '.') {
          console.log('🎙️ Transcribed:', transcript)
          setAiQuery(transcript.trim())
          setTimeout(() => handleAIQuery(), 100)
        } else {
          console.log('🎙️ Empty transcription, using fallback')
          setAiQuery('Hello, can you help me with air fryer recipes?')
          setTimeout(() => handleAIQuery(), 100)
        }

      } catch (transcriptionError) {
        console.error('🎙️ Transcription error:', transcriptionError)
        // Fallback
        setAiQuery('Hello, can you help me with air fryer recipes?')
        setTimeout(() => handleAIQuery(), 100)
      }
    }

    // Stop the recording
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
  }

  const handleAIQuery = async () => {
    if (!aiQuery.trim() || isAIProcessing) return

    setIsAIProcessing(true)
    setAiResponse('')
    setAIState('processing')
    setCallState('listening')

    try {
      // Try the main voice agent first, fallback to test API
      let response = await fetch('/api/voice-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: aiQuery,
          creatorId,
          roomName
        })
      })

      // If main API fails, try test API
      if (!response.ok) {
        console.log('🔄 Main API failed, trying test API...')
        response = await fetch('/api/voice-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: aiQuery,
            creatorId
          })
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('🤖 Voice agent response:', data)
      
      setAiResponse(data.response || data.cleanText || 'No response received')

      // If audio data is available, play it
      if (data.audioData) {
        console.log('🎵 Playing voice response audio')
        try {
          const audioBlob = new Blob([
            new Uint8Array(atob(data.audioData).split('').map(c => c.charCodeAt(0)))
          ], { type: 'audio/mpeg' })
          
          const audioUrl = URL.createObjectURL(audioBlob)
          const audio = new Audio(audioUrl)
          
          // Set states BEFORE playing for immediate UI feedback
          setCallState('talking')
          setAIState('speaking')
          setIsAISpeaking(true)
          
          audio.onloadstart = () => {
            console.log('🎵 Audio loading started')
            setCallState('talking')
            setAIState('speaking')
            setIsAISpeaking(true)
          }
          
          audio.onplaying = () => {
            console.log('🎵 Audio actually playing')
            setCallState('talking')
            setAIState('speaking')
            setIsAISpeaking(true)
          }
          
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl)
            setCallState('listening')
            setAIState('idle')
            setIsAISpeaking(false)
            console.log('🎵 Audio playback completed')
          }
          
          audio.onerror = (e) => {
            console.error('🔊 Audio playback error:', e)
            setCallState('listening')
            setAIState('idle')
            setIsAISpeaking(false)
            URL.revokeObjectURL(audioUrl)
          }
          
          audio.play().then(() => {
            console.log('🎵 Audio started playing')
          }).catch((error) => {
            console.error('🔊 Audio play failed:', error)
            setCallState('listening')
            setAIState('idle')
            setIsAISpeaking(false)
            URL.revokeObjectURL(audioUrl)
          })
        } catch (audioError) {
          console.error('🔊 Audio processing error:', audioError)
          setCallState('listening')
          setAIState('idle')
          setIsAISpeaking(false)
        }
      } else {
        console.log('🔇 No audio data in response')
        setCallState('listening')
        setAIState('idle')
        setIsAISpeaking(false)
      }

    } catch (error) {
      console.error('❌ AI Query failed:', error)
      setAiResponse('Sorry, I could not process your request at the moment.')
    } finally {
      setIsAIProcessing(false)
      if (aiState === 'processing') {
        setAIState('idle')
        setCallState('listening')
      }
    }
  }

  const clearAIChat = () => {
    setAiQuery('')
    setAiResponse('')
  }

  const testVoiceSystem = async () => {
    setDebugInfo('Testing voice system...')
    setIsAIProcessing(true)
    
    try {
      // Test the debug endpoint
      const debugResponse = await fetch('/api/debug/voice')
      const debugData = await debugResponse.json()
      console.log('🔍 Debug info:', debugData)
      
      // Test TTS
      const ttsResponse = await fetch('/api/debug/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello, this is a test of the voice system.' })
      })
      
      if (!ttsResponse.ok) {
        const errorData = await ttsResponse.json()
        throw new Error(`TTS Error: ${errorData.error}`)
      }
      
      const ttsData = await ttsResponse.json()
      console.log('🎵 TTS test result:', ttsData)
      
      if (ttsData.audioData) {
        // Play the test audio
        const audioBlob = new Blob([
          new Uint8Array(atob(ttsData.audioData).split('').map(c => c.charCodeAt(0)))
        ], { type: 'audio/mpeg' })
        
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        
        audio.onended = () => URL.revokeObjectURL(audioUrl)
        await audio.play()
        
        setDebugInfo('✅ Voice test successful! Audio should be playing.')
        setAiResponse('Voice test completed successfully!')
      } else {
        setDebugInfo('❌ No audio data received')
      }
      
    } catch (error) {
      console.error('❌ Voice test failed:', error)
      setDebugInfo(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsAIProcessing(false)
    }
  }

  // Modern UI component
  const renderCallInterface = () => {
    // Don't show ended state during initial connection
    if (callState === 'ended' && !isConnecting) {
      return (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
          {/* Top bar with call info */}
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
            <div className="bg-gray-100 rounded-full px-6 py-3 flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="h-4 w-4" />
                <span className="font-medium">{formatDuration(callDuration)}</span>
              </div>
              <div className="w-px h-4 bg-gray-300"></div>
              <div className="text-gray-700">
                <span>Call ended</span>
              </div>
            </div>
          </div>
          
          {/* Main content */}
          <div className="flex flex-col items-center justify-center flex-1">
            {/* Avatar */}
            <div className="relative mb-8">
              <div className="w-48 h-48 rounded-full mx-auto flex items-center justify-center shadow-lg overflow-hidden">
                {creatorImage ? (
                  <Image
                    src={creatorImage}
                    alt={creatorName}
                    width={192}
                    height={192}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                    <span className="text-white text-6xl font-bold">
                      {creatorName.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-6">{creatorName}</h2>
            
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-gray-100 text-gray-600 text-lg mb-12">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
              Call Ended
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-4 mb-8">
              <Button 
                variant="outline" 
                className="px-6 py-3 text-gray-700 border-gray-200 hover:bg-gray-50"
                onClick={() => console.log('View Transcript')}
              >
                <FileText className="h-5 w-5 mr-2" />
                View Transcript
              </Button>
              <Button 
                variant="outline" 
                className="px-6 py-3 text-gray-700 border-gray-200 hover:bg-gray-50"
                onClick={() => console.log('Share Call')}
              >
                <Share className="h-5 w-5 mr-2" />
                Share Call
              </Button>
            </div>
            
            {/* Bottom buttons */}
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="px-8 py-4 rounded-full bg-gray-100 border-0 text-gray-700"
                onClick={() => console.log('Chat')}
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Chat
              </Button>
              <Button 
                className="px-8 py-4 rounded-full bg-green-500 hover:bg-green-600 text-white border-0"
                onClick={() => {
                  // Restart the call by resetting states and reconnecting
                  setCallState('connecting')
                  setIsConnecting(true)
                  setIsConnected(false)
                  setConnectionError(null)
                  connectToRoom()
                }}
              >
                <Phone className="h-5 w-5 mr-2" />
                Call Again
              </Button>
            </div>
          </div>
          
          {/* Back button at bottom */}
          <div className="absolute bottom-8 left-8">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="rounded-full w-12 h-12 p-0 border-gray-300"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )
    }
    
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        {/* Top bar with call timer and remaining time */}
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-100 rounded-full px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700">
              <Phone className="h-4 w-4" />
              <span className="font-medium">{isConnected ? formatDuration(callDuration) : '00:00'}</span>
            </div>
            {callDuration > 0 && (
              <>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className={`flex items-center gap-2 ${
                  VOICE_CALL_CONFIG.shouldShowWarning(callDuration) ? 'text-orange-600' : 'text-gray-700'
                }`}>
                  {VOICE_CALL_CONFIG.shouldShowWarning(callDuration) && (
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  )}
                  <span className="font-medium">{VOICE_CALL_CONFIG.formatRemainingTime(callDuration)}</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex flex-col items-center justify-center flex-1">
          {/* Avatar with animation */}
          <div className="relative mb-8 w-72 h-72 flex items-center justify-center">
            {/* Subtle circular ring animation */}
            {(callState === 'talking' || isAISpeaking) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="#fed7aa"
                    strokeWidth="1"
                    opacity="0.3"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="#fb923c"
                    strokeWidth="2"
                    strokeDasharray="12 8"
                    opacity="0.7"
                    transform="rotate(0 50 50)"
                    style={{ 
                      animation: 'spin 3s linear infinite',
                      transformOrigin: '50% 50%'
                    }}
                  />
                </svg>
              </div>
            )}
            
            {/* Avatar */}
            <div className={`w-64 h-64 rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden relative z-10 ${
              callState === 'talking' || isAISpeaking 
                ? 'scale-105' 
                : callState === 'thinking' || aiState === 'processing'
                ? 'animate-pulse scale-102'
                : ''
            }`}>
              {creatorImage ? (
                <Image
                  src={creatorImage}
                  alt={creatorName}
                  width={256}
                  height={256}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center rounded-full">
                  <span className="text-white text-7xl font-bold">
                    {creatorName.charAt(0)}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <h2 className="text-4xl font-bold text-gray-900 mb-6">{creatorName}</h2>
          
          {/* Warning message when time is about to expire */}
          {VOICE_CALL_CONFIG.shouldShowWarning(callDuration) && (
            <div className="mb-6 px-6 py-3 bg-orange-50 border border-orange-200 rounded-full">
              <div className="flex items-center justify-center text-orange-700">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span className="font-medium">{VOICE_CALL_CONFIG.EXPIRY_WARNING_MESSAGE}</span>
              </div>
            </div>
          )}
          
          {/* Status indicator */}
          <div className="mb-16">
            {isConnecting ? (
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-blue-100 text-blue-700">
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                <span className="font-medium text-lg">Connecting...</span>
              </div>
            ) : callState === 'talking' || isAISpeaking ? (
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-orange-100 text-orange-700">
                <div className="w-3 h-3 bg-orange-500 rounded-full mr-3 animate-pulse"></div>
                <span className="font-medium text-lg">Talking</span>
              </div>
            ) : callState === 'thinking' || aiState === 'processing' ? (
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-purple-100 text-purple-700">
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                <span className="font-medium text-lg">Thinking...</span>
              </div>
            ) : callState === 'listening' ? (
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-green-100 text-green-700">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
                <span className="font-medium text-lg">Listening</span>
              </div>
            ) : (
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-gray-100 text-gray-600">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
                <span className="font-medium text-lg">Ready</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom controls */}
        {isConnected && (
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center justify-center gap-8">
              {/* Microphone Toggle */}
              <Button
                onClick={toggleMicrophone}
                variant={isMuted ? "default" : "outline"}
                className={`rounded-full w-20 h-20 border-2 transition-all shadow-lg ${
                  isMuted 
                    ? 'bg-red-500 border-red-500 hover:bg-red-600' 
                    : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                }`}
              >
                {isMuted ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-gray-700" />}
              </Button>
              
              {/* End Call Button */}
              <Button
                onClick={endCall}
                className="rounded-full w-20 h-20 bg-red-500 hover:bg-red-600 text-white border-0 shadow-lg"
                disabled={isConnecting}
              >
                <PhoneOff className="h-8 w-8" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Back button at bottom left */}
        <div className="absolute bottom-8 left-8">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="rounded-full w-12 h-12 p-0 border-gray-300 bg-white hover:bg-gray-50"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Video Display Overlay */}
        {displayedVideo && (
          <div 
            className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 w-80"
            style={{ zIndex: 9999 }}
          >
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-900">Recipe Video</span>
                </div>
                <button
                  onClick={() => {
                    console.log('🎥 Closing video overlay')
                    setDisplayedVideo(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="relative mb-3">
                <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                  <iframe
                    src={`https://www.youtube.com/embed/${displayedVideo.videoId}?rel=0&modestbranding=1`}
                    title={displayedVideo.videoTitle}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 text-sm mb-1 max-w-full overflow-hidden">
                  <span className="block truncate">
                    {displayedVideo.videoTitle}
                  </span>
                </h4>
                <p className="text-xs text-gray-500">
                  {displayedVideo.recipeName} recipe
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="p-6 w-full max-w-lg mx-auto relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <Phone className="h-12 w-12 mx-auto mb-2" />
              <h3 className="font-semibold">Connection Failed</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">{connectionError}</p>
            <div className="space-x-2">
              <Button onClick={connectToRoom} size="sm">
                Try Again
              </Button>
              <Button onClick={onClose} variant="outline" size="sm">
                Close
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return renderCallInterface()
}