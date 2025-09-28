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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ProConfigData {
  // Identity & Framing (Q1-3)
  agentName: string
  agentIntro: string
  aiLabelStyle: string
  
  // Audience & Goals (Q4-6)
  primaryAudiences: string[]
  topOutcomes: string[]
  ctaPreferences: string[]
  
  // Voice & Style - Tone sliders (Q7)
  directness: number
  humor: number
  empathy: number
  formality: number
  spiciness: number
  
  // Content preferences (Q8-12)
  sentenceLength: string
  useRhetoricalQs: string
  formatDefault: string
  maxBulletsPerAnswer: number
  useHeaders: boolean
  useEmojis: string
  
  // Language & phrases (Q13-17)
  goToVerbs: string[]
  catchphrases: string[]
  avoidWords: string[]
  openPatterns: string[]
  closePatterns: string[]
  
  // Content policy & safety (Q18-20)
  sensitiveDomains: string[]
  redLines: string[]
  competitorPolicy: string
  misinfoHandling: boolean
  
  // Evidence & citations (Q21-22)
  citationPolicy: string
  citationFormat: string
  recencyBias: string
  
  // Answer patterns (Q23-24)
  defaultTemplate: string
  lengthLimit: string
  uncertaintyHandling: string
  followUpStyle: string
  
  // Multilingual (Q25)
  supportedLanguages: string[]
  translateDisplay: boolean
}

const AUDIENCE_OPTIONS = [
  'Fans Q&A', 'Product Advice', 'Career Tips', 'Hot Takes', 'Tutorials', 
  'Entertainment', 'Educational Content', 'Brand Partnerships', 'Technical Support',
  'Community Building', 'Personal Development', 'Industry Insights'
]

const OUTCOME_OPTIONS = [
  'Increase engagement', 'Drive sales', 'Build authority', 'Educate audience',
  'Generate leads', 'Build community', 'Share knowledge', 'Personal branding',
  'Product promotion', 'Thought leadership'
]

const CTA_OPTIONS = [
  'Subscribe to channel', 'Visit website', 'Buy product', 'Join community',
  'Follow social media', 'Download resource', 'Book consultation', 'Share content',
  'Leave comment', 'Join newsletter'
]

const SENSITIVE_DOMAINS = [
  'health advice', 'financial advice', 'legal advice', 'political opinions',
  'medical diagnosis', 'investment recommendations', 'relationship advice',
  'parenting advice', 'mental health', 'diet/nutrition'
]

const REDLINE_OPTIONS = [
  'Give medical diagnosis', 'Provide financial advice', 'Share personal info',
  'Endorse competitors', 'Make political statements', 'Give legal advice',
  'Share private conversations', 'Make investment recommendations'
]

const LANGUAGE_OPTIONS = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'hi', 'ar', 'ru'
]

interface ProFormProps {
  onSubmit: (data: ProConfigData) => void
  onCancel: () => void
  initialData?: Partial<ProConfigData>
}

