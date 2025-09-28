'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, Clock, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoProcessingBannerProps {
  className?: string
}

interface ProcessingStatus {
  isProcessing: boolean
  totalVideos: number
  processedVideos: number
  processingVideos: string[]
  recentlyCompleted: string[]
  hasErrors: boolean
  startedAt?: string
}

export default function VideoProcessingBanner({ className }: VideoProcessingBannerProps) {
  const [status, setStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    totalVideos: 0,
    processedVideos: 0,
    processingVideos: [],
    recentlyCompleted: [],
    hasErrors: false
  })
  const [dismissed, setDismissed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check for processing status from localStorage or API
  const checkProcessingStatus = async () => {
    try {
      // First, check localStorage for immediate status
      const localStatus = localStorage.getItem('videoProcessingStatus')
      if (localStatus) {
        const parsed = JSON.parse(localStatus)
        if (parsed.isProcessing) {
          setStatus(parsed)
          return
        }
      }

      // Then check API for current processing status (session-based)
      setIsLoading(true)
      const response = await fetch('/api/creator/processing-status', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setStatus(data)

        // Update localStorage
        if (data.isProcessing) {
          localStorage.setItem('videoProcessingStatus', JSON.stringify({
            ...data,
            lastChecked: Date.now()
          }))
        } else {
          localStorage.removeItem('videoProcessingStatus')
        }
      }
    } catch (error) {
      console.warn('Failed to check processing status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Clean up stuck localStorage on mount
  useEffect(() => {
    // Check for old stuck processing status and clear it
    const localStatus = localStorage.getItem('videoProcessingStatus')
    if (localStatus) {
      try {
        const parsed = JSON.parse(localStatus)
        const lastChecked = parsed.lastChecked
        // If it's older than 1 hour, clear it
        if (lastChecked && (Date.now() - new Date(lastChecked).getTime()) > 60 * 60 * 1000) {
          localStorage.removeItem('videoProcessingStatus')
        }
      } catch (e) {
        localStorage.removeItem('videoProcessingStatus')
      }
    }
  }, [])

  // Poll for status updates
  useEffect(() => {
    // Check if banner was previously dismissed
    const wasDismissed = localStorage.getItem('dismissedProcessingBanner')
    if (wasDismissed) {
      setDismissed(true)
      return
    }

    // Initial check
    checkProcessingStatus()

    // Set up polling if processing
    const interval = setInterval(() => {
      if (status.isProcessing) {
        checkProcessingStatus()
      }
    }, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [status.isProcessing, dismissed])

  // Clear dismissal state when new processing starts
  useEffect(() => {
    if (status.isProcessing && dismissed) {
      setDismissed(false)
      localStorage.removeItem('dismissedProcessingBanner')
    }
  }, [status.isProcessing, dismissed])

  // Handle manual refresh
  const handleRefresh = () => {
    checkProcessingStatus()
  }

  // Handle dismiss
  const handleDismiss = () => {
    setDismissed(true)
    // Store dismissal in localStorage (session-based)
    localStorage.setItem('dismissedProcessingBanner', 'true')
  }

  // Don't show banner if dismissed or if there's no processing activity
  if (dismissed) {
    return null
  }

  // If there are no videos at all, don't show banner
  if (status.totalVideos === 0) {
    return null
  }

  // If all videos are processed and no active processing, hide banner and clean up
  if (status.totalVideos > 0 && status.processedVideos === status.totalVideos && !status.isProcessing) {
    // Clean up any stuck localStorage
    localStorage.removeItem('videoProcessingStatus')
    return null
  }

  // Only show banner if there's actual processing happening
  if (!status.isProcessing && status.processingVideos.length === 0) {
    return null
  }

  const progress = status.totalVideos > 0 ? (status.processedVideos / status.totalVideos) * 100 : 0
  const isComplete = status.processedVideos === status.totalVideos && status.totalVideos > 0
  const hasProcessing = status.processingVideos.length > 0

  return (
    <Card className={cn(
      "border-l-4 shadow-sm transition-all duration-300",
      status.hasErrors
        ? "border-l-red-500 bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
        : isComplete
        ? "border-l-green-500 bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
        : "border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className="flex-shrink-0 mt-1">
            {status.hasErrors ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <div className="relative">
                <Clock className="h-5 w-5 text-blue-500" />
                {hasProcessing && (
                  <RefreshCw className="h-3 w-3 text-blue-400 absolute -top-1 -right-1 animate-spin" />
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className={cn(
                  "font-medium text-sm leading-tight mb-1",
                  status.hasErrors
                    ? "text-red-800 dark:text-red-200"
                    : isComplete
                    ? "text-green-800 dark:text-green-200"
                    : "text-blue-800 dark:text-blue-200"
                )}>
                  {status.hasErrors ? (
                    "Video Processing Issues Detected"
                  ) : isComplete ? (
                    `🎉 Video Processing Complete!`
                  ) : hasProcessing ? (
                    "Processing Your Videos..."
                  ) : (
                    "Videos Queued for Processing"
                  )}
                </h3>

                <p className={cn(
                  "text-xs mb-3 leading-relaxed",
                  status.hasErrors
                    ? "text-red-600 dark:text-red-300"
                    : isComplete
                    ? "text-green-600 dark:text-green-300"
                    : "text-blue-600 dark:text-blue-300"
                )}>
                  {status.hasErrors ? (
                    "Some videos encountered processing errors. Check the Knowledge Base for details."
                  ) : isComplete ? (
                    `All ${status.totalVideos} videos have been processed successfully. Your AI knowledge base is now updated!`
                  ) : hasProcessing ? (
                    `Currently processing ${status.processingVideos.length} videos. This may take several minutes depending on video length and complexity.`
                  ) : (
                    `${status.totalVideos} videos are queued and will begin processing shortly.`
                  )}
                </p>

                {/* Progress Bar */}
                {status.totalVideos > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn(
                        "font-medium",
                        status.hasErrors
                          ? "text-red-700 dark:text-red-300"
                          : isComplete
                          ? "text-green-700 dark:text-green-300"
                          : "text-blue-700 dark:text-blue-300"
                      )}>
                        Progress: {status.processedVideos}/{status.totalVideos} videos
                      </span>
                      <span className={cn(
                        "tabular-nums",
                        status.hasErrors
                          ? "text-red-600 dark:text-red-400"
                          : isComplete
                          ? "text-green-600 dark:text-green-400"
                          : "text-blue-600 dark:text-blue-400"
                      )}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <Progress
                      value={progress}
                      className={cn(
                        "h-2",
                        status.hasErrors && "bg-red-100 dark:bg-red-900/30",
                        isComplete && "bg-green-100 dark:bg-green-900/30",
                        !status.hasErrors && !isComplete && "bg-blue-100 dark:bg-blue-900/30"
                      )}
                    />
                  </div>
                )}

                {/* Status Badges */}
                <div className="flex items-center gap-2 mt-2">
                  {hasProcessing && (
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-300">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Processing {status.processingVideos.length}
                    </Badge>
                  )}

                  {status.recentlyCompleted.length > 0 && (
                    <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {status.recentlyCompleted.length} completed
                    </Badge>
                  )}

                  {isComplete && (
                    <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      All Done!
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className={cn(
                    "h-8 w-8 p-0",
                    status.hasErrors
                      ? "hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600"
                      : isComplete
                      ? "hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600"
                      : "hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600"
                  )}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="sr-only">Refresh status</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  className={cn(
                    "h-8 w-8 p-0",
                    status.hasErrors
                      ? "hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600"
                      : isComplete
                      ? "hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600"
                      : "hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600"
                  )}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Dismiss</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}