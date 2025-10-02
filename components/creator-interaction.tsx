'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Send, MessageCircle, Phone, ChevronUp, MoreHorizontal, Paperclip, FileText, Share, Link as LinkIcon, ThumbsUp, X, Heart, Copy, History, ChevronDown, User, LogOut, Volume2, VolumeX, Mic } from 'lucide-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import VoiceCallInterface from './voice-call-interface'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  messageType?: string // "text", "voice", "voice_transcript"
  metadata?: string | null
  citations?: Citation[]
  createdAt: Date
  isStreaming?: boolean
}

interface Citation {
  videoTitle: string
  videoId: string
  startTime?: number
  endTime?: number
  content: string
}

interface CreatorInteractionProps {
  creator: {
    id: string
    username: string
    displayName?: string
    display_name?: string
    bio?: string | null
    profileImage?: string | null
    profile_image?: string | null
    youtubeChannelUrl?: string | null
  }
  isSubscribed: boolean
  messagesUsed: number
  session: any | null
}

interface SuggestedQuestion {
  question: string
  category: string
  confidence: number
  basedOn: string[]
}

interface ChatHistorySession {
  id: string
  createdAt: Date
  updatedAt: Date
  messages: {
    id: string
    role: string
    content: string
    messageType?: string
    metadata?: string | null
    createdAt: Date
  }[]
}

