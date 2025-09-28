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
  Mic
} from 'lucide-react'

interface SpeechPatterns {
  catchphrases: string[]
  openingPatterns: string[]
  closingPatterns: string[]
  goToVerbs: string[]
  avoidWords: string[]
  speakingStyle: {
    sentenceStructure: string
    energyLevel: string
    tonality: string
    pacing: string
  }
}

interface AnalysisResult {
  patterns: SpeechPatterns
  confidence: number
  videosAnalyzed: number
  totalWords: number
  aiConfigUpdated: boolean
}

export default function SpeechPatternAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [existingPatterns, setExistingPatterns] = useState<SpeechPatterns | null>(null)
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false)

  // Check for existing speech patterns
  const checkExistingPatterns = async () => {
    if (hasCheckedExisting) return
    
    try {
      const response = await fetch('/api/creator/analyze-speech', { method: 'GET' })
      const data = await response.json()
      
      if (data.hasPatterns) {
        setExistingPatterns(data.patterns)
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
        setAnalysisResult(data.analysis)
        setExistingPatterns(data.analysis.patterns)
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
        <div className="flex items-center gap-3 mb-4">
          <Mic className="h-6 w-6 text-purple-600" />
          <div>
            <h3 className="text-lg font-semibold">Speech Pattern Analysis</h3>
            <p className="text-sm text-gray-600">
              Analyze your video transcripts to extract your unique speaking style, catchphrases, and language patterns
            </p>
          </div>
        </div>

        {!existingPatterns && !analysisResult ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
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
            {analysisResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Analysis Complete!</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p>• Analyzed {analysisResult.videosAnalyzed} videos ({analysisResult.totalWords.toLocaleString()} words)</p>
                  <p>• Confidence score: {analysisResult.confidence}%</p>
                  <p>• AI configuration {analysisResult.aiConfigUpdated ? 'updated successfully' : 'update failed'}</p>
                </div>
              </div>
            )}

            {existingPatterns && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Catchphrases */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    Catchphrases ({existingPatterns.catchphrases.length})
                  </h4>
                  <div className="space-y-2">
                    {existingPatterns.catchphrases.length > 0 ? (
                      existingPatterns.catchphrases.map((phrase, index) => (
                        <Badge key={index} variant="outline" className="mr-2 mb-2">
                          {phrase}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No catchphrases identified</p>
                    )}
                  </div>
                </div>

                {/* Opening Patterns */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Play className="h-4 w-4 text-green-600" />
                    Opening Patterns ({existingPatterns.openingPatterns.length})
                  </h4>
                  <div className="space-y-2">
                    {existingPatterns.openingPatterns.length > 0 ? (
                      existingPatterns.openingPatterns.map((pattern, index) => (
                        <Badge key={index} variant="outline" className="mr-2 mb-2 bg-green-50">
                          {pattern}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No opening patterns identified</p>
                    )}
                  </div>
                </div>

                {/* Closing Patterns */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-orange-600" />
                    Closing Patterns ({existingPatterns.closingPatterns.length})
                  </h4>
                  <div className="space-y-2">
                    {existingPatterns.closingPatterns.length > 0 ? (
                      existingPatterns.closingPatterns.map((pattern, index) => (
                        <Badge key={index} variant="outline" className="mr-2 mb-2 bg-orange-50">
                          {pattern}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No closing patterns identified</p>
                    )}
                  </div>
                </div>

                {/* Go-to Verbs */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    Preferred Words ({existingPatterns.goToVerbs.length})
                  </h4>
                  <div className="space-y-2">
                    {existingPatterns.goToVerbs.length > 0 ? (
                      existingPatterns.goToVerbs.map((verb, index) => (
                        <Badge key={index} variant="outline" className="mr-2 mb-2 bg-purple-50">
                          {verb}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No preferred words identified</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {existingPatterns && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Speaking Style Profile</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Sentence Structure:</span>
                    <span className="ml-2 font-medium">{existingPatterns.speakingStyle.sentenceStructure}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Energy Level:</span>
                    <span className="ml-2 font-medium">{existingPatterns.speakingStyle.energyLevel}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Tonality:</span>
                    <span className="ml-2 font-medium">{existingPatterns.speakingStyle.tonality}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Pacing:</span>
                    <span className="ml-2 font-medium">{existingPatterns.speakingStyle.pacing}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={runAnalysis} disabled={isAnalyzing} variant="outline" className="gap-2">
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Re-analyze Patterns
                  </>
                )}
              </Button>
              
              {existingPatterns && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertCircle className="h-4 w-4" />
                  These patterns are automatically applied to your AI responses
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}