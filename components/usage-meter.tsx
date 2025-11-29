'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Video, MessageCircle } from 'lucide-react'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'

interface UsageMeterProps {
  type: 'videos' | 'messages'
}

export default function UsageMeter({ type }: UsageMeterProps) {
  const { remainingVideos, remainingMessages, isLoading } = usePlanLimits()

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {type === 'videos' ? (
              <>
                <Video className="w-4 h-4" />
                Video Usage
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                Message Usage
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-2 bg-gray-200 rounded-full animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const remaining = type === 'videos' ? remainingVideos : remainingMessages
  const isUnlimited = remaining === null

  if (isUnlimited) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {type === 'videos' ? (
              <>
                <Video className="w-4 h-4" />
                Video Usage
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                Message Usage
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-tandym-text-muted">
            Unlimited ∞
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate percentage (we'd need total for this - will need to enhance the hook)
  // For now, show remaining count
  const isLow = remaining !== null && remaining < 5

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {type === 'videos' ? (
            <>
              <Video className="w-4 h-4" />
              Video Usage
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4" />
              Message Usage (This Month)
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={isLow ? 'text-orange-500 font-medium' : 'text-tandym-text-muted'}>
              {remaining} remaining
            </span>
            {isLow && (
              <span className="text-xs text-orange-500">Running low!</span>
            )}
          </div>
          {/* TODO: Add progress bar when we have total count */}
        </div>
      </CardContent>
    </Card>
  )
}
