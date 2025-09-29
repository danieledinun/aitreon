'use client'

import React from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Play, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Video,
  Calendar,
  Eye,
  Trash2,
  RefreshCw,
  Database
} from 'lucide-react'

interface Video {
  id: string
  youtubeId: string
  title: string
  description?: string
  thumbnail?: string
  duration?: number
  publishedAt: Date
  createdAt: Date
  updatedAt: Date
  transcript?: string
  isProcessed: boolean
  syncedAt?: Date
}

interface VideoListModalProps {
  videos: Video[]
  trigger?: React.ReactNode
  creator: {
    displayName: string
    username: string
  }
}

const getVideoStatus = (video: Video) => {
  return {
    status: 'processed',
    label: 'Ready for AI',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle
  }
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds === 0) return '--:--'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function VideoListModal({ videos, trigger, creator }: VideoListModalProps) {
  const [videoList, setVideoList] = React.useState(videos)
  const [removingVideoId, setRemovingVideoId] = React.useState<string | null>(null)
  const [videoToRemove, setVideoToRemove] = React.useState<Video | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    setVideoList(videos)
  }, [videos])

  const refreshData = React.useCallback(async () => {
    setLoading(true)
    try {
      // Simply refresh the video list - no GraphRAG specific calls needed
      setVideoList(videos)
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setLoading(false)
    }
  }, [videos])


  const handleRemoveVideo = async (video: Video) => {
    setRemovingVideoId(video.youtubeId)

    try {
      const response = await fetch('/api/creator/remove-video', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId: video.youtubeId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove video')
      }

      const result = await response.json()
      
      // Remove video from local state
      setVideoList(prev => prev.filter(v => v.youtubeId !== video.youtubeId))
      
      console.log(`✅ Successfully removed video: ${result.removedVideo.title}`)
    } catch (error) {
      console.error('Failed to remove video:', error)
      alert(error instanceof Error ? error.message : 'Failed to remove video. Please try again.')
    } finally {
      setRemovingVideoId(null)
      setVideoToRemove(null)
    }
  }

  const openRemoveDialog = (video: Video) => {
    setVideoToRemove(video)
  }
  
  const DefaultTrigger = () => (
    <Button variant="outline" size="sm" className="w-full">
      <Database className="h-4 w-4 mr-2" />
      Show Agent Brain ({videoList.length})
    </Button>
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || <DefaultTrigger />}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-white border border-gray-200 shadow-xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3">
                <Video className="h-5 w-5" />
                Content Library - {creator.displayName}
              </DialogTitle>
              <DialogDescription>
                Videos currently stored in your AI agent's brain
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </DialogHeader>
        
        {/* GraphRAG Status Banner */}
        {loading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-sm text-blue-700">🧠 Loading agent brain contents...</p>
          </div>
        )}
        <Separator />
        
        {/* Video List */}
        <ScrollArea className="flex-1 max-h-[400px] bg-white border border-gray-200 rounded-md">
          <div className="space-y-2 p-4 bg-white">
            {videoList.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No Videos in Agent Brain</h3>
                <p className="text-sm text-muted-foreground">
                  Process videos from your YouTube channel to add them to your AI agent's brain
                </p>
              </div>
            ) : (
              videoList.map((video) => {
                const statusInfo = getVideoStatus(video)
                const StatusIcon = statusInfo.icon
                const isRemoving = removingVideoId === video.youtubeId
                
                return (
                  <div
                    key={video.id}
                    className={`flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors shadow-sm ${isRemoving ? 'opacity-50' : ''}`}
                  >
                    {/* Video Thumbnail */}
                    <div className="w-20 h-12 bg-gray-200 rounded-md flex items-center justify-center shrink-0 relative overflow-hidden">
                      <img 
                        src={video.thumbnail || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://img.youtube.com/vi/${video.youtubeId}/default.jpg`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Play className="h-3 w-3 text-white drop-shadow-md" />
                      </div>
                      <div className="absolute bottom-0 right-0 bg-black/80 text-white text-xs px-1 rounded-tl">
                        {formatDuration(video.duration)}
                      </div>
                    </div>
                    
                    {/* Video Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2 mb-1" title={video.title}>
                        {video.title}
                      </h4>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'Unknown'}
                        </div>
                        <div>
                          Added: {new Date(video.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Status and Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${statusInfo.color} flex items-center gap-1`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <a
                          href={`https://youtube.com/watch?v=${video.youtubeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" className="p-2">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                        
                        {/* Remove button - only show for videos with transcripts */}
                        {video.transcript && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openRemoveDialog(video)}
                            disabled={isRemoving}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Remove from knowledge base"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>

      {/* Remove Video Confirmation AlertDialog */}
      <AlertDialog open={!!videoToRemove} onOpenChange={() => setVideoToRemove(null)}>
        <AlertDialogContent className="max-w-md bg-white border border-gray-200 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Remove Video from Knowledge Base
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Are you sure you want to remove <strong>"{videoToRemove?.title}"</strong> from your knowledge base?
              <br /><br />
              This will:
              <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                <li>Remove the video from your AI's memory</li>
                <li>Make it unavailable for chat responses</li>
                <li>Delete all associated transcript data</li>
              </ul>
              <br />
              <span className="font-medium text-red-600">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingVideoId}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => videoToRemove && handleRemoveVideo(videoToRemove)}
              disabled={!!removingVideoId}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {removingVideoId === videoToRemove?.youtubeId ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Video
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

// Compact video list for showing recent videos
interface CompactVideoListProps {
  videos: Video[]
  maxItems?: number
  showViewAll?: boolean
  creator: {
    displayName: string
    username: string
  }
}

export function CompactVideoList({ videos, maxItems = 3, showViewAll = true, creator }: CompactVideoListProps) {
  const displayVideos = videos.slice(0, maxItems)
  const lastSyncedVideo = videos[0] // Most recent video
  
  return (
    <div className="space-y-3">
      {/* Last Synced Video Highlight */}
      {lastSyncedVideo && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-blue-900">Last Synced Video</h4>
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
              Latest
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center shrink-0 relative overflow-hidden">
              <img 
                src={lastSyncedVideo.thumbnail || `https://img.youtube.com/vi/${lastSyncedVideo.youtubeId}/mqdefault.jpg`}
                alt={lastSyncedVideo.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://img.youtube.com/vi/${lastSyncedVideo.youtubeId}/default.jpg`;
                }}
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <Play className="h-2 w-2 text-white drop-shadow-md" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" title={lastSyncedVideo.title}>
                {lastSyncedVideo.title}
              </p>
              <p className="text-xs text-blue-700">
                {new Date(lastSyncedVideo.createdAt).toLocaleDateString()}
              </p>
            </div>
            <a
              href={`https://youtube.com/watch?v=${lastSyncedVideo.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>
      )}
      
      {/* Recent Videos List */}
      <div className="space-y-2">
        {displayVideos.map((video) => {
          const statusInfo = getVideoStatus(video)
          const StatusIcon = statusInfo.icon
          
          return (
            <div key={video.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center shrink-0 relative overflow-hidden">
                <img 
                  src={video.thumbnail || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://img.youtube.com/vi/${video.youtubeId}/default.jpg`;
                  }}
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Play className="h-2 w-2 text-white drop-shadow-md" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={video.title}>{video.title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(video.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusIcon className={`h-3 w-3 ${
                  statusInfo.status === 'syncing' ? 'text-yellow-600' : 
                  statusInfo.status === 'processing' ? 'text-orange-600' : 
                  'text-gray-400'
                }`} />
                <a
                  href={`https://youtube.com/watch?v=${video.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* View All Button */}
      {showViewAll && videos.length > maxItems && (
        <div className="pt-2">
          <VideoListModal 
            videos={videos} 
            creator={creator}
            trigger={
              <Button variant="outline" size="sm" className="w-full">
                <Database className="h-4 w-4 mr-2" />
                Show Agent Brain (+{videos.length - maxItems} more)
              </Button>
            }
          />
        </div>
      )}
    </div>
  )
}