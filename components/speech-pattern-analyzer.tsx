'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Brain,
  MessageSquare,
  Play,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Mic,
  TrendingUp,
  Zap
} from 'lucide-react'

interface SignaturePhrase {
  phrase: string
  frequency: number
}

interface SpeechAnalysisData {
  signaturePhrases: SignaturePhrase[]
  communicationMetrics: Record<string, number>
  analyzedAt: string
}

export default function SpeechPatternAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisData, setAnalysisData] = useState<SpeechAnalysisData | null>(null)
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false)

  // Check for existing speech patterns
  const checkExistingPatterns = async () => {
    if (hasCheckedExisting) return

    try {
      const response = await fetch('/api/creator/analyze-speech', { method: 'GET' })
      const data = await response.json()

      if (data.hasPatterns) {
        setAnalysisData({
          signaturePhrases: data.signaturePhrases,
          communicationMetrics: data.communicationMetrics,
          analyzedAt: data.analyzedAt
        })
      }
      setHasCheckedExisting(true)
    } catch (error) {
      console.error('Error checking existing patterns:', error)
      setHasCheckedExisting(true)
    }
  }

  // Run speech pattern analysis
  const runAnalysis = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/creator/analyze-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (data.success) {
        alert('Analysis complete! Refreshing patterns...')
        // Reload patterns from database
        await checkExistingPatterns()
        window.location.reload() // Reload to fetch latest data
      } else {
        alert(`Analysis failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      alert('Failed to analyze speech patterns')
    }
    setIsAnalyzing(false)
  }

  // Initialize by checking existing patterns
  if (!hasCheckedExisting) {
    checkExistingPatterns()
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mic className="h-6 w-6 text-purple-600" />
            <div>
              <h3 className="text-lg font-semibold">Speech Pattern Analysis</h3>
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                Automatically extracted from your video transcripts
              </p>
            </div>
          </div>
          {analysisData && (
            <Badge variant="outline" className="text-xs">
              Last analyzed: {new Date(analysisData.analyzedAt).toLocaleDateString()}
            </Badge>
          )}
        </div>

        {!analysisData ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-400 dark:text-neutral-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-neutral-400 mb-4">
              No speech patterns analyzed yet. Run analysis to extract your unique speaking style from your video transcripts.
            </p>
            <Button onClick={runAnalysis} disabled={isAnalyzing} className="gap-2">
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyzing Videos...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Analyze Speech Patterns
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Signature Phrases */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium">Signature Phrases ({analysisData.signaturePhrases.length})</h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mb-3">
                These phrases are automatically incorporated into your AI responses to match your speaking style
              </p>
              <div className="flex flex-wrap gap-2">
                {analysisData.signaturePhrases.map((item, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  >
                    <span className="mr-2">"{item.phrase}"</span>
                    <span className="text-xs text-gray-500 dark:text-neutral-500">×{item.frequency}</span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Communication Metrics */}
            {Object.keys(analysisData.communicationMetrics).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <h4 className="font-medium">Communication Style Metrics</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-neutral-400 mb-3">
                  Quantitative analysis of your communication patterns
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(analysisData.communicationMetrics).map(([metric, value]) => (
                    <div
                      key={metric}
                      className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">{metric}</span>
                        <Zap className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">
                        {typeof value === 'number' ? value.toFixed(1) : value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-neutral-400">
                <AlertCircle className="h-4 w-4" />
                <span>These patterns are automatically applied to your AI prompts</span>
              </div>
              <Button onClick={runAnalysis} disabled={isAnalyzing} variant="outline" size="sm" className="gap-2">
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Re-analyze
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