export default function CreatorInteraction({
  creator,
  isSubscribed,
  messagesUsed,
  session
}: CreatorInteractionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [messageCount, setMessageCount] = useState(49)
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(true)

  // Anonymous user session tracking
  const [anonymousSessionId, setAnonymousSessionId] = useState<string>()
  const [anonymousMessageCount, setAnonymousMessageCount] = useState(0)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [lastResponseBlurred, setLastResponseBlurred] = useState(false)
  const [showAllCitations, setShowAllCitations] = useState<string | null>(null)
  const [showActionCenter, setShowActionCenter] = useState(false)
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set())
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatHistorySession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map())
  const [showVoiceCall, setShowVoiceCall] = useState(false)
  const [currentRoomName, setCurrentRoomName] = useState<string | null>(null)
  const [pipVideo, setPipVideo] = useState<{
    videoId: string
    startTime: number
    title: string
  } | null>(null)

  // Ref to maintain typing animation state across re-renders
  const typingStateRef = useRef<{
    content: string
    citations: Citation[]
    currentIndex: number
    isActive: boolean
    messageId: string
    originalMessageId: string // Track the original ID to handle updates
  } | null>(null)

  // Ref to store pending message update
  const pendingMessageUpdateRef = useRef<{ messageId: string, createdAt: string } | null>(null)

  // Debug showVoiceCall state changes
  useEffect(() => {
    console.log('🎤 showVoiceCall state changed to:', showVoiceCall)
  }, [showVoiceCall])

  // Initialize anonymous session tracking for non-authenticated users
  useEffect(() => {
    if (!session?.user?.id) {
      // Generate or retrieve anonymous session ID
      const storageKey = `anonymous_session_${creator.id}`
      const storedSession = localStorage.getItem(storageKey)

      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession)
          setAnonymousSessionId(sessionData.sessionId)
          setAnonymousMessageCount(sessionData.messageCount || 0)
          console.log('📱 Retrieved anonymous session:', sessionData)

          // If user already reached limit, show modal and blur immediately
          if (sessionData.messageCount >= 2) {
            console.log('📱 User already reached limit on page load, showing modal')
            setLastResponseBlurred(true)
            setTimeout(() => {
              setShowRegistrationModal(true)
            }, 1000) // Small delay to let page load
          }
        } catch (error) {
          console.error('Error parsing stored session:', error)
          // Create new session if parsing fails
          const newSessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          setAnonymousSessionId(newSessionId)
          localStorage.setItem(storageKey, JSON.stringify({ sessionId: newSessionId, messageCount: 0 }))
          console.log('📱 Created new anonymous session after error:', newSessionId)
        }
      } else {
        // Create new anonymous session
        const newSessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        setAnonymousSessionId(newSessionId)
        localStorage.setItem(storageKey, JSON.stringify({ sessionId: newSessionId, messageCount: 0 }))
        console.log('📱 Created new anonymous session:', newSessionId)
      }
    }
  }, [session?.user?.id, creator.id])

  // Function to update anonymous session data
  const updateAnonymousSession = (messageCount: number) => {
    if (!session?.user?.id && anonymousSessionId) {
      const storageKey = `anonymous_session_${creator.id}`
      const sessionData = { sessionId: anonymousSessionId, messageCount }
      localStorage.setItem(storageKey, JSON.stringify(sessionData))
      setAnonymousMessageCount(messageCount)
      console.log('📱 Updated anonymous session:', sessionData)
    }
  }

  // Typing animation function using ref to persist state across re-renders
  const startTypingAnimation = (content: string, citations: Citation[], messageId: string, onComplete?: () => void) => {
    // Stop any existing animation
    if (typingStateRef.current) {
      typingStateRef.current.isActive = false
    }

    // Initialize new typing state
    typingStateRef.current = {
      content,
      citations,
      currentIndex: 0,
      isActive: true,
      messageId,
      originalMessageId: messageId // Store the original ID
    }

    const typingSpeed = 15 // milliseconds per character

    const typeText = () => {
      const state = typingStateRef.current
      if (!state || !state.isActive) {
        return
      }

      const currentText = state.content.slice(0, state.currentIndex + 1)
      const isComplete = state.currentIndex + 1 >= state.content.length

      // Find the message by original ID or current ID
      const findAndUpdateMessage = (updateFn: (msg: ChatMessage) => ChatMessage) => {
        setMessages(prev => {
          let messageFound = false
          const updated = prev.map(msg => {
            if (msg.id === state.messageId || msg.id === state.originalMessageId) {
              messageFound = true
              // Update the messageId in state if it has changed
              if (msg.id !== state.messageId) {
                console.log(`🔄 Message ID changed from ${state.messageId} to ${msg.id}`)
                state.messageId = msg.id
              }
              return updateFn(msg)
            }
            return msg
          })

          if (!messageFound) {
            console.warn(`⚠️ Message not found with ID ${state.messageId} or ${state.originalMessageId}`)
          }

          return updated
        })
      }

      if (isComplete) {
        // Animation is complete - render full content immediately
        console.log('🔤 Typing animation completed!')
        state.isActive = false

        findAndUpdateMessage(msg => ({
          ...msg,
          content: state.content, // Use full content, not currentText
          citations: state.citations,
          isStreaming: false
        }))

        console.log(`🔤 Final update - isStreaming set to FALSE for message ${state.messageId}`)

        // Call onComplete callback if provided
        if (onComplete) {
          console.log('🔄 Calling onComplete callback after typing animation')
          onComplete()
        }

        return // Exit early to prevent further processing
      }

      // Animation still in progress - render partial content
      findAndUpdateMessage(msg => ({
        ...msg,
        content: currentText,
        citations: [],
        isStreaming: true
      }))

      state.currentIndex++

      if (state.isActive) {
        setTimeout(typeText, typingSpeed)
      }
    }

    // Start the animation
    typeText()
  }

  // Function to directly start voice call
  const startVoiceCall = async () => {
    console.log('🎤 Starting voice call directly...', { 
      creatorId: creator.id, 
      creatorName: creator.display_name,
      userId: session?.user?.id 
    })
    
    if (!session?.user?.id) {
      console.error('❌ Cannot start call: User not authenticated')
      alert('Please sign in to start a voice call')
      return
    }
    
    try {
      // Show loading state immediately for better UX
      setShowVoiceCall(true)
      console.log('🎤 Called setShowVoiceCall(true) - showing loading state')
      
      // Run session cleanup asynchronously (don't wait for it)
      console.log('🧹 Starting session cleanup in background...')
      fetch('/api/voice/cleanup-user-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: session.user.id,
          creatorId: creator.id 
        })
      }).then(async (cleanupResponse) => {
        if (cleanupResponse.ok) {
          const cleanupResult = await cleanupResponse.json()
          console.log('✅ Session cleanup completed:', cleanupResult)
        } else {
          console.warn('⚠️ Session cleanup failed, but continuing with new call')
        }
      }).catch((cleanupError) => {
        console.warn('⚠️ Session cleanup error, but continuing:', cleanupError)
      })
      
      // Generate unique room name immediately
      const roomName = `voice_call_${session.user.id}_${creator.id}_${Date.now()}`
      setCurrentRoomName(roomName)
      console.log('🎤 Generated room name:', roomName)
      
      // Get access token for permissions
      const tokenResponse = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, creatorId: creator.id })
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json()
        throw new Error(error.error || 'Failed to get access token')
      }

      console.log('✅ Voice call token obtained, interface already showing')
      
    } catch (error) {
      console.error('❌ Failed to start voice call:', error)
      setShowVoiceCall(false) // Hide interface on error
      alert(`Failed to start voice call: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // Handler functions for hover actions
  const handleLikeMessage = (messageId: string) => {
    setLikedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      // Remove citation numbers from content before copying
      const cleanContent = content.replace(/\[(\d+)\]/g, '')
      await navigator.clipboard.writeText(cleanContent)
      
      // Show visual feedback
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000) // Hide after 2 seconds
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  // Fetch chat history
  const fetchChatHistory = async () => {
    if (!session?.user?.id || historyLoading) return
    
    setHistoryLoading(true)
    try {
      const response = await fetch(`/api/chat/history?creatorId=${creator.id}`)
      const data = await response.json()
      
      if (data.success) {
        setChatHistory(data.sessions || [])
      }
    } catch (error) {
      console.error('Error fetching chat history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Handle chat history button click
  const handleChatHistoryClick = () => {
    setShowChatHistory(true)
    fetchChatHistory()
  }

  // Handle selecting a chat session from history
  const handleSelectChatSession = (session: ChatHistorySession) => {
    // Load the selected chat session
    const formattedMessages: ChatMessage[] = session.messages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      messageType: msg.messageType,
      metadata: msg.metadata,
      createdAt: new Date(msg.createdAt),
      citations: [] // Citations would need to be fetched separately if needed
    }))
    
    setMessages(formattedMessages)
    setSessionId(session.id)
    setShowChatHistory(false)
  }
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleReadAloud = async (messageId: string, content: string) => {
    try {
      // If this message is currently playing, stop it
      if (playingAudio === messageId) {
        const audio = audioElements.get(messageId)
        if (audio) {
          audio.pause()
          audio.currentTime = 0
          audio.src = '' // Clear the src to stop loading
        }
        setPlayingAudio(null)
        return
      }

      // Stop any other playing audio
      if (playingAudio) {
        const currentAudio = audioElements.get(playingAudio)
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
          currentAudio.src = '' // Clear the src to stop loading
        }
        setPlayingAudio(null)
      }

      setPlayingAudio(messageId)

      // Check if we already have audio for this message
      let audio = audioElements.get(messageId)
      
      if (!audio) {
        // Generate new audio
        console.log('🎵 Generating TTS for message:', messageId)
        
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: content,
            creatorId: creator.id
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('TTS API error:', errorText)
          throw new Error('Failed to generate audio')
        }

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        
        audio = new Audio(audioUrl)
        
        // Set up event listeners
        audio.onended = () => {
          console.log('🎵 Audio ended for message:', messageId)
          setPlayingAudio(null)
        }
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e)
          setPlayingAudio(null)
        }

        audio.onpause = () => {
          console.log('🎵 Audio paused for message:', messageId)
          if (playingAudio === messageId) {
            setPlayingAudio(null)
          }
        }
        
        // Store the audio element
        setAudioElements(prev => new Map(prev.set(messageId, audio!)))
      }

      // Play the audio
      console.log('🎵 Starting audio playback for message:', messageId)
      await audio.play()
      
    } catch (error) {
      console.error('Error with read aloud:', error)
      setPlayingAudio(null)
      alert('Sorry, there was an error reading the message aloud.')
    }
  }

  // Utility function to format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Click outside handler for user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Load suggested questions on mount
  useEffect(() => {
    const fetchSuggestedQuestions = async () => {
      if (!creator.id) return
      
      setQuestionsLoading(true)
      try {
        // First try to get custom questions
        const customResponse = await fetch(`/api/creator/custom-questions?creatorId=${creator.id}`)
        const customData = await customResponse.json()
        
        console.log('📝 Custom questions response:', customData)
        
        if (customData.success && customData.questions && customData.questions.length > 0) {
          // Use custom questions if they exist
          console.log('📝 Using custom suggested questions:', customData.questions)
          // Transform custom questions to match expected format
          const formattedQuestions = customData.questions.map((q: any) => ({
            question: q.question,
            category: 'custom',
            confidence: 1.0,
            basedOn: q.description ? [q.description] : []
          }))
          setSuggestedQuestions(formattedQuestions.slice(0, 5)) // Take top 5 questions
        } else {
          // Fall back to RAG-generated questions if no custom questions exist
          console.log('📝 No custom questions found, falling back to RAG-generated questions')
          const isDev = process.env.NODE_ENV === 'development'
          const debugParam = isDev ? '&debug=true' : ''
          const ragResponse = await fetch(`/api/creator/suggested-questions?creatorId=${creator.id}${debugParam}`)
          const ragData = await ragResponse.json()
          
          if (ragData.success && ragData.questions) {
            console.log('📝 Using RAG-generated questions:', ragData.questions)
            setSuggestedQuestions(ragData.questions.slice(0, 5)) // Take top 5 questions
          } else {
            console.log('❌ No questions received from either source')
          }
        }
      } catch (error) {
        console.error('Error fetching suggested questions:', error)
        // Use fallback questions on error
        setSuggestedQuestions([
          {
            question: "What's your best advice for someone starting in your field?",
            category: "advice",
            confidence: 0.7,
            basedOn: ["general"]
          },
          {
            question: "What's the biggest mistake you see people make?",
            category: "lessons",
            confidence: 0.7,
            basedOn: ["general"]
          },
          {
            question: "How did you get started with your work?",
            category: "journey",
            confidence: 0.7,
            basedOn: ["general"]
          }
        ])
      } finally {
        setQuestionsLoading(false)
      }
    }

    fetchSuggestedQuestions()
  }, [creator.id])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
    }
  }, [input])

  const sendMessage = async () => {
    console.log('🚀 sendMessage called!', {
      input: input,
      inputLength: input.trim().length,
      loading,
      hasSession: !!session?.user,
      showVoiceCall,
      anonymousMessageCount,
      isAnonymous: !session?.user?.id
    })

    if (!input.trim() || loading) return

    // For anonymous users, check message limit
    // Count: user message (1) + AI response (1) = 2 total exchanges
    // After 1 complete exchange (count = 2), block the next user message
    if (!session?.user?.id) {
      if (anonymousMessageCount >= 2) {
        console.log('📱 Anonymous user reached message limit, current count:', anonymousMessageCount)
        setShowRegistrationModal(true)
        return
      }
    }

    const currentInput = input
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      createdAt: new Date()
    }

    // Create streaming AI message placeholder
    const streamingMessageId = (Date.now() + 1).toString()
    const streamingMessage: ChatMessage = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      citations: [],
      createdAt: new Date(),
      isStreaming: true
    }

    setMessages(prev => [...prev, userMessage, streamingMessage])
    setInput('')
    setLoading(true)

    // Update message counting based on user type
    if (session?.user?.id) {
      // Authenticated user - use existing logic
      setMessageCount(prev => prev - 1)
    } else {
      // Anonymous user - increment anonymous message count (user message = +1)
      const newCount = anonymousMessageCount + 1
      updateAnonymousSession(newCount)
    }

    // Close voice call modal when user chooses to send a message instead
    if (showVoiceCall) {
      console.log('🔄 Closing voice call modal - user chose to send message instead')
      setShowVoiceCall(false)
    }

    try {
      console.log('📡 Making streaming API request to /api/chat/stream...')
      console.log('📡 Request payload:', { message: currentInput, creatorId: creator.id, sessionId })

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          creatorId: creator.id,
          sessionId: session?.user?.id ? sessionId : undefined,
          anonymousSessionId: !session?.user?.id ? anonymousSessionId : undefined
        }),
      })

      console.log('📡 Streaming response received:', { status: response.status, ok: response.ok })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''
      let finalCitations: Citation[] = []
      let finalMessageId = ''
      let finalCreatedAt = ''

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6).trim()
                  if (jsonStr === '[DONE]') continue

                  const data = JSON.parse(jsonStr)
                  console.log('📦 Streaming data received:', data)

                  if (data.type === 'session' && !sessionId) {
                    console.log('🔗 Setting session ID:', data.sessionId)
                    setSessionId(data.sessionId)
                  } else if (data.type === 'complete') {
                    // Final response with complete content and citations
                    accumulatedContent = data.response
                    finalCitations = data.citations || []

                    console.log('🔤 Full response received:', accumulatedContent)
                    console.log('🔤 Citations received:', finalCitations?.length || 0)

                    // For anonymous users, handle limit immediately when response is complete
                    if (!session?.user?.id) {
                      const newCount = anonymousMessageCount + 1
                      updateAnonymousSession(newCount)
                      console.log('📱 Anonymous response completed, count now:', newCount)

                      if (newCount === 2) {
                        console.log('📱 LIMIT REACHED! Setting blur and showing modal immediately')
                        setLastResponseBlurred(true)
                        // Show modal immediately, don't wait for animation
                        setTimeout(() => {
                          setShowRegistrationModal(true)
                        }, 500) // Short delay just to let the message appear
                      }
                    }

                    // Start the robust typing animation using ref-based state management
                    startTypingAnimation(accumulatedContent, finalCitations, streamingMessageId, () => {
                      // Apply pending message update after typing animation completes
                      const pendingUpdate = pendingMessageUpdateRef.current
                      if (pendingUpdate) {
                        console.log('🔄 Applying deferred message ID update:', pendingUpdate)
                        setMessages(prev => prev.map(msg =>
                          msg.id === streamingMessageId
                            ? {
                                ...msg,
                                id: pendingUpdate.messageId,
                                createdAt: new Date(pendingUpdate.createdAt)
                              }
                            : msg
                        ))
                        pendingMessageUpdateRef.current = null
                      }
                    })
                  } else if (data.type === 'message_saved') {
                    // Store the final message ID and timestamp for later application
                    finalMessageId = data.messageId
                    finalCreatedAt = data.createdAt
                    pendingMessageUpdateRef.current = {
                      messageId: data.messageId,
                      createdAt: data.createdAt
                    }
                    console.log('💾 Message saved data received, deferring ID update until after typing animation')
                  }
                } catch (parseError) {
                  console.error('Error parsing streaming data:', parseError)
                }
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      }

      console.log('✅ Streaming completed with citations:', finalCitations.length)
    } catch (error) {
      console.error('❌ Error in sendMessage function:', error)
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      })
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: new Date()
      }
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== streamingMessageId)
        return [...filtered, errorMessage]
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (question: string) => {
    setInput(question)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Function to format message content with numbered citations
  const formatMessageWithCitations = (content: string, citations: Citation[] = []) => {
    if (!citations.length) return content

    let formattedContent = content

    // Replace citation patterns with numbered links
    citations.forEach((citation, index) => {
      const citationNumber = index + 1
      const citationRegex = new RegExp(`\\[${citationNumber}\\]`, 'g')

      formattedContent = formattedContent.replace(
        citationRegex,
        `<span class="citation-link" data-citation-index="${index}" title="${citation.videoTitle} - ${Math.floor(citation.startTime || 0)}s">[${citationNumber}]</span>`
      )
    })

    return formattedContent
  }

  // Handle citation click - directly open PiP video
  const handleCitationClick = (citation: Citation, index: number) => {
    setPipVideo({
      videoId: citation.videoId,
      startTime: citation.startTime || 0,
      title: citation.videoTitle
    })
  }

  // Handle opening video in picture-in-picture mode
  const handleOpenPipVideo = (citation: Citation) => {
    setPipVideo({
      videoId: citation.videoId,
      startTime: citation.startTime || 0,
      title: citation.videoTitle
    })
  }

  // Generate shareable conversation text
  const generateShareableConversation = () => {
    const conversationText = messages
      .map(message => {
        const role = message.role === 'user' ? 'You' : creator.display_name
        const content = message.content.replace(/\[(\d+)\]/g, '') // Remove citation numbers
        return `${role}: ${content}`
      })
      .join('\n\n')

    return `🤖 Chat with ${creator.display_name} on AITreon\n\n${conversationText}\n\n---\nPowered by ⚡ AITreon\nContinue the conversation: ${window.location.href}`
  }

  // Handle share conversation
  const handleShareConversation = () => {
    const shareText = generateShareableConversation()
    
    if (navigator.share) {
      navigator.share({
        title: `Chat with ${creator.display_name}`,
        text: shareText,
        url: window.location.href
      }).catch(() => {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareText)
        alert('Conversation copied to clipboard!')
      })
    } else {
      // Fallback for browsers without Web Share API
      navigator.clipboard.writeText(shareText)
      alert('Conversation copied to clipboard!')
    }
  }

  const UserProfileDropdown = () => (
    <div className="relative" ref={userDropdownRef}>
      <button
        onClick={() => setShowUserDropdown(!showUserDropdown)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="relative">
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || 'User'}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'U'}
              </span>
            </div>
          )}
        </div>
        <div className="hidden md:flex items-center space-x-2">
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">
              {session?.user?.name || session?.user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-xs text-gray-500">
              {isSubscribed ? 'Premium' : 'Free'}
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      {showUserDropdown && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-[60]">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="relative">
                {session?.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-sm text-gray-500">
                  {session?.user?.email}
                </p>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    isSubscribed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {isSubscribed ? 'Premium Member' : 'Free User'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-2">
            <button 
              onClick={() => {
                setShowUserDropdown(false)
                alert('Profile page coming soon!')
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <User className="w-5 h-5 text-gray-500" />
              <span className="text-gray-900">Profile Settings</span>
            </button>
            
            <button 
              onClick={() => {
                setShowUserDropdown(false)
                alert('Subscription management coming soon!')
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-5 h-5 text-gray-500 flex items-center justify-center">
                <span className="text-xs font-bold">$</span>
              </div>
              <div>
                <span className="text-gray-900">Subscription</span>
                <p className="text-xs text-gray-500">
                  {isSubscribed ? 'Manage your premium plan' : 'Upgrade to premium'}
                </p>
              </div>
            </button>
            
            <div className="border-t border-gray-200 mt-2 pt-2">
              <button 
                onClick={() => {
                  setShowUserDropdown(false)
                  signOut({ callbackUrl: '/' })
                }}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-left group"
              >
                <LogOut className="w-5 h-5 text-gray-500 group-hover:text-red-500" />
                <span className="text-gray-900 group-hover:text-red-600">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Registration Modal component
  const RegistrationModal = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Continue Chatting</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            You've reached the 2-message limit for anonymous users. Sign in to continue your conversation with {creator.display_name}!
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-orange-800 mb-2">Free Account Benefits:</h3>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• 5 messages per day per creator</li>
              <li>• Access to all creator conversations</li>
              <li>• Save your chat history</li>
              <li>• Personalized experience</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link href="/auth/signin" className="w-full">
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              Sign In to Continue
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full"
            onClick={onClose}
          >
            Maybe Later
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 mt-4">
          No account? Signing in will create one automatically
        </div>
      </div>
    </div>
  )

  // Action Center component
  const ActionCenter = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Action Center</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Section */}
        <div className="mb-8">
          <h3 className="text-sm text-gray-500 mb-4 font-medium">Actions</h3>
          <div className="space-y-1">
            {/* Share Conversation */}
            <button 
              onClick={() => {
                handleShareConversation()
                onClose()
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <Share className="w-5 h-5 text-white" />
                </div>
                <span className="text-gray-900 font-medium">Share Conversation</span>
              </div>
              <ChevronUp className="w-4 h-4 text-gray-400 rotate-90 group-hover:text-gray-600" />
            </button>

            {/* View Socials */}
            <button 
              onClick={() => {
                if (creator.youtubeChannelUrl) {
                  window.open(creator.youtubeChannelUrl, '_blank')
                } else {
                  alert('No social links available for this creator.')
                }
                onClose()
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <LinkIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-gray-900 font-medium">View Socials</span>
              </div>
              <ChevronUp className="w-4 h-4 text-gray-400 rotate-90 group-hover:text-gray-600" />
            </button>

            {/* Give Feedback */}
            <button 
              onClick={() => {
                window.open('https://github.com/anthropics/claude-code/issues', '_blank')
                onClose()
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
                  <ThumbsUp className="w-5 h-5 text-white" />
                </div>
                <span className="text-gray-900 font-medium">Give feedback</span>
              </div>
              <ChevronUp className="w-4 h-4 text-gray-400 rotate-90 group-hover:text-gray-600" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400">
          Powered by <span className="font-medium">⚡ AITreon</span>
        </div>
      </div>
    </div>
  )


  // Citations panel component
  const CitationsPanel = ({ citations, messageId, onClose }: { citations: Citation[]; messageId: string; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-semibold">Citations ({citations.length})</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          {citations.map((citation, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{citation.videoTitle}</h4>
                  {citation.startTime && (
                    <p className="text-sm text-gray-500 mt-1">
                      {Math.floor(citation.startTime / 60)}:{(citation.startTime % 60).toFixed(0).padStart(2, '0')}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 mt-2">{citation.content}</p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenPipVideo(citation)}
                    >
                      Watch
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://www.youtube.com/watch?v=${citation.videoId}&t=${Math.floor(citation.startTime || 0)}s`, '_blank')}
                    >
                      YouTube
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // Picture-in-picture video player component
  const PipVideoPlayer = ({ video, onClose }: { video: { videoId: string; startTime: number; title: string }; onClose: () => void }) => (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 w-80 h-52 overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
        <h4 className="text-sm font-medium text-gray-800 truncate flex-1 mr-2">
          {video.title}
        </h4>
        <div className="flex gap-1">
          <button
            onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}&t=${Math.floor(video.startTime)}s`, '_blank')}
            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
            title="Open in YouTube"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.2a2.8 2.8 0 0 0-2-2C19.6 3.8 12 3.8 12 3.8s-7.6 0-9.5.4a2.8 2.8 0 0 0-2 2C0 8.2 0 12 0 12s0 3.8.5 5.8a2.8 2.8 0 0 0 2 2c1.9.4 9.5.4 9.5.4s7.6 0 9.5-.4a2.8 2.8 0 0 0 2-2c.5-2 .5-5.8.5-5.8s0-3.8-.5-5.8zM9.5 15.5v-7L15.5 12l-6 3.5z"/>
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="relative h-full">
        <iframe
          src={`https://www.youtube.com/embed/${video.videoId}?start=${Math.floor(video.startTime)}&autoplay=1&rel=0&modestbranding=1`}
          className="w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )

  // Add citation styles and click handler
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .citation-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        background: #3b82f6;
        color: white;
        border: 1px solid #2563eb;
        border-radius: 50%;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        margin: 0 2px;
        transition: all 0.2s;
        text-decoration: none;
      }
      .citation-link:hover {
        background: #2563eb;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      }
    `
    document.head.appendChild(style)

    // Add click handler for citations
    const handleCitationClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('citation-link')) {
        e.preventDefault()
        const citationIndex = parseInt(target.getAttribute('data-citation-index') || '0')
        // Find the message with citations that contains this citation
        const messageWithCitations = messages.find(m => m.citations && m.citations.length > citationIndex)
        if (messageWithCitations?.citations?.[citationIndex]) {
          const citation = messageWithCitations.citations[citationIndex]
          // Open in picture-in-picture mode instead of new tab
          setPipVideo({
            videoId: citation.videoId,
            startTime: citation.startTime || 0,
            title: citation.videoTitle
          })
        }
      }
    }

    document.addEventListener('click', handleCitationClick)

    return () => {
      document.head.removeChild(style)
      document.removeEventListener('click', handleCitationClick)
    }
  }, [messages])

  // Show message count for anonymous users
  const getDisplayMessageCount = () => {
    if (session?.user?.id) {
      return messageCount // Authenticated user existing logic
    } else {
      return Math.max(0, 2 - anonymousMessageCount) // Anonymous user: show remaining from 2
    }
  }

  // Initial state - no messages yet
  if (messages.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        {/* Fixed Top Header */}
        <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
          <div className="px-6 py-3 flex items-center">
            <div className="flex-1">
              {/* Left side - empty for now */}
            </div>
            
            {/* Center - Channel info and actions */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                {creator.profile_image ? (
                  <Image
                    src={creator.profile_image}
                    alt={creator.display_name || 'Creator'}
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {((creator.display_name || 'U')).charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></div>
              </div>
              <span className="font-semibold text-gray-900 text-lg">{creator.display_name}</span>
              <button 
                onClick={() => setShowActionCenter(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <MoreHorizontal className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex-1 flex justify-end">
              {session?.user?.id ? (
                <UserProfileDropdown />
              ) : (
                <Link href="/auth/signin">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto p-6 pt-20">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="relative">
                {creator.profile_image ? (
                  <Image
                    src={creator.profile_image}
                    alt={creator.display_name || 'Creator'}
                    width={80}
                    height={80}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {((creator.display_name || 'U')).charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">{creator.display_name}</h1>
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                </div>
                {creator.bio && (
                  <p className="text-gray-600 mt-1">{creator.bio}</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 mb-12">
            <Button 
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full flex items-center space-x-2"
              onClick={() => inputRef.current?.focus()}
            >
              <MessageCircle className="w-5 h-5" />
              <span>Chat</span>
            </Button>
            <Button 
              variant="outline" 
              className="border-orange-500 text-orange-500 hover:bg-orange-50 px-8 py-3 rounded-full flex items-center space-x-2"
              onClick={startVoiceCall}
            >
              <Phone className="w-5 h-5" />
              <span>Call</span>
            </Button>
          </div>


          {/* Suggested Questions */}
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Suggested Questions</h2>
            </div>
            
            <div className="space-y-4">
              {questionsLoading ? (
                // Loading skeleton
                [1, 2, 3].map((i) => (
                  <div key={i} className="w-full p-4 rounded-2xl border border-gray-200 animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded bg-gray-200"></div>
                      <div className="h-4 bg-gray-200 rounded flex-1"></div>
                    </div>
                  </div>
                ))
              ) : (
                suggestedQuestions.map((questionObj, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(questionObj.question)}
                    className="w-full text-left p-4 rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
                    title={`Based on: ${questionObj.basedOn?.join(', ') || 'N/A'} (${Math.round(questionObj.confidence * 100)}% confidence)`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center mt-0.5 group-hover:bg-orange-200 transition-colors">
                        <span className="text-orange-600 text-xs font-medium">Q</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-gray-900 font-medium">{questionObj.question}</span>
                        <div className="mt-1">
                          <span className="text-xs text-gray-500 capitalize">#{questionObj.category}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Input */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end space-x-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder={(!session?.user?.id && anonymousMessageCount >= 2) ? "Sign in to continue chatting" : `Ask ${creator.display_name} a question`}
                    className={`w-full resize-none border border-gray-200 rounded-2xl px-4 py-3 pr-20 focus:outline-none focus:border-gray-300 text-gray-700 ${(!session?.user?.id && anonymousMessageCount >= 2) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    rows={1}
                    disabled={loading || (!session?.user?.id && anonymousMessageCount >= 2)}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center space-x-2">
                    <button className="text-gray-400 hover:text-gray-600">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <Button
                      onClick={sendMessage}
                      disabled={!input.trim() || loading || (!session?.user?.id && anonymousMessageCount >= 2)}
                      className="w-8 h-8 p-0 bg-orange-500 hover:bg-orange-600 rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Voice Call Interface Modal */}
        {showVoiceCall && currentRoomName && (
          <VoiceCallInterface
            creatorId={creator.id}
            creatorName={creator.display_name || 'Creator'}
            creatorImage={creator.profile_image}
            userId={session.user.id}
            roomName={currentRoomName}
            onClose={() => {
              setShowVoiceCall(false)
              setCurrentRoomName(null)
            }}
          />
        )}
      </div>
    )
  }


  // Chat mode - messages exist
  return (
    <>
    <div className="min-h-screen bg-white">
      {/* Fixed Top Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="px-6 py-3 flex items-center">
          {/* Left side - Chat History */}
          <div className="flex-1">
            <button
              onClick={handleChatHistoryClick}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Chat History"
            >
              <History className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* Center - Channel info and actions */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              {creator.profile_image ? (
                <Image
                  src={creator.profile_image}
                  alt={creator.display_name || 'Creator'}
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {(creator.displayName || (creator.display_name || 'U')).charAt(0)}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></div>
            </div>
            <span className="font-semibold text-gray-900 text-sm">{creator.display_name}</span>
            <button 
              onClick={() => {
                console.log('📞 Header phone button clicked in chat mode')
                startVoiceCall()
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Start Voice Call"
            >
              <Phone className="w-5 h-5 text-gray-400" />
            </button>
            <button 
              onClick={() => setShowActionCenter(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          <div className="flex-1 flex justify-end">
            {session?.user?.id ? (
              <UserProfileDropdown />
            ) : (
              <Link href="/auth/signin">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto pt-16">

        {/* Messages with blur overlays */}
        <div className="px-6 py-6 pb-32 space-y-6 relative">
          {/* Top blur overlay - positioned inside messages area */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white via-white/90 via-white/70 via-white/40 to-transparent pointer-events-none z-10"></div>
          {messages.map((message, index) => (
            <div key={message.id}>
              {message.role === 'assistant' && (
                <div className="flex items-start space-x-3 mb-4 group">
                  <div className="relative flex-shrink-0">
                    {creator.profile_image ? (
                      <Image
                        src={creator.profile_image}
                        alt={creator.display_name || 'Creator'}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {(creator.displayName || (creator.display_name || 'U')).charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`${message.messageType === 'voice_transcript' ? 'bg-blue-50 border border-blue-100' : 'bg-gray-100'} rounded-2xl rounded-tl-md px-4 py-3 w-full relative break-words ${
                      !session?.user?.id && lastResponseBlurred && index === messages.length - 1 && message.role === 'assistant' ? 'blur-sm' : ''
                    }`}>
                      {message.isStreaming && !message.content ? (
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      ) : (
                        <div className="text-gray-900 break-words">
                          {message.messageType === 'voice_transcript' && (
                            <div className="flex items-center mb-2 text-blue-600 text-sm">
                              <Mic className="w-3 h-3 mr-1" />
                              <span>Voice transcription</span>
                            </div>
                          )}
                          <div
                            className="whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{
                              __html: formatMessageWithCitations(message.content, message.citations)
                            }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement
                              if (target.classList.contains('citation-link')) {
                                const citationIndex = parseInt(target.getAttribute('data-citation-index') || '0')
                                const citation = message.citations?.[citationIndex]
                                if (citation) {
                                  handleCitationClick(citation, citationIndex)
                                }
                              }
                            }}
                          />
                          {message.isStreaming && (
                            <span className="inline-block w-2 h-5 bg-blue-500 animate-pulse ml-1"></span>
                          )}
                        </div>
                      )}
                      
                      {/* Hover Actions - Heart and Copy Icons */}
                      <div className="absolute -right-14 top-1/2 -translate-y-1/2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                        <button
                          onClick={() => handleLikeMessage(message.id)}
                          className={`p-1.5 rounded-full transition-colors shadow-sm border border-gray-200 ${
                            likedMessages.has(message.id)
                              ? 'text-red-500 bg-white hover:bg-red-50'
                              : 'text-gray-400 bg-white hover:text-red-500 hover:bg-red-50'
                          }`}
                          title="Like this message"
                        >
                          <Heart className={`w-4 h-4 ${likedMessages.has(message.id) ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleCopyMessage(message.content, message.id)}
                          className={`p-1.5 rounded-full transition-colors shadow-sm border border-gray-200 ${
                            copiedMessageId === message.id
                              ? 'text-green-500 bg-green-50 border-green-200'
                              : 'bg-white text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                          }`}
                          title={copiedMessageId === message.id ? 'Copied!' : 'Copy message'}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {message.role === 'assistant' && !message.isStreaming && (
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 h-0 group-hover:h-auto overflow-hidden group-hover:mt-2">
                        <div className="flex gap-2">
                          {message.citations && message.citations.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAllCitations(message.id)}
                              className="text-xs px-3 py-1 h-7"
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Citations ({message.citations.length})
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReadAloud(message.id, message.content)}
                            className={`text-xs px-3 py-1 h-7 ${playingAudio === message.id ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : ''}`}
                          >
                            {playingAudio === message.id ? (
                              <>
                                <VolumeX className="w-3 h-3 mr-1" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3 mr-1" />
                                Read Aloud
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {message.role === 'user' && (
                <div className="flex justify-end mb-4">
                  <div className={`${message.messageType === 'voice_transcript' ? 'bg-blue-600 border border-blue-500' : 'bg-orange-500'} text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-2xl`}>
                    {message.messageType === 'voice_transcript' && (
                      <div className="flex items-center mb-2 text-blue-100 text-sm">
                        <Mic className="w-3 h-3 mr-1" />
                        <span>Voice message</span>
                      </div>
                    )}
                    <p>{message.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}


          {/* Suggested Questions Collapsible */}
          <div className="border-t border-gray-100 pt-6">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center justify-center space-x-2 w-full py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span>Suggested Questions</span>
              <ChevronUp className={`w-4 h-4 transition-transform ${showSuggestions ? '' : 'rotate-180'}`} />
            </button>
            
            {showSuggestions && (
              <div className="mt-4 space-y-3">
                {questionsLoading ? (
                  // Loading skeleton for chat mode
                  [1, 2, 3].map((i) => (
                    <div key={i} className="w-full p-3 rounded-lg border border-gray-200 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded"></div>
                    </div>
                  ))
                ) : (
                  suggestedQuestions.map((questionObj, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(questionObj.question)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-sm group"
                    >
                      <div className="font-medium">{questionObj.question}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Fixed Input */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-30">
          {/* Bottom blur overlay - positioned above input */}
          <div className="absolute -top-20 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/95 via-white/80 via-white/50 to-transparent pointer-events-none z-10"></div>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder={(!session?.user?.id && anonymousMessageCount >= 2) ? "Sign in to continue chatting" : "Type..."}
                  className={`w-full resize-none border border-gray-200 rounded-2xl px-4 py-3 pr-20 focus:outline-none focus:border-gray-300 text-gray-700 ${(!session?.user?.id && anonymousMessageCount >= 2) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  rows={1}
                  disabled={loading || (!session?.user?.id && anonymousMessageCount >= 2)}
                />
                <div className="absolute right-3 bottom-3 flex items-center space-x-2 z-[60]">
                  <Button
                    onClick={() => {
                      console.log('📤 Send button clicked in CHAT MODE')
                      sendMessage()
                    }}
                    disabled={!input.trim() || loading || (!session?.user?.id && anonymousMessageCount >= 2)}
                    className="w-8 h-8 p-0 bg-orange-500 hover:bg-orange-600 rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="text-center text-sm text-gray-500 mt-2">
              {session?.user?.id ? `${messageCount} Messages Remaining` : `${getDisplayMessageCount()} Messages Remaining (Anonymous)`}
            </div>
          </div>
        </div>
      </div>

      {/* Action Center Modal */}
      {showActionCenter && (
        <ActionCenter 
          onClose={() => setShowActionCenter(false)} 
        />
      )}


      {showAllCitations && (
        (() => {
          const messageWithCitations = messages.find(m => m.id === showAllCitations)
          return messageWithCitations?.citations ? (
            <CitationsPanel
              citations={messageWithCitations.citations}
              messageId={showAllCitations}
              onClose={() => setShowAllCitations(null)}
            />
          ) : null
        })()
      )}
      
      {/* Chat History Panel */}
      {showChatHistory && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowChatHistory(false)}
          />
          
          {/* Sliding Panel */}
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
            <div className="h-full flex flex-col">
              {/* Panel Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Chat History</h2>
                <button
                  onClick={() => setShowChatHistory(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Loading chat history...</div>
                  </div>
                ) : chatHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="text-gray-500 mb-2">No chat history yet</div>
                    <div className="text-sm text-gray-400">Start a conversation to see it here</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatHistory.map((session) => {
                      const lastMessage = session.messages[session.messages.length - 1]
                      const firstUserMessage = session.messages.find(m => m.role === 'USER')
                      const preview = firstUserMessage?.content || lastMessage?.content || 'No messages'
                      const timeAgo = formatTimeAgo(new Date(session.updatedAt))
                      
                      // Check if this session contains voice transcriptions
                      const hasVoiceMessages = session.messages.some(m => m.messageType === 'voice_transcript')
                      
                      return (
                        <div 
                          key={session.id}
                          onClick={() => handleSelectChatSession(session)}
                          className="p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-gray-100 hover:border-gray-200"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              {hasVoiceMessages ? (
                                <Mic className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              ) : (
                                <MessageCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="font-medium text-gray-900 truncate">
                                {preview.length > 40 ? preview.substring(0, 40) + '...' : preview}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {timeAgo}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 ml-6">
                            {session.messages.length} message{session.messages.length === 1 ? '' : 's'}
                            {hasVoiceMessages && (
                              <span className="text-blue-500 ml-2">• Voice conversation</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* New Chat Button */}
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setMessages([])
                          setSessionId(undefined)
                          setShowChatHistory(false)
                        }}
                        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors text-gray-600 hover:text-orange-600"
                      >
                        <div className="text-center">
                          <div className="font-medium">Start New Chat</div>
                          <div className="text-sm">Begin a fresh conversation</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Voice Call Interface Modal */}
      {showVoiceCall && currentRoomName && (
        <VoiceCallInterface
          creatorId={creator.id}
          creatorName={creator.display_name || 'Creator'}
          creatorImage={creator.profile_image}
          userId={session.user.id}
          roomName={currentRoomName}
          onClose={() => {
            setShowVoiceCall(false)
            setCurrentRoomName(null)
          }}
        />
      )}

      {/* Picture-in-picture video player */}
      {pipVideo && (
        <PipVideoPlayer
          video={pipVideo}
          onClose={() => setPipVideo(null)}
        />
      )}

      {/* Registration Modal for Anonymous Users */}
      {showRegistrationModal && (
        <RegistrationModal
          onClose={() => setShowRegistrationModal(false)}
        />
      )}

    </div>
    </>
  )
}