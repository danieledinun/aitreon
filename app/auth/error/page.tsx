'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'OAuthAccountNotLinked':
        return {
          title: 'Account Linking Issue',
          description: 'There was a problem linking your Google account. This usually happens when there are multiple accounts or a temporary issue.',
          suggestion: 'Try signing in again or contact support if the issue persists.'
        }
      case 'OAuthCallback':
        return {
          title: 'Authentication Error',
          description: 'There was an issue with the Google authentication process.',
          suggestion: 'Please try again or check if your Google account has the necessary permissions.'
        }
      default:
        return {
          title: 'Authentication Error',
          description: 'An unexpected error occurred during authentication.',
          suggestion: 'Please try again or contact support if the issue persists.'
        }
    }
  }

  const errorInfo = getErrorMessage(error)

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <div className="card p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-gray-600 mb-4">
            {errorInfo.description}
          </p>
          <p className="text-sm text-gray-500">
            {errorInfo.suggestion}
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/auth/signin">
            <Button className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </Link>

          <Link href="/">
            <Button variant="outline" className="w-full">
              Back to Home
            </Button>
          </Link>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">
              Error code: {error}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}