'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Clock, CheckCircle, Eye, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LearningVideo {
  id: string
  title: string
  duration?: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  addedAt: Date
  estimatedProcessingTime?: number
}

interface AIReplicaLearningStatusProps {
  className?: string
  videos?: LearningVideo[]
  onClose?: () => void
}

const estimateProcessingTime = (videos: LearningVideo[]): number => {
  const queuedAndProcessing = videos.filter(v => 
    v.status === 'queued' || v.status === 'processing'
  )
  
  if (queuedAndProcessing.length === 0) return 0
  
  // Base estimation: 30 seconds per video + 10 seconds per minute of video duration
  const baseTimePerVideo = 30 // seconds
  const timePerMinuteOfVideo = 10 // seconds
  
  let totalEstimatedSeconds = 0
  
  queuedAndProcessing.forEach(video => {
    let videoEstimate = baseTimePerVideo
    
    if (video.duration) {
      // Convert duration from seconds to minutes and add processing time
      videoEstimate += Math.ceil(video.duration / 60) * timePerMinuteOfVideo
    } else {
      // Default assumption: 12 minute average video
      videoEstimate += 12 * timePerMinuteOfVideo
    }
    
    totalEstimatedSeconds += videoEstimate
  })
  
  return Math.max(totalEstimatedSeconds, 30) // Minimum 30 seconds
}

const formatTimeRemaining = (seconds: number): string => {
  if (seconds < 60) return `${seconds} seconds`
  
  const minutes = Math.ceil(seconds / 60)
  if (minutes === 1) return '1 minute'
  if (minutes < 60) return `${minutes} minutes`
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (hours === 1) {
    return remainingMinutes > 0 ? `1 hour ${remainingMinutes} minutes` : '1 hour'
  }
  
  return remainingMinutes > 0 
    ? `${hours} hours ${remainingMinutes} minutes` 
    : `${hours} hours`
}

const getLearningMessage = (
  queuedCount: number, 
  processingCount: number, 
  completedCount: number,
  totalCount: number
): { primary: string; secondary: string; icon: React.ComponentType } => {
  if (processingCount > 0) {
    return {
      primary: `Your AI Replica is watching and memorizing ${processingCount} video${processingCount > 1 ? 's' : ''}...`,
      secondary: `${completedCount} of ${totalCount} videos learned • ${queuedCount} waiting in queue`,
      icon: Eye
    }
  }
  
  if (queuedCount > 0) {
    return {
      primary: `${queuedCount} video${queuedCount > 1 ? 's' : ''} ready for your AI Replica to learn`,
      secondary: `${completedCount} videos already learned • Starting processing...`,
      icon: Brain
    }
  }
  
  if (completedCount > 0) {
    return {
      primary: 'Your AI Replica has finished learning!',
      secondary: `Successfully processed ${completedCount} video${completedCount > 1 ? 's' : ''} • Ready for enhanced conversations`,
      icon: CheckCircle
    }
  }
  
  return {
    primary: 'No videos currently being processed',
    secondary: 'Add more videos to enhance your AI Replica\'s knowledge',
    icon: Brain
  }
}

export function AIReplicaLearningStatus({ 
  className, 
  videos = [],
  onClose 
}: AIReplicaLearningStatusProps) {
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const queuedVideos = videos.filter(v => v.status === 'queued')
  const processingVideos = videos.filter(v => v.status === 'processing')
  const completedVideos = videos.filter(v => v.status === 'completed')
  const failedVideos = videos.filter(v => v.status === 'failed')
  
  const activeVideos = [...queuedVideos, ...processingVideos]
  const hasActiveProcessing = activeVideos.length > 0
  
  // Only show if there are videos to process or recently completed
  useEffect(() => {
    const shouldShow = hasActiveProcessing || 
      (completedVideos.length > 0 && 
       completedVideos.some(v => Date.now() - v.addedAt.getTime() < 60000)) // Show for 1 minute after completion
    
    setIsVisible(shouldShow)
  }, [videos, hasActiveProcessing, completedVideos])

  // Calculate and update time remaining
  useEffect(() => {
    if (!hasActiveProcessing) {
      setTimeRemaining(0)
      return
    }
    
    const updateEstimate = () => {
      const estimate = estimateProcessingTime(activeVideos)
      setTimeRemaining(estimate)
    }
    
    updateEstimate()
    const interval = setInterval(updateEstimate, 5000) // Update every 5 seconds
    
    return () => clearInterval(interval)
  }, [activeVideos, hasActiveProcessing])

  // Auto-hide after completion
  useEffect(() => {
    if (!hasActiveProcessing && completedVideos.length > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, 10000) // Hide after 10 seconds when done
      
      return () => clearTimeout(timer)
    }
  }, [hasActiveProcessing, completedVideos, onClose])

  if (!isVisible || videos.length === 0) {
    return null
  }

  const message = getLearningMessage(
    queuedVideos.length, 
    processingVideos.length, 
    completedVideos.length,
    videos.length
  )
  
  const IconComponent = message.icon
  const progressPercentage = videos.length > 0 
    ? Math.round((completedVideos.length / videos.length) * 100) 
    : 0

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(
          "relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-lg",
          className
        )}
      >
        {/* Animated background gradient */}
        {hasActiveProcessing && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 via-indigo-400/5 to-purple-400/5">
            <motion.div
              className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            />
          </div>
        )}

        <div className="relative z-10">
          {/* Header with icon and main message */}
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              hasActiveProcessing 
                ? "bg-blue-100 text-blue-600" 
                : "bg-green-100 text-green-600"
            )}>
              <IconComponent className="h-5 w-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm">
                {message.primary}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                {message.secondary}
              </p>
            </div>
            
            {/* Estimated time remaining */}
            {hasActiveProcessing && timeRemaining > 0 && (
              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full whitespace-nowrap">
                <Clock className="h-3 w-3" />
                <span>{formatTimeRemaining(timeRemaining)}</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {videos.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Learning Progress</span>
                <span>{progressPercentage}% Complete</span>
              </div>
              
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    hasActiveProcessing 
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500" 
                      : "bg-gradient-to-r from-green-500 to-emerald-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {/* Processing status details */}
          {hasActiveProcessing && (
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
              {processingVideos.length > 0 && (
                <div className="flex items-center gap-1">
                  <motion.div 
                    className="h-2 w-2 bg-yellow-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span>{processingVideos.length} processing</span>
                </div>
              )}
              
              {queuedVideos.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 bg-blue-400 rounded-full" />
                  <span>{queuedVideos.length} queued</span>
                </div>
              )}
              
              {completedVideos.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 bg-green-400 rounded-full" />
                  <span>{completedVideos.length} completed</span>
                </div>
              )}
            </div>
          )}

          {/* Success state with enhancement message */}
          {!hasActiveProcessing && completedVideos.length > 0 && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-green-700">
                <Zap className="h-3 w-3" />
                <span>Your AI conversations are now enhanced with knowledge from your videos!</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default AIReplicaLearningStatus