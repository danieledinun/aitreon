'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SyncProgress {
  stage: 'discovery' | 'processing' | 'complete'
  current: number
  total: number
  currentItem?: string
  message?: string
}

interface SyncResult {
  videosFound: number
  transcriptsExtracted: number
  segmentsProcessed: number
  successRate: number
  errors: string[]
}

interface SyncState {
  isActive: boolean
  progress: SyncProgress | null
  result: SyncResult | null
  syncType: 'single' | 'playlist' | 'channel' | null
  startedAt: Date | null
  jobId: string | null
}

interface SyncContextType {
  syncState: SyncState
  startSync: (type: 'single' | 'playlist' | 'channel', payload: any) => Promise<void>
  stopSync: () => void
  resetSync: () => void
}

const defaultSyncState: SyncState = {
  isActive: false,
  progress: null,
  result: null,
  syncType: null,
  startedAt: null,
  jobId: null
}

const SyncContext = createContext<SyncContextType | undefined>(undefined)

export const useSyncContext = () => {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider')
  }
  return context
}

interface SyncProviderProps {
  children: ReactNode
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [syncState, setSyncState] = useState<SyncState>(defaultSyncState)

  // Persist sync state to localStorage to survive page navigation
  useEffect(() => {
    const savedState = localStorage.getItem('syncState')
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.startedAt) {
          parsed.startedAt = new Date(parsed.startedAt)
        }
        setSyncState(parsed)

        // If there's an active job, resume polling
        if (parsed.jobId && parsed.isActive) {
          console.log('📊 Resuming sync job polling:', parsed.jobId)
          pollJobStatus(parsed.jobId)
        }
      } catch (error) {
        console.warn('Failed to restore sync state:', error)
      }
    }
  }, [])

  useEffect(() => {
    if (syncState.isActive || syncState.result) {
      localStorage.setItem('syncState', JSON.stringify(syncState))
    } else {
      localStorage.removeItem('syncState')
    }
  }, [syncState])

  // Poll job status using the same pattern as onboarding
  const pollJobStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/creator/job-status/${jobId}`)

        if (!response.ok) {
          console.error('Failed to fetch job status:', response.status)
          return
        }

        const data = await response.json()

        // Update progress
        setSyncState(prev => ({
          ...prev,
          progress: {
            stage: data.status === 'completed' ? 'complete' : 'processing',
            current: data.videos_processed || 0,
            total: data.video_ids?.length || 0,
            message: data.status === 'processing'
              ? `Processing ${data.videos_processed}/${data.video_ids?.length} videos...`
              : data.status === 'completed'
              ? 'Sync complete!'
              : 'Processing videos...'
          }
        }))

        // Handle completion
        if (data.status === 'completed') {
          clearInterval(pollInterval)

          const result: SyncResult = {
            videosFound: data.video_ids?.length || 0,
            transcriptsExtracted: data.videos_processed || 0,
            segmentsProcessed: 0, // Not tracked in job
            successRate: ((data.videos_processed || 0) / (data.video_ids?.length || 1)) * 100,
            errors: data.videos_failed > 0 ? [`${data.videos_failed} video(s) failed to process`] : []
          }

          setSyncState(prev => ({
            ...prev,
            isActive: false,
            result,
            progress: {
              stage: 'complete',
              current: data.videos_processed || 0,
              total: data.video_ids?.length || 0,
              message: 'Sync complete!'
            }
          }))

          // Auto-clear result after 30 seconds
          setTimeout(() => {
            setSyncState(prev => ({
              ...prev,
              result: null,
              progress: null,
              jobId: null
            }))
          }, 30000)
        }

        // Handle failure
        if (data.status === 'failed') {
          clearInterval(pollInterval)

          setSyncState(prev => ({
            ...prev,
            isActive: false,
            result: {
              videosFound: data.video_ids?.length || 0,
              transcriptsExtracted: 0,
              segmentsProcessed: 0,
              successRate: 0,
              errors: [data.error_message || 'Job failed']
            },
            progress: {
              stage: 'complete',
              current: 0,
              total: data.video_ids?.length || 0,
              message: 'Sync failed'
            }
          }))
        }

      } catch (error) {
        console.error('Error polling job status:', error)
      }
    }, 2000) // Poll every 2 seconds

    // Clean up on unmount or when job completes
    return () => clearInterval(pollInterval)
  }

  const startSync = async (type: 'single' | 'playlist' | 'channel', payload: any) => {
    setSyncState({
      isActive: true,
      progress: { stage: 'discovery', current: 0, total: 0, message: 'Creating processing job...' },
      result: null,
      syncType: type,
      startedAt: new Date(),
      jobId: null
    })

    try {
      // Create job via API (new approach)
      const response = await fetch('/api/creator/sync-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...payload })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.jobId) {
        throw new Error('No job ID returned from server')
      }

      console.log('✅ Sync job created:', data.jobId)

      // Update state with job ID and start polling
      setSyncState(prev => ({
        ...prev,
        jobId: data.jobId,
        progress: {
          stage: 'processing',
          current: 0,
          total: data.videoCount || 0,
          message: `Processing ${data.videoCount} video${data.videoCount > 1 ? 's' : ''}...`
        }
      }))

      // Start polling for job status
      pollJobStatus(data.jobId)

    } catch (error) {
      console.error('Sync failed:', error)
      setSyncState(prev => ({
        ...prev,
        isActive: false,
        result: {
          videosFound: 0,
          transcriptsExtracted: 0,
          segmentsProcessed: 0,
          successRate: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        },
        progress: { stage: 'complete', current: 0, total: 1, message: 'Sync failed' }
      }))
    }
  }

  const stopSync = () => {
    setSyncState(prev => ({
      ...prev,
      isActive: false
    }))
  }

  const resetSync = () => {
    setSyncState(defaultSyncState)
    localStorage.removeItem('syncState')
  }

  return (
    <SyncContext.Provider value={{ syncState, startSync, stopSync, resetSync }}>
      {children}
    </SyncContext.Provider>
  )
}
