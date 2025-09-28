'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Youtube, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export default function YouTubeSyncButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    data?: any
  } | null>(null)

  const handleSync = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/youtube/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync YouTube data')
      }

      setResult({
        success: true,
        message: 'YouTube sync completed successfully!',
        data: data.data
      })

      // Refresh the page after successful sync
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={handleSync}
        disabled={loading}
        variant="secondary"
        className="flex items-center space-x-2"
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Youtube className="w-4 h-4" />
        )}
        <span>{loading ? 'Syncing...' : 'Sync YouTube'}</span>
      </Button>

      {result && (
        <div className={`p-4 rounded-xl border ${
          result.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${
                result.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {result.message}
              </p>
              
              {result.success && result.data && (
                <div className="mt-3 text-sm text-green-800">
                  <p><strong>Channel:</strong> {result.data.channel.title}</p>
                  <p><strong>Subscribers:</strong> {Number(result.data.channel.subscriberCount).toLocaleString()}</p>
                  <p><strong>Videos synced:</strong> {result.data.sync.newVideos} new, {result.data.sync.processedVideos} with transcripts</p>
                  {result.data.creator.profileUrl && (
                    <p>
                      <strong>Profile:</strong>{' '}
                      <a 
                        href={result.data.creator.profileUrl} 
                        className="text-green-600 hover:text-green-700 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        /{result.data.creator.username} →
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}