'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Heart, CreditCard, Users, MessageCircle, Crown, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  userTier: 'free' | 'follower' | 'paid'
  currentUsage: number
  messageLimit: number
  upgradeMessage: string
  creatorName: string
  creatorId: string
  onFollow: () => Promise<void>
  onUpgradeSubscription: () => void
}

export function UpgradeModal({
  isOpen,
  onClose,
  userTier,
  currentUsage,
  messageLimit,
  upgradeMessage,
  creatorName,
  creatorId,
  onFollow,
  onUpgradeSubscription
}: UpgradeModalProps) {
  const isFreeTier = userTier === 'free'
  const isFollowerTier = userTier === 'follower'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full">
            {isFreeTier ? (
              <MessageCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            ) : (
              <Crown className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            )}
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            Daily Message Limit Reached
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600 dark:text-gray-400">
            {upgradeMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Usage */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Today's Usage:</span>
              <Badge variant="secondary">
                {currentUsage} / {messageLimit} messages
              </Badge>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((currentUsage / messageLimit) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Upgrade Options */}
          <div className="space-y-3">
            {isFreeTier && (
              <div className={cn(
                "p-4 border-2 rounded-lg transition-all duration-200",
                "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
              )}>
                <div className="flex items-start space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full">
                    <Heart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100">Follow {creatorName}</h3>
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200">
                        Free
                      </Badge>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Get 5 messages per day with any creator you follow
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-blue-600 dark:text-blue-400">
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-3 h-3" />
                        <span>5 messages/day</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>All creators</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={cn(
              "p-4 border-2 rounded-lg transition-all duration-200",
              "border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"
            )}>
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                  <Crown className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">Premium Subscription</h3>
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                      $9.99/month
                    </Badge>
                  </div>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Unlimited messages and exclusive content
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-purple-600 dark:text-purple-400">
                    <div className="flex items-center space-x-1">
                      <Zap className="w-3 h-3" />
                      <span>Unlimited messages</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3" />
                      <span>Exclusive content</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
          {isFreeTier && (
            <Button
              onClick={async () => {
                await onFollow()
                onClose()
              }}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Heart className="w-4 h-4 mr-2" />
              Follow for Free
            </Button>
          )}
          <Button
            onClick={() => {
              onUpgradeSubscription()
              onClose()
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Upgrade to Premium
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}