'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function TestAuthPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const simulateLogin = async () => {
    setLoading(true)
    
    // Simulate creating a test user session
    try {
      const response = await fetch('/api/test-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'demo@aitrion.com',
          name: 'Demo User',
        }),
      })

      if (response.ok) {
        router.push('/creator')
      } else {
        alert('Demo login failed')
      }
    } catch (error) {
      console.error('Demo login error:', error)
      alert('Demo login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <div className="card p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Demo Authentication
          </h1>
          <p className="text-gray-600">
            Since Google OAuth needs proper setup, use this demo login to test the platform.
          </p>
        </div>

        <div className="space-y-4">
          <div className="card p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Demo Account</h3>
            <p className="text-sm text-blue-800">
              Email: demo@aitrion.com<br/>
              Name: Demo User
            </p>
          </div>

          <Button 
            onClick={simulateLogin}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Logging in...' : 'Demo Login'}
          </Button>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              This creates a temporary session for testing purposes
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">To Fix Google OAuth:</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>1. Go to <a href="https://console.cloud.google.com" target="_blank" className="text-blue-600 hover:underline">Google Cloud Console</a></p>
            <p>2. Create/select your project</p>
            <p>3. Enable Google+ API</p>
            <p>4. Create OAuth 2.0 credentials</p>
            <p>5. Add authorized redirect URI:</p>
            <code className="block bg-gray-100 p-2 rounded text-xs mt-1">
              http://localhost:3000/api/auth/callback/google
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}