'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import {
  Mic,
  MessageSquare,
  Clock,
  TrendingUp,
  Target,
  Sparkles,
  PlayCircle,
  Loader2,
  RefreshCw,
  Copy,
  CheckCircle,
  AlertCircle,
  Brain,
  Zap,
  BarChart3
} from 'lucide-react'

interface SpeechAnalysisData {
  total_words?: number
  total_segments?: number
  speaking_rate_wpm?: number
  avg_sentence_length?: number
  signature_phrases?: Record<string, number>
  communication_style?: {
    enthusiasm_ratio?: number
    instructional_ratio?: number
    tone?: string
  }
  pov_analysis?: {
    first_person_ratio?: number
    second_person_ratio?: number
    direct_address?: boolean
  }
}

interface StyleCard {
  id: string
  style_card_text: string
  signature_phrases?: Record<string, number>
  communication_metrics?: any
  ai_prompting_guidelines?: string
  created_at: string
}

interface AIStyleCardProps {
  creatorId: string
  creatorName: string
}

export default function AIStyleCard({ creatorId, creatorName }: AIStyleCardProps) {
  const [speechData, setSpeechData] = useState<SpeechAnalysisData | null>(null)
  const [styleCard, setStyleCard] = useState<StyleCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [testText, setTestText] = useState('')
  const [scoreResult, setScoreResult] = useState<{ score: number; recommendations: string[] } | null>(null)
  const [scoringText, setScoringText] = useState(false)
  const [copiedCard, setCopiedCard] = useState(false)

  useEffect(() => {
    fetchSpeechAnalysis()
  }, [creatorId])

  const fetchSpeechAnalysis = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/creator/speech-analysis?creatorId=${creatorId}`)
      const data = await response.json()

      if (data.success) {
        setSpeechData(data.data.speechAnalysis?.analysis_data)
        setStyleCard(data.data.styleCard)
      }
    } catch (error) {
      console.error('Error fetching speech analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const runAnalysis = async () => {
    try {
      setAnalyzing(true)
      const response = await fetch('/api/creator/speech-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          action: 'analyze'
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetchSpeechAnalysis() // Refresh data
      } else {
        alert(`Analysis failed: ${data.error || data.message}`)
      }
    } catch (error) {
      console.error('Error running analysis:', error)
      alert('Failed to run speech analysis')
    } finally {
      setAnalyzing(false)
    }
  }

  const scoreText = async () => {
    if (!testText.trim()) return

    try {
      setScoringText(true)
      const response = await fetch('/api/creator/speech-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          action: 'score',
          text: testText
        })
      })

      const data = await response.json()

      if (data.success) {
        setScoreResult(data.data)
      } else {
        alert(`Scoring failed: ${data.error || data.message}`)
      }
    } catch (error) {
      console.error('Error scoring text:', error)
      alert('Failed to score text')
    } finally {
      setScoringText(false)
    }
  }

  const copyStyleCard = async () => {
    if (styleCard?.style_card_text) {
      await navigator.clipboard.writeText(styleCard.style_card_text)
      setCopiedCard(true)
      setTimeout(() => setCopiedCard(false), 2000)
    }
  }

  const formatPercentage = (value?: number) => {
    if (typeof value !== 'number') return '0%'
    return `${(value * 100).toFixed(1)}%`
  }

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="h-16 w-16 mx-auto mb-4 text-blue-500 animate-spin" />
        <h3 className="text-lg font-semibold mb-2">Loading Speech Analysis...</h3>
        <p className="text-gray-600 dark:text-neutral-400">
          Fetching AI style profile data
        </p>
      </Card>
    )
  }

  if (!speechData && !styleCard) {
    return (
      <Card className="p-12 text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
        <Brain className="h-16 w-16 mx-auto mb-4 text-purple-500" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
          AI Style Analysis Available
        </h3>
        <p className="text-gray-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
          Analyze your speech patterns and communication style to create a personalized AI style card for more authentic responses.
        </p>
        <Button
          onClick={runAnalysis}
          disabled={analyzing}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing Speech Patterns...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI Style Card
            </>
          )}
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Speech Pattern Metrics */}
      {speechData && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <BarChart3 className="h-5 w-5" />
              Speech Pattern Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{speechData.total_words?.toLocaleString() || 0}</div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">Words Analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{speechData.speaking_rate_wpm?.toFixed(0) || 0}</div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">Words/Minute</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{speechData.avg_sentence_length?.toFixed(1) || 0}</div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">Avg Sentence Length</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{speechData.total_segments || 0}</div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">Content Segments</div>
              </div>
            </div>

            {speechData.signature_phrases && Object.keys(speechData.signature_phrases).length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Signature Phrases
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(speechData.signature_phrases)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8)
                    .map(([phrase, count]) => (
                      <Badge key={phrase} variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        "{phrase}" ({count})
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Style Card */}
      {styleCard && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                <Brain className="h-5 w-5" />
                AI Style Card for {creatorName}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={copyStyleCard}
                  variant="outline"
                  size="sm"
                  className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-950/20"
                >
                  {copiedCard ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  variant="outline"
                  size="sm"
                  className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-950/20"
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Regenerate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-neutral-200 font-mono leading-relaxed">
                {styleCard.style_card_text}
              </pre>
            </div>

            <div className="mt-4 text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/30 p-3 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-3 w-3" />
                <strong>AI Integration Ready</strong>
              </div>
              This style card can be used in AI prompts to make your AI replica speak more authentically like you.
              Generated: {new Date(styleCard.created_at).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Text Style Scorer */}
      {speechData && (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <Target className="h-5 w-5" />
              Style Similarity Tester
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Test how well text matches your communication style:
              </label>
              <Textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Enter some text to analyze how similar it is to your speaking style..."
                className="min-h-[100px] bg-white dark:bg-neutral-800 border-amber-200 dark:border-amber-700"
              />
            </div>

            <Button
              onClick={scoreText}
              disabled={!testText.trim() || scoringText}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {scoringText ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Style Match...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Check Style Similarity
                </>
              )}
            </Button>

            {scoreResult && (
              <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-amber-200 dark:border-amber-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Style Similarity Score</h4>
                  <Badge
                    variant={scoreResult.score > 0.7 ? "default" : scoreResult.score > 0.4 ? "secondary" : "destructive"}
                    className="text-sm"
                  >
                    {(scoreResult.score * 100).toFixed(1)}%
                  </Badge>
                </div>

                {scoreResult.recommendations && scoreResult.recommendations.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-800 dark:text-neutral-200 mb-2">Recommendations:</h5>
                    <ul className="space-y-1">
                      {scoreResult.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-gray-600 dark:text-neutral-400 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}