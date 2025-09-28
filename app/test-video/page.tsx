'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function TestVideoPage() {
  const { data: session } = useSession()
  const [videos, setVideos] = useState<any[]>([])
  const [userId, setUserId] = useState('cmeggjlxp0015wvebg2952wcq')
  const [displayedVideo, setDisplayedVideo] = useState<any>(null)
  const [polling, setPolling] = useState(false)
  
  // Update userId when session loads
  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id)
    }
  }, [session])
  
  // Test the video display API
  const testVideoDisplay = async () => {
    try {
      const response = await fetch('/api/voice/display-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          roomName: 'voice-call-cmeggjlxp0015wvebg2952wcq-1756179673271',
          videoId: 'dQw4w9WgXcQ',
          videoTitle: 'Frontend Test Video',
          recipeName: 'Test Recipe'
        })
      })
      
      const result = await response.json()
      console.log('✅ Video display request sent:', result)
      setVideos(prev => [...prev, result])
    } catch (error) {
      console.error('❌ Error sending video display:', error)
    }
  }
  
  // Test polling
  const testPolling = async () => {
    try {
      console.log('🔍 Polling for videos for userId:', userId)
      const response = await fetch(`/api/voice/display-video?userId=${userId}`)
      const data = await response.json()
      console.log('📊 Poll result:', data)
      
      if (data.hasPendingVideo) {
        setDisplayedVideo(data.videoDisplay)
        console.log('🎥 Video should be displayed:', data.videoDisplay)
      }
    } catch (error) {
      console.error('❌ Error polling:', error)
    }
  }
  
  // Auto polling
  useEffect(() => {
    if (!polling) return
    
    const interval = setInterval(testPolling, 2000)
    return () => clearInterval(interval)
  }, [polling, userId])
  
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Video Display Test</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Session Info:</label>
          <div className="bg-gray-100 p-3 rounded text-sm">
            <p><strong>Session User ID:</strong> {session?.user?.id || 'Not logged in'}</p>
            <p><strong>Session User Name:</strong> {session?.user?.name || 'N/A'}</p>
            <p><strong>Session User Email:</strong> {session?.user?.email || 'N/A'}</p>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">User ID for Test:</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="flex space-x-4">
          <button
            onClick={testVideoDisplay}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Send Video Display Request
          </button>
          
          <button
            onClick={testPolling}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Test Polling Once
          </button>
          
          <button
            onClick={() => setPolling(!polling)}
            className={`px-4 py-2 rounded text-white ${
              polling ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600'
            }`}
          >
            {polling ? 'Stop Auto Polling' : 'Start Auto Polling'}
          </button>
        </div>
        
        <div>
          <h3 className="font-semibold">Sent Videos:</h3>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(videos, null, 2)}
          </pre>
        </div>
        
        <div>
          <h3 className="font-semibold">Displayed Video State:</h3>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(displayedVideo, null, 2)}
          </pre>
        </div>
      </div>
      
      {/* Video Overlay (same as in voice-call-interface) */}
      {displayedVideo && (
        <div 
          className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 w-80"
          style={{ zIndex: 9999 }}
        >
          <div className="p-3">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-600 font-medium">Voice Agent Video</span>
              </div>
              
              <button
                onClick={() => setDisplayedVideo(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="relative mb-3">
              <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${displayedVideo.videoId}?rel=0&modestbranding=1`}
                  title={displayedVideo.videoTitle}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 text-sm mb-1 max-w-full overflow-hidden">
                <span className="block truncate">
                  {displayedVideo.videoTitle}
                </span>
              </h4>
              <p className="text-xs text-gray-500">
                {displayedVideo.recipeName} recipe
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}