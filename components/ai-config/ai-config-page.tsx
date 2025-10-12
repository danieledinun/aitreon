'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import UnifiedAIForm from './unified-ai-form'
import { Loader2, Settings, ArrowLeft, Mic } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState('config')

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

      {/* AI Setup Status Recap */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800/30">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-500" />
            Configuration Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700">
              <span className="text-sm text-gray-600 dark:text-neutral-300">AI Personality</span>
              <Badge variant={currentConfig?.personality ? "default" : "secondary"} className={currentConfig?.personality ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400"}>
                {currentConfig?.personality ? 'Configured' : 'Default'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700">
              <span className="text-sm text-gray-600 dark:text-neutral-300">Questions</span>
              <Badge variant={currentConfig?.suggested_questions ? "default" : "secondary"} className={currentConfig?.suggested_questions ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400"}>
                {currentConfig?.suggested_questions ? 'Configured' : 'None'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700">
              <span className="text-sm text-gray-600 dark:text-neutral-300">Voice Settings</span>
              <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400">
                Configure in Voice Settings
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-gray-100 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700">
          <TabsTrigger value="config" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="speech" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
            <Mic className="h-4 w-4" />
            Speech Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <UnifiedAIForm
            onSubmit={handleSaveConfig}
            onCancel={handleCancel}
            loading={saving}
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