export default function ProForm({ onSubmit, onCancel, initialData = {} }: ProFormProps) {
  const [data, setData] = useState<ProConfigData>({
    // Identity & Framing
    agentName: '',
    agentIntro: '',
    aiLabelStyle: 'SUBTLE',
    
    // Audience & Goals
    primaryAudiences: [],
    topOutcomes: [],
    ctaPreferences: [],
    
    // Voice & Style
    directness: 3,
    humor: 3,
    empathy: 3,
    formality: 3,
    spiciness: 3,
    
    // Content preferences
    sentenceLength: 'MEDIUM',
    useRhetoricalQs: 'SOMETIMES',
    formatDefault: 'BULLETS',
    maxBulletsPerAnswer: 5,
    useHeaders: true,
    useEmojis: 'SOMETIMES',
    
    // Language & phrases
    goToVerbs: [''],
    catchphrases: [''],
    avoidWords: [''],
    openPatterns: [''],
    closePatterns: [''],
    
    // Content policy & safety
    sensitiveDomains: [],
    redLines: [],
    competitorPolicy: 'NEUTRAL',
    misinfoHandling: true,
    
    // Evidence & citations
    citationPolicy: 'FACTUAL',
    citationFormat: 'INLINE',
    recencyBias: 'BALANCED',
    
    // Answer patterns
    defaultTemplate: 'STANCE_BULLETS',
    lengthLimit: 'MEDIUM',
    uncertaintyHandling: 'NEAREST',
    followUpStyle: 'ONE_QUESTION',
    
    // Multilingual
    supportedLanguages: ['en'],
    translateDisplay: false,
    
    ...initialData
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(data)
  }

  const handleArrayChange = (field: keyof ProConfigData, index: number, value: string) => {
    setData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).map((item, i) => i === index ? value : item)
    }))
  }

  const addArrayItem = (field: keyof ProConfigData) => {
    setData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), '']
    }))
  }

  const removeArrayItem = (field: keyof ProConfigData, index: number) => {
    setData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }))
  }

  const handleMultiSelect = (field: keyof ProConfigData, option: string, checked: boolean) => {
    setData(prev => ({
      ...prev,
      [field]: checked 
        ? [...(prev[field] as string[]), option]
        : (prev[field] as string[]).filter(item => item !== option)
    }))
  }

  const ToneSlider = ({ label, value, onChange, description }: { 
    label: string
    value: number
    onChange: (value: number) => void
    description: string
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between">
        <div>
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
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
    <Card className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">AI Replica Pro Configuration</h2>
        <p className="text-muted-foreground">Complete 25-question setup for advanced personality customization</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Identity & Framing */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Identity & Framing</h3>
          
          <div className="space-y-2">
            <Label htmlFor="agentName">1. Agent name</Label>
            <Input
              id="agentName"
              value={data.agentName}
              onChange={(e) => setData(prev => ({ ...prev, agentName: e.target.value }))}
              placeholder="e.g., FitnessGuru AI, CookingMaster..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentIntro">2. Agent intro/tagline</Label>
            <Textarea
              id="agentIntro"
              value={data.agentIntro}
              onChange={(e) => setData(prev => ({ ...prev, agentIntro: e.target.value }))}
              placeholder="e.g., 'Your personal fitness coach, here 24/7 to help you reach your goals'"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>3. AI label style</Label>
            <RadioGroup 
              value={data.aiLabelStyle} 
              onValueChange={(value) => setData(prev => ({ ...prev, aiLabelStyle: value }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PROMINENT" id="prominent" />
                <Label htmlFor="prominent">Prominent - Always show "AI Assistant"</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="SUBTLE" id="subtle" />
                <Label htmlFor="subtle">Subtle - Small disclaimer</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="OFF" id="off" />
                <Label htmlFor="off">Off - No AI labels</Label>
              </div>
            </RadioGroup>
          </div>
        </section>

        {/* Audience & Goals */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Audience & Goals</h3>
          
          <div className="space-y-3">
            <Label>4. Primary audiences (select 3-5)</Label>
            <div className="grid grid-cols-3 gap-3">
              {AUDIENCE_OPTIONS.map((audience) => (
                <div key={audience} className="flex items-center space-x-2">
                  <Checkbox
                    id={audience}
                    checked={data.primaryAudiences.includes(audience)}
                    onCheckedChange={(checked) => handleMultiSelect('primaryAudiences', audience, checked as boolean)}
                  />
                  <Label htmlFor={audience} className="text-sm">{audience}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>5. Top 3 outcomes you want</Label>
            <div className="grid grid-cols-2 gap-3">
              {OUTCOME_OPTIONS.map((outcome) => (
                <div key={outcome} className="flex items-center space-x-2">
                  <Checkbox
                    id={outcome}
                    checked={data.topOutcomes.includes(outcome)}
                    onCheckedChange={(checked) => handleMultiSelect('topOutcomes', outcome, checked as boolean)}
                  />
                  <Label htmlFor={outcome} className="text-sm">{outcome}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>6. Call-to-action preferences</Label>
            <div className="grid grid-cols-2 gap-3">
              {CTA_OPTIONS.map((cta) => (
                <div key={cta} className="flex items-center space-x-2">
                  <Checkbox
                    id={cta}
                    checked={data.ctaPreferences.includes(cta)}
                    onCheckedChange={(checked) => handleMultiSelect('ctaPreferences', cta, checked as boolean)}
                  />
                  <Label htmlFor={cta} className="text-sm">{cta}</Label>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Voice & Style */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Voice & Style</h3>
          
          <div className="space-y-4">
            <Label>7. Tone sliders (1-5)</Label>
            <div className="grid grid-cols-1 gap-6">
              <ToneSlider
                label="Directness"
                description="How direct vs diplomatic"
                value={data.directness}
                onChange={(value) => setData(prev => ({ ...prev, directness: value }))}
              />
              <ToneSlider
                label="Humor"
                description="How much humor to inject"
                value={data.humor}
                onChange={(value) => setData(prev => ({ ...prev, humor: value }))}
              />
              <ToneSlider
                label="Empathy"
                description="How emotionally supportive"
                value={data.empathy}
                onChange={(value) => setData(prev => ({ ...prev, empathy: value }))}
              />
              <ToneSlider
                label="Formality"
                description="How formal vs casual"
                value={data.formality}
                onChange={(value) => setData(prev => ({ ...prev, formality: value }))}
              />
              <ToneSlider
                label="Spiciness"
                description="How controversial/edgy"
                value={data.spiciness}
                onChange={(value) => setData(prev => ({ ...prev, spiciness: value }))}
              />
            </div>
          </div>
        </section>

        {/* Content Preferences */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Content Preferences</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>8. Sentence length</Label>
              <Select value={data.sentenceLength} onValueChange={(value) => setData(prev => ({ ...prev, sentenceLength: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHORT">Short (≤15 words)</SelectItem>
                  <SelectItem value="MEDIUM">Medium (15-25 words)</SelectItem>
                  <SelectItem value="LONG">Long (25+ words)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>9. Use rhetorical questions</Label>
              <Select value={data.useRhetoricalQs} onValueChange={(value) => setData(prev => ({ ...prev, useRhetoricalQs: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEVER">Never</SelectItem>
                  <SelectItem value="SOMETIMES">Sometimes</SelectItem>
                  <SelectItem value="OFTEN">Often</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>10. Default format</Label>
              <Select value={data.formatDefault} onValueChange={(value) => setData(prev => ({ ...prev, formatDefault: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BULLETS">Bullet points</SelectItem>
                  <SelectItem value="PARAGRAPHS">Paragraphs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>11. Max bullets per answer</Label>
              <Select value={data.maxBulletsPerAnswer.toString()} onValueChange={(value) => setData(prev => ({ ...prev, maxBulletsPerAnswer: parseInt(value) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="useHeaders"
              checked={data.useHeaders}
              onCheckedChange={(checked) => setData(prev => ({ ...prev, useHeaders: checked as boolean }))}
            />
            <Label htmlFor="useHeaders">12. Use headers/subheadings</Label>
          </div>

          <div className="space-y-3">
            <Label>Emoji usage</Label>
            <RadioGroup 
              value={data.useEmojis} 
              onValueChange={(value) => setData(prev => ({ ...prev, useEmojis: value }))}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="NEVER" id="emoji-never" />
                <Label htmlFor="emoji-never">Never</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="SOMETIMES" id="emoji-sometimes" />
                <Label htmlFor="emoji-sometimes">Sometimes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="OFTEN" id="emoji-often" />
                <Label htmlFor="emoji-often">Often</Label>
              </div>
            </RadioGroup>
          </div>
        </section>

        {/* Language & Phrases */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Language & Phrases</h3>
          
          {[
            { field: 'goToVerbs' as const, label: '13. Go-to verbs/adjectives (10-15)', placeholder: 'e.g., "dive into", "powerful", "game-changing"' },
            { field: 'catchphrases' as const, label: '14. Catchphrases/signature phrases (5-8)', placeholder: 'e.g., "Here\'s the thing...", "Let me break this down"' },
            { field: 'avoidWords' as const, label: '15. Words to avoid (5-10)', placeholder: 'e.g., "amazing", "literally", "honestly"' },
            { field: 'openPatterns' as const, label: '16. Typical openers (3-5)', placeholder: 'e.g., "Great question!", "I love this topic"' },
            { field: 'closePatterns' as const, label: '17. Typical closers (3-5)', placeholder: 'e.g., "Hope that helps!", "Let me know what you think"' }
          ].map(({ field, label, placeholder }) => (
            <div key={field} className="space-y-3">
              <Label>{label}</Label>
              <div className="space-y-2">
                {data[field].map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => handleArrayChange(field, index, e.target.value)}
                      placeholder={placeholder}
                    />
                    {data[field].length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeArrayItem(field, index)}
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
                  onClick={() => addArrayItem(field)}
                >
                  Add item
                </Button>
              </div>
            </div>
          ))}
        </section>

        {/* Content Policy & Safety */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Content Policy & Safety</h3>
          
          <div className="space-y-3">
            <Label>18. Sensitive domains (require disclaimers)</Label>
            <div className="grid grid-cols-2 gap-3">
              {SENSITIVE_DOMAINS.map((domain) => (
                <div key={domain} className="flex items-center space-x-2">
                  <Checkbox
                    id={domain}
                    checked={data.sensitiveDomains.includes(domain)}
                    onCheckedChange={(checked) => handleMultiSelect('sensitiveDomains', domain, checked as boolean)}
                  />
                  <Label htmlFor={domain} className="text-sm">{domain}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>19. Red lines (never do these)</Label>
            <div className="grid grid-cols-2 gap-3">
              {REDLINE_OPTIONS.map((redline) => (
                <div key={redline} className="flex items-center space-x-2">
                  <Checkbox
                    id={redline}
                    checked={data.redLines.includes(redline)}
                    onCheckedChange={(checked) => handleMultiSelect('redLines', redline, checked as boolean)}
                  />
                  <Label htmlFor={redline} className="text-sm">{redline}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>20. Competitor policy</Label>
            <RadioGroup 
              value={data.competitorPolicy} 
              onValueChange={(value) => setData(prev => ({ ...prev, competitorPolicy: value }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="COMPARE" id="compare" />
                <Label htmlFor="compare">Compare - Mention competitors when helpful</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="NEUTRAL" id="neutral" />
                <Label htmlFor="neutral">Neutral - Acknowledge but don't promote</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="AVOID" id="avoid" />
                <Label htmlFor="avoid">Avoid - Don't mention competitors</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="misinfoHandling"
              checked={data.misinfoHandling}
              onCheckedChange={(checked) => setData(prev => ({ ...prev, misinfoHandling: checked as boolean }))}
            />
            <Label htmlFor="misinfoHandling">Show conflicting sources when relevant</Label>
          </div>
        </section>

        {/* Evidence & Citations */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Evidence & Citations</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>21. Citation policy</Label>
              <Select value={data.citationPolicy} onValueChange={(value) => setData(prev => ({ ...prev, citationPolicy: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALWAYS">Always cite with timestamps</SelectItem>
                  <SelectItem value="FACTUAL">Only for factual claims</SelectItem>
                  <SelectItem value="REQUEST">Only when requested</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Citation format</Label>
              <Select value={data.citationFormat} onValueChange={(value) => setData(prev => ({ ...prev, citationFormat: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INLINE">Inline with text</SelectItem>
                  <SelectItem value="BULLETS">Bullet list at end</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>22. Recency bias</Label>
              <Select value={data.recencyBias} onValueChange={(value) => setData(prev => ({ ...prev, recencyBias: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEWEST">Prioritize newest content</SelectItem>
                  <SelectItem value="BALANCED">Balance new and popular</SelectItem>
                  <SelectItem value="NEUTRAL">No recency preference</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Answer Patterns */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Answer Patterns</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>23. Default template</Label>
              <Select value={data.defaultTemplate} onValueChange={(value) => setData(prev => ({ ...prev, defaultTemplate: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANCE_BULLETS">Stance + bullets</SelectItem>
                  <SelectItem value="PLAYBOOK">Step-by-step playbook</SelectItem>
                  <SelectItem value="PARAGRAPH">Paragraph + example</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>24. Length limit</Label>
              <Select value={data.lengthLimit} onValueChange={(value) => setData(prev => ({ ...prev, lengthLimit: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHORT">Short (≤120 words)</SelectItem>
                  <SelectItem value="MEDIUM">Medium (≤250 words)</SelectItem>
                  <SelectItem value="LONG">Long (≤400 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Uncertainty handling</Label>
              <Select value={data.uncertaintyHandling} onValueChange={(value) => setData(prev => ({ ...prev, uncertaintyHandling: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEAREST">Show nearest clip + "not found"</SelectItem>
                  <SelectItem value="BEST_GUESS">Best guess + flag uncertainty</SelectItem>
                  <SelectItem value="CLARIFY">Ask clarifying question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Follow-up style</Label>
              <Select value={data.followUpStyle} onValueChange={(value) => setData(prev => ({ ...prev, followUpStyle: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONE_QUESTION">Ask one clarifying question</SelectItem>
                  <SelectItem value="ASSUMPTIONS">Make assumptions explicit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Multilingual */}
        <section className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">Multilingual</h3>
          
          <div className="space-y-3">
            <Label>25. Supported languages</Label>
            <div className="grid grid-cols-4 gap-3">
              {LANGUAGE_OPTIONS.map((lang) => (
                <div key={lang} className="flex items-center space-x-2">
                  <Checkbox
                    id={lang}
                    checked={data.supportedLanguages.includes(lang)}
                    onCheckedChange={(checked) => handleMultiSelect('supportedLanguages', lang, checked as boolean)}
                  />
                  <Label htmlFor={lang} className="text-sm">{lang.toUpperCase()}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="translateDisplay"
              checked={data.translateDisplay}
              onCheckedChange={(checked) => setData(prev => ({ ...prev, translateDisplay: checked as boolean }))}
            />
            <Label htmlFor="translateDisplay">Show original + translation for non-English responses</Label>
          </div>
        </section>

        <div className="flex gap-3 pt-6 border-t">
          <Button type="submit" className="flex-1">
            Save Pro Configuration
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}