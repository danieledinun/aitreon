'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SyncContentModal } from '@/components/creator/SyncContentModal'
import { AISyncLoader } from '@/components/ui/ai-sync-loader'
import { Zap, Brain, Youtube, Database, Loader2 } from 'lucide-react'

export default function SyncPage() {
  const { data: session } = useSession()
  const [showDemo, setShowDemo] = useState(false)
  const [creator, setCreator] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCreatorData = async () => {
      if (!session?.user?.email) {
        setLoading(false)
        return
      }

      try {
        // Get current creator data directly
        const response = await fetch('/api/creator/me')
        if (response.ok) {
          const creatorData = await response.json()
          console.log('📋 Fetched creator data:', creatorData)
          
          setCreator({
            youtubeChannelUrl: creatorData.youtubeChannelUrl,
            displayName: creatorData.displayName || creatorData.username
          })
        } else {
          console.warn('Failed to fetch creator data:', response.status)
        }
      } catch (error) {
        console.error('Error fetching creator data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCreatorData()
  }, [session])

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-3">
            <Brain className="h-8 w-8 text-blue-600" />
            AI Knowledge Sync
          </h1>
          <p className="text-gray-600 text-lg">
            Transform your YouTube content into a powerful AI knowledge base
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-600" />
                Sync YouTube Content
              </CardTitle>
              <CardDescription>
                Extract and process your YouTube videos for AI training
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-gray-600">Loading creator data...</span>
                </div>
              ) : (
                <SyncContentModal creator={creator} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Demo AI Sync Loader
              </CardTitle>
              <CardDescription>
                Preview the AI brain synchronization animation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setShowDemo(true)}
                className="w-full"
              >
                <Brain className="h-4 w-4 mr-2" />
                Show AI Sync Demo
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" />
              How AI Knowledge Sync Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Youtube className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-medium mb-1">1. Content Discovery</h3>
                <p className="text-sm text-gray-600">Scan and identify your YouTube videos</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Brain className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-medium mb-1">2. AI Processing</h3>
                <p className="text-sm text-gray-600">Extract transcripts and build knowledge graphs</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-medium mb-1">3. Replica Training</h3>
                <p className="text-sm text-gray-600">Train your AI replica with your unique knowledge</p>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">✨ Features</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Hybrid RAG system (Traditional + traditional RAG)</li>
                <li>• Multi-language transcript support</li>
                <li>• Real-time processing progress</li>
                <li>• Vector embeddings for semantic search</li>
                <li>• Knowledge graph construction</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Sync Demo Loader */}
      <AISyncLoader 
        loading={showDemo} 
        type="knowledge"
        onClose={() => setShowDemo(false)}
      />
    </div>
  )
}