import { useState, useEffect } from 'react'
import type { LearningVideo } from '@/components/ai-replica-learning-status'

interface VideoProcessingLog {
  timestamp: string
  message: string
  videoId?: string
  status?: 'queued' | 'processing' | 'completed' | 'failed'
}

export function useVideoLearningStatus() {
  const [learningVideos, setLearningVideos] = useState<LearningVideo[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchProcessingStatus = async () => {
    try {
      setIsLoading(true)
      
      // Fetch processing logs
      const response = await fetch('/api/processing-logs')
      const data = await response.json()
      
      if (data.logs && Array.isArray(data.logs)) {
        // Parse logs to extract video processing information
        const videoMap = new Map<string, Partial<LearningVideo>>()
        
        data.logs.forEach((log: string) => {
          // Parse logs for video processing messages
          // Look for patterns like "✅ Episode queued for MCP GraphRAG processing: YouTube Video: [Title] (ID: [UUID])"
          const episodeQueuedMatch = log.match(/✅ Episode queued for MCP GraphRAG processing: YouTube Video: (.+?) \(ID: ([^)]+)\)/)
          const videoProcessingMatch = log.match(/🎥 Processing video: (.+?) \(([^)]+)\)/)
          const videoCompletedMatch = log.match(/✅ Video processed: (.+?) \(([^)]+)\)/)
          
          if (episodeQueuedMatch) {
            const [, title, id] = episodeQueuedMatch
            videoMap.set(id, {
              id,
              title: title.trim(),
              status: 'queued' as const,
              addedAt: new Date(),
            })
          }
          
          if (videoProcessingMatch) {
            const [, title, id] = videoProcessingMatch
            const existing = videoMap.get(id) || {}
            videoMap.set(id, {
              ...existing,
              id,
              title: title.trim(),
              status: 'processing' as const,
              addedAt: existing.addedAt || new Date(),
            })
          }
          
          if (videoCompletedMatch) {
            const [, title, id] = videoCompletedMatch
            const existing = videoMap.get(id) || {}
            videoMap.set(id, {
              ...existing,
              id,
              title: title.trim(),
              status: 'completed' as const,
              addedAt: existing.addedAt || new Date(),
            })
          }
        })
        
        // Convert map to array and fill in missing properties
        const videos = Array.from(videoMap.values())
          .map((video): LearningVideo => ({
            id: video.id || '',
            title: video.title || 'Unknown Video',
            status: video.status || 'queued',
            addedAt: video.addedAt || new Date(),
            duration: 600, // Default 10 minutes if unknown
            estimatedProcessingTime: calculateProcessingTime(video.title || '', 600)
          }))
          .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime()) // Sort by when they were added
        
        // Only show videos from the last 24 hours and active processing
        const recentVideos = videos.filter(video => {
          const isRecent = Date.now() - video.addedAt.getTime() < 24 * 60 * 60 * 1000 // 24 hours
          const isActive = video.status === 'processing' || video.status === 'queued'
          const isRecentlyCompleted = video.status === 'completed' && 
            Date.now() - video.addedAt.getTime() < 5 * 60 * 1000 // 5 minutes
          
          return isRecent && (isActive || isRecentlyCompleted)
        })
        
        setLearningVideos(recentVideos)
      } else {
        setLearningVideos([])
      }
    } catch (error) {
      console.error('Error fetching video learning status:', error)
      setLearningVideos([])
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate estimated processing time based on title and duration
  const calculateProcessingTime = (title: string, duration: number): number => {
    const baseTime = 30 // Base 30 seconds
    const durationMinutes = Math.ceil(duration / 60)
    const timePerMinute = 10 // 10 seconds per minute of video
    
    return baseTime + (durationMinutes * timePerMinute)
  }

  // Fetch status on mount and then every 10 seconds
  useEffect(() => {
    fetchProcessingStatus()
    
    const interval = setInterval(fetchProcessingStatus, 10000) // Every 10 seconds
    
    return () => clearInterval(interval)
  }, [])

  return {
    learningVideos,
    isLoading,
    refetch: fetchProcessingStatus
  }
}