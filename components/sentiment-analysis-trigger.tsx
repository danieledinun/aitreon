'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

interface SentimentAnalysisTriggerProps {
  creatorId: string
}

export default function SentimentAnalysisTrigger({ creatorId }: SentimentAnalysisTriggerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = async () => {
    setIsAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/admin/analyze-existing-conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze conversations')
      }

      setResult(data)
      console.log('✅ Sentiment analysis complete:', data)
    } catch (error) {
      console.error('❌ Sentiment analysis failed:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/admin/analyze-existing-conversations')
      const data = await response.json()

      if (response.ok) {
        setResult(data)
      }
    } catch (error) {
      console.error('Error checking status:', error)
    }
  }

  return (
    <Card className="bg-white/50 dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
          <Brain className="h-5 w-5 text-purple-500" />
          Sentiment Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-neutral-400">
          Analyze existing conversations to add sentiment badges to your chat sessions.
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div className="text-sm text-green-700 dark:text-green-300">
              {result.message || `Analyzed ${result.processed || 0} messages`}
              {result.stats && (
                <div className="mt-1">
                  Total: {result.stats.total}, Analyzed: {result.stats.analyzed}, Pending: {result.stats.pending}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Analyze Conversations
              </>
            )}
          </Button>

          <Button
            onClick={checkStatus}
            variant="outline"
            size="sm"
            className="border-gray-300 dark:border-neutral-600"
          >
            Check Status
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}