'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'

interface QuickstartData {
  agentName: string
  audiences: string[]
  toneSliders: {
    directness: number
    playfulness: number
    formality: number
    optimism: number
  }
  sentenceLength: string
  formatPreference: string
  emojiUsage: string
  signaturePhrases: string[]
  avoidWords: string[]
  answerShape: string
  evidencePolicy: string
  boundaries: string[]
  uncertaintyHandling: string
  approvalPolicy: string
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

const ANSWER_SHAPES = [
  { value: 'stance-bullets', label: 'One-line stance + 3 bullets' },
  { value: 'paragraph-example', label: 'Short paragraph + 1 example' },
  { value: 'checklist', label: 'Step-by-step checklist (max 5 steps)' }
]

const EVIDENCE_POLICIES = [
  { value: 'always', label: 'Always cite YouTube clips with timecodes' },
  { value: 'factual-only', label: 'Only when making factual claims' },
  { value: 'never', label: 'Never cite unless asked' }
]

const UNCERTAINTY_OPTIONS = [
  { value: 'not-found', label: 'Say "not found" + nearest clip' },
  { value: 'best-guess', label: 'Offer best guess + flag uncertainty' },
  { value: 'follow-up', label: 'Ask a follow-up question first' }
]

interface QuickstartFormProps {
  onSubmit: (data: QuickstartData) => void
  onCancel: () => void
  initialData?: Partial<QuickstartData>
}

export default function QuickstartForm({ onSubmit, onCancel, initialData = {} }: QuickstartFormProps) {
  const [data, setData] = useState<QuickstartData>({
    agentName: '',
    audiences: [],
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
    approvalPolicy: 'immediate',
    ...initialData
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(data)
  }

  const handleAudienceChange = (audience: string, checked: boolean) => {
    setData(prev => ({
      ...prev,
      audiences: checked 
        ? [...prev.audiences, audience]
        : prev.audiences.filter(a => a !== audience)
    }))
  }

  const handlePhraseChange = (index: number, value: string, type: 'signaturePhrases' | 'avoidWords') => {
    setData(prev => ({
      ...prev,
      [type]: prev[type].map((phrase, i) => i === index ? value : phrase)
    }))
  }

  const addPhrase = (type: 'signaturePhrases' | 'avoidWords') => {
    setData(prev => ({
      ...prev,
      [type]: [...prev[type], '']
    }))
  }

  const removePhrases = (index: number, type: 'signaturePhrases' | 'avoidWords') => {
    setData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }))
  }

  const ToneSlider = ({ label, value, onChange }: { 
    label: string
    value: number
    onChange: (value: number) => void 
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between">
        <Label>{label}</Label>
        <span className="text-sm text-muted-foreground">{value}/5</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        max={5}
        min={1}
        step={1}
        className="w-full"
      />
    </div>
  )

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">AI Replica Quickstart</h2>
        <p className="text-muted-foreground">10 questions to get your AI clone up and running</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Agent Name */}
        <div className="space-y-2">
          <Label htmlFor="agentName">1. What should we call your agent?</Label>
          <Input
            id="agentName"
            value={data.agentName}
            onChange={(e) => setData(prev => ({ ...prev, agentName: e.target.value }))}
            placeholder="e.g., FitnessGuru AI, CookingMaster, TechReviewer..."
            required
          />
        </div>

        {/* Audience & Use Cases */}
        <div className="space-y-3">
          <Label>2. Audience & use cases (pick 2–3)</Label>
          <div className="grid grid-cols-2 gap-3">
            {AUDIENCE_OPTIONS.map((audience) => (
              <div key={audience} className="flex items-center space-x-2">
                <Checkbox
                  id={audience}
                  checked={data.audiences.includes(audience)}
                  onCheckedChange={(checked) => handleAudienceChange(audience, checked as boolean)}
                />
                <Label htmlFor={audience} className="text-sm">{audience}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Tone Sliders */}
        <div className="space-y-4">
          <Label>3. Tone sliders (1–5)</Label>
          <div className="grid grid-cols-2 gap-6">
            <ToneSlider
              label="Direct"
              value={data.toneSliders.directness}
              onChange={(value) => setData(prev => ({
                ...prev,
                toneSliders: { ...prev.toneSliders, directness: value }
              }))}
            />
            <ToneSlider
              label="Playful"
              value={data.toneSliders.playfulness}
              onChange={(value) => setData(prev => ({
                ...prev,
                toneSliders: { ...prev.toneSliders, playfulness: value }
              }))}
            />
            <ToneSlider
              label="Formal"
              value={data.toneSliders.formality}
              onChange={(value) => setData(prev => ({
                ...prev,
                toneSliders: { ...prev.toneSliders, formality: value }
              }))}
            />
            <ToneSlider
              label="Optimistic"
              value={data.toneSliders.optimism}
              onChange={(value) => setData(prev => ({
                ...prev,
                toneSliders: { ...prev.toneSliders, optimism: value }
              }))}
            />
          </div>
        </div>

        {/* Sentence & Structure */}
        <div className="space-y-4">
          <Label>4. Sentence & structure</Label>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Sentence length</Label>
              <RadioGroup 
                value={data.sentenceLength} 
                onValueChange={(value) => setData(prev => ({ ...prev, sentenceLength: value }))}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="short" id="short" />
                  <Label htmlFor="short">Short</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="medium" />
                  <Label htmlFor="medium">Medium</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="long" id="long" />
                  <Label htmlFor="long">Long</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label className="text-sm">Format preference</Label>
              <RadioGroup 
                value={data.formatPreference} 
                onValueChange={(value) => setData(prev => ({ ...prev, formatPreference: value }))}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bullets" id="bullets" />
                  <Label htmlFor="bullets">Bullets</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="paragraphs" id="paragraphs" />
                  <Label htmlFor="paragraphs">Paragraphs</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm">Emojis</Label>
              <RadioGroup 
                value={data.emojiUsage} 
                onValueChange={(value) => setData(prev => ({ ...prev, emojiUsage: value }))}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="never" id="never" />
                  <Label htmlFor="never">Never</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sometimes" id="sometimes" />
                  <Label htmlFor="sometimes">Sometimes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="often" id="often" />
                  <Label htmlFor="often">Often</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        {/* Signature Phrases */}
        <div className="space-y-3">
          <Label>5. Signature phrases or words to use (5–10)</Label>
          <div className="space-y-2">
            {data.signaturePhrases.map((phrase, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={phrase}
                  onChange={(e) => handlePhraseChange(index, e.target.value, 'signaturePhrases')}
                  placeholder="e.g., 'Here's the thing...', 'Let's be real...'"
                />
                {data.signaturePhrases.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removePhrases(index, 'signaturePhrases')}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {data.signaturePhrases.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPhrase('signaturePhrases')}
              >
                Add phrase
              </Button>
            )}
          </div>
        </div>

        {/* Words to Avoid */}
        <div className="space-y-3">
          <Label>Words to avoid (3–5)</Label>
          <div className="space-y-2">
            {data.avoidWords.map((word, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={word}
                  onChange={(e) => handlePhraseChange(index, e.target.value, 'avoidWords')}
                  placeholder="e.g., 'amazing', 'literally', 'honestly'..."
                />
                {data.avoidWords.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removePhrases(index, 'avoidWords')}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {data.avoidWords.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPhrase('avoidWords')}
              >
                Add word
              </Button>
            )}
          </div>
        </div>

        {/* Answer Shape */}
        <div className="space-y-3">
          <Label>6. Answer shape default</Label>
          <RadioGroup 
            value={data.answerShape} 
            onValueChange={(value) => setData(prev => ({ ...prev, answerShape: value }))}
            className="space-y-2"
          >
            {ANSWER_SHAPES.map((shape) => (
              <div key={shape.value} className="flex items-center space-x-2">
                <RadioGroupItem value={shape.value} id={shape.value} />
                <Label htmlFor={shape.value}>{shape.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Evidence Policy */}
        <div className="space-y-3">
          <Label>7. Evidence policy</Label>
          <RadioGroup 
            value={data.evidencePolicy} 
            onValueChange={(value) => setData(prev => ({ ...prev, evidencePolicy: value }))}
            className="space-y-2"
          >
            {EVIDENCE_POLICIES.map((policy) => (
              <div key={policy.value} className="flex items-center space-x-2">
                <RadioGroupItem value={policy.value} id={policy.value} />
                <Label htmlFor={policy.value}>{policy.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Boundaries */}
        <div className="space-y-2">
          <Label>8. Topics to avoid or require disclaimer</Label>
          <Textarea
            value={data.boundaries.join(', ')}
            onChange={(e) => setData(prev => ({ 
              ...prev, 
              boundaries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
            }))}
            placeholder="health advice, financial advice, legal advice, political opinions..."
            rows={3}
          />
        </div>

        {/* Uncertainty Handling */}
        <div className="space-y-3">
          <Label>9. When not sure / not in my videos</Label>
          <RadioGroup 
            value={data.uncertaintyHandling} 
            onValueChange={(value) => setData(prev => ({ ...prev, uncertaintyHandling: value }))}
            className="space-y-2"
          >
            {UNCERTAINTY_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Approval Policy */}
        <div className="space-y-3">
          <Label>10. Approval & edits</Label>
          <RadioGroup 
            value={data.approvalPolicy} 
            onValueChange={(value) => setData(prev => ({ ...prev, approvalPolicy: value }))}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="immediate" id="immediate" />
              <Label htmlFor="immediate">Publish answers immediately</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="queue" id="queue" />
              <Label htmlFor="queue">Queue for review</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="high-risk-only" id="high-risk-only" />
              <Label htmlFor="high-risk-only">Only high-risk topics need approval</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex gap-3 pt-6">
          <Button type="submit" className="flex-1">
            Save Configuration
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}