'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Play, 
  Download, 
  Clock, 
  FileText, 
  Youtube,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react'

interface TranscriptSegment {
  start: number
  duration: number
  end: number
  text: string
  confidence: number
}

interface TranscriptResult {
  success: boolean
  video_id?: string
  language?: string
  is_generated?: boolean
  segments_count?: number
  segments?: TranscriptSegment[]
  obtained_via?: string
  confidence?: number
  processing_date?: string
  error?: string
  message?: string
}

interface BatchResult {
  [videoId: string]: TranscriptResult
}

export default function TranscriptTestPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [singleVideoId, setSingleVideoId] = useState('dQw4w9WgXcQ') // Default test video
  const [languages, setLanguages] = useState('en')
  const [multipleVideoIds, setMultipleVideoIds] = useState('dQw4w9WgXcQ,jNQXAC9IVRw')
  const [singleResult, setSingleResult] = useState<TranscriptResult | null>(null)
  const [batchResults, setBatchResults] = useState<BatchResult | null>(null)
  const [channelResults, setChannelResults] = useState<BatchResult | null>(null)
  const [channelProgress, setChannelProgress] = useState<{ processed: number, total: number }>({ processed: 0, total: 0 })
  const [isChannelProcessing, setIsChannelProcessing] = useState(false)

  const extractSingleTranscript = async () => {
    setIsLoading(true)
    setSingleResult(null)
    
    try {
      const response = await fetch(`/api/youtube/transcripts?videoId=${singleVideoId}&languages=${languages}`)
      const result = await response.json()
      setSingleResult(result)
    } catch (error) {
      console.error('Error extracting single transcript:', error)
      setSingleResult({
        success: false,
        error: 'api_error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const extractMultipleTranscripts = async () => {
    setIsLoading(true)
    setBatchResults(null)
    
    try {
      const videoIds = multipleVideoIds.split(',').map(id => id.trim()).filter(id => id)
      const response = await fetch('/api/youtube/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIds,
          languages: languages.split(',').map(lang => lang.trim())
        })
      })
      const results = await response.json()
      setBatchResults(results)
    } catch (error) {
      console.error('Error extracting multiple transcripts:', error)
      setBatchResults({
        error: {
          success: false,
          error: 'api_error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const simulateChannelExtraction = async () => {
    setIsChannelProcessing(true)
    setChannelResults(null)
    setChannelProgress({ processed: 0, total: 25 })
    
    // Simulate processing 25 Air Fryer Geek videos
    const testVideoIds = [
      'dQw4w9WgXcQ', 'jNQXAC9IVRw', 'oHg5SJYRHA0', 'L_jWHffIx5E', 'fJ9rUzIMcZQ',
      'dQw4w9WgXcQ', 'jNQXAC9IVRw', 'oHg5SJYRHA0', 'L_jWHffIx5E', 'fJ9rUzIMcZQ',
      'dQw4w9WgXcQ', 'jNQXAC9IVRw', 'oHg5SJYRHA0', 'L_jWHffIx5E', 'fJ9rUzIMcZQ',
      'dQw4w9WgXcQ', 'jNQXAC9IVRw', 'oHg5SJYRHA0', 'L_jWHffIx5E', 'fJ9rUzIMcZQ',
      'dQw4w9WgXcQ', 'jNQXAC9IVRw', 'oHg5SJYRHA0', 'L_jWHffIx5E', 'fJ9rUzIMcZQ'
    ]
    
    const results: BatchResult = {}
    
    try {
      // Process in batches of 5
      for (let i = 0; i < testVideoIds.length; i += 5) {
        const batch = testVideoIds.slice(i, i + 5)
        
        const response = await fetch('/api/youtube/transcripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoIds: batch,
            languages: ['en']
          })
        })
        
        const batchResults = await response.json()
        Object.assign(results, batchResults)
        
        setChannelProgress({ processed: i + batch.length, total: 25 })
        
        // Realistic delay to simulate real processing with rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      
      setChannelResults(results)
    } catch (error) {
      console.error('Error processing channel:', error)
      setChannelResults({
        error: {
          success: false,
          error: 'channel_processing_error',
          message: error instanceof Error ? error.message : 'Channel processing failed'
        }
      })
    } finally {
      setIsChannelProcessing(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">YouTube Transcript Extraction Test</h1>
          <p className="text-muted-foreground">
            Test the YouTube transcript API system with various scenarios
          </p>
        </div>

        <Tabs defaultValue="single" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="single">Single Video</TabsTrigger>
            <TabsTrigger value="batch">Multiple Videos</TabsTrigger>
            <TabsTrigger value="channel">Air Fryer Geek (25 Videos)</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Youtube className="h-5 w-5" />
                  Single Video Transcript
                </CardTitle>
                <CardDescription>
                  Extract transcript from a single YouTube video
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="single-video">Video ID</Label>
                    <Input
                      id="single-video"
                      value={singleVideoId}
                      onChange={(e) => setSingleVideoId(e.target.value)}
                      placeholder="Enter YouTube video ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="languages">Languages</Label>
                    <Input
                      id="languages"
                      value={languages}
                      onChange={(e) => setLanguages(e.target.value)}
                      placeholder="en,es,fr"
                    />
                  </div>
                </div>
                <Button 
                  onClick={extractSingleTranscript} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Extract Transcript
                    </>
                  )}
                </Button>

                {singleResult && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {singleResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        Result
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {singleResult.success ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Language:</span> {singleResult.language}
                            </div>
                            <div>
                              <span className="font-medium">Segments:</span> {singleResult.segments_count}
                            </div>
                            <div>
                              <span className="font-medium">Generated:</span> 
                              <Badge variant={singleResult.is_generated ? "secondary" : "default"} className="ml-2">
                                {singleResult.is_generated ? "Auto" : "Manual"}
                              </Badge>
                            </div>
                            <div>
                              <span className="font-medium">Confidence:</span> {Math.round((singleResult.confidence || 0) * 100)}%
                            </div>
                          </div>
                          
                          {singleResult.segments && singleResult.segments.length > 0 && (
                            <div>
                              <Label>First 3 Segments:</Label>
                              <div className="mt-2 space-y-2">
                                {singleResult.segments.slice(0, 3).map((segment, index) => (
                                  <div key={index} className="p-2 bg-muted rounded text-sm">
                                    <div className="font-medium text-xs text-muted-foreground mb-1">
                                      {formatDuration(segment.start)} - {formatDuration(segment.end)}
                                    </div>
                                    <div>{segment.text}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-500">
                          <div className="font-medium">Error: {singleResult.error}</div>
                          <div className="text-sm mt-1">{singleResult.message}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batch" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Multiple Videos Batch Processing
                </CardTitle>
                <CardDescription>
                  Extract transcripts from multiple YouTube videos at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="multiple-videos">Video IDs (comma separated)</Label>
                  <Textarea
                    id="multiple-videos"
                    value={multipleVideoIds}
                    onChange={(e) => setMultipleVideoIds(e.target.value)}
                    placeholder="dQw4w9WgXcQ,jNQXAC9IVRw,oHg5SJYRHA0"
                    className="h-20"
                  />
                </div>
                <Button 
                  onClick={extractMultipleTranscripts} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Extract All Transcripts
                    </>
                  )}
                </Button>

                {batchResults && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Batch Results</h3>
                      <Badge variant="outline">
                        {Object.values(batchResults).filter(r => r.success).length} / {Object.keys(batchResults).length} successful
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(batchResults).map(([videoId, result]) => (
                        <Card key={videoId}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              {result.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              {videoId}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-xs">
                            {result.success ? (
                              <div>
                                <div>{result.segments_count} segments in {result.language}</div>
                                <Badge variant={result.is_generated ? "secondary" : "default"} className="mt-1">
                                  {result.is_generated ? "Auto-generated" : "Manual"}
                                </Badge>
                              </div>
                            ) : (
                              <div className="text-red-500">
                                <div>{result.error}</div>
                                <div className="opacity-75">{result.message}</div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channel" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Youtube className="h-5 w-5" />
                  Air Fryer Geek Channel Extraction (25 Videos)
                </CardTitle>
                <CardDescription>
                  Simulate extracting transcripts from 25 Air Fryer Geek videos to test the system at scale
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={simulateChannelExtraction} 
                  disabled={isChannelProcessing}
                  className="w-full"
                >
                  {isChannelProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing Channel...
                    </>
                  ) : (
                    <>
                      <Youtube className="h-4 w-4 mr-2" />
                      Extract Air Fryer Geek Transcripts
                    </>
                  )}
                </Button>

                {isChannelProcessing && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Processing Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Videos Processed</span>
                          <span>{channelProgress.processed} / {channelProgress.total}</span>
                        </div>
                        <Progress value={(channelProgress.processed / channelProgress.total) * 100} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {channelResults && !isChannelProcessing && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Channel Processing Complete
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-500">
                              {Object.values(channelResults).filter(r => r.success).length}
                            </div>
                            <div className="text-muted-foreground">Successful</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-500">
                              {Object.values(channelResults).filter(r => !r.success).length}
                            </div>
                            <div className="text-muted-foreground">Failed</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">
                              {Object.values(channelResults)
                                .filter(r => r.success)
                                .reduce((sum, r) => sum + (r.segments_count || 0), 0)}
                            </div>
                            <div className="text-muted-foreground">Total Segments</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">
                              {Math.round(
                                Object.values(channelResults)
                                  .filter(r => r.success)
                                  .reduce((sum, r, _, arr) => sum + (r.confidence || 0), 0) /
                                Object.values(channelResults).filter(r => r.success).length * 100
                              ) || 0}%
                            </div>
                            <div className="text-muted-foreground">Avg Confidence</div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Sample Results:</h4>
                          <div className="grid gap-2 md:grid-cols-3">
                            {Object.entries(channelResults).slice(0, 6).map(([videoId, result]) => (
                              <div key={videoId} className="p-2 bg-muted rounded text-xs">
                                <div className="flex items-center gap-1 mb-1">
                                  {result.success ? (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-500" />
                                  )}
                                  <span className="font-mono">{videoId.slice(0, 8)}...</span>
                                </div>
                                {result.success ? (
                                  <div>{result.segments_count} segments</div>
                                ) : (
                                  <div className="text-red-500">{result.error}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}