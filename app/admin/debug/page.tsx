'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
// Removed unused server-side imports since this is a client component
import AdminDebugInterface from '@/components/admin/admin-debug-interface'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

// Super admin emails - in production, store this in environment variables
const SUPER_ADMIN_EMAILS = [
  'the-air-fryer-g-9837@pages.plusgoogle.com', // Your current email
  'admin@aitrion.com'
]

export default function AdminDebugPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [creators, setCreators] = useState([])
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for admin token first
        const adminToken = sessionStorage.getItem('admin_token')
        
        if (adminToken) {
          // Verify admin token
          const response = await fetch('/api/admin/auth', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
          })
          
          if (response.ok) {
            setIsAuthenticated(true)
            setUserEmail('admin@aitrion.com')
            loadCreators()
            return
          }
        }

        // Fallback to NextAuth session
        const sessionResponse = await fetch('/api/auth/session')
        const session = await sessionResponse.json()
        
        if (session?.user?.email && SUPER_ADMIN_EMAILS.includes(session.user.email)) {
          setIsAuthenticated(true)
          setUserEmail(session.user.email)
          loadCreators()
        } else {
          setIsAuthenticated(false)
          router.push('/admin/login')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthenticated(false)
        router.push('/admin/login')
      }
    }

    const loadCreators = async () => {
      try {
        const response = await fetch('/api/admin/creators')
        if (response.ok) {
          const data = await response.json()
          setCreators(data.creators || [])
        }
      } catch (error) {
        console.error('Failed to load creators:', error)
      }
    }

    checkAuth()
  }, [router])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </Card>
      </div>
    )
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this admin panel.</p>
        </Card>
      </div>
    )
  }

  return <AdminDebugInterface creators={creators} adminEmail={userEmail} />
}