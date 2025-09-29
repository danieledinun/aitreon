'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { 
  Youtube, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Play,
  Users,
  Bot,
  MessageCircle,
  Loader2,
  ExternalLink,
  Check,
  Sparkles,
  Zap,
  Target,
  Star,
  Calendar
} from 'lucide-react'

interface Video {
  id: string
  title: string
  thumbnail: string
  duration: string
  publishedAt: string
  selected: boolean
}

const AUDIENCE_OPTIONS = [
  'Fans Q&A',
  'Product Advice', 
  'Career Tips',
  'Hot Takes',
  'Tutorials',
  'Entertainment',
  'Educational Content',
  'Brand Partnerships'
]

interface OnboardingFlowProps {
  userId: string
}

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | undefined
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

export default function CreatorOnboardingFlow({ userId }: OnboardingFlowProps) {
  console.log('🟢 CreatorOnboardingFlow component rendered')

  const router = useRouter()
  const { update: updateSession } = useSession()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [processingVideos, setProcessingVideos] = useState(false)

  console.log('🟡 Component states:', { currentStep, loading, processingVideos })
  const [channelData, setChannelData] = useState<any>(null)

  // Debug useEffect to track state changes
  useEffect(() => {
    console.log('🟣 State changed - Step:', currentStep, 'Loading:', loading, 'ProcessingVideos:', processingVideos)
    if (currentStep === 4) {
      console.log('📍 Reached final step - button should be visible')
    }
  }, [currentStep, loading, processingVideos])

  // Debounced validation functions
  const validateUsername = useCallback(
    debounce(async (username: string) => {
      if (!username || username.length < 3) {
        setValidationErrors(prev => ({ ...prev, username: '' }))
        setValidationSuccess(prev => ({ ...prev, username: false }))
        return
      }

      setValidationLoading(prev => ({ ...prev, username: true }))

      try {
        const response = await fetch('/api/creator/validate-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        })

        const data = await response.json()

        if (data.available) {
          setValidationErrors(prev => ({ ...prev, username: '' }))
          setValidationSuccess(prev => ({ ...prev, username: true }))
        } else {
          setValidationErrors(prev => ({ ...prev, username: data.error }))
          setValidationSuccess(prev => ({ ...prev, username: false }))
        }
      } catch (error) {
        setValidationErrors(prev => ({ ...prev, username: 'Failed to validate username' }))
        setValidationSuccess(prev => ({ ...prev, username: false }))
      } finally {
        setValidationLoading(prev => ({ ...prev, username: false }))
      }
    }, 500),
    []
  )

  const validateChannel = useCallback(
    debounce(async (youtubeChannelUrl: string) => {
      if (!youtubeChannelUrl) {
        setValidationErrors(prev => ({ ...prev, youtubeChannelUrl: '' }))
        setValidationSuccess(prev => ({ ...prev, youtubeChannelUrl: false }))
        return
      }

      setValidationLoading(prev => ({ ...prev, youtubeChannelUrl: true }))

      try {
        const response = await fetch('/api/creator/validate-channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeChannelUrl })
        })

        const data = await response.json()

        if (data.available) {
          setValidationErrors(prev => ({ ...prev, youtubeChannelUrl: '' }))
          setValidationSuccess(prev => ({ ...prev, youtubeChannelUrl: true }))
        } else {
          setValidationErrors(prev => ({ ...prev, youtubeChannelUrl: data.error }))
          setValidationSuccess(prev => ({ ...prev, youtubeChannelUrl: false }))
        }
      } catch (error) {
        setValidationErrors(prev => ({ ...prev, youtubeChannelUrl: 'Failed to validate YouTube channel' }))
        setValidationSuccess(prev => ({ ...prev, youtubeChannelUrl: false }))
      } finally {
        setValidationLoading(prev => ({ ...prev, youtubeChannelUrl: false }))
      }
    }, 500),
    []
  )
  const [videos, setVideos] = useState<Video[]>([])
  
  // Step 1: Basic Info
  const [basicInfo, setBasicInfo] = useState({
    username: '',
    displayName: '',
    bio: '',
    youtubeChannelUrl: ''
  })

  // Step 2: Video Selection
  const [selectedVideos, setSelectedVideos] = useState<string[]>([])

  // Validation states for conflicts
  const [validationErrors, setValidationErrors] = useState({
    username: '',
    youtubeChannelUrl: ''
  })

  // Validation loading states
  const [validationLoading, setValidationLoading] = useState({
    username: false,
    youtubeChannelUrl: false
  })

  // Validation success states
  const [validationSuccess, setValidationSuccess] = useState({
    username: false,
    youtubeChannelUrl: false
  })

  // Step 3: AI Configuration (Quickstart style)
  const [aiConfig, setAiConfig] = useState({
    agentName: '',
    audiences: [] as string[],
    toneSliders: {
      directness: 3,
      playfulness: 3,
      formality: 3,
      optimism: 3
    },
    sentenceLength: 'medium',
    formatPreference: 'bullets',
    emojiUsage: 'sometimes',
    signaturePhrases: [''],
    avoidWords: [''],
    answerShape: 'stance-bullets',
    evidencePolicy: 'factual-only',
    boundaries: [],
    uncertaintyHandling: 'not-found',
    approvalPolicy: 'immediate'
  })

  // Step 4: Questions
  const [questions, setQuestions] = useState({
    question1: '',
    question2: '',
    question3: ''
  })

  const steps = [
    { 
      number: 1, 
      title: 'Connect Channel', 
      description: 'Link your YouTube channel',
      icon: Youtube,
      color: 'from-red-500 to-red-600'
    },
    { 
      number: 2, 
      title: 'Select Content', 
      description: 'Choose videos for training',
      icon: Play,
      color: 'from-blue-500 to-blue-600'
    },
    { 
      number: 3, 
      title: 'AI Personality', 
      description: 'Define your AI character',
      icon: Bot,
      color: 'from-purple-500 to-purple-600'
    },
    { 
      number: 4, 
      title: 'Launch Ready', 
      description: 'Add starter questions',
      icon: MessageCircle,
      color: 'from-green-500 to-green-600'
    }
  ]

  const progress = (currentStep / steps.length) * 100

  // Step 1: Handle YouTube channel processing
  const handleChannelSubmit = async () => {
    console.log('🔄 handleChannelSubmit called', { basicInfo })
    if (!basicInfo.youtubeChannelUrl) {
      console.log('❌ No YouTube channel URL provided')
      return
    }

    setLoading(true)
    console.log('📺 Processing YouTube channel:', basicInfo.youtubeChannelUrl)
    try {
      const response = await fetch('/api/youtube/channel-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: basicInfo.youtubeChannelUrl })
      })
      
      const data = await response.json()
      if (response.ok) {
        console.log('✅ Channel analysis successful:', data)
        setChannelData(data.channel)
        setVideos(data.videos?.slice(0, 20).map((v: any, i: number) => ({
          id: v.id,
          title: v.title,
          thumbnail: v.thumbnail,
          duration: v.duration || 'N/A',
          publishedAt: v.publishedAt,
          selected: i < 5 // Pre-select first 5 videos
        })) || [])
        
        // Auto-fill display name if not provided
        if (!basicInfo.displayName && data.channel?.name) {
          setBasicInfo(prev => ({ ...prev, displayName: data.channel.name }))
        }
        
        setCurrentStep(2)
      } else {
        console.error('❌ Channel analysis failed:', response.status, data)
        alert(`Error: ${data.error || 'Failed to analyze channel'}`)
      }
    } catch (error) {
      console.error('Error processing channel:', error)
    }
    setLoading(false)
  }

  // Step 2: Handle video selection
  const toggleVideoSelection = (videoId: string) => {
    setVideos(prev => prev.map(video => 
      video.id === videoId 
        ? { ...video, selected: !video.selected }
        : video
    ))
  }

  const selectAllVideos = () => {
    const allSelected = videos.every(v => v.selected)
    setVideos(prev => prev.map(video => ({ ...video, selected: !allSelected })))
  }

  // AI Config handlers
  const handleAudienceChange = (audience: string, checked: boolean) => {
    setAiConfig(prev => ({
      ...prev,
      audiences: checked 
        ? [...prev.audiences, audience]
        : prev.audiences.filter(a => a !== audience)
    }))
  }

  const handlePhraseChange = (index: number, value: string, type: 'signaturePhrases' | 'avoidWords') => {
    setAiConfig(prev => ({
      ...prev,
      [type]: prev[type].map((phrase, i) => i === index ? value : phrase)
    }))
  }

  const addPhrase = (type: 'signaturePhrases' | 'avoidWords') => {
    setAiConfig(prev => ({
      ...prev,
      [type]: [...prev[type], '']
    }))
  }

  const removePhrases = (index: number, type: 'signaturePhrases' | 'avoidWords') => {
    setAiConfig(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }))
  }

  // Handle video selection completion - start background processing
  const handleVideoSelectionComplete = async () => {
    console.log('🚀 Starting background video processing for selected videos')

    // Get selected video IDs
    const selectedVideoIds = videos.filter(v => v.selected).map(v => v.id)
    console.log('📋 Selected videos for processing:', selectedVideoIds)

    if (selectedVideoIds.length > 0) {
      try {
        // Set initial processing status in localStorage for immediate banner display
        // Note: creatorId will be determined by the API endpoints using session data
        const processingStatus = {
          isProcessing: true,
          totalVideos: selectedVideoIds.length,
          processedVideos: 0,
          processingVideos: selectedVideoIds,
          recentlyCompleted: [],
          hasErrors: false,
          startedAt: new Date().toISOString(),
          lastChecked: Date.now()
        }
        localStorage.setItem('videoProcessingStatus', JSON.stringify(processingStatus))
        console.log('📝 Processing status saved to localStorage for banner display')

        // Start background video processing (fire-and-forget)
        fetch('/api/creator/sync-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoIds: selectedVideoIds,
            backgroundProcessing: true // Flag to indicate this is background processing
          })
        }).then(response => {
          console.log('🎯 Background video processing started:', response.status)
        }).catch(error => {
          console.warn('⚠️ Background processing request failed:', error)
        })

        console.log('✅ Background processing initiated')
      } catch (error) {
        console.warn('⚠️ Failed to start background processing:', error)
      }
    }

    // Reset processing state since background processing is now running
    setProcessingVideos(false)

    // Move to next step immediately (don't wait for processing)
    setCurrentStep(prev => prev + 1)
  }

  // Final submission
  const handleFinalSubmit = async () => {
    console.log('🚀🚀🚀 FINAL SUBMIT BUTTON CLICKED! 🚀🚀🚀')
    console.log('🚀 DEBUG: handleFinalSubmit function called')
    console.log('🚀 DEBUG: Current loading state:', loading)
    console.log('🚀 DEBUG: Current processingVideos state:', processingVideos)
    console.log('🚀 DEBUG: Basic info:', basicInfo)

    setLoading(true)
    console.log('🚀 DEBUG: Loading state set to true')
    try {
      // Create creator profile (or handle if already exists)
      const creatorResponse = await fetch('/api/creator/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basicInfo)
      })

      let creatorData = null
      if (creatorResponse.ok) {
        creatorData = await creatorResponse.json()
        console.log('✅ Creator profile created successfully')
      } else {
        const errorData = await creatorResponse.json()
        if (errorData.error === 'Creator profile already exists') {
          console.log('ℹ️ Creator profile already exists - continuing with onboarding completion')
        } else if (errorData.error === 'Username already taken') {
          console.log('❌ Username already taken - showing validation error')
          setValidationErrors(prev => ({ ...prev, username: 'This username is already taken. Please choose a different one.' }))
          setCurrentStep(1) // Go back to step 1
          setLoading(false)
          return // Stop execution here
        } else if (errorData.error === 'This YouTube channel is already connected to another creator') {
          console.log('❌ Channel conflict - showing validation error')
          setValidationErrors(prev => ({ ...prev, youtubeChannelUrl: 'This YouTube channel is already connected to another creator.' }))
          setCurrentStep(1) // Go back to step 1
          setLoading(false)
          return // Stop execution here
        } else {
          console.error('❌ Creator setup error:', errorData.error)
          throw new Error(errorData.error || 'Failed to create creator profile')
        }
      }

      // Skip video processing here - it was already started in background during step 2
      console.log('ℹ️ Video processing was already started in background during step 2')

      // Small delay to ensure creator record is committed to database
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Save AI configuration (quickstart format)
      if (aiConfig.agentName.trim()) {
        try {
          const aiConfigResponse = await fetch('/api/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiConfig)
          })

          if (aiConfigResponse.ok) {
            console.log('✅ AI config saved successfully')
          } else {
            const errorData = await aiConfigResponse.json()
            console.error('❌ AI config save failed:', errorData)
          }
        } catch (error) {
          console.error('⚠️ AI config save network error:', error)
        }
      }

      // Save questions
      const questionsToSave = Object.values(questions).filter(q => q.trim())
      if (questionsToSave.length > 0) {
        try {
          const questionsResponse = await fetch('/api/creator/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: questionsToSave })
          })

          if (questionsResponse.ok) {
            console.log('✅ Questions saved successfully')
          } else {
            const errorData = await questionsResponse.json()
            console.error('❌ Questions save failed:', errorData)
          }
        } catch (error) {
          console.error('⚠️ Questions save network error:', error)
        }
      }

      // Force session refresh and redirect
      console.log('🔄 Refreshing session and redirecting...')

      // Try to update the session
      await updateSession()

      // Direct redirect to creator dashboard
      router.push('/creator?onboarding=complete')

    } catch (error) {
      console.error('Final submission error:', error)
    }
    setLoading(false)
  }

  const currentStepData = steps[currentStep - 1]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full bg-repeat bg-center" style={{
          backgroundImage: `radial-gradient(circle at 20px 20px, rgba(255,255,255,0.03) 2px, transparent 2px)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>
      <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="pt-8 pb-4 px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 mb-6 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Welcome to <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Aitrion</span>
              </h1>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Create your AI replica in minutes and start earning from day one
              </p>
            </div>
            
            {/* Progress Steps */}
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  const isActive = currentStep === step.number
                  const isCompleted = currentStep > step.number
                  
                  return (
                    <div key={step.number} className="flex items-center flex-1">
                      <div className="relative flex flex-col items-center">
                        <div className={`
                          flex items-center justify-center w-16 h-16 rounded-2xl border-2 transition-all duration-300
                          ${isActive 
                            ? `bg-gradient-to-r ${step.color} border-transparent shadow-lg shadow-blue-500/25` 
                            : isCompleted
                            ? 'bg-green-500 border-transparent'
                            : 'bg-gray-800/50 border-gray-600'
                          }
                        `}>
                          {isCompleted ? (
                            <Check className="w-8 h-8 text-white" />
                          ) : (
                            <Icon className={`w-8 h-8 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                          )}
                        </div>
                        <div className="text-center mt-4">
                          <div className={`font-semibold text-sm ${isActive ? 'text-white' : isCompleted ? 'text-green-400' : 'text-gray-400'}`}>
                            {step.title}
                          </div>
                          <div className={`text-xs mt-1 ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
                            {step.description}
                          </div>
                        </div>
                      </div>
                      {index < steps.length - 1 && (
                        <div className={`
                          flex-1 h-0.5 mx-6 transition-all duration-300
                          ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-700'}
                        `} />
                      )}
                    </div>
                  )
                })}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-700/50 rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-center text-sm text-gray-400">
                Step {currentStep} of {steps.length}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-8 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              {/* Step Header */}
              <div className="text-center mb-12">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r ${currentStepData.color} mb-6 shadow-lg`}>
                  <currentStepData.icon className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {currentStepData.title}
                </h2>
                <p className="text-gray-300 text-lg">
                  {currentStepData.description}
                </p>
              </div>

              {/* Step Content */}
              <div className="space-y-8">
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <Label htmlFor="username" className="text-white text-base font-medium">
                          Username *
                        </Label>
                        <div className="relative">
                          <Input
                            id="username"
                            value={basicInfo.username}
                            onChange={(e) => {
                              const newUsername = e.target.value
                              setBasicInfo(prev => ({ ...prev, username: newUsername }))
                              // Clear validation states when user types
                              setValidationErrors(prev => ({ ...prev, username: '' }))
                              setValidationSuccess(prev => ({ ...prev, username: false }))
                              // Trigger validation after debounce
                              validateUsername(newUsername)
                            }}
                            placeholder="your_username"
                            pattern="^[a-zA-Z0-9_]+$"
                            className={`bg-white/10 border-white/20 text-white placeholder:text-gray-400 h-12 text-lg rounded-xl focus:bg-white/15 pr-12 ${
                              validationErrors.username
                                ? 'border-red-400 focus:border-red-400 bg-red-500/10'
                                : validationSuccess.username
                                ? 'border-green-400 focus:border-green-400 bg-green-500/10'
                                : 'focus:border-blue-400'
                            }`}
                          />
                          {validationLoading.username && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                            </div>
                          )}
                          {validationSuccess.username && !validationLoading.username && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                          )}
                        </div>
                        {validationErrors.username && (
                          <p className="text-sm text-red-400 flex items-center gap-2">
                            <span className="text-red-400">⚠️</span>
                            {validationErrors.username}
                          </p>
                        )}
                        <p className="text-sm text-gray-400">
                          Your unique URL: <span className="text-blue-400">aitrion.com/{basicInfo.username || 'your_username'}</span>
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <Label htmlFor="displayName" className="text-white text-base font-medium">
                          Display Name *
                        </Label>
                        <Input
                          id="displayName"
                          value={basicInfo.displayName}
                          onChange={(e) => setBasicInfo(prev => ({ ...prev, displayName: e.target.value }))}
                          placeholder="Your Display Name"
                          className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 h-12 text-lg rounded-xl focus:bg-white/15 focus:border-blue-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="bio" className="text-white text-base font-medium">
                        Bio <span className="text-gray-400 font-normal">(Optional)</span>
                      </Label>
                      <Textarea
                        id="bio"
                        value={basicInfo.bio}
                        onChange={(e) => setBasicInfo(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Tell people about yourself..."
                        rows={4}
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 text-lg rounded-xl focus:bg-white/15 focus:border-blue-400 resize-none"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="youtubeChannelUrl" className="text-white text-base font-medium">
                        YouTube Channel URL *
                      </Label>
                      <div className="relative">
                        <Input
                          id="youtubeChannelUrl"
                          type="url"
                          value={basicInfo.youtubeChannelUrl}
                          onChange={(e) => {
                            const newChannelUrl = e.target.value
                            setBasicInfo(prev => ({ ...prev, youtubeChannelUrl: newChannelUrl }))
                            // Clear validation states when user types
                            setValidationErrors(prev => ({ ...prev, youtubeChannelUrl: '' }))
                            setValidationSuccess(prev => ({ ...prev, youtubeChannelUrl: false }))
                            // Trigger validation after debounce
                            validateChannel(newChannelUrl)
                          }}
                          placeholder="https://www.youtube.com/channel/..."
                          className={`bg-white/10 border-white/20 text-white placeholder:text-gray-400 h-12 text-lg rounded-xl focus:bg-white/15 pr-12 ${
                            validationErrors.youtubeChannelUrl
                              ? 'border-red-400 focus:border-red-400 bg-red-500/10'
                              : validationSuccess.youtubeChannelUrl
                              ? 'border-green-400 focus:border-green-400 bg-green-500/10'
                              : 'focus:border-blue-400'
                          }`}
                        />
                        {validationLoading.youtubeChannelUrl && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                          </div>
                        )}
                        {validationSuccess.youtubeChannelUrl && !validationLoading.youtubeChannelUrl && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          </div>
                        )}
                      </div>
                      {validationErrors.youtubeChannelUrl && (
                        <p className="text-sm text-red-400 flex items-center gap-2">
                          <span className="text-red-400">⚠️</span>
                          {validationErrors.youtubeChannelUrl}
                        </p>
                      )}
                    </div>

                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/20 rounded-2xl p-6">
                      <h3 className="font-semibold text-blue-300 mb-3 flex items-center gap-2 text-lg">
                        <Target className="w-5 h-5" />
                        What's next?
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-200">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-400" />
                          <span>Analyze your channel content</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-400" />
                          <span>Select training videos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-400" />
                          <span>Configure AI personality</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-400" />
                          <span>Launch your AI replica</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Video Selection */}
                {currentStep === 2 && (
                  <div className="space-y-8">
                    {channelData && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-6">
                          <img 
                            src={channelData.thumbnail} 
                            alt={channelData.name}
                            className="w-20 h-20 rounded-2xl shadow-lg"
                          />
                          <div>
                            <h3 className="font-bold text-2xl text-white">{channelData.name}</h3>
                            <p className="text-gray-300 text-lg">{channelData.subscriberCount} subscribers</p>
                            <p className="text-gray-400">{channelData.videoCount} total videos</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-white">Choose Your Best Content</h3>
                      <div className="flex items-center gap-4">
                        <Button 
                          variant="outline" 
                          size="lg"
                          onClick={selectAllVideos}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl"
                        >
                          {videos.every(v => v.selected) ? 'Deselect All' : 'Select All'}
                        </Button>
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/20 px-4 py-2 text-lg rounded-xl">
                          {videos.filter(v => v.selected).length} selected
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-96 overflow-y-auto custom-scrollbar">
                      {videos.map((video) => (
                        <div 
                          key={video.id}
                          className={`
                            border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-105
                            ${video.selected 
                              ? 'border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/25' 
                              : 'border-white/20 bg-white/5 hover:border-white/30'
                            }
                          `}
                          onClick={() => toggleVideoSelection(video.id)}
                        >
                          <div className="flex items-start gap-4">
                            <Checkbox 
                              checked={video.selected}
                              className="mt-1 border-white/30 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                              onChange={() => toggleVideoSelection(video.id)}
                            />
                            <img 
                              src={video.thumbnail} 
                              alt={video.title}
                              className="w-28 h-20 object-cover rounded-xl flex-shrink-0 shadow-md"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white text-sm line-clamp-2 mb-2">{video.title}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{video.duration}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {videos.filter(v => v.selected).length > 0 && (
                      <div className="bg-green-500/10 border border-green-400/20 rounded-2xl p-6">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-6 h-6 text-green-400" />
                          <p className="text-green-200 text-lg">
                            <span className="font-semibold">{videos.filter(v => v.selected).length} videos</span> selected for AI training
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: AI Configuration (Quickstart) */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* AI Agent Name */}
                    <div className="space-y-3">
                      <Label htmlFor="agentName" className="text-white text-base font-medium">
                        1. What should we call your AI agent? *
                      </Label>
                      <Input
                        id="agentName"
                        value={aiConfig.agentName}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, agentName: e.target.value }))}
                        placeholder="e.g., FitnessGuru AI, CookingMaster, TechReviewer..."
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 h-12 text-lg rounded-xl focus:bg-white/15 focus:border-purple-400"
                      />
                    </div>

                    {/* Audience & Use Cases */}
                    <div className="space-y-3">
                      <Label className="text-white text-base font-medium">
                        2. Audience & use cases (pick 2–3)
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {AUDIENCE_OPTIONS.map((audience) => (
                          <div key={audience} className="flex items-center space-x-2">
                            <Checkbox
                              id={audience}
                              checked={aiConfig.audiences.includes(audience)}
                              onCheckedChange={(checked) => handleAudienceChange(audience, checked as boolean)}
                            />
                            <Label htmlFor={audience} className="text-sm text-white">{audience}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tone Sliders */}
                    <div className="space-y-3">
                      <Label className="text-white text-base font-medium">
                        3. Tone sliders (1–5)
                      </Label>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { key: 'directness', label: 'Direct' },
                          { key: 'playfulness', label: 'Playful' },
                          { key: 'formality', label: 'Formal' },
                          { key: 'optimism', label: 'Optimistic' }
                        ].map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-white text-sm">{label}</Label>
                              <span className="text-sm text-gray-400">{aiConfig.toneSliders[key as keyof typeof aiConfig.toneSliders]}/5</span>
                            </div>
                            <Slider
                              value={[aiConfig.toneSliders[key as keyof typeof aiConfig.toneSliders]]}
                              onValueChange={(values) => setAiConfig(prev => ({
                                ...prev,
                                toneSliders: { ...prev.toneSliders, [key]: values[0] }
                              }))}
                              max={5}
                              min={1}
                              step={1}
                              className="w-full"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Signature Phrases */}
                    <div className="space-y-3">
                      <Label className="text-white text-base font-medium">
                        4. Signature phrases or words to use (3–5)
                      </Label>
                      <div className="space-y-2">
                        {aiConfig.signaturePhrases.map((phrase, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={phrase}
                              onChange={(e) => handlePhraseChange(index, e.target.value, 'signaturePhrases')}
                              placeholder="e.g., 'Here's the thing...', 'Let's be real...'"
                              className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 h-10 rounded-xl focus:bg-white/15 focus:border-purple-400"
                            />
                            {aiConfig.signaturePhrases.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removePhrases(index, 'signaturePhrases')}
                                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        ))}
                        {aiConfig.signaturePhrases.length < 5 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addPhrase('signaturePhrases')}
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                          >
                            + Add phrase
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Evidence Policy */}
                    <div className="space-y-3">
                      <Label className="text-white text-base font-medium">
                        5. Evidence policy
                      </Label>
                      <RadioGroup 
                        value={aiConfig.evidencePolicy} 
                        onValueChange={(value) => setAiConfig(prev => ({ ...prev, evidencePolicy: value }))}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="always" id="always" />
                          <Label htmlFor="always" className="text-white text-sm">Always cite YouTube clips</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="factual-only" id="factual-only" />
                          <Label htmlFor="factual-only" className="text-white text-sm">Only when making factual claims</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="never" id="never-cite" />
                          <Label htmlFor="never-cite" className="text-white text-sm">Never cite unless asked</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Info Card */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-400/20 rounded-2xl p-6">
                      <h3 className="font-semibold text-purple-300 mb-4 flex items-center gap-2 text-lg">
                        <Zap className="w-5 h-5" />
                        AI Quickstart Configuration
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-purple-200">
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-400 mt-0.5" />
                          <span>Essential questions for quick setup</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-400 mt-0.5" />
                          <span>Based on professional AI config best practices</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-400 mt-0.5" />
                          <span>Can be refined later in dashboard</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-400 mt-0.5" />
                          <span>Perfect for getting started quickly</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Questions */}
                {currentStep === 4 && (
                  <div className="space-y-8">
                    <div className="text-center mb-8">
                      <p className="text-gray-300 text-lg">
                        Add starter questions that fans might ask your AI. These help visitors get started.
                      </p>
                    </div>

                    <div className="space-y-6">
                      {[1, 2, 3].map((num) => (
                        <div key={num} className="space-y-3">
                          <Label htmlFor={`question${num}`} className="text-white text-base font-medium">
                            Question {num} {num === 1 ? '*' : '(Optional)'}
                          </Label>
                          <Input
                            id={`question${num}`}
                            value={questions[`question${num}` as keyof typeof questions]}
                            onChange={(e) => setQuestions(prev => ({ 
                              ...prev, 
                              [`question${num}`]: e.target.value 
                            }))}
                            placeholder={
                              num === 1 ? "What's your best advice for beginners?" :
                              num === 2 ? "How did you get started in your field?" :
                              "What's your favorite project you've worked on?"
                            }
                            className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 h-12 text-lg rounded-xl focus:bg-white/15 focus:border-green-400"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-400/20 rounded-2xl p-8">
                      <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-blue-600 mb-4 shadow-lg">
                          <Zap className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-green-300 mb-2 text-2xl">
                          Ready to Launch!
                        </h3>
                        <p className="text-green-200 text-lg mb-6">
                          Your AI replica will be live and ready to interact with fans in seconds.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-white/5 rounded-xl">
                          <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                          <div className="font-medium text-white">Profile Ready</div>
                          <div className="text-sm text-gray-400">All set up</div>
                        </div>
                        <div className="text-center p-4 bg-white/5 rounded-xl">
                          <Play className="w-8 h-8 text-green-400 mx-auto mb-2" />
                          <div className="font-medium text-white">{videos.filter(v => v.selected).length} Videos</div>
                          <div className="text-sm text-gray-400">Ready for training</div>
                        </div>
                        <div className="text-center p-4 bg-white/5 rounded-xl">
                          <Bot className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                          <div className="font-medium text-white">AI Configured</div>
                          <div className="text-sm text-gray-400">Personality defined</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1 || loading}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl px-6 h-12"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>

            <div className="flex items-center gap-4">
              {currentStep < steps.length ? (
                <Button
                  size="lg"
                  onClick={() => {
                    console.log('🔘 Button clicked, currentStep:', currentStep)
                    if (currentStep === 1) {
                      console.log('🔘 Calling handleChannelSubmit')
                      handleChannelSubmit()
                    } else if (currentStep === 2) {
                      console.log('🔘 Step 2 complete - starting background video processing')
                      handleVideoSelectionComplete()
                    } else {
                      console.log('🔘 Moving to next step')
                      setCurrentStep(prev => prev + 1)
                    }
                  }}
                  disabled={
                    loading ||
                    (currentStep === 1 && (
                      !basicInfo.username ||
                      !basicInfo.displayName ||
                      !basicInfo.youtubeChannelUrl ||
                      !!validationErrors.username ||
                      !!validationErrors.youtubeChannelUrl ||
                      validationLoading.username ||
                      validationLoading.youtubeChannelUrl ||
                      (!validationSuccess.username && basicInfo.username.length >= 3) ||
                      (!validationSuccess.youtubeChannelUrl && basicInfo.youtubeChannelUrl.length > 0)
                    )) ||
                    (currentStep === 2 && videos.filter(v => v.selected).length === 0) ||
                    (currentStep === 3 && !aiConfig.agentName.trim())
                  }
                  className={`bg-gradient-to-r ${currentStepData.color} hover:opacity-90 text-white rounded-xl px-8 h-12 text-lg font-semibold shadow-lg`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      {currentStep === 1 ? 'Analyzing...' : 'Loading...'}
                    </>
                  ) : (
                    <>
                      {currentStep === 1 ? 'Analyze Channel' : 'Continue'}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => {
                    console.log('🔥 DEBUG: Button clicked!')
                    console.log('🔥 DEBUG: Loading state before click:', loading)
                    console.log('🔥 DEBUG: ProcessingVideos state before click:', processingVideos)
                    console.log('🔥 DEBUG: Button disabled state:', loading || processingVideos)
                    handleFinalSubmit()
                  }}
                  disabled={false}
                  className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white rounded-xl px-8 h-14 text-xl font-bold shadow-lg shadow-green-500/25"
                >
                  {loading || processingVideos ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin mr-3" />
                      {processingVideos ? 'Processing Videos...' : 'Finalizing...'}
                    </>
                  ) : (
                    <>
                      🚀 Launch My AI Replica
                      <ExternalLink className="w-6 h-6 ml-3" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  )
}