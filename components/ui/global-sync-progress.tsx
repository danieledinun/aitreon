'use client'

import React from 'react'
import { useSyncContext } from '@/contexts/SyncContext'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Youtube, 
  Download, 
  Zap, 
  CheckCircle, 
  XCircle,
  X,
  Clock,
  Brain
} from 'lucide-react'

export function GlobalSyncProgress() {
  const { syncState, stopSync, resetSync } = useSyncContext()
  
  // Don't show if no active sync and no recent result
  if (!syncState.isActive && !syncState.result) {
    return null
  }

  const getProgressPercentage = () => {
    if (!syncState.progress || syncState.progress.total === 0) return 0
    return Math.round((syncState.progress.current / syncState.progress.total) * 100)
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'discovery': return <Youtube className="h-4 w-4" />
      case 'transcripts': return <Download className="h-4 w-4" />
      case 'processing': return <Zap className="h-4 w-4" />
      case 'complete': return <CheckCircle className="h-4 w-4" />
      default: return <Brain className="h-4 w-4" />
    }
  }

  const getStageText = (stage: string) => {
    switch (stage) {
      case 'discovery': return 'Discovering Videos'
      case 'transcripts': return 'Extracting Transcripts'
      case 'processing': return 'Processing Content'
      case 'complete': return 'Complete'
      default: return 'Syncing'
    }
  }

  const getSyncTypeText = (type: string | null) => {
    switch (type) {
      case 'single': return 'Single Video'
      case 'playlist': return 'Playlist'
      case 'channel': return 'Whole Channel'
      default: return 'Content'
    }
  }

  const formatDuration = (startedAt: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96">
      <Card className="shadow-lg border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {syncState.progress && getStageIcon(syncState.progress.stage)}
                <span className="font-medium text-sm">
                  {syncState.isActive ? 'Syncing' : 'Sync Complete'} • {getSyncTypeText(syncState.syncType)}
                </span>
              </div>
              {syncState.isActive && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {syncState.startedAt && formatDuration(syncState.startedAt)}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={syncState.isActive ? stopSync : resetSync}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {syncState.progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {getStageIcon(syncState.progress.stage)}
                  {getStageText(syncState.progress.stage)}
                </span>
                {syncState.progress.total > 0 && (
                  <span className="text-muted-foreground">
                    {syncState.progress.current} / {syncState.progress.total}
                  </span>
                )}
              </div>
              
              <Progress 
                value={getProgressPercentage()} 
                className="h-2"
              />
              
              {syncState.progress.message && (
                <p className="text-xs text-muted-foreground">
                  {syncState.progress.message}
                </p>
              )}
              
              {syncState.progress.currentItem && (
                <p className="text-xs text-muted-foreground truncate">
                  Processing: {syncState.progress.currentItem}
                </p>
              )}
            </div>
          )}

          {syncState.result && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                {syncState.result.successRate > 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium text-sm">
                  {syncState.result.successRate > 0 ? 'Sync Successful!' : 'Sync Failed'}
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-blue-600">{syncState.result.videosFound}</div>
                  <div className="text-xs text-muted-foreground">Videos</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">{syncState.result.transcriptsExtracted}</div>
                  <div className="text-xs text-muted-foreground">Transcripts</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-600">{syncState.result.segmentsProcessed}</div>
                  <div className="text-xs text-muted-foreground">Segments</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-600">{Math.round(syncState.result.successRate)}%</div>
                  <div className="text-xs text-muted-foreground">Success</div>
                </div>
              </div>
              
              {syncState.result.errors.length > 0 && (
                <div className="text-xs text-red-600">
                  {syncState.result.errors.length} error(s) occurred
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}