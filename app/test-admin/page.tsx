'use client'

import { useState, useEffect } from 'react'

export default function TestAdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [apiResponse, setApiResponse] = useState<any>(null)

  useEffect(() => {
    const storedToken = sessionStorage.getItem('admin_token')
    setToken(storedToken)
  }, [])

  const testLogin = async () => {
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '12345' })
      })
      
      if (response.ok) {
        const data = await response.json()
        sessionStorage.setItem('admin_token', data.token)
        setToken(data.token)
        console.log('Login successful:', data)
      } else {
        console.error('Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  const testMetrics = async () => {
    if (!token) return
    
    try {
      const response = await fetch('/api/admin/voice-metrics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setApiResponse(data)
        console.log('Metrics response:', data)
      } else {
        console.error('Metrics fetch failed')
      }
    } catch (error) {
      console.error('Metrics error:', error)
    }
  }

  const clearToken = () => {
    sessionStorage.removeItem('admin_token')
    setToken(null)
    setApiResponse(null)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Admin Authentication Test</h1>
      
      <div className="space-y-4">
        <div>
          <strong>Token Status:</strong> {token ? 'Present' : 'None'}
        </div>
        
        <div className="space-x-2">
          <button 
            onClick={testLogin}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Test Login
          </button>
          
          <button 
            onClick={testMetrics}
            disabled={!token}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
          >
            Test Metrics API
          </button>
          
          <button 
            onClick={clearToken}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Clear Token
          </button>
        </div>
        
        {apiResponse && (
          <div>
            <h3 className="text-lg font-bold">API Response:</h3>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}