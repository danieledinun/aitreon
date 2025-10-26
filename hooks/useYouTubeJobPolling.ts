import { useState, useEffect, useCallback, useRef } from 'react'

interface JobStatus {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  channelId?: string
  errorMessage?: string
  result?: {
    channelId: string
    channelName: string
    channelThumbnail: string
    subscriberCount: string | null
    totalVideos: number
    videos: Array<{
      id: string
      title: string
      thumbnail: string
      duration: string
      publishedAt: string
      description: string
      viewCount: number
      url: string
    }>
  }
  metadata?: any
}

interface UseYouTubeJobPollingOptions {
  jobId: string | null
  onComplete?: (result: JobStatus['result']) => void
  onError?: (error: string) => void
  pollInterval?: number
  maxRetries?: number
}

/**
 * Hook to poll YouTube analysis job status
 * Automatically polls the job status endpoint and handles completion/errors
 */
export function useYouTubeJobPolling({
  jobId,
  onComplete,
  onError,
  pollInterval = 2000, // Poll every 2 seconds
  maxRetries = 3
}: UseYouTubeJobPollingOptions) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retriesRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  const fetchJobStatus = useCallback(async () => {
    if (!jobId) return

    try {
      console.log(`📊 Polling job status: ${jobId}`)

      const response = await fetch(`/api/youtube/job-status/${jobId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.status}`)
      }

      const data: JobStatus = await response.json()
      setJobStatus(data)
      retriesRef.current = 0 // Reset retries on successful fetch

      console.log(`📊 Job status: ${data.status}, progress: ${data.progress}%`)

      // Handle completion
      if (data.status === 'completed' && data.result) {
        console.log('✅ Job completed successfully')
        stopPolling()
        onComplete?.(data.result)
      }

      // Handle failure
      if (data.status === 'failed') {
        console.error('❌ Job failed:', data.errorMessage)
        stopPolling()
        const errorMsg = data.errorMessage || 'Job failed'
        setError(errorMsg)
        onError?.(errorMsg)
      }

    } catch (err) {
      console.error('Error fetching job status:', err)

      retriesRef.current++

      // Stop polling after max retries
      if (retriesRef.current >= maxRetries) {
        stopPolling()
        const errorMsg = 'Failed to fetch job status after multiple attempts'
        setError(errorMsg)
        onError?.(errorMsg)
      }
    }
  }, [jobId, onComplete, onError, stopPolling, maxRetries])

  // Start polling when jobId is provided
  useEffect(() => {
    if (!jobId) {
      stopPolling()
      return
    }

    console.log(`🎬 Starting job polling for: ${jobId}`)
    setIsPolling(true)
    setError(null)
    retriesRef.current = 0

    // Fetch immediately
    fetchJobStatus()

    // Then poll at regular intervals
    pollIntervalRef.current = setInterval(fetchJobStatus, pollInterval)

    // Cleanup on unmount or jobId change
    return () => {
      stopPolling()
    }
  }, [jobId, fetchJobStatus, pollInterval, stopPolling])

  return {
    jobStatus,
    isPolling,
    error,
    stopPolling
  }
}
