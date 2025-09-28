'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminDebugInterface from './admin-debug-interface'

export default function AdminAuthWrapper() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [creators, setCreators] = useState([])
  const [creatorsLoading, setCreatorsLoading] = useState(true)
  const router = useRouter()

  const fetchCreators = async (token: string) => {
    try {
      console.log('AdminAuthWrapper: Fetching creators...')
      const response = await fetch('/api/admin/creators', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('AdminAuthWrapper: Creators loaded:', data.creators.length)
        setCreators(data.creators)
      } else {
        console.error('AdminAuthWrapper: Failed to fetch creators:', response.status)
      }
    } catch (error) {
      console.error('AdminAuthWrapper: Error fetching creators:', error)
    } finally {
      setCreatorsLoading(false)
    }
  }

  useEffect(() => {
    // Check for admin token in sessionStorage
    const token = sessionStorage.getItem('admin_token')
    console.log('AdminAuthWrapper: Token found:', !!token)
    
    if (token) {
      console.log('AdminAuthWrapper: Verifying token...')
      // Verify token is still valid
      fetch('/api/admin/voice-metrics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        console.log('AdminAuthWrapper: Token verification response:', response.status)
        if (response.ok) {
          console.log('AdminAuthWrapper: Token valid, setting authenticated')
          setIsAuthenticated(true)
          // Fetch creators data
          fetchCreators(token)
        } else {
          console.log('AdminAuthWrapper: Token invalid, redirecting to login')
          // Token is invalid, remove it and redirect
          sessionStorage.removeItem('admin_token')
          router.push('/admin/login')
        }
      })
      .catch((error) => {
        console.error('AdminAuthWrapper: Token verification error:', error)
        // Network error or other issue
        sessionStorage.removeItem('admin_token')
        router.push('/admin/login')
      })
      .finally(() => {
        setIsLoading(false)
      })
    } else {
      console.log('AdminAuthWrapper: No token, redirecting to login')
      // No token, redirect to login
      router.push('/admin/login')
      setIsLoading(false)
    }
  }, [router])

  if (isLoading || creatorsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isLoading ? 'Authenticating...' : 'Loading creators...'}
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return <AdminDebugInterface creators={creators} adminEmail="admin@aitrion.com" />
}