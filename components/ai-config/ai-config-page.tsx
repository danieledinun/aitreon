'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import QuickstartForm from './quickstart-form'
import ProForm from './pro-form'
import { Loader2, Settings, Zap, Crown, ArrowLeft, Mic } from 'lucide-react'
import Link from 'next/link'
import SpeechPatternAnalyzer from '@/components/speech-pattern-analyzer'

interface AiConfigPageProps {
  creatorId: string
}

export default function AiConfigPage({ creatorId }: AiConfigPageProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentConfig, setCurrentConfig] = useState<any>(null)
  const [configExists, setConfigExists] = useState(false)
  const [activeTab, setActiveTab] = useState('quickstart')

  useEffect(() => {
    loadCurrentConfig()
  }, [])

  const loadCurrentConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai-config')
      const data = await response.json()
      
      if (data.config) {
        setCurrentConfig(data.config)
        setConfigExists(true)
      }
    } catch (error) {
      console.error('Error loading AI config:', error)
    }
    setLoading(false)
  }

  const handleSaveConfig = async (configData: any) => {
    setSaving(true)
    try {
      const response = await fetch('/api/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      })

      if (response.ok) {
        await loadCurrentConfig() // Reload to get updated data
        alert('AI configuration saved successfully!')
      } else {
        throw new Error('Failed to save configuration')
      }
    } catch (error) {
      console.error('Error saving AI config:', error)
      alert('Error saving configuration. Please try again.')
    }
    setSaving(false)
  }

  const handleCancel = () => {
    // Reset form or redirect
    window.history.back()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
          <p className="text-gray-600 dark:text-neutral-400">Loading AI configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/creator" className="text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <Settings className="h-7 w-7 text-blue-400" />
              AI Replica Configuration
            </h1>
          </div>
          <p className="text-gray-600 dark:text-neutral-400 text-lg">
            Configure your AI personality to match your unique style and voice
          </p>
        </div>
        {configExists && (
          <Badge className="bg-green-600 text-white">
            Configuration Active
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-8 bg-gray-100 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700">
          <TabsTrigger value="quickstart" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
            <Zap className="h-4 w-4" />
            Quickstart
          </TabsTrigger>
          <TabsTrigger value="pro" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
            <Crown className="h-4 w-4" />
            Pro Setup
          </TabsTrigger>
          <TabsTrigger value="speech" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
            <Mic className="h-4 w-4" />
            Speech Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quickstart">
          <div className="mb-6">
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-300 dark:border-blue-800/30">
              <div className="flex items-start gap-4">
                <Zap className="h-8 w-8 text-blue-500 dark:text-blue-400 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Quickstart Setup</h3>
                  <p className="text-gray-700 dark:text-neutral-300 mt-2">
                    Get your AI replica up and running in 5 minutes with 10 essential questions.
                    Perfect for getting started quickly with basic personality configuration.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-blue-700 dark:text-blue-300">
                    <li>• Basic tone and style settings</li>
                    <li>• Essential phrases and audience targeting</li>
                    <li>• Simple content policies</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>

          <QuickstartForm
            onSubmit={handleSaveConfig}
            onCancel={handleCancel}
            initialData={currentConfig || {}}
          />
        </TabsContent>

        <TabsContent value="pro">
          <div className="mb-6">
            <Card className="p-6 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-800/30">
              <div className="flex items-start gap-4">
                <Crown className="h-8 w-8 text-purple-400 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Pro Setup</h3>
                  <p className="text-gray-700 dark:text-neutral-300 mt-2">
                    Complete 25-question configuration for advanced personality customization.
                    Full control over every aspect of your AI's behavior and responses.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-purple-700 dark:text-purple-300">
                    <li>• Advanced tone sliders and voice characteristics</li>
                    <li>• Detailed content policies and safety settings</li>
                    <li>• Custom phrase patterns and language preferences</li>
                    <li>• Citation policies and evidence handling</li>
                    <li>• Multilingual support and uncertainty handling</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>

          <ProForm
            onSubmit={handleSaveConfig}
            onCancel={handleCancel}
            initialData={currentConfig || {}}
          />
        </TabsContent>

        <TabsContent value="speech">
          <div className="mb-6">
            <Card className="p-6 bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-800/30">
              <div className="flex items-start gap-4">
                <Mic className="h-8 w-8 text-green-400 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Speech Pattern Analysis</h3>
                  <p className="text-gray-700 dark:text-neutral-300 mt-2">
                    Extract your unique speaking style directly from your video transcripts. This AI-powered analysis 
                    identifies your catchphrases, opening/closing patterns, and vocabulary preferences to make your AI replica sound more authentic.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-green-700 dark:text-green-300">
                    <li>• Automatically extract catchphrases and signature phrases</li>
                    <li>• Identify opening and closing patterns</li>
                    <li>• Discover your preferred vocabulary and words you avoid</li>
                    <li>• Analyze sentence structure and speaking style</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>

          <SpeechPatternAnalyzer />
        </TabsContent>
      </Tabs>

      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span className="text-gray-900 dark:text-white">Saving AI configuration...</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}