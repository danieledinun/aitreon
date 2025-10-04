'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { User, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface RegistrationModalProps {
  onClose: () => void
}

export default function RegistrationModal({ onClose }: RegistrationModalProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Join the Conversation
          </DialogTitle>
          <DialogDescription>
            You've reached the limit for anonymous users. Sign in to continue chatting with unlimited access!
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="text-sm text-gray-600 text-center">
            🎉 Get unlimited conversations, voice calls, and premium features
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/auth/signin" className="w-full">
              <Button className="w-full" size="lg">
                <ArrowRight className="mr-2 h-4 w-4" />
                Sign In to Continue
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Sign in with Google • Takes just seconds
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}