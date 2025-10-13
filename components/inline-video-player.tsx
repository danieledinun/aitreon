'use client'

import { useState } from 'react'
import { X, Maximize2, Minimize2, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface InlineVideoPlayerProps {
  videoId: string
  startTime?: number
  title: string
  onClose: () => void
  className?: string
}

export default function InlineVideoPlayer({
  videoId,
  startTime = 0,
  title,
  onClose,
  className
}: InlineVideoPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startTime)}&autoplay=0&rel=0&modestbranding=1`
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startTime)}s`

  return (
    <>
      {/* Full-Screen Overlay when Expanded */}
      {isExpanded && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-neutral-900">
          {/* Full-Screen Video Container */}
          <div className="h-full w-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {title}
                </h4>
              </div>

              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-neutral-700"
                  onClick={() => setIsExpanded(false)}
                  title="Minimize"
                >
                  <Minimize2 className="h-4 w-4 text-gray-600 dark:text-neutral-300" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-neutral-700"
                  onClick={onClose}
                  title="Close"
                >
                  <X className="h-4 w-4 text-gray-600 dark:text-neutral-300" />
                </Button>
              </div>
            </div>

            {/* Full-Screen Video Player */}
            <div className="relative flex-1 bg-black w-full">
              {/* Loading State */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-3" />
                    <p className="text-white text-sm">Loading video...</p>
                  </div>
                </div>
              )}

              {/* YouTube Embed */}
              <iframe
                src={embedUrl}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={() => setIsLoading(false)}
              />
            </div>

            {/* Footer Info */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-200 dark:border-neutral-700">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-400">
                <span>
                  {startTime > 0 && `Starting at ${Math.floor(startTime / 60)}:${(startTime % 60).toFixed(0).padStart(2, '0')}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline Video Player (Not Expanded) */}
      {!isExpanded && (
        <div
          className={cn(
            "transition-all duration-300 ease-in-out my-4 w-full",
            className
          )}
        >
          {/* Video Container */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-lg w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {title}
                </h4>
              </div>

              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-neutral-700"
                  onClick={() => setIsExpanded(true)}
                  title="Maximize"
                >
                  <Maximize2 className="h-4 w-4 text-gray-600 dark:text-neutral-300" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-neutral-700"
                  onClick={onClose}
                  title="Close"
                >
                  <X className="h-4 w-4 text-gray-600 dark:text-neutral-300" />
                </Button>
              </div>
            </div>

            {/* Video Player */}
            <div className="relative bg-black transition-all duration-300 w-full aspect-video">
              {/* Loading State */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-3" />
                    <p className="text-white text-sm">Loading video...</p>
                  </div>
                </div>
              )}

              {/* YouTube Embed */}
              <iframe
                src={embedUrl}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={() => setIsLoading(false)}
              />
            </div>

            {/* Footer Info */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-200 dark:border-neutral-700">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-400">
                <span>
                  {startTime > 0 && `Starting at ${Math.floor(startTime / 60)}:${(startTime % 60).toFixed(0).padStart(2, '0')}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
