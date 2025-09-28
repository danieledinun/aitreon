'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart3,
  Brain,
  TrendingUp,
  MessageCircle,
  Smile,
  Frown,
  Meh,
  RefreshCw,
  Play,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SentimentStats {
  total: number
  analyzed: number
  positive: number
  negative: number
  neutral: number
}

interface SentimentDashboardProps {
  creatorId: string
  className?: string
}

interface AnalysisResult {
  messageId: string
  content: string
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  confidence: number
}

export default function SentimentDashboard({ creatorId, className }: SentimentDashboardProps) {
  const [stats, setStats] = useState<SentimentStats>({
    total: 0,
    analyzed: 0,
    positive: 0,
    negative: 0,
    neutral: 0
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentResults, setRecentResults] = useState<AnalysisResult[]>([])

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/creator/sentiment-analysis?creatorId=${creatorId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch sentiment stats')
      }

      setStats(data.stats)
      setError(null)
    } catch (error) {
      console.error('Error fetching sentiment stats:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const runSentimentAnalysis = async () => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/creator/sentiment-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creatorId,
          batchSize: 50
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze sentiment')
      }

      if (data.results) {
        setRecentResults(data.results)
      }

      // Refresh stats after analysis
      await fetchStats()

      console.log('✅ Sentiment analysis complete:', data.message)
    } catch (error) {
      console.error('Error running sentiment analysis:', error)
      setError(error instanceof Error ? error.message : 'Failed to analyze sentiment')
    } finally {
      setIsAnalyzing(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [creatorId])

  const analysisProgress = stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0
  const unanalyzed = stats.total - stats.analyzed

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE':
        return <Smile className="h-4 w-4 text-green-500" />
      case 'NEGATIVE':
        return <Frown className="h-4 w-4 text-red-500" />
      case 'NEUTRAL':
        return <Meh className="h-4 w-4 text-gray-500" />
      default:
        return <MessageCircle className="h-4 w-4" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'NEGATIVE':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'NEUTRAL':
        return 'text-gray-600 bg-gray-50 border-gray-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
            <Brain className="h-6 w-6 text-purple-500" />
            Fan Sentiment Analysis
          </h2>
          <p className="text-gray-600 dark:text-neutral-400 mt-1">
            Understand how your fans feel about their interactions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={fetchStats}
            variant="outline"
            size="sm"
            disabled={isLoading || isAnalyzing}
            className="border-gray-300 dark:border-neutral-600"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>

          <Button
            onClick={runSentimentAnalysis}
            disabled={isAnalyzing || unanalyzed === 0}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Analyze {unanalyzed > 0 ? `${unanalyzed} Messages` : 'Messages'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Smile className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Positive</p>
                <p className="text-2xl font-bold text-green-600">{stats.positive.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Frown className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Negative</p>
                <p className="text-2xl font-bold text-red-600">{stats.negative.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Meh className="h-8 w-8 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Neutral</p>
                <p className="text-2xl font-bold text-gray-600">{stats.neutral.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Progress */}
      <Card className="bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Analysis Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-neutral-400">
              Messages Analyzed: {stats.analyzed} of {stats.total}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {analysisProgress}%
            </span>
          </div>
          <Progress value={analysisProgress} className="h-2" />

          {unanalyzed > 0 && (
            <div className="text-sm text-gray-600 dark:text-neutral-400">
              {unanalyzed} messages remaining to analyze
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sentiment Distribution */}
      {stats.analyzed > 0 && (
        <Card className="bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Sentiment Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {Math.round((stats.positive / stats.analyzed) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">Positive</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 mb-1">
                  {Math.round((stats.negative / stats.analyzed) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">Negative</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600 mb-1">
                  {Math.round((stats.neutral / stats.analyzed) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">Neutral</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Analysis Results */}
      {recentResults.length > 0 && (
        <Card className="bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Recent Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentResults.map((result) => (
                <div
                  key={result.messageId}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/30"
                >
                  {getSentimentIcon(result.sentiment)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", getSentimentColor(result.sentiment))}
                      >
                        {result.sentiment}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-neutral-400">
                        {Math.round(result.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-neutral-300 truncate">
                      "{result.content}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}