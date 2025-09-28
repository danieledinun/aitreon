'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SyncProgress {
  stage: 'discovery' | 'transcripts' | 'processing' | 'complete'
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
  startedAt: null
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

  const startSync = async (type: 'single' | 'playlist' | 'channel', payload: any) => {
    setSyncState({
      isActive: true,
      progress: { stage: 'discovery', current: 0, total: 0, message: 'Starting sync...' },
      result: null,
      syncType: type,
      startedAt: new Date()
    })

    try {
      const response = await fetch('/api/creator/sync-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...payload })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'progress') {
                  setSyncState(prev => ({
                    ...prev,
                    progress: {
                      stage: data.stage,
                      current: data.current,
                      total: data.total,
                      currentItem: data.currentItem,
                      message: data.message
                    }
                  }))
                } else if (data.type === 'complete') {
                  const result: SyncResult = {
                    videosFound: data.videosFound,
                    transcriptsExtracted: data.transcriptsExtracted,
                    segmentsProcessed: data.segmentsProcessed,
                    successRate: data.successRate,
                    errors: data.errors || []
                  }
                  
                  setSyncState(prev => ({
                    ...prev,
                    isActive: false,
                    result,
                    progress: { stage: 'complete', current: data.total, total: data.total, message: 'Sync complete!' }
                  }))
                  
                  // Auto-clear result after 30 seconds
                  setTimeout(() => {
                    setSyncState(prev => ({
                      ...prev,
                      result: null,
                      progress: null
                    }))
                  }, 30000)
                }
              } catch (e) {
                console.warn('Failed to parse progress data:', line)
              }
            }
          }
        }
      } else {
        // Handle regular JSON response
        const data = await response.json()
        const result: SyncResult = {
          videosFound: data.videosFound,
          transcriptsExtracted: data.transcriptsExtracted,
          segmentsProcessed: data.segmentsProcessed,
          successRate: data.successRate,
          errors: data.errors || []
        }
        
        setSyncState(prev => ({
          ...prev,
          isActive: false,
          result,
          progress: { stage: 'complete', current: 1, total: 1, message: 'Sync complete!' }
        }))
      }

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