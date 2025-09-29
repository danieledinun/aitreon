'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, AlertCircle, Clock, Play, Download, Brain, Key, UserX, Database } from 'lucide-react'

interface ProcessingStats {
  totalVideos: number
  processedVideos: number
  totalChunks: number
  chunksByLevel: Record<string, number>
  totalWords: number
  averageConfidence: number
  languageDistribution: Record<string, number>
}

interface ProcessingStatusProps {
  creatorName: string
}

export default function ProcessingStatus({ creatorName }: ProcessingStatusProps) {
  const [stats, setStats] = useState<ProcessingStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [refreshingToken, setRefreshingToken] = useState(false)
  const [resettingTokens, setResettingTokens] = useState(false)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/creator/process-content')
      const data = await response.json()
      setStats(data.stats)
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }


  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/processing-logs')
      const data = await response.json()
      if (data.logs) {
        setLogs(data.logs)
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchLogs()
    const statsInterval = setInterval(() => {
      fetchStats()
    }, 5000) // Poll every 5 seconds
    const logsInterval = setInterval(fetchLogs, 2000) // Poll logs more frequently
    return () => {
      clearInterval(statsInterval)
      clearInterval(logsInterval)
    }
  }, [])

  const startProcessing = async () => {
    setProcessing(true)
    setError(null)
    
    // Clear previous logs
    await fetch('/api/processing-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true })
    })
    
    setLogs([
      '🚀 Starting quota-conscious knowledge base processing...',
      '📊 Processing up to 5 videos to understand chunking process',
      '🔍 Processing 5 videos to analyze how chunking and knowledge processing works'
    ])

    try {
      // Process 5 videos to understand chunking and knowledge processing
      const response = await fetch('/api/creator/process-content?maxVideos=5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed')
      }

      // Add completion logs
      const completionLogs = [
        `📹 Found ${data.result.totalVideos} total videos`,
        `✅ Successfully processed ${data.result.processedVideos} videos`,
        `🧠 Created ${data.result.totalChunks} knowledge chunks`,
      ]

      if (data.result.quotaLimited) {
        completionLogs.push(`⚠️ Processing stopped early due to quota limits`)
        completionLogs.push(`💡 Request YouTube API quota increase to process all videos`)
      }

      if (data.result.errors && data.result.errors.length > 0) {
        completionLogs.push(`⚠️ ${data.result.errors.length} errors encountered`)
        completionLogs.push(...data.result.errors.map((err: string) => `   • ${err}`))
      }

      completionLogs.push('🎉 Knowledge base processing complete!')

      // Send completion logs to server
      for (const log of completionLogs) {
        await fetch('/api/processing-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: log })
        })
      }

      await fetchStats()
      await fetchLogs()
    } catch (err: any) {
      setError(err.message)
      const errorLog = `❌ Error: ${err.message}`
      setLogs(prev => [...prev, errorLog])
      
      // Send error log to server
      await fetch('/api/processing-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: errorLog })
      })
    } finally {
      setProcessing(false)
    }
  }

  const refreshToken = async () => {
    setRefreshingToken(true)
    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setLogs(prev => [...prev, '✅ Token refreshed successfully'])
        setError(null)
      } else {
        setLogs(prev => [...prev, `❌ Token refresh failed: ${data.error}`])
        setError(data.error)
        
        if (data.needsReauth) {
          setLogs(prev => [...prev, '🔄 Please reconnect your YouTube account'])
        }
      }
    } catch (err) {
      setLogs(prev => [...prev, `❌ Token refresh error: ${err}`])
      setError('Token refresh failed')
    } finally {
      setRefreshingToken(false)
    }
  }

  const resetAndReconnect = async () => {
    setResettingTokens(true)
    try {
      const response = await fetch('/api/auth/reset-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setLogs(prev => [...prev, '✅ Cleared expired tokens'])
        setError(null)
        
        if (data.needsSignIn) {
          setLogs(prev => [...prev, '🔄 Redirecting to sign in...'])
          // Redirect to sign in page
          window.location.href = '/auth/signin'
        }
      } else {
        setLogs(prev => [...prev, `❌ Reset failed: ${data.error}`])
        setError(data.error)
      }
    } catch (err) {
      setLogs(prev => [...prev, `❌ Reset error: ${err}`])
      setError('Reset failed')
    } finally {
      setResettingTokens(false)
    }
  }

  // GraphRAG stats are automatically synced during video processing

  const getProcessingProgress = () => {
    if (!stats) return 0
    if (stats.totalVideos === 0) return 0
    return (stats.processedVideos / stats.totalVideos) * 100
  }

  const getStatusIcon = () => {
    if (processing) return <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
    if (error) return <AlertCircle className="w-5 h-5 text-red-500" />
    if (stats && stats.processedVideos === stats.totalVideos && stats.totalVideos > 0) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <Clock className="w-5 h-5 text-yellow-500" />
  }

  const getStatusText = () => {
    if (processing) return 'Processing & syncing knowledge base...'
    if (error) return 'Processing failed'
    if (stats && stats.processedVideos === stats.totalVideos && stats.totalVideos > 0) {
      return 'Knowledge base ready for AI responses'
    }
    if (stats && stats.totalVideos > 0) {
      return 'Knowledge base incomplete'
    }
    return 'No videos found'
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Knowledge Base Status</h3>
            <p className="text-sm text-gray-600">{getStatusText()}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={refreshToken}
            disabled={refreshingToken || processing || resettingTokens}
            variant="outline"
            size="sm"
          >
            {refreshingToken ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Refresh Token
              </>
            )}
          </Button>
          <Button 
            onClick={resetAndReconnect}
            disabled={resettingTokens || processing || refreshingToken}
            variant="outline"
            size="sm"
          >
            {resettingTokens ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <UserX className="w-4 h-4 mr-2" />
                Reset & Reconnect
              </>
            )}
          </Button>
          <Button 
            onClick={startProcessing} 
            disabled={processing || loading || refreshingToken || resettingTokens}
            variant={stats && stats.totalChunks > 0 ? "secondary" : "default"}
            size="sm"
          >
            {processing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                {stats && stats.totalChunks > 0 ? 'Reprocess' : 'Process Videos'}
              </>
            )}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Videos Processed</span>
              <span>{stats?.processedVideos || 0} of {stats?.totalVideos || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProcessingProgress()}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-3 bg-blue-50 border-blue-200">
              <Play className="w-5 h-5 text-blue-600 mb-1" />
              <div className="text-lg font-semibold text-gray-900">{stats?.totalVideos || 0}</div>
              <div className="text-xs text-gray-600">Total Videos</div>
            </div>
            <div className="card p-3 bg-green-50 border-green-200">
              <CheckCircle className="w-5 h-5 text-green-600 mb-1" />
              <div className="text-lg font-semibold text-gray-900">{stats?.processedVideos || 0}</div>
              <div className="text-xs text-gray-600">Processed</div>
            </div>
            <div className="card p-3 bg-purple-50 border-purple-200">
              <Brain className="w-5 h-5 text-purple-600 mb-1" />
              <div className="text-lg font-semibold text-gray-900">{stats?.totalChunks || 0}</div>
              <div className="text-xs text-gray-600">Knowledge Chunks</div>
            </div>
            <div className="card p-3 bg-orange-50 border-orange-200">
              <Download className="w-5 h-5 text-orange-600 mb-1" />
              <div className="text-lg font-semibold text-gray-900">{(stats.totalWords || 0).toLocaleString()}</div>
              <div className="text-xs text-gray-600">Total Words</div>
            </div>
          </div>


          {/* Chunk Breakdown */}
          {Object.keys(stats.chunksByLevel || {}).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Chunk Breakdown</h4>
              <div className="space-y-1">
                {Object.entries(stats.chunksByLevel || {}).map(([level, count]) => (
                  <div key={level} className="flex justify-between text-sm">
                    <span className="capitalize text-gray-600">{level} level:</span>
                    <span className="font-medium text-gray-900">{count} chunks</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processing Logs */}
      {logs.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Processing Log</h4>
          <div className="card p-3 bg-gray-50 max-h-48 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="text-sm text-gray-700 font-mono mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 card p-4 bg-red-50 border-red-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700 font-medium">Processing Error</span>
          </div>
          <p className="text-sm text-red-600 mt-2">{error}</p>
        </div>
      )}

      {/* Instructions */}
      {stats && stats.totalChunks === 0 && (
        <div className="mt-6 card p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Knowledge Base Empty</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Your AI won't have any content to reference until videos are processed. 
                {stats.totalVideos > 0 ? ' Click "Process Videos" to start.' : ' Make sure your YouTube account has videos with captions.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Token Issues */}
      {error && error.includes('refresh') && (
        <div className="mt-4 card p-4 bg-red-50 border-red-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Authentication Issue</h4>
              <p className="text-sm text-red-700 mt-1">
                Your YouTube access tokens have expired. This commonly happens when:
              </p>
              <ul className="text-sm text-red-700 mt-2 ml-4 list-disc space-y-1">
                <li>You haven't used the app for several days/weeks</li>
                <li>You've reached your YouTube API quota limit</li>
                <li>Google's security policies require re-authentication</li>
              </ul>
              <p className="text-sm text-red-700 mt-2">
                Click <strong>"Reset & Reconnect"</strong> to fix this issue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quota Issues */}
      {error && error.includes('quota') && (
        <div className="mt-4 card p-4 bg-orange-50 border-orange-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-orange-800">YouTube API Quota Exceeded</h4>
              <p className="text-sm text-orange-700 mt-1">
                You've reached the YouTube API daily quota limit (10,000 units). This resets at midnight PST.
              </p>
              <p className="text-sm text-orange-700 mt-2">
                Try again tomorrow, or wait a few hours if you just hit the rate limit (100 requests/minute).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}