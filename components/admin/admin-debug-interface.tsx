'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  MessageSquare, 
  Users, 
  Eye, 
  Edit, 
  Play,
  Save,
  RefreshCw,
  Terminal,
  Zap,
  BarChart3,
  Clock,
  TrendingUp,
  Activity
} from 'lucide-react'

interface Creator {
  id: string
  username: string
  displayName: string
  user: {
    name: string
    email: string
  }
  aiConfig?: any
  _count: {
    videos: number
    subscriptions: number
  }
}

interface AdminDebugInterfaceProps {
  creators: Creator[]
  adminEmail: string
}

export default function AdminDebugInterface({ creators, adminEmail }: AdminDebugInterfaceProps) {
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null)
  const [testQuery, setTestQuery] = useState('')
  const [testResponse, setTestResponse] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  
  // Voice agent states
  const [voiceBaseInstructions, setVoiceBaseInstructions] = useState('')
  const [voiceCompletePrompt, setVoiceCompletePrompt] = useState('')
  const [voiceLoading, setVoiceLoading] = useState(false)
  
  // Voice metrics states
  const [voiceMetrics, setVoiceMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')

  useEffect(() => {
    if (selectedCreator && activeTab === 'prompt') {
      generateSystemPrompt()
    }
    if (selectedCreator && activeTab === 'voice') {
      loadVoicePrompt()
    }
    if (activeTab === 'metrics') {
      loadVoiceMetrics()
    }
  }, [selectedCreator, activeTab])

  const generateSystemPrompt = async () => {
    if (!selectedCreator) return

    try {
      // Get admin token for authentication
      const adminToken = sessionStorage.getItem('admin_token')

      // Load current prompts for the selected creator
      const response = await fetch(`/api/admin/prompts?creatorId=${selectedCreator.id}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSystemPrompt(data.chat.systemPrompt || 'No chat system prompt configured yet')
        console.log(`✅ Chat prompts loaded for ${selectedCreator.displayName}:`, data.chat)
      } else {
        console.error('Failed to load chat prompts:', response.status)
        setSystemPrompt('Error loading chat system prompt')
      }
    } catch (error) {
      console.error('Error loading chat system prompt:', error)
      setSystemPrompt('Error loading chat system prompt')
    }
  }

  const testAiResponse = async () => {
    if (!selectedCreator || !testQuery.trim()) return
    
    setTestLoading(true)
    try {
      const response = await fetch('/api/admin/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: selectedCreator.id,
          message: testQuery
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setTestResponse(data.response)
      } else {
        setTestResponse('Error: Failed to generate response')
      }
    } catch (error) {
      setTestResponse(`Error: ${error}`)
    }
    setTestLoading(false)
  }

  const updateAiConfig = async (configData: any) => {
    if (!selectedCreator) return
    
    try {
      const response = await fetch('/api/admin/update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: selectedCreator.id,
          config: configData
        })
      })
      
      if (response.ok) {
        alert('Configuration updated successfully!')
        window.location.reload()
      } else {
        alert('Failed to update configuration')
      }
    } catch (error) {
      alert(`Error: ${error}`)
    }
  }

  const loadVoicePrompt = async () => {
    if (!selectedCreator) return

    setVoiceLoading(true)
    try {
      // Get admin token for authentication
      const adminToken = sessionStorage.getItem('admin_token')

      const response = await fetch(`/api/admin/prompts?creatorId=${selectedCreator.id}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setVoiceBaseInstructions(data.voice.voiceBaseInstructions || '')
        setVoiceCompletePrompt(data.voice.voiceCompletePrompt || '')
        console.log(`✅ Voice prompts loaded for ${selectedCreator.displayName}:`, data.voice)
      } else {
        console.error('Failed to load voice prompts:', response.status)
      }
    } catch (error) {
      console.error('Error loading voice prompt:', error)
    }
    setVoiceLoading(false)
  }

  const updateVoicePrompt = async () => {
    if (!voiceBaseInstructions.trim()) return
    
    setVoiceLoading(true)
    try {
      // Get admin token for authentication
      const adminToken = sessionStorage.getItem('admin_token')
      
      const response = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          type: 'voice',
          prompt: voiceBaseInstructions
        })
      })
      
      if (response.ok) {
        alert('Voice agent system prompt updated successfully!')
        await loadVoicePrompt() // Reload to show updated complete prompt
      } else {
        alert('Failed to update voice agent prompt')
      }
    } catch (error) {
      alert(`Error: ${error}`)
    }
    setVoiceLoading(false)
  }

  const updateChatPrompt = async () => {
    if (!systemPrompt.trim()) return
    
    try {
      // Get admin token for authentication
      const adminToken = sessionStorage.getItem('admin_token')
      
      const response = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          type: 'chat',
          prompt: systemPrompt
        })
      })
      
      if (response.ok) {
        alert('Chat agent system prompt updated successfully!')
        await generateSystemPrompt() // Reload to show updated prompt
      } else {
        alert('Failed to update chat agent prompt')
      }
    } catch (error) {
      alert(`Error: ${error}`)
    }
  }

  const loadVoiceMetrics = async () => {
    setMetricsLoading(true)
    setMetricsError('')
    try {
      // Get admin token for authentication
      const adminToken = sessionStorage.getItem('admin_token')
      const headers: Record<string, string> = {}
      
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`
      }

      const response = await fetch('/api/admin/voice-metrics?limit=100', { headers })
      
      if (response.ok) {
        const data = await response.json()
        setVoiceMetrics(data)
      } else {
        setMetricsError('Failed to load voice metrics')
      }
    } catch (error) {
      console.error('Error loading voice metrics:', error)
      setMetricsError('Error loading voice metrics')
    }
    setMetricsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Terminal className="h-7 w-7 text-red-600" />
                Super Admin Debug Console
              </h1>
              <p className="text-gray-600">Debug and configure AI agents • Admin: {adminEmail}</p>
            </div>
            <Badge variant="destructive" className="px-3 py-1">
              ADMIN ONLY
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Creator List */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Creators ({creators.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {creators.map((creator) => (
                  <div
                    key={creator.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCreator?.id === creator.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedCreator(creator)}
                  >
                    <div className="font-medium text-sm">{creator.displayName}</div>
                    <div className="text-xs text-gray-500">@{creator.username}</div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {creator._count?.videos || 0} videos
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {creator._count?.subscriptions || 0} subs
                      </Badge>
                      <Badge 
                        variant={creator.aiConfig ? "default" : "secondary"} 
                        className="text-xs"
                      >
                        {creator.aiConfig ? "AI ✓" : "No AI"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Main Debug Interface */}
          <div className="lg:col-span-3">
            {selectedCreator ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold">{selectedCreator.displayName}</h2>
                    <p className="text-gray-600">@{selectedCreator.username} • {selectedCreator.user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{selectedCreator._count?.videos || 0} videos processed</Badge>
                    <Badge>{selectedCreator._count?.subscriptions || 0} subscribers</Badge>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-7">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="config">AI Config</TabsTrigger>
                    <TabsTrigger value="prompt">Chat Prompt</TabsTrigger>
                    <TabsTrigger value="voice">Voice Prompt</TabsTrigger>
                    <TabsTrigger value="test">Test Chat</TabsTrigger>
                    <TabsTrigger value="metrics">Voice Metrics</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">AI Status</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {selectedCreator.aiConfig ? (
                            <span className="text-green-600">Configured</span>
                          ) : (
                            <span className="text-gray-400">Not Set</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {selectedCreator.aiConfig ? 'AI personality active' : 'Using default behavior'}
                        </div>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Knowledge Base</span>
                        </div>
                        <div className="text-2xl font-bold">{selectedCreator._count?.videos || 0}</div>
                        <div className="text-sm text-gray-500">Processed videos</div>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-purple-600" />
                          <span className="font-medium">Engagement</span>
                        </div>
                        <div className="text-2xl font-bold">{selectedCreator._count?.subscriptions || 0}</div>
                        <div className="text-sm text-gray-500">Active subscribers</div>
                      </Card>
                    </div>

                    {selectedCreator.aiConfig && (
                      <Card className="p-4">
                        <h4 className="font-medium mb-3">AI Configuration Summary</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Agent Name:</span>
                            <span className="ml-2">{selectedCreator.aiConfig.agentName || 'Not set'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Directness:</span>
                            <span className="ml-2">{selectedCreator.aiConfig.directness || 3}/5</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Humor:</span>
                            <span className="ml-2">{selectedCreator.aiConfig.humor || 3}/5</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Format:</span>
                            <span className="ml-2">{selectedCreator.aiConfig.formatDefault || 'BULLETS'}</span>
                          </div>
                        </div>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="config" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">AI Configuration</h3>
                      <Button onClick={() => window.open(`/creator/ai-config`, '_blank')}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Config
                      </Button>
                    </div>
                    
                    {selectedCreator.aiConfig ? (
                      <div className="space-y-4">
                        <Card className="p-4">
                          <h4 className="font-medium mb-3">Identity & Personality</h4>
                          <div className="space-y-2 text-sm">
                            <div>
                              <strong>Agent Name:</strong> {selectedCreator.aiConfig.agentName || 'Not set'}
                            </div>
                            <div>
                              <strong>Intro:</strong> {selectedCreator.aiConfig.agentIntro || 'Not set'}
                            </div>
                            <div className="grid grid-cols-5 gap-4 mt-3">
                              <div>Directness: <Badge>{selectedCreator.aiConfig.directness || 3}/5</Badge></div>
                              <div>Humor: <Badge>{selectedCreator.aiConfig.humor || 3}/5</Badge></div>
                              <div>Empathy: <Badge>{selectedCreator.aiConfig.empathy || 3}/5</Badge></div>
                              <div>Formality: <Badge>{selectedCreator.aiConfig.formality || 3}/5</Badge></div>
                              <div>Spiciness: <Badge>{selectedCreator.aiConfig.spiciness || 3}/5</Badge></div>
                            </div>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h4 className="font-medium mb-3">Content Preferences</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Sentence Length:</strong> {selectedCreator.aiConfig.sentenceLength || 'MEDIUM'}
                            </div>
                            <div>
                              <strong>Format:</strong> {selectedCreator.aiConfig.formatDefault || 'BULLETS'}
                            </div>
                            <div>
                              <strong>Emojis:</strong> {selectedCreator.aiConfig.useEmojis || 'SOMETIMES'}
                            </div>
                            <div>
                              <strong>Citation Policy:</strong> {selectedCreator.aiConfig.citationPolicy || 'FACTUAL'}
                            </div>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h4 className="font-medium mb-3">Language & Phrases</h4>
                          <div className="space-y-2 text-sm">
                            {selectedCreator.aiConfig.catchphrases && (
                              <div>
                                <strong>Catchphrases:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {JSON.parse(selectedCreator.aiConfig.catchphrases || '[]').map((phrase: string, idx: number) => (
                                    <Badge key={idx} variant="outline">{phrase}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selectedCreator.aiConfig.avoidWords && (
                              <div>
                                <strong>Avoid Words:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {JSON.parse(selectedCreator.aiConfig.avoidWords || '[]').map((word: string, idx: number) => (
                                    <Badge key={idx} variant="destructive">{word}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>
                    ) : (
                      <Card className="p-6 text-center">
                        <p className="text-gray-500 mb-4">No AI configuration found for this creator</p>
                        <Button onClick={() => window.open(`/creator/ai-config`, '_blank')}>
                          Create Configuration
                        </Button>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="prompt" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Complete System Prompt</h3>
                      <div className="flex gap-2">
                        <Button onClick={generateSystemPrompt} disabled={!selectedCreator}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate
                        </Button>
                        <Button onClick={updateChatPrompt} disabled={!systemPrompt}>
                          <Save className="h-4 w-4 mr-2" />
                          Update Chat Agent
                        </Button>
                        <Button 
                          onClick={() => navigator.clipboard.writeText(systemPrompt)}
                          disabled={!systemPrompt}
                          variant="outline"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    
                    <Card className="p-4">
                      <div className="space-y-2">
                        <Label htmlFor="sampleQuery">Sample Query (affects context generation)</Label>
                        <Input
                          id="sampleQuery"
                          value={testQuery}
                          onChange={(e) => setTestQuery(e.target.value)}
                          placeholder="What's your best advice for beginners?"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              generateSystemPrompt()
                            }
                          }}
                        />
                        <div className="text-xs text-gray-500">
                          Press Enter to regenerate prompt with new query context
                        </div>
                      </div>
                    </Card>

                    {systemPrompt ? (
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="systemPrompt">Complete System Prompt (Live Preview)</Label>
                          <div className="text-xs text-gray-500">
                            {systemPrompt.length} chars • {systemPrompt.split('\n').length} lines
                          </div>
                        </div>
                        <Textarea
                          id="systemPrompt"
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          rows={25}
                          className="mt-2 font-mono text-xs leading-tight"
                          placeholder="System prompt will appear here..."
                        />
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-xs text-blue-800 font-medium mb-1">💬 Chat Agent Editing:</p>
                          <p className="text-xs text-blue-700">
                            This is the EXACT system prompt sent to GPT-4o for this creator's chat responses. 
                            You can edit this prompt directly and click "Update Chat Agent" to save custom instructions.
                            The chat agent will use your custom prompt for all future conversations.
                          </p>
                        </div>
                      </Card>
                    ) : (
                      <Card className="p-8 text-center border-dashed">
                        <Terminal className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 mb-3">No system prompt generated yet</p>
                        <Button onClick={generateSystemPrompt} disabled={!selectedCreator}>
                          Generate System Prompt
                        </Button>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="test" className="space-y-4">
                    <h3 className="text-lg font-medium">Test AI Response</h3>
                    
                    <Card className="p-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="testQuery">Test Query</Label>
                          <Textarea
                            id="testQuery"
                            value={testQuery}
                            onChange={(e) => setTestQuery(e.target.value)}
                            rows={3}
                            className="mt-1"
                            placeholder="Ask a question to test the AI response..."
                          />
                        </div>
                        
                        <Button 
                          onClick={testAiResponse} 
                          disabled={!testQuery.trim() || testLoading}
                          className="w-full"
                        >
                          {testLoading ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          {testLoading ? 'Generating...' : 'Test AI Response'}
                        </Button>
                      </div>
                    </Card>

                    {testResponse && (
                      <Card className="p-4">
                        <Label>AI Response</Label>
                        <div className="mt-2 p-4 bg-gray-50 rounded-md whitespace-pre-wrap text-sm">
                          {testResponse}
                        </div>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="voice" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Voice Agent System Prompt</h3>
                      <div className="flex gap-2">
                        <Button onClick={loadVoicePrompt} disabled={!selectedCreator || voiceLoading}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${voiceLoading ? 'animate-spin' : ''}`} />
                          Reload
                        </Button>
                        <Button 
                          onClick={updateVoicePrompt}
                          disabled={!voiceBaseInstructions.trim() || voiceLoading}
                          variant="default"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Update Voice Agent
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Base Instructions - Editable */}
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="voiceBaseInstructions">Base Instructions (Editable)</Label>
                          <div className="text-xs text-gray-500">
                            {voiceBaseInstructions.length} chars
                          </div>
                        </div>
                        <Textarea
                          id="voiceBaseInstructions"
                          value={voiceBaseInstructions}
                          onChange={(e) => setVoiceBaseInstructions(e.target.value)}
                          rows={20}
                          className="font-mono text-xs leading-tight"
                          placeholder={voiceLoading ? "Loading voice agent instructions..." : "Voice agent base instructions will appear here..."}
                          disabled={voiceLoading}
                        />
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                          <p className="text-xs text-orange-800 font-medium mb-1">⚠️ Voice Agent Editing:</p>
                          <p className="text-xs text-orange-700">
                            This directly edits the Python voice agent file. Changes will apply to all future voice conversations.
                            The voice agent will need to be restarted to pick up changes.
                          </p>
                        </div>
                      </Card>

                      {/* Complete Prompt - Read Only */}
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="voiceCompletePrompt">Complete Voice Prompt (Preview)</Label>
                          <div className="text-xs text-gray-500">
                            {voiceCompletePrompt.length} chars
                          </div>
                        </div>
                        <Textarea
                          id="voiceCompletePrompt"
                          value={voiceCompletePrompt}
                          rows={20}
                          className="font-mono text-xs leading-tight bg-gray-50"
                          placeholder={voiceLoading ? "Loading complete prompt..." : "Complete voice prompt with creator personalizations will appear here..."}
                          disabled={true}
                        />
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-xs text-blue-800 font-medium mb-1">🎤 Voice Agent Info:</p>
                          <p className="text-xs text-blue-700">
                            This is the complete system prompt used by the voice agent, including base instructions plus 
                            creator-specific AI configuration (personality traits, catchphrases, etc.).
                          </p>
                        </div>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="metrics" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Voice Agent Metrics & Latency</h3>
                      <Button onClick={loadVoiceMetrics} disabled={metricsLoading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
                        {metricsLoading ? 'Loading...' : 'Refresh Metrics'}
                      </Button>
                    </div>

                    {metricsError && (
                      <Card className="p-4 border-red-200 bg-red-50">
                        <p className="text-red-600">❌ {metricsError}</p>
                      </Card>
                    )}

                    {voiceMetrics ? (
                      <div className="space-y-6">
                        {/* Aggregate Metrics Overview */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-sm">Total Sessions</span>
                            </div>
                            <div className="text-2xl font-bold">{voiceMetrics.aggregate?.totalSessions || 0}</div>
                            <div className="text-xs text-gray-500">
                              {voiceMetrics.aggregate?.sessionsToday || 0} today
                            </div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-sm">Avg EOU Delay</span>
                            </div>
                            <div className="text-2xl font-bold">
                              {voiceMetrics.aggregate?.averageEouDelay?.toFixed(2) || '0.00'}s
                            </div>
                            <div className="text-xs text-gray-500">Response latency</div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-4 w-4 text-purple-600" />
                              <span className="font-medium text-sm">P95 Latency</span>
                            </div>
                            <div className="text-2xl font-bold">
                              {voiceMetrics.aggregate?.p95EouDelay?.toFixed(2) || '0.00'}s
                            </div>
                            <div className="text-xs text-gray-500">95th percentile</div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-orange-600" />
                              <span className="font-medium text-sm">Total Turns</span>
                            </div>
                            <div className="text-2xl font-bold">{voiceMetrics.aggregate?.totalTurns || 0}</div>
                            <div className="text-xs text-gray-500">Conversation turns</div>
                          </Card>
                        </div>

                        {/* Recent Sessions */}
                        <Card className="p-6">
                          <h4 className="font-medium mb-4 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Recent Voice Sessions ({voiceMetrics.sessions?.length || 0})
                          </h4>
                          
                          {voiceMetrics.sessions && voiceMetrics.sessions.length > 0 ? (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {voiceMetrics.sessions.slice(0, 20).map((session, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      Room: {session.room_name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      User: {session.user_id} • {new Date(session.session_start).toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium">
                                      {session.average_eou_delay?.toFixed(2)}s avg
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {session.total_turns} turns • {Math.floor(session.session_duration / 60)}m{Math.floor(session.session_duration % 60)}s
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <Badge 
                                      variant={session.average_eou_delay < 2 ? 'default' : 
                                              session.average_eou_delay < 4 ? 'secondary' : 'destructive'}
                                    >
                                      {session.average_eou_delay < 2 ? 'Fast' : 
                                       session.average_eou_delay < 4 ? 'Good' : 'Slow'}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No voice session data available</p>
                              <p className="text-xs">Voice metrics will appear here after voice calls</p>
                            </div>
                          )}
                        </Card>

                        {/* Performance Insights */}
                        {voiceMetrics.aggregate && voiceMetrics.aggregate.totalSessions > 0 && (
                          <Card className="p-6">
                            <h4 className="font-medium mb-4">Performance Insights</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Latency Distribution</div>
                                <div className="text-xs text-gray-600">
                                  • Average: {voiceMetrics.aggregate.averageEouDelay.toFixed(2)}s
                                </div>
                                <div className="text-xs text-gray-600">
                                  • Median: {voiceMetrics.aggregate.medianEouDelay.toFixed(2)}s
                                </div>
                                <div className="text-xs text-gray-600">
                                  • 95th Percentile: {voiceMetrics.aggregate.p95EouDelay.toFixed(2)}s
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Session Stats</div>
                                <div className="text-xs text-gray-600">
                                  • Average Duration: {Math.floor(voiceMetrics.aggregate.averageSessionDuration / 60)}m{Math.floor(voiceMetrics.aggregate.averageSessionDuration % 60)}s
                                </div>
                                <div className="text-xs text-gray-600">
                                  • Average Turns/Session: {(voiceMetrics.aggregate.totalTurns / voiceMetrics.aggregate.totalSessions).toFixed(1)}
                                </div>
                                <div className="text-xs text-gray-600">
                                  • Sessions Today: {voiceMetrics.aggregate.sessionsToday}
                                </div>
                              </div>
                            </div>
                          </Card>
                        )}
                        
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-xs text-blue-800 font-medium mb-1">📊 EOU (End of Utterance) Metrics:</p>
                          <p className="text-xs text-blue-700">
                            EOU delay measures the time from when a user stops speaking until the AI completes its response. 
                            Lower values indicate more responsive conversations. Target: &lt;2s excellent, &lt;4s acceptable.
                          </p>
                        </div>
                      </div>
                    ) : metricsLoading ? (
                      <Card className="p-8 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500">Loading voice metrics...</p>
                      </Card>
                    ) : (
                      <Card className="p-8 text-center">
                        <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 mb-3">No voice metrics loaded</p>
                        <Button onClick={loadVoiceMetrics}>Load Voice Metrics</Button>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="analytics" className="space-y-4">
                    <h3 className="text-lg font-medium">Analytics & Usage</h3>
                    <Card className="p-4">
                      <p className="text-gray-500">Analytics features coming soon...</p>
                    </Card>
                  </TabsContent>
                </Tabs>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <Terminal className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Creator</h3>
                <p className="text-gray-500">Choose a creator from the list to debug their AI configuration</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}