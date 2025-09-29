'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useSyncContext } from '@/contexts/SyncContext'
import { SyncContentModal } from '@/components/creator/SyncContentModal'
import {
  ArrowLeft,
  Database,
  Video,
  FileText,
  Search,
  Calendar,
  Clock,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  PlayCircle,
  MessageSquare,
  Zap,
  Trash2,
  Layers3,
  BarChart3,
  RefreshCw,
  Brain
} from 'lucide-react'
import Link from 'next/link'
import AIStyleCard from '@/components/speech-analysis/ai-style-card'

interface Video {
  id: string
  youtube_id: string
  title: string
  description?: string
  thumbnail?: string
  duration?: number
  published_at: string
  is_processed: boolean
  synced_at?: string
  created_at: string
  updated_at: string
  content_chunks?: ContentChunk[]
}

interface ContentChunk {
  id: string
  chunk_text: string
  start_time?: number
  end_time?: number
  chunk_index: number
  created_at: string
}

interface Creator {
  id: string
  username: string
  display_name: string
}

interface KnowledgeBasePageProps {
  creator: Creator
  videos?: Video[]
}

export default function KnowledgeBasePage({ creator }: KnowledgeBasePageProps) {
  const { syncState } = useSyncContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [activeTab, setActiveTab] = useState('videos')
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Creator data for SyncContentModal
  const [creatorData, setCreatorData] = useState<any>(null)

  // Fetch videos from API
  const fetchVideos = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/creator/videos')
      if (!response.ok) {
        throw new Error('Failed to fetch videos')
      }
      const data = await response.json()
      setVideos(data.videos || [])
    } catch (err) {
      console.error('Error fetching videos:', err)
      setError('Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  // Delete video
  const deleteVideo = async (videoId: string) => {
    try {
      setDeleteLoading(videoId)
      const response = await fetch(`/api/creator/videos/${videoId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete video')
      }
      // Remove video from state
      setVideos(prev => prev.filter(v => v.id !== videoId))
      if (selectedVideo?.id === videoId) {
        setSelectedVideo(null)
      }
    } catch (err) {
      console.error('Error deleting video:', err)
      alert('Failed to delete video. Please try again.')
    } finally {
      setDeleteLoading(null)
    }
  }

  // Fetch creator data for SyncContentModal
  const fetchCreatorData = async () => {
    try {
      const response = await fetch('/api/creator/me')
      if (response.ok) {
        const data = await response.json()
        setCreatorData({
          youtubeChannelUrl: data.youtubeChannelUrl,
          displayName: data.displayName || data.username
        })
      }
    } catch (error) {
      console.error('Error fetching creator data:', error)
    }
  }

  useEffect(() => {
    fetchVideos()
    fetchCreatorData()
  }, [])

  // Refresh when sync completes
  useEffect(() => {
    if (syncState.result && !syncState.isActive) {
      fetchVideos()
    }
  }, [syncState.result, syncState.isActive])

  const processedVideos = videos.filter(v => v.is_processed)
  const unprocessedVideos = videos.filter(v => !v.is_processed)
  const syncedVideos = videos.filter(v => v.synced_at)
  
  const totalChunks = videos.reduce((acc, video) => acc + (video.content_chunks?.length || 0), 0)
  
  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getSyncStatus = (video: Video) => {
    if (!video.is_processed) return { status: 'processing', color: 'bg-orange-500', text: 'Processing' }
    if (video.synced_at) return { status: 'synced', color: 'bg-green-500', text: 'Synced' }
    return { status: 'processed', color: 'bg-blue-500', text: 'Processed' }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatViewCount = (count?: number) => {
    if (!count) return '0'
    if (count < 1000) return count.toString()
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`
    return `${(count / 1000000).toFixed(1)}M`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/creator" className="text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <Database className="h-7 w-7 text-blue-400" />
              Knowledge Base
            </h1>
          </div>
          <p className="text-gray-600 dark:text-neutral-400 text-lg">
            View and manage the content your AI replica has learned from
          </p>
        </div>

        {/* Sync Actions */}
        <div className="flex items-center gap-3">
          <SyncContentModal creator={creatorData} />
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncState.isActive && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-blue-600 animate-pulse" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Sync in Progress - {syncState.syncType === 'single' ? 'Single Video' : syncState.syncType === 'playlist' ? 'Playlist' : 'Whole Channel'}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {syncState.progress?.message || 'Processing your content...'}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {syncState.progress?.current || 0} / {syncState.progress?.total || 0}
            </Badge>
          </div>
        </Card>
      )}

      {/* Sync Complete Banner */}
      {syncState.result && !syncState.isActive && (
        <Card className="p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  Sync Complete!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Successfully processed {syncState.result.transcriptsExtracted} transcripts from {syncState.result.videosFound} videos
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              {Math.round(syncState.result.successRate)}% Success
            </Badge>
          </div>
        </Card>
      )}

      {/* Compact Stats Overview */}
      <Card className="bg-white/50 dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Knowledge Base Overview</h3>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {Math.round((processedVideos.length / (videos.length || 1)) * 100)}% Processed
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">{videos.length}</div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">Total Videos</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">{processedVideos.length}</div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">Processed</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-purple-600">{syncedVideos.length}</div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">Synced</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-orange-600">{totalChunks}</div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">Chunks</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-amber-600">{unprocessedVideos.length}</div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">In Queue</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-emerald-600">{Math.round(videos.reduce((acc, v) => acc + (v.duration || 0), 0) / 60)}m</div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">Total Duration</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Search and Tabs */}
      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-neutral-500" />
            <Input
              type="text"
              placeholder="Search videos by title or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white dark:bg-neutral-700 border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-white"
            />
          </div>
          <Button
            onClick={fetchVideos}
            disabled={loading}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-gray-100 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700">
            <TabsTrigger value="videos" className="data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800">
              Videos
            </TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800">
              Content Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-6">
            {loading ? (
              <Card className="p-12 text-center bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
                <Loader2 className="h-16 w-16 mx-auto mb-4 text-blue-500 animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Loading videos...
                </h3>
                <p className="text-gray-600 dark:text-neutral-400">
                  Fetching your content from the knowledge base
                </p>
              </Card>
            ) : error ? (
              <Card className="p-12 text-center bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Error Loading Videos
                </h3>
                <p className="text-gray-600 dark:text-neutral-400 mb-4">
                  {error}
                </p>
                <Button onClick={fetchVideos} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </Card>
            ) : filteredVideos.length === 0 ? (
              <Card className="p-12 text-center bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
                <Video className="h-16 w-16 mx-auto mb-4 text-gray-400 dark:text-neutral-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchTerm ? 'No videos found' : 'No videos synced yet'}
                </h3>
                <p className="text-gray-600 dark:text-neutral-400 mb-4">
                  {searchTerm 
                    ? 'Try adjusting your search terms'
                    : 'Connect your YouTube channel to start building your AI knowledge base'
                  }
                </p>
                {!searchTerm && (
                  <>
                    {syncState.isActive ? (
                      <Button 
                        disabled={true}
                        className="bg-gray-400 cursor-not-allowed"
                      >
                        <Zap className="h-4 w-4 mr-2 animate-pulse" />
                        Sync in Progress...
                      </Button>
                    ) : (
                      <Link href="/creator/sync">
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          Sync YouTube Channel
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </Card>
            ) : (
              <Card className="bg-white/50 dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-neutral-700">
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="text-gray-900 dark:text-white font-semibold">Video</TableHead>
                      <TableHead className="text-gray-900 dark:text-white font-semibold">Status</TableHead>
                      <TableHead className="text-gray-900 dark:text-white font-semibold">Duration</TableHead>
                      <TableHead className="text-gray-900 dark:text-white font-semibold">Chunks</TableHead>
                      <TableHead className="text-gray-900 dark:text-white font-semibold">Published</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVideos.map((video) => {
                      const syncStatus = getSyncStatus(video)
                      return (
                        <TableRow 
                          key={video.id} 
                          className="group border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedVideo(video)}
                        >
                          <TableCell className="p-2">
                            <div className="w-16 h-10 bg-gray-200 dark:bg-neutral-800 rounded overflow-hidden">
                              {video.thumbnail ? (
                                <img 
                                  src={video.thumbnail} 
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <PlayCircle className="h-4 w-4 text-gray-400 dark:text-neutral-600" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="max-w-xs">
                              <p className="text-gray-900 dark:text-white font-medium line-clamp-1">{video.title}</p>
                              {video.description && (
                                <p className="text-xs text-gray-500 dark:text-neutral-400 line-clamp-1 mt-1">
                                  {video.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={`${
                                  syncStatus.status === 'synced' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                  syncStatus.status === 'processed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                  'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full mr-1 ${
                                  syncStatus.status === 'synced' ? 'bg-green-500' :
                                  syncStatus.status === 'processed' ? 'bg-blue-500' : 'bg-orange-500'
                                }`} />
                                {syncStatus.text}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-neutral-400">
                            {formatDuration(video.duration)}
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-neutral-400">
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {video.content_chunks?.length || 0}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-neutral-400">
                            {video.published_at ? formatDate(video.published_at) : 'Date unavailable'}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 h-8 w-8"
                                  disabled={deleteLoading === video.id}
                                >
                                  {deleteLoading === video.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Video</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{video.title}"? This will permanently remove the video and all its content chunks from your AI knowledge base. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteVideo(video.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete Forever
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="content" className="mt-6 space-y-6">
            {/* Knowledge Base Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/10 dark:to-purple-950/10 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Knowledge Base Summary
              </h4>
              <p className="text-gray-700 dark:text-neutral-300">
                Your AI replica has been trained on <strong>{processedVideos.length} processed videos</strong> containing <strong>{totalChunks} content chunks</strong>.
                This knowledge base allows your AI to provide accurate, contextual responses based on your actual content using advanced vector search.
              </p>

              {unprocessedVideos.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {unprocessedVideos.length} videos are still being processed and will be available soon.
                  </p>
                </div>
              )}
            </div>

            {/* AI Style Card Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                  <Brain className="h-6 w-6 text-purple-500" />
                  AI Communication Style Analysis
                </h3>
              </div>
              <p className="text-gray-600 dark:text-neutral-400">
                Analyze your speech patterns and communication style to create personalized AI prompts for more authentic responses.
              </p>

              <AIStyleCard
                creatorId={creator.id}
                creatorName={creator.display_name}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Video Detail Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white pr-4">
                  {selectedVideo.title}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedVideo(null)}
                  className="text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-neutral-400">
                  <Badge className={selectedVideo.is_processed ? "bg-green-600 text-white" : "bg-orange-500 text-white"}>
                    {selectedVideo.is_processed ? 'Processed' : 'Processing'}
                  </Badge>
                  <span>{formatDuration(selectedVideo.duration)}</span>
                  <span>{formatDate(selectedVideo.published_at)}</span>
                </div>

                {selectedVideo.description && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                    <p className="text-gray-700 dark:text-neutral-300 text-sm whitespace-pre-wrap">
                      {selectedVideo.description}
                    </p>
                  </div>
                )}

                {selectedVideo.content_chunks && selectedVideo.content_chunks.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Content Chunks ({selectedVideo.content_chunks.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedVideo.content_chunks.map((chunk, index) => (
                        <div
                          key={chunk.id}
                          className="p-3 bg-gray-50 dark:bg-neutral-800/50 rounded border border-gray-200 dark:border-neutral-700"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 dark:text-neutral-500">
                              Chunk {index + 1}
                            </span>
                            {chunk.start_time && chunk.end_time && (
                              <span className="text-xs text-gray-500 dark:text-neutral-500">
                                {Math.floor(chunk.start_time / 60)}:{(chunk.start_time % 60).toString().padStart(2, '0')} - {Math.floor(chunk.end_time / 60)}:{(chunk.end_time % 60).toString().padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-neutral-300">
                            {chunk.chunk_text.substring(0, 200)}
                            {chunk.chunk_text.length > 200 && '...'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}