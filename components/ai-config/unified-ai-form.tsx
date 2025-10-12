'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Bot, User, MessageSquare, Settings, Heart, Zap, Shield, CheckCircle } from 'lucide-react'

interface UnifiedAIConfig {
  // Core Identity (Essential)
  agentName: string
  agentIntro: string

  // Personality (Essential)
  directness: number
  humor: number
  empathy: number
  formality: number

  // Content Style (Essential)
  sentenceLength: 'SHORT' | 'MEDIUM' | 'LONG'
  useEmojis: 'NEVER' | 'SOMETIMES' | 'OFTEN'
  formatDefault: 'PARAGRAPH' | 'BULLETS' | 'MIXED'

  // Signature Elements (Optional)
  catchphrases: string[]
  avoidWords: string[]

  // Content Policy (Essential)
  redLines: string[]
  competitorPolicy: 'NEUTRAL' | 'SUPPORTIVE' | 'AVOID'
}

interface UnifiedAIFormProps {
  onSubmit: (config: UnifiedAIConfig) => void
  onCancel: () => void
  loading: boolean
  initialData?: Partial<UnifiedAIConfig>
}

export default function UnifiedAIForm({ onSubmit, onCancel, loading, initialData }: UnifiedAIFormProps) {
  const [config, setConfig] = useState<UnifiedAIConfig>({
    agentName: '',
    agentIntro: '',
    directness: 3,
    humor: 3,
    empathy: 4,
    formality: 3,
    sentenceLength: 'MEDIUM',
    useEmojis: 'SOMETIMES',
    formatDefault: 'BULLETS',
    catchphrases: [''],
    avoidWords: [''],
    redLines: [''],
    competitorPolicy: 'NEUTRAL'
  })

  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (initialData) {
      setConfig(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  const steps = [
    {
      id: 'identity',
      title: 'Identity & Introduction',
      icon: User,
      description: 'How should your AI introduce itself?'
    },
    {
      id: 'personality',
      title: 'Personality Traits',
      icon: Heart,
      description: 'Define your communication style'
    },
    {
      id: 'content',
      title: 'Content Style',
      icon: MessageSquare,
      description: 'How should responses be formatted?'
    },
    {
      id: 'signature',
      title: 'Signature Elements',
      icon: Zap,
      description: 'Your unique phrases and language'
    },
    {
      id: 'policy',
      title: 'Content Policies',
      icon: Shield,
      description: 'Set boundaries and guidelines'
    }
  ]

  const updateArrayField = (field: keyof UnifiedAIConfig, index: number, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).map((item, i) => i === index ? value : item)
    }))
  }

  const addArrayItem = (field: keyof UnifiedAIConfig) => {
    setConfig(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), '']
    }))
  }

  const removeArrayItem = (field: keyof UnifiedAIConfig, index: number) => {
    setConfig(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }))
  }

  const isStepValid = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: return config.agentName.length > 0 && config.agentIntro.length > 10
      case 1: return true // Personality sliders always valid
      case 2: return true // Content style always valid
      case 3: return true // Signature elements optional
      case 4: return true // Policy optional but recommended
      default: return false
    }
  }

  const getCompletionPercentage = (): number => {
    const essential = [
      config.agentName.length > 0,
      config.agentIntro.length > 10,
      true, // personality always set
      true, // content style always set
    ]
    const optional = [
      config.catchphrases.some(p => p.length > 0),
      config.redLines.some(r => r.length > 0)
    ]

    const essentialScore = essential.filter(Boolean).length / essential.length * 80
    const optionalScore = optional.filter(Boolean).length / optional.length * 20

    return Math.round(essentialScore + optionalScore)
  }

  const handleSubmit = () => {
    // Clean up arrays - remove empty strings
    const cleanConfig = {
      ...config,
      catchphrases: config.catchphrases.filter(p => p.trim().length > 0),
      avoidWords: config.avoidWords.filter(w => w.trim().length > 0),
      redLines: config.redLines.filter(r => r.trim().length > 0)
    }
    onSubmit(cleanConfig)
  }

  const renderStepContent = () => {
    const step = steps[currentStep]

    switch (step.id) {
      case 'identity':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="agentName" className="text-sm font-medium">What should your AI be called?</Label>
              <Input
                id="agentName"
                value={config.agentName}
                onChange={(e) => setConfig(prev => ({ ...prev, agentName: e.target.value }))}
                placeholder="e.g., Alex's AI Assistant, FitnessCoach Pro, etc."
                className="text-base"
              />
              <p className="text-xs text-gray-500">This is how your AI will introduce itself to users</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentIntro" className="text-sm font-medium">How should your AI introduce itself?</Label>
              <Textarea
                id="agentIntro"
                value={config.agentIntro}
                onChange={(e) => setConfig(prev => ({ ...prev, agentIntro: e.target.value }))}
                placeholder="e.g., I'm here to help you with fitness advice based on my years of experience as a personal trainer..."
                className="min-h-[100px] text-base"
                maxLength={300}
              />
              <p className="text-xs text-gray-500">{config.agentIntro.length}/300 characters. Describe your expertise and what you help with.</p>
            </div>
          </div>
        )

      case 'personality':
        return (
          <div className="space-y-8">
            <p className="text-sm text-gray-600">Adjust these sliders to match your communication style:</p>

            {[
              { key: 'directness', label: 'Direct Communication', left: 'Gentle & Diplomatic', right: 'Direct & Straightforward' },
              { key: 'humor', label: 'Use of Humor', left: 'Serious Tone', right: 'Playful & Funny' },
              { key: 'empathy', label: 'Empathy Level', left: 'Objective & Factual', right: 'Warm & Understanding' },
              { key: 'formality', label: 'Formality', left: 'Casual & Friendly', right: 'Professional & Formal' }
            ].map(({ key, label, left, right }) => (
              <div key={key} className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">{label}</Label>
                  <Badge variant="outline">{config[key as keyof UnifiedAIConfig]}/5</Badge>
                </div>
                <Slider
                  value={[config[key as keyof UnifiedAIConfig] as number]}
                  onValueChange={([value]) => setConfig(prev => ({ ...prev, [key]: value }))}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{left}</span>
                  <span>{right}</span>
                </div>
              </div>
            ))}
          </div>
        )

      case 'content':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Preferred sentence length</Label>
              <RadioGroup
                value={config.sentenceLength}
                onValueChange={(value) => setConfig(prev => ({ ...prev, sentenceLength: value as any }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="SHORT" id="short" />
                  <Label htmlFor="short" className="text-sm">Short & punchy (5-10 words)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MEDIUM" id="medium" />
                  <Label htmlFor="medium" className="text-sm">Medium length (10-20 words)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="LONG" id="long" />
                  <Label htmlFor="long" className="text-sm">Detailed explanations (20+ words)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Response format preference</Label>
              <Select value={config.formatDefault} onValueChange={(value) => setConfig(prev => ({ ...prev, formatDefault: value as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARAGRAPH">Paragraph format</SelectItem>
                  <SelectItem value="BULLETS">Bullet points</SelectItem>
                  <SelectItem value="MIXED">Mix of both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Emoji usage</Label>
              <RadioGroup
                value={config.useEmojis}
                onValueChange={(value) => setConfig(prev => ({ ...prev, useEmojis: value as any }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="NEVER" id="never" />
                  <Label htmlFor="never" className="text-sm">Never use emojis</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="SOMETIMES" id="sometimes" />
                  <Label htmlFor="sometimes" className="text-sm">Occasionally use emojis</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="OFTEN" id="often" />
                  <Label htmlFor="often" className="text-sm">Use emojis frequently</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )

      case 'signature':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Signature phrases (optional)</Label>
              <p className="text-xs text-gray-500">Phrases you commonly use that make your responses feel authentic</p>
              {config.catchphrases.map((phrase, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={phrase}
                    onChange={(e) => updateArrayField('catchphrases', index, e.target.value)}
                    placeholder="e.g., 'Let's break this down...', 'Here's the thing...'"
                    className="flex-1"
                  />
                  {config.catchphrases.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem('catchphrases', index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem('catchphrases')}
                className="w-full"
              >
                Add Another Phrase
              </Button>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Words to avoid (optional)</Label>
              <p className="text-xs text-gray-500">Words or phrases that don't fit your style</p>
              {config.avoidWords.map((word, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={word}
                    onChange={(e) => updateArrayField('avoidWords', index, e.target.value)}
                    placeholder="e.g., 'utilize', 'leverage', overly formal terms..."
                    className="flex-1"
                  />
                  {config.avoidWords.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem('avoidWords', index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem('avoidWords')}
                className="w-full"
              >
                Add Another Word
              </Button>
            </div>
          </div>
        )

      case 'policy':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Content boundaries</Label>
              <p className="text-xs text-gray-500">Topics your AI should avoid or handle carefully</p>
              {config.redLines.map((line, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={line}
                    onChange={(e) => updateArrayField('redLines', index, e.target.value)}
                    placeholder="e.g., 'Medical diagnosis', 'Financial advice', 'Political opinions'..."
                    className="flex-1"
                  />
                  {config.redLines.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem('redLines', index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem('redLines')}
                className="w-full"
              >
                Add Another Boundary
              </Button>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">How to handle competitor mentions</Label>
              <RadioGroup
                value={config.competitorPolicy}
                onValueChange={(value) => setConfig(prev => ({ ...prev, competitorPolicy: value as any }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="NEUTRAL" id="neutral" />
                  <Label htmlFor="neutral" className="text-sm">Stay neutral and objective</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="SUPPORTIVE" id="supportive" />
                  <Label htmlFor="supportive" className="text-sm">Be supportive when appropriate</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AVOID" id="avoid" />
                  <Label htmlFor="avoid" className="text-sm">Avoid discussing competitors</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const completion = getCompletionPercentage()

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Configuration</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{completion}% Complete</span>
            <CheckCircle className={`w-5 h-5 ${completion === 100 ? 'text-green-500' : 'text-gray-300'}`} />
          </div>
        </div>
        <Progress value={completion} className="w-full h-2" />
      </div>

      {/* Step Navigation */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = index === currentStep
          const isCompleted = index < currentStep || (index === currentStep && isStepValid(index))

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex flex-col items-center cursor-pointer transition-all ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}
                onClick={() => setCurrentStep(index)}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : isCompleted
                      ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-center max-w-[80px]">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(steps[currentStep].icon, { className: "w-5 h-5" })}
            {steps[currentStep].title}
          </CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <div>
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => prev - 1)}
            >
              Previous
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!isStepValid(currentStep)}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !isStepValid(currentStep)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}