'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useSyncContext } from '@/contexts/SyncContext'
import { 
  Youtube,
  PlayCircle,
  List,
  Users,
  Download,
  Zap,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface SyncContentModalProps {
  creator?: {
    youtubeChannelUrl?: string | null
    displayName?: string
  }
}

export function SyncContentModal({ creator }: SyncContentModalProps = {}) {
  const { syncState, startSync } = useSyncContext()
  const [isOpen, setIsOpen] = useState(false)
  // Smart default: if user has connected YouTube channel, start on channel tab
  const [activeTab, setActiveTab] = useState(creator?.youtubeChannelUrl ? 'channel' : 'single')
  
  // Form states
  const [singleVideoId, setSingleVideoId] = useState('')
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [channelUrl] = useState(creator?.youtubeChannelUrl || '') // Non-editable, from creator data
  const [maxVideos, setMaxVideos] = useState(10)
  const [languages, setLanguages] = useState('en')

  const extractVideoId = (url: string) => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    const match = url.match(regex)
    return match ? match[1] : url
  }

  const extractChannelId = (url: string) => {
    // Match various YouTube channel URL formats
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_-]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const isUserOwnChannel = (inputUrl: string) => {
    if (!creator?.youtubeChannelUrl || !inputUrl) return false
    
    const userChannelId = extractChannelId(creator.youtubeChannelUrl)
    const inputChannelId = extractChannelId(inputUrl)
    
    return userChannelId && inputChannelId && userChannelId === inputChannelId
  }

  const extractPlaylistId = (url: string) => {
    const regex = /[&?]list=([a-zA-Z0-9_-]+)/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  const handleStartSync = async () => {
    const currentSyncType = activeTab as 'single' | 'playlist' | 'channel'
    
    let payload: any = {
      languages: languages.split(',').map(l => l.trim())
    }

    // Prepare payload based on sync type
    switch (currentSyncType) {
      case 'single':
        payload.videoId = extractVideoId(singleVideoId)
        break
      case 'playlist':
        payload.playlistId = extractPlaylistId(playlistUrl)
        payload.maxVideos = maxVideos
        break
      case 'channel':
        payload.channelUrl = channelUrl
        payload.maxVideos = maxVideos
        break
    }

    // Close modal and start sync using global context
    setIsOpen(false)
    await startSync(currentSyncType, payload)
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button disabled={syncState.isActive}>
            <Zap className="h-4 w-4 mr-2" />
            {syncState.isActive ? 'Sync in Progress...' : 'Sync Content'}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Sync YouTube Content
            </SheetTitle>
            <SheetDescription>
              {creator?.youtubeChannelUrl
                ? `Extract transcripts from your YouTube content and process them for AI training. Your connected channel: ${creator.displayName || 'Your Channel'}`
                : 'Extract transcripts from your YouTube content and process them for enhanced AI responses.'
              }
            </SheetDescription>
          </SheetHeader>

          {!syncState.isActive && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="single" className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Single Video
                </TabsTrigger>
                <TabsTrigger value="playlist" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Playlist
                </TabsTrigger>
                <TabsTrigger value="channel" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Whole Channel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-4">
                <div>
                  <Label htmlFor="video-url">Video URL or ID</Label>
                  <Input
                    id="video-url"
                    value={singleVideoId}
                    onChange={(e) => {
                      const url = e.target.value
                      setSingleVideoId(url)
                      
                      // Smart detection: if user enters their own channel URL, suggest using channel tab
                      if (isUserOwnChannel(url)) {
                        console.log('Detected user\'s own channel URL - suggesting channel tab')
                      }
                    }}
                    placeholder="https://youtube.com/watch?v=... or dQw4w9WgXcQ"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste a YouTube video URL or just the video ID
                  </p>
                  {singleVideoId && isUserOwnChannel(singleVideoId) && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-xs text-amber-700">
                        💡 This looks like your own channel! Consider using the "Whole Channel" tab for better results.
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="languages-single">Preferred Languages</Label>
                  <Input
                    id="languages-single"
                    value={languages}
                    onChange={(e) => setLanguages(e.target.value)}
                    placeholder="en, es, fr"
                    className="mt-1"
                  />
                </div>

                <Button 
                  onClick={handleStartSync} 
                  disabled={!singleVideoId.trim() || syncState.isActive}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {syncState.isActive ? 'Sync in Progress...' : 'Sync Single Video'}
                </Button>
              </TabsContent>

              <TabsContent value="playlist" className="space-y-4">
                <div>
                  <Label htmlFor="playlist-url">Playlist URL</Label>
                  <Input
                    id="playlist-url"
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    placeholder="https://youtube.com/playlist?list=..."
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max-videos-playlist">Max Videos</Label>
                    <Input
                      id="max-videos-playlist"
                      type="number"
                      value={maxVideos}
                      onChange={(e) => setMaxVideos(parseInt(e.target.value) || 25)}
                      min="1"
                      max="100"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="languages-playlist">Languages</Label>
                    <Input
                      id="languages-playlist"
                      value={languages}
                      onChange={(e) => setLanguages(e.target.value)}
                      placeholder="en, es, fr"
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleStartSync} 
                  disabled={!playlistUrl.trim() || syncState.isActive}
                  className="w-full"
                >
                  <List className="h-4 w-4 mr-2" />
                  {syncState.isActive ? 'Sync in Progress...' : `Sync Playlist (${maxVideos} videos max)`}
                </Button>
              </TabsContent>

              <TabsContent value="channel" className="space-y-4">
                {channelUrl && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Youtube className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 mb-1">Your Connected Channel</h4>
                        <p className="text-sm text-blue-800 break-all">{channelUrl}</p>
                        <p className="text-xs text-blue-600 mt-1">Ready to sync your entire channel!</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!channelUrl && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <Youtube className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <h4 className="font-medium text-gray-600 mb-1">No Channel Connected</h4>
                    <p className="text-sm text-gray-500">
                      Connect your YouTube channel to sync your entire content library.
                    </p>
                  </div>
                )}

                {channelUrl && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="max-videos-channel">Max Videos</Label>
                        <Input
                          id="max-videos-channel"
                          type="number"
                          value={maxVideos}
                          onChange={(e) => setMaxVideos(parseInt(e.target.value) || 25)}
                          min="1"
                          max="100"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="languages-channel">Languages</Label>
                        <Input
                          id="languages-channel"
                          value={languages}
                          onChange={(e) => setLanguages(e.target.value)}
                          placeholder="en, es, fr"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleStartSync} 
                      disabled={!channelUrl || syncState.isActive}
                      className="w-full"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      {syncState.isActive ? 'Sync in Progress...' : `🚀 Sync My Channel (${maxVideos} videos max)`}
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Show sync status when active */}
          {syncState.isActive && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <Zap className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-blue-900 mb-1">Sync in Progress</h3>
                <p className="text-sm text-blue-700">
                  Your content is being processed in the background. You can close this modal and continue using the app.
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Check the progress indicator in the top-right corner.
                </p>
              </div>
            </div>
          )}

          {/* Show results when complete */}
          {syncState.result && (
            <div className="space-y-4 mt-4">
              <div className="text-center">
                {syncState.result.successRate > 0 ? (
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                ) : (
                  <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                )}
                <h3 className="text-lg font-semibold">
                  {syncState.result.successRate > 0 ? 'Sync Complete!' : 'Sync Failed'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Content has been processed and added to your AI knowledge base
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{syncState.result.videosFound}</div>
                  <div className="text-xs text-muted-foreground">Videos Found</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{syncState.result.transcriptsExtracted}</div>
                  <div className="text-xs text-muted-foreground">Transcripts</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{syncState.result.segmentsProcessed}</div>
                  <div className="text-xs text-muted-foreground">Segments</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{Math.round(syncState.result.successRate)}%</div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                </div>
              </div>

              {syncState.result.errors.length > 0 && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <strong>Errors ({syncState.result.errors.length}):</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {syncState.result.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